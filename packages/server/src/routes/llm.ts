import { Router } from 'express';
import crypto from 'crypto';
import { callLLM, LLMStreamChunk } from '@oxygen-claw/core';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth';
import { runQuery, runInsert, runExec } from '../services/db';
import { analyzeImage, analyzeVideo, transcribeAudio, synthesizeSpeech } from '../services/multimodal';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface ModelConfig {
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsImageGeneration?: boolean;
  modality?: string;
  costPer1KInput: number;
  costPer1KOutput: number;
}

function inferSupportsVision(model: any): boolean {
  const name = (model.name || '').toLowerCase();
  return !!model.supportsVision || name === 'step-3.7-flash' || name.includes('vision') || name.includes('vl');
}

function inferModality(model: any): string {
  if (model.modality) return model.modality;
  const name = (model.name || '').toLowerCase();
  if (name.includes('asr') || name.includes('transcribe') || name.includes('whisper')) return 'audio-transcription';
  if (name.includes('tts') || name.includes('speech') || name.includes('audio-tts')) return 'audio-speech';
  if (name.includes('realtime')) return 'realtime';
  if (name.includes('image-edit') || name.includes('image-gen') || model.supportsImageGeneration) return 'image-generation';
  if (inferSupportsVision(model)) return 'vision';
  return 'text';
}

function buildModelConfig(provider: any, model: any): ModelConfig {
  return {
    name: model.name,
    provider: provider.type === 'openai-compatible' ? 'openai' : provider.type,
    apiKey: provider.api_key,
    baseUrl: provider.base_url,
    maxTokens: model.max_output || 4096,
    supportsVision: !!model.supports_vision,
    supportsTools: !!model.supports_tools,
    supportsImageGeneration: !!model.supports_image_generation,
    modality: model.modality || 'text',
    costPer1KInput: model.cost_per_1k_input || 0,
    costPer1KOutput: model.cost_per_1k_output || 0
  };
}

function getModelById(modelId: string, userId?: string): { provider: any; model: any } | null {
  const parts = modelId.split(':');
  if (parts.length < 2) return null;
  
  const providerId = parts[0];
  const modelName = parts.slice(1).join(':');
  
  let provider: any;
  if (userId) {
    provider = runQuery('SELECT * FROM model_providers WHERE id = ? AND (user_id = ? OR user_id IS NULL)', [providerId, userId])[0];
  } else {
    provider = runQuery('SELECT * FROM model_providers WHERE id = ? AND user_id IS NULL', [providerId])[0];
  }
  
  if (!provider) return null;
  
  let model: any;
  model = runQuery('SELECT * FROM models WHERE provider_id = ? AND name = ? AND enabled = 1', [providerId, modelName])[0];
  
  if (!model) return null;
  
  return { provider, model };
}

function getUserSettings(userId?: string): any {
  if (!userId) {
    return null;
  }
  return runQuery('SELECT * FROM settings WHERE user_id = ?', [userId])[0] || null;
}

function decryptSettingsSecret(value: any) {
  if (typeof value !== 'string' || !value.startsWith('encrypted:aes256-gcm:')) return value;
  try {
    const key = crypto.createHash('sha256').update(process.env.SETTINGS_ENCRYPTION_KEY || 'oxygen-claw-local-settings-key').digest();
    const payload = Buffer.from(value.replace('encrypted:aes256-gcm:', ''), 'base64');
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function isImageContent(content: any): content is Array<any> {
  return Array.isArray(content) && content.some((item: any) => item.type === 'image_url');
}

function extractImageBase64(imageUrl: string): string | null {
  const match = imageUrl.match(/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,(.+)$/);
  if (match) {
    return match[1];
  }
  return null;
}

function extractBase64Payload(value: string): { data: string; format?: string } {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { data: value };
  const mime = match[1];
  return { data: match[2], format: mime.split('/')[1] };
}

async function processMultimodalMessages(
  messages: any[],
  modelConfig: ModelConfig,
  settings: any
): Promise<any[]> {
  const visionEnabled = settings?.vision_enabled === 1 || settings?.vision_enabled === true;
  const useDedicatedVision = visionEnabled && settings?.vision_api_key && !modelConfig.supportsVision;

  if (!useDedicatedVision) {
    return messages;
  }

  const processedMessages: any[] = [];

  for (const msg of messages) {
    if (isImageContent(msg.content)) {
      let textParts: string[] = [];
      const images: string[] = [];

      for (const part of msg.content) {
        if (part.type === 'text') {
          textParts.push(part.text || '');
        } else if (part.type === 'image_url') {
          const url = part.image_url?.url || '';
          const base64 = extractImageBase64(url);
          if (base64) {
            images.push(base64);
          }
        }
      }

      let combinedText = textParts.join('\n');

      if (images.length > 0) {
        const visionPrompt = combinedText || '请描述这张图片的内容';
        try {
          const visionResult = await analyzeImage(
            settings.vision_api_key,
            settings.vision_base_url || 'https://api.stepfun.com/step_plan/v1',
            settings.vision_model || 'step-3.7-flash',
            images[0],
            visionPrompt
          );
          combinedText = `${combinedText ? combinedText + '\n\n' : ''}[图片识别结果: ${visionResult.content}]`;
        } catch (err: any) {
          console.error('[LLM] Vision analysis failed:', err);
          combinedText = `${combinedText ? combinedText + '\n\n' : ''}[图片识别失败: ${err.message}]`;
        }
      }

      processedMessages.push({
        role: msg.role,
        content: combinedText
      });
    } else {
      processedMessages.push(msg);
    }
  }

  return processedMessages;
}

router.post('/chat/completions', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { model: modelId, messages, temperature, maxTokens, stream = false } = req.body;

    if (!modelId || !messages) {
      return res.status(400).json({
        success: false,
        error: 'Model and messages are required'
      });
    }

    const modelData = getModelById(modelId, req.userId);
    if (!modelData) {
      return res.status(404).json({
        success: false,
        error: 'Model not found or not enabled'
      });
    }

    const modelConfig = buildModelConfig(modelData.provider, modelData.model);
    const settings = getUserSettings(req.userId);
    const processedMessages = await processMultimodalMessages(messages, modelConfig, settings);

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullContent = '';
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      try {
        const result = await callLLM(modelConfig as any, processedMessages, {
          temperature: temperature ?? 0.7,
          maxTokens: maxTokens ?? 4096,
          streaming: true,
          onChunk: (chunk: LLMStreamChunk) => {
            fullContent += chunk.content;
            res.write(`data: ${JSON.stringify({
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: modelId,
              choices: [{
                index: 0,
                delta: { content: chunk.content },
                finish_reason: chunk.done ? 'stop' : null
              }]
            })}\n\n`);
            
            if (chunk.done) {
              res.write(`data: [DONE]\n\n`);
              res.end();
              
              if (req.userId) {
                recordUsage(req.userId, modelId, messages.length, fullContent.length, 0);
              }
            }
          }
        });
        
        totalInputTokens = result.usage.promptTokens;
        totalOutputTokens = result.usage.completionTokens;
      } catch (error: any) {
        console.error('[LLM] Stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: error.message || 'LLM call failed'
          });
        } else {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        }
      }
    } else {
      const result = await callLLM(modelConfig as any, processedMessages, {
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 4096
      });

      if (req.userId) {
        recordUsage(req.userId, modelId, result.usage.promptTokens, result.usage.completionTokens, 0);
      }

      res.json({
        success: true,
        data: {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: result.content
            },
            finish_reason: result.finishReason || 'stop'
          }],
          usage: {
            prompt_tokens: result.usage.promptTokens,
            completion_tokens: result.usage.completionTokens,
            total_tokens: result.usage.totalTokens
          }
        }
      });
    }
  } catch (error: any) {
    console.error('[LLM] Chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'LLM call failed'
    });
  }
});

router.post('/image/generations', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { model: requestedModelId, prompt, n = 1, size, response_format, steps, cfg_scale, quality, negative_prompt, seed } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    const settings = getUserSettings(req.userId);
    let provider: any;
    let modelName: string;
    let modelId = requestedModelId || settings?.image_gen_model;

    if (modelId) {
      const modelData = getModelById(modelId, req.userId);
      if (!modelData) {
        return res.status(404).json({ success: false, error: 'Model not found or not enabled' });
      }
      if (!modelData.model.supports_image_generation) {
        return res.status(400).json({ success: false, error: 'Selected model does not support image generation' });
      }
      provider = modelData.provider;
      modelName = modelData.model.name;
    } else {
      if (!settings?.image_gen_enabled || !settings?.image_gen_api_key || !settings?.image_gen_base_url || !settings?.image_gen_model) {
        return res.status(400).json({ success: false, error: 'Image generation model is not configured' });
      }
      provider = { api_key: decryptSettingsSecret(settings.image_gen_api_key), base_url: settings.image_gen_base_url, id: 'settings:image-generation' };
      modelName = settings.image_gen_model;
      modelId = `settings:${modelName}`;
    }

    const baseUrl = String(provider.base_url || '').replace(/\/+$/, '');
    const endpoint = `${baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`}/images/generations`;
    const startedAt = Date.now();
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model: modelName,
        prompt,
        n,
        size: size || settings?.image_gen_default_size || '1024x1024',
        ...(steps !== undefined ? { steps } : {}),
        ...(cfg_scale !== undefined ? { cfg_scale } : {}),
        ...(quality ? { quality } : {}),
        ...(negative_prompt ? { negative_prompt } : {}),
        ...(seed !== undefined ? { seed } : {}),
        ...(response_format ? { response_format } : {}),
      }),
    });

    const data: any = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        error: data?.error?.message || data?.error || data?.message || `Image generation failed with HTTP ${upstream.status}`,
      });
    }

    if (req.userId) {
      recordImageUsage(req.userId, provider.id, modelId, Number(n) || 1, size || settings?.image_gen_default_size || '1024x1024', Date.now() - startedAt);
    }

    res.json({
      success: true,
      data: {
        created: data?.created || Math.floor(Date.now() / 1000),
        data: data?.data || [],
      },
    });
  } catch (error: any) {
    console.error('[LLM] Image generation error:', error);
    res.status(500).json({ success: false, error: error.message || 'Image generation failed' });
  }
});

function recordImageUsage(userId: string, providerId: string, model: string, imageCount: number, resolution: string, latencyMs: number) {
  const today = new Date().toISOString().split('T')[0];
  const existing = runQuery(
    'SELECT id FROM usage_stats WHERE user_id = ? AND date = ? AND model = ? AND operation_type = ?',
    [userId, today, model, 'image_generation']
  )[0] as any;

  if (existing) {
    runExec(`
      UPDATE usage_stats
      SET requests = requests + 1,
          image_count = image_count + ?,
          latency_ms = ?
      WHERE id = ?
    `, [imageCount, latencyMs, existing.id]);
  } else {
    runInsert(`
      INSERT INTO usage_stats (user_id, date, requests, input_tokens, output_tokens, cost, model, operation_type, provider_id, image_count, resolution, latency_ms)
      VALUES (?, ?, 1, 0, 0, 0, ?, ?, ?, ?, ?, ?)
    `, [userId, today, model, 'image_generation', providerId, imageCount, resolution, latencyMs]);
  }
}

function recordAudioUsage(userId: string, providerId: string, model: string, operationType: 'audio_transcription' | 'audio_speech', audioSeconds: number, characterCount: number, latencyMs: number) {
  const today = new Date().toISOString().split('T')[0];
  const existing = runQuery(
    'SELECT id FROM usage_stats WHERE user_id = ? AND date = ? AND model = ? AND operation_type = ?',
    [userId, today, model, operationType]
  )[0] as any;

  if (existing) {
    runExec(`
      UPDATE usage_stats
      SET requests = requests + 1,
          audio_seconds = audio_seconds + ?,
          character_count = character_count + ?,
          latency_ms = ?
      WHERE id = ?
    `, [audioSeconds, characterCount, latencyMs, existing.id]);
  } else {
    runInsert(`
      INSERT INTO usage_stats (user_id, date, requests, input_tokens, output_tokens, cost, model, operation_type, provider_id, audio_seconds, character_count, latency_ms)
      VALUES (?, ?, 1, 0, 0, 0, ?, ?, ?, ?, ?, ?)
    `, [userId, today, model, operationType, providerId, audioSeconds, characterCount, latencyMs]);
  }
}

function recordVisionUsage(userId: string, providerId: string, model: string, operationType: 'image_analysis' | 'video_analysis', imageCount: number, videoFrames: number, latencyMs: number) {
  const today = new Date().toISOString().split('T')[0];
  const existing = runQuery(
    'SELECT id FROM usage_stats WHERE user_id = ? AND date = ? AND model = ? AND operation_type = ?',
    [userId, today, model, operationType]
  )[0] as any;

  if (existing) {
    runExec(`
      UPDATE usage_stats
      SET requests = requests + 1,
          image_count = image_count + ?,
          video_frames = video_frames + ?,
          latency_ms = ?
      WHERE id = ?
    `, [imageCount, videoFrames, latencyMs, existing.id]);
  } else {
    runInsert(`
      INSERT INTO usage_stats (user_id, date, requests, input_tokens, output_tokens, cost, model, operation_type, provider_id, image_count, video_frames, latency_ms)
      VALUES (?, ?, 1, 0, 0, 0, ?, ?, ?, ?, ?, ?)
    `, [userId, today, model, operationType, providerId, imageCount, videoFrames, latencyMs]);
  }
}

function resolveVisionModel(requestedModelId: string | undefined, settings: any, userId?: string) {
  if (requestedModelId && requestedModelId.includes(':') && !requestedModelId.startsWith('settings:')) {
    const modelData = getModelById(requestedModelId, userId);
    if (!modelData) return null;
    if (!modelData.model.supports_vision && modelData.model.modality !== 'vision') return null;
    return { provider: modelData.provider, modelName: modelData.model.name, modelId: requestedModelId };
  }

  if (!settings?.vision_api_key || !settings?.vision_base_url || !settings?.vision_model) return null;
  return {
    provider: { api_key: decryptSettingsSecret(settings.vision_api_key), base_url: settings.vision_base_url, id: 'settings:vision' },
    modelName: settings.vision_model,
    modelId: `settings:${settings.vision_model}`,
  };
}

router.post('/vision/images/analyze', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { model: requestedModelId, imageBase64, image, prompt = '请描述这张图片的内容', options } = req.body;
    const imageInput = imageBase64 || image;
    if (!imageInput) {
      return res.status(400).json({ success: false, error: 'imageBase64 is required' });
    }

    const settings = getUserSettings(req.userId);
    const resolved = resolveVisionModel(requestedModelId, settings, req.userId);
    if (!resolved) {
      return res.status(400).json({ success: false, error: 'Vision model is not configured or does not support vision' });
    }

    const imagePayload = extractBase64Payload(String(imageInput));
    const startedAt = Date.now();
    const result = await analyzeImage(resolved.provider.api_key, resolved.provider.base_url, resolved.modelName, imagePayload.data, prompt, options);
    const latencyMs = Date.now() - startedAt;

    if (req.userId) {
      recordVisionUsage(req.userId, resolved.provider.id, resolved.modelId, 'image_analysis', 1, 0, latencyMs);
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[LLM] Vision image analysis error:', error);
    res.status(500).json({ success: false, error: error.message || 'Image analysis failed' });
  }
});

router.post('/vision/videos/analyze', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { model: requestedModelId, videoData, videoBase64, videoUrl, prompt = '请描述这个视频的内容', frameCount = 0 } = req.body;
    const videoInput = videoData || (videoBase64 ? { type: 'base64', data: extractBase64Payload(String(videoBase64)).data } : videoUrl ? { type: 'url', data: videoUrl } : null);
    if (!videoInput?.type || !videoInput?.data) {
      return res.status(400).json({ success: false, error: 'videoData, videoBase64, or videoUrl is required' });
    }

    const settings = getUserSettings(req.userId);
    const resolved = resolveVisionModel(requestedModelId, settings, req.userId);
    if (!resolved) {
      return res.status(400).json({ success: false, error: 'Vision model is not configured or does not support vision' });
    }

    const startedAt = Date.now();
    const result = await analyzeVideo(resolved.provider.api_key, resolved.provider.base_url, resolved.modelName, videoInput, prompt);
    const latencyMs = Date.now() - startedAt;

    if (req.userId) {
      recordVisionUsage(req.userId, resolved.provider.id, resolved.modelId, 'video_analysis', 0, Number(frameCount) || 0, latencyMs);
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[LLM] Vision video analysis error:', error);
    res.status(500).json({ success: false, error: error.message || 'Video analysis failed' });
  }
});

router.post('/audio/transcriptions', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { model: requestedModelId, file, audio, format, language, prompt: transcriptionPrompt, response_format = 'json', temperature } = req.body;

    const audioInput = file || audio;
    if (!audioInput) {
      return res.status(400).json({ success: false, error: 'audio file (base64) is required' });
    }
    const audioPayload = extractBase64Payload(String(audioInput));

    const settings = getUserSettings(req.userId);
    let provider: any;
    let modelName: string;
    let modelId = requestedModelId || settings?.asr_model;

    if (requestedModelId && requestedModelId.includes(':') && !requestedModelId.startsWith('settings:')) {
      const modelData = getModelById(requestedModelId, req.userId);
      if (!modelData) {
        return res.status(404).json({ success: false, error: 'Model not found or not enabled' });
      }
      if (modelData.model.modality !== 'audio-transcription') {
        return res.status(400).json({ success: false, error: 'Selected model does not support audio transcription' });
      }
      provider = modelData.provider;
      modelName = modelData.model.name;
    } else {
      if (!settings?.asr_api_key || !settings?.asr_base_url || !settings?.asr_model) {
        return res.status(400).json({ success: false, error: 'ASR model is not configured' });
      }
      provider = { api_key: decryptSettingsSecret(settings.asr_api_key), base_url: settings.asr_base_url, id: 'settings:asr' };
      modelName = settings.asr_model;
      modelId = `settings:${modelName}`;
    }

    const startedAt = Date.now();
    const result = await transcribeAudio(provider.api_key, provider.base_url, modelName, audioPayload.data, format || audioPayload.format || 'mp3');
    const latencyMs = Date.now() - startedAt;

    const text = result.text || '';
    const audioSeconds = Math.max(1, Math.round(latencyMs / 1000));

    if (req.userId) {
      recordAudioUsage(req.userId, provider.id, modelId, 'audio_transcription', audioSeconds, text.length, latencyMs);
    }

    if (response_format === 'text') {
      res.setHeader('Content-Type', 'text/plain');
      res.send(text);
    } else if (response_format === 'verbose_json') {
      res.json({
        task: 'transcribe',
        language: language || 'auto',
        duration: audioSeconds,
        text,
      });
    } else {
      res.json({ text });
    }
  } catch (error: any) {
    console.error('[LLM] Audio transcription error:', error);
    res.status(500).json({ success: false, error: error.message || 'Audio transcription failed' });
  }
});

router.post('/audio/realtime/sessions', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { model: requestedModelId, voice, modalities = ['text', 'audio'], instructions } = req.body;
    if (!requestedModelId || !requestedModelId.includes(':')) {
      return res.status(400).json({ success: false, error: 'Realtime model id is required' });
    }

    const modelData = getModelById(requestedModelId, req.userId);
    if (!modelData) {
      return res.status(404).json({ success: false, error: 'Model not found or not enabled' });
    }
    if (modelData.model.modality !== 'realtime') {
      return res.status(400).json({ success: false, error: 'Selected model does not support realtime audio' });
    }

    res.json({
      success: true,
      data: {
        id: `rt_${Date.now()}`,
        object: 'realtime.session',
        model: modelData.model.name,
        providerId: modelData.provider.id,
        baseUrl: String(modelData.provider.base_url || '').replace(/\/+$/, ''),
        apiKeyRequired: true,
        modalities,
        voice,
        instructions,
        websocketUrl: `${String(modelData.provider.base_url || '').replace(/\/+$/, '').replace(/^http/, 'ws')}/realtime`,
      },
    });
  } catch (error: any) {
    console.error('[LLM] Realtime session error:', error);
    res.status(500).json({ success: false, error: error.message || 'Realtime session creation failed' });
  }
});

router.post('/audio/realtime/events', optionalAuth, async (_req: AuthRequest, res) => {
  res.status(501).json({
    success: false,
    error: 'Realtime event relay is not implemented yet; use /audio/realtime/sessions to resolve provider websocket metadata',
  });
});

router.post('/audio/speech', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { model: requestedModelId, input, voice, response_format = 'mp3', speed = 1.0 } = req.body;

    if (!input) {
      return res.status(400).json({ success: false, error: 'input text is required' });
    }

    const settings = getUserSettings(req.userId);
    let provider: any;
    let modelName: string;
    let modelId = requestedModelId || settings?.tts_model;
    let ttsVoice = voice || settings?.tts_voice;

    if (requestedModelId && requestedModelId.includes(':') && !requestedModelId.startsWith('settings:')) {
      const modelData = getModelById(requestedModelId, req.userId);
      if (!modelData) {
        return res.status(404).json({ success: false, error: 'Model not found or not enabled' });
      }
      if (modelData.model.modality !== 'audio-speech') {
        return res.status(400).json({ success: false, error: 'Selected model does not support speech synthesis' });
      }
      provider = modelData.provider;
      modelName = modelData.model.name;
    } else {
      if (!settings?.tts_api_key || !settings?.tts_base_url || !settings?.tts_model) {
        return res.status(400).json({ success: false, error: 'TTS model is not configured' });
      }
      provider = { api_key: decryptSettingsSecret(settings.tts_api_key), base_url: settings.tts_base_url, id: 'settings:tts' };
      modelName = settings.tts_model;
      modelId = `settings:${modelName}`;
    }

    const startedAt = Date.now();
    const result = await synthesizeSpeech(provider.api_key, provider.base_url, modelName, input, ttsVoice);
    const latencyMs = Date.now() - startedAt;

    const audioSeconds = Math.max(1, Math.round(latencyMs / 1000));

    if (req.userId) {
      recordAudioUsage(req.userId, provider.id, modelId, 'audio_speech', audioSeconds, input.length, latencyMs);
    }

    const audioBuffer = Buffer.from(result.audioBase64, 'base64');
    const mimeType = result.format === 'mp3' ? 'audio/mpeg' :
                     result.format === 'opus' ? 'audio/opus' :
                     result.format === 'wav' ? 'audio/wav' :
                     result.format === 'flac' ? 'audio/flac' : 'audio/mpeg';

    res.setHeader('Content-Type', mimeType);
    res.send(audioBuffer);
  } catch (error: any) {
    console.error('[LLM] Speech synthesis error:', error);
    res.status(500).json({ success: false, error: error.message || 'Speech synthesis failed' });
  }
});

function recordUsage(userId: string, model: string, inputTokens: number, outputTokens: number, cost: number) {
  const today = new Date().toISOString().split('T')[0];
  
  const existing = runQuery(
    'SELECT id FROM usage_stats WHERE user_id = ? AND date = ? AND model = ?',
    [userId, today, model]
  )[0] as any;

  if (existing) {
    runExec(`
      UPDATE usage_stats 
      SET requests = requests + 1, 
          input_tokens = input_tokens + ?, 
          output_tokens = output_tokens + ?, 
          cost = cost + ?
      WHERE id = ?
    `, [inputTokens, outputTokens, cost, existing.id]);
  } else {
    runInsert(`
      INSERT INTO usage_stats (user_id, date, requests, input_tokens, output_tokens, cost, model)
      VALUES (?, ?, 1, ?, ?, ?, ?)
    `, [userId, today, inputTokens, outputTokens, cost, model]);
  }
}

router.get('/models', optionalAuth, (req: AuthRequest, res) => {
  const userId = req.userId;

  let providers: any[];
  if (userId) {
    providers = runQuery('SELECT * FROM model_providers WHERE user_id = ? OR user_id IS NULL', [userId]);
  } else {
    providers = runQuery('SELECT * FROM model_providers WHERE user_id IS NULL');
  }

  const models: any[] = [];
  for (const provider of providers) {
    const providerModels = runQuery('SELECT * FROM models WHERE provider_id = ? AND enabled = 1', [provider.id]);
    for (const m of providerModels) {
      models.push({
        id: `${provider.id}:${m.name}`,
        name: m.name,
        displayName: m.display_name || m.name,
        provider: provider.type,
        providerId: provider.id,
        providerName: provider.name,
        supportsVision: !!m.supports_vision,
        supportsFiles: !!m.supports_files,
        supportsTools: !!m.supports_tools,
        supportsImageGeneration: !!m.supports_image_generation,
        modality: m.modality || 'text',
        contextWindow: m.context_window,
        maxOutput: m.max_output,
        costPer1KInput: m.cost_per_1k_input,
        costPer1KOutput: m.cost_per_1k_output
      });
    }
  }

  res.json({
    success: true,
    data: { models }
  });
});

function buildProviderWithModels(provider: any, models: any[]): any {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    apiKey: provider.api_key,
    baseUrl: provider.base_url,
    billingMultiplier: provider.billing_multiplier,
    createdAt: provider.created_at,
    updatedAt: provider.updated_at,
    models: models.map((m: any) => ({
      id: m.id,
      name: m.name,
      displayName: m.display_name,
      enabled: !!m.enabled,
      supportsVision: !!m.supports_vision,
      supportsFiles: !!m.supports_files,
      supportsTools: !!m.supports_tools,
      supportsImageGeneration: !!m.supports_image_generation,
      contextWindow: m.context_window,
      maxOutput: m.max_output,
      costPer1KInput: m.cost_per_1k_input,
      costPer1KOutput: m.cost_per_1k_output,
      createdAt: m.created_at
    }))
  };
}

router.get('/providers', optionalAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId;

    let providers: any[];
    if (userId) {
      providers = runQuery(
        'SELECT * FROM model_providers WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC',
        [userId]
      );
    } else {
      providers = runQuery(
        'SELECT * FROM model_providers WHERE user_id IS NULL ORDER BY created_at DESC'
      );
    }

    const result: any[] = [];
    for (const provider of providers) {
      const models = runQuery(
        'SELECT * FROM models WHERE provider_id = ? ORDER BY name',
        [provider.id]
      );
      result.push(buildProviderWithModels(provider, models));
    }

    res.json({
      success: true,
      data: { providers: result }
    });
  } catch (error: any) {
    console.error('[LLM] Get providers error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get providers'
    });
  }
});

router.post('/providers', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { name, type, apiKey, baseUrl, models = [], billingMultiplier = 1 } = req.body;

    if (!name || !type || !apiKey || !baseUrl) {
      return res.status(400).json({
        success: false,
        error: 'name, type, apiKey, baseUrl are required'
      });
    }

    const providerId = uuidv4();
    const now = Date.now();

    runInsert(
      `INSERT INTO model_providers (id, user_id, name, type, api_key, base_url, billing_multiplier, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [providerId, userId || null, name, type, apiKey, baseUrl, billingMultiplier, now, now]
    );

    for (const model of models) {
      const modelId = uuidv4();
      runInsert(
        `INSERT INTO models (id, provider_id, name, display_name, enabled, supports_vision, supports_files, supports_tools, supports_image_generation, capabilities, modality, context_window, max_output, cost_per_1k_input, cost_per_1k_output, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          modelId,
          providerId,
          model.name,
          model.displayName || model.name,
          model.enabled !== false ? 1 : 0,
          inferSupportsVision(model) ? 1 : 0,
          model.supportsFiles ? 1 : 0,
          model.supportsTools ? 1 : 0,
          model.supportsImageGeneration ? 1 : 0,
          JSON.stringify(model.capabilities || {}),
          inferModality(model),
          model.contextWindow || null,
          model.maxOutput || null,
          model.costPer1KInput || 0,
          model.costPer1KOutput || 0,
          now
        ]
      );
    }

    const provider = runQuery('SELECT * FROM model_providers WHERE id = ?', [providerId])[0];
    const createdModels = runQuery('SELECT * FROM models WHERE provider_id = ?', [providerId]);

    res.status(201).json({
      success: true,
      data: buildProviderWithModels(provider, createdModels)
    });
  } catch (error: any) {
    console.error('[LLM] Create provider error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create provider'
    });
  }
});

router.put('/providers/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const providerId = req.params.id;
    const { name, type, apiKey, baseUrl, models, billingMultiplier } = req.body;

    const provider = runQuery(
      'SELECT * FROM model_providers WHERE id = ? AND user_id = ?',
      [providerId, userId]
    )[0];

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }

    const now = Date.now();

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      updateValues.push(type);
    }
    if (apiKey !== undefined) {
      updateFields.push('api_key = ?');
      updateValues.push(apiKey);
    }
    if (baseUrl !== undefined) {
      updateFields.push('base_url = ?');
      updateValues.push(baseUrl);
    }
    if (billingMultiplier !== undefined) {
      updateFields.push('billing_multiplier = ?');
      updateValues.push(billingMultiplier);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = ?');
      updateValues.push(now);
      updateValues.push(providerId);

      runExec(
        `UPDATE model_providers SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    if (models && Array.isArray(models)) {
      runExec('DELETE FROM models WHERE provider_id = ?', [providerId]);

      for (const model of models) {
        const modelId = uuidv4();
        runInsert(
          `INSERT INTO models (id, provider_id, name, display_name, enabled, supports_vision, supports_files, supports_tools, supports_image_generation, capabilities, modality, context_window, max_output, cost_per_1k_input, cost_per_1k_output, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            modelId,
            providerId,
            model.name,
            model.displayName || model.name,
            model.enabled !== false ? 1 : 0,
            inferSupportsVision(model) ? 1 : 0,
            model.supportsFiles ? 1 : 0,
            model.supportsTools ? 1 : 0,
            model.supportsImageGeneration ? 1 : 0,
            JSON.stringify(model.capabilities || {}),
            inferModality(model),
            model.contextWindow || null,
            model.maxOutput || null,
            model.costPer1KInput || 0,
            model.costPer1KOutput || 0,
            now
          ]
        );
      }
    }

    const updatedProvider = runQuery('SELECT * FROM model_providers WHERE id = ?', [providerId])[0];
    const updatedModels = runQuery('SELECT * FROM models WHERE provider_id = ?', [providerId]);

    res.json({
      success: true,
      data: buildProviderWithModels(updatedProvider, updatedModels)
    });
  } catch (error: any) {
    console.error('[LLM] Update provider error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update provider'
    });
  }
});

router.delete('/providers/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const providerId = req.params.id;

    const provider = runQuery(
      'SELECT * FROM model_providers WHERE id = ? AND user_id = ?',
      [providerId, userId]
    )[0];

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }

    runExec('DELETE FROM models WHERE provider_id = ?', [providerId]);
    runExec('DELETE FROM model_providers WHERE id = ?', [providerId]);

    res.json({
      success: true,
      data: { message: 'Provider deleted successfully' }
    });
  } catch (error: any) {
    console.error('[LLM] Delete provider error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete provider'
    });
  }
});

router.post('/models/:id/toggle', authMiddleware, (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const modelId = req.params.id;

    const model = runQuery('SELECT * FROM models WHERE id = ?', [modelId])[0];
    if (!model) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }

    const provider = runQuery(
      'SELECT * FROM model_providers WHERE id = ? AND user_id = ?',
      [model.provider_id, userId]
    )[0];

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }

    const newEnabled = model.enabled ? 0 : 1;
    runExec('UPDATE models SET enabled = ? WHERE id = ?', [newEnabled, modelId]);

    const updatedModel = runQuery('SELECT * FROM models WHERE id = ?', [modelId])[0];

    res.json({
      success: true,
      data: {
        id: updatedModel.id,
        name: updatedModel.name,
        displayName: updatedModel.display_name,
        enabled: !!updatedModel.enabled,
        supportsVision: !!updatedModel.supports_vision,
        supportsFiles: !!updatedModel.supports_files,
        supportsTools: !!updatedModel.supports_tools,
        supportsImageGeneration: !!updatedModel.supports_image_generation,
        modality: updatedModel.modality || 'text',
        contextWindow: updatedModel.context_window,
        maxOutput: updatedModel.max_output,
        costPer1KInput: updatedModel.cost_per_1k_input,
        costPer1KOutput: updatedModel.cost_per_1k_output
      }
    });
  } catch (error: any) {
    console.error('[LLM] Toggle model error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to toggle model'
    });
  }
});

router.post('/providers/:id/test', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const providerId = req.params.id;

    let provider: any;
    if (userId) {
      provider = runQuery(
        'SELECT * FROM model_providers WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
        [providerId, userId]
      )[0];
    } else {
      provider = runQuery(
        'SELECT * FROM model_providers WHERE id = ? AND user_id IS NULL',
        [providerId]
      )[0];
    }

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }

    const models = runQuery(
      'SELECT * FROM models WHERE provider_id = ? AND enabled = 1 LIMIT 1',
      [providerId]
    );

    if (models.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No enabled models found for this provider'
      });
    }

    const model = models[0];
    const modelConfig = buildModelConfig(provider, model);

    try {
      const result = await callLLM(modelConfig as any, [
        { role: 'user', content: 'Hi, respond with just "OK"' }
      ], {
        temperature: 0,
        maxTokens: 10
      });

      res.json({
        success: true,
        data: {
          message: 'Connection test successful',
          response: result.content?.slice(0, 100)
        }
      });
    } catch (testError: any) {
      res.json({
        success: false,
        error: testError.message || 'Connection test failed'
      });
    }
  } catch (error: any) {
    console.error('[LLM] Test provider error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test provider'
    });
  }
});

export default router;
