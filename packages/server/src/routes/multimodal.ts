import { Router } from 'express';
import crypto from 'crypto';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { runQuery } from '../services/db';
import { analyzeImage, analyzeVideo, transcribeAudio, synthesizeSpeech } from '../services/multimodal';

const router = Router();

function getUserSettings(userId?: string) {
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

router.post('/analyze-image', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { imageBase64, prompt, options } = req.body;

    if (!imageBase64 || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'imageBase64 and prompt are required',
      });
    }

    const settings = getUserSettings(req.userId);

    let apiKey = decryptSettingsSecret(settings?.vision_api_key);
    let baseUrl = settings?.vision_base_url || 'https://api.stepfun.com/step_plan/v1';
    let model = settings?.vision_model || 'step-3.7-flash';

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Vision API key is not configured',
      });
    }

    const result = await analyzeImage(apiKey, baseUrl, model, imageBase64, prompt, options);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Multimodal] Image analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Image analysis failed',
    });
  }
});

router.post('/analyze-video', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { videoData, prompt } = req.body;

    if (!videoData || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'videoData and prompt are required',
      });
    }

    if (!videoData.type || !videoData.data) {
      return res.status(400).json({
        success: false,
        error: 'videoData must have type and data fields',
      });
    }

    const settings = getUserSettings(req.userId);

    let apiKey = decryptSettingsSecret(settings?.vision_api_key);
    let baseUrl = settings?.vision_base_url || 'https://api.stepfun.com/step_plan/v1';
    let model = settings?.vision_model || 'step-3.7-flash';

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Vision API key is not configured',
      });
    }

    const result = await analyzeVideo(apiKey, baseUrl, model, videoData, prompt);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Multimodal] Video analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Video analysis failed',
    });
  }
});

router.post('/transcribe', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { audioBase64, format } = req.body;

    if (!audioBase64) {
      return res.status(400).json({
        success: false,
        error: 'audioBase64 is required',
      });
    }

    const settings = getUserSettings(req.userId);

    let apiKey = decryptSettingsSecret(settings?.asr_api_key);
    let baseUrl = settings?.asr_base_url || 'https://api.stepfun.com/step_plan/v1';
    let model = settings?.asr_model || 'stepaudio-2.5-asr';

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'ASR API key is not configured',
      });
    }

    const result = await transcribeAudio(apiKey, baseUrl, model, audioBase64, format);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Multimodal] Transcription error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Audio transcription failed',
    });
  }
});

router.post('/synthesize', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required',
      });
    }

    const settings = getUserSettings(req.userId);

    let apiKey = decryptSettingsSecret(settings?.tts_api_key);
    let baseUrl = settings?.tts_base_url || 'https://api.stepfun.com/step_plan/v1';
    let model = settings?.tts_model || 'stepaudio-2.5-tts';
    let ttsVoice = voice || settings?.tts_voice;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'TTS API key is not configured',
      });
    }

    const result = await synthesizeSpeech(apiKey, baseUrl, model, text, ttsVoice);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Multimodal] Synthesis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Speech synthesis failed',
    });
  }
});

export default router;
