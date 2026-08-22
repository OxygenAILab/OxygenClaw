import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { callLLM, LLMStreamChunk } from '@oxygen-claw/core';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { runQuery, runInsert, runExec } from '../services/db';
import { createRuntimeTask, createWorkerRun } from '../services/runtime';
import { runtimeWorkerManager } from '../services/runtimeWorkerManager';

const router = Router();

interface ModelConfig {
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  costPer1KInput: number;
  costPer1KOutput: number;
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
    provider = runQuery('SELECT * FROM model_providers WHERE id = ? AND user_id = ?', [providerId, userId])[0];
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

  const { analyzeImage } = await import('../services/multimodal');

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
          console.error('[Conversations] Vision analysis failed:', err);
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

function formatConversation(conv: any): any {
  return {
    id: conv.id,
    userId: conv.user_id,
    title: conv.title,
    mode: conv.mode,
    capability: conv.capability,
    modelId: conv.model_id,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at
  };
}

function formatMessage(msg: any): any {
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    role: msg.role,
    content: msg.content,
    attachments: msg.attachments ? JSON.parse(msg.attachments) : null,
    timestamp: msg.timestamp
  };
}

router.get('/', optionalAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { mode } = req.query;

    let sql = 'SELECT * FROM conversations WHERE ';
    const params: any[] = [];

    if (userId) {
      sql += 'user_id = ?';
      params.push(userId);
    } else {
      sql += 'user_id IS NULL';
    }

    if (mode) {
      sql += ' AND mode = ?';
      params.push(mode);
    }

    sql += ' ORDER BY updated_at DESC LIMIT 50';

    const conversations = runQuery(sql, params);

    res.json({
      success: true,
      data: {
        conversations: conversations.map(formatConversation)
      }
    });
  } catch (error: any) {
    console.error('[Conversations] List error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get conversations'
    });
  }
});

router.post('/', optionalAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { title, modelId, mode = 'chat', capability = 'fast' } = req.body;

    if (!modelId) {
      return res.status(400).json({
        success: false,
        error: 'modelId is required'
      });
    }

    const conversationId = uuidv4();
    const now = Date.now();
    const conversationTitle = title || '新会话';

    runInsert(
      `INSERT INTO conversations (id, user_id, title, mode, capability, model_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [conversationId, userId || null, conversationTitle, mode, capability, modelId, now, now]
    );

    const conversation = runQuery('SELECT * FROM conversations WHERE id = ?', [conversationId])[0];

    res.status(201).json({
      success: true,
      data: formatConversation(conversation)
    });
  } catch (error: any) {
    console.error('[Conversations] Create error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create conversation'
    });
  }
});

router.get('/:id', optionalAuth, (req: AuthRequest, res, next) => {
  try {
    const conversationId = req.params.id;

    if (conversationId === 'search' || conversationId === 'suggestions') {
      return next();
    }

    const conversation = runQuery('SELECT * FROM conversations WHERE id = ?', [conversationId])[0] as any;

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    if (conversation.user_id && req.userId !== conversation.user_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const messages = runQuery(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
      [conversationId]
    );

    res.json({
      success: true,
      data: {
        conversation: formatConversation(conversation),
        messages: messages.map(formatMessage)
      }
    });
  } catch (error: any) {
    console.error('[Conversations] Get detail error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get conversation'
    });
  }
});

router.post('/:id/messages', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const { content, role = 'user', modelId: msgModelId, generate = true } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'content is required'
      });
    }

    const conversation = runQuery('SELECT * FROM conversations WHERE id = ?', [conversationId])[0] as any;

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    if (conversation.user_id && req.userId !== conversation.user_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const modelId = msgModelId || conversation.model_id;
    if (!modelId) {
      return res.status(400).json({
        success: false,
        error: 'No model specified'
      });
    }

    const modelData = getModelById(modelId, req.userId);
    if (!modelData) {
      return res.status(404).json({
        success: false,
        error: 'Model not found or not enabled'
      });
    }

    const userMessageId = uuidv4();
    const now = Date.now();

    runInsert(
      `INSERT INTO messages (id, conversation_id, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [userMessageId, conversationId, role, typeof content === 'string' ? content : JSON.stringify(content), now]
    );

    runExec('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId]);

    if (generate === false) {
      const message = runQuery('SELECT * FROM messages WHERE id = ?', [userMessageId])[0];
      return res.status(201).json({
        success: true,
        data: formatMessage(message)
      });
    }

    const previousMessages = runQuery(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
      [conversationId]
    );

    const messagesForLLM = previousMessages.map((msg: any) => {
      try {
        const parsed = JSON.parse(msg.content);
        if (Array.isArray(parsed) || (typeof parsed === 'object' && parsed.type)) {
          return { role: msg.role, content: parsed };
        }
      } catch {
        // not JSON, use as string
      }
      return { role: msg.role, content: msg.content };
    });

    const modelConfig = buildModelConfig(modelData.provider, modelData.model);
    const settings = getUserSettings(req.userId);
    const processedMessages = await processMultimodalMessages(messagesForLLM, modelConfig, settings);

    // 创建 runtime task，通过 worker manager 执行
    const assistantMessageId = uuidv4();
    const taskId = uuidv4();

    createRuntimeTask({
      id: taskId,
      userId: req.userId,
      conversationId,
      kind: 'chat',
      prompt: `Chat message in conversation ${conversationId}`,
      mode: 'chat',
      capability: 'chat',
      modelId,
      status: 'pending',
      metadata: {
        conversationId,
        messageId: assistantMessageId,
        providerId: modelData.provider.id,
        modelName: modelData.model.name
      },
    });

    const workerRunId = createWorkerRun(taskId, 'local-chat', {
      conversationId,
      messageId: assistantMessageId,
      modelId
    }, 'pending');

    runtimeWorkerManager.enqueue({
      taskId,
      workerRunId,
      workerType: 'local-chat',
      payload: {
        conversationId,
        messageId: assistantMessageId,
        messages: processedMessages,
        modelConfig,
        temperature: settings?.temperature ?? 0.7,
        maxTokens: settings?.max_tokens ?? 4096,
      },
      enqueuedAt: Date.now(),
    });

    res.status(202).json({
      success: true,
      data: {
        taskId,
        workerRunId,
        messageId: assistantMessageId,
        status: 'pending',
        eventsUrl: `/api/agent/tasks/${taskId}/events/live`
      }
    });
  } catch (error: any) {
    console.error('[Conversations] Send message error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send message'
      });
    }
  }
});

router.put('/:id', optionalAuth, (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const { title, modelId, mode, capability } = req.body;

    const conversation = runQuery('SELECT * FROM conversations WHERE id = ?', [conversationId])[0] as any;

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    if (conversation.user_id && req.userId !== conversation.user_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    if (modelId !== undefined) {
      updateFields.push('model_id = ?');
      updateValues.push(modelId);
    }
    if (mode !== undefined) {
      updateFields.push('mode = ?');
      updateValues.push(mode);
    }
    if (capability !== undefined) {
      updateFields.push('capability = ?');
      updateValues.push(capability);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    const now = Date.now();
    updateFields.push('updated_at = ?');
    updateValues.push(now);
    updateValues.push(conversationId);

    runExec(
      `UPDATE conversations SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updatedConversation = runQuery('SELECT * FROM conversations WHERE id = ?', [conversationId])[0];

    res.json({
      success: true,
      data: formatConversation(updatedConversation)
    });
  } catch (error: any) {
    console.error('[Conversations] Update error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update conversation'
    });
  }
});

router.delete('/:id', optionalAuth, (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;

    const conversation = runQuery('SELECT * FROM conversations WHERE id = ?', [conversationId])[0] as any;

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    if (conversation.user_id && req.userId !== conversation.user_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    runExec('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
    runExec('DELETE FROM conversations WHERE id = ?', [conversationId]);

    res.json({
      success: true,
      data: { message: 'Conversation deleted successfully' }
    });
  } catch (error: any) {
    console.error('[Conversations] Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete conversation'
    });
  }
});

// 搜索对话
router.get('/search', optionalAuth, (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { q, mode, limit = '20' } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    let sql = `
      SELECT DISTINCT c.* 
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE 
    `;
    const params: any[] = [];

    if (userId) {
      sql += 'c.user_id = ?';
      params.push(userId);
    } else {
      sql += 'c.user_id IS NULL';
    }

    sql += ' AND (c.title LIKE ? OR m.content LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);

    if (mode) {
      sql += ' AND c.mode = ?';
      params.push(mode);
    }

    sql += ' ORDER BY c.updated_at DESC LIMIT ?';
    params.push(parseInt(limit as string));

    const conversations = runQuery(sql, params);

    res.json({
      success: true,
      data: {
        conversations: conversations.map(formatConversation),
        total: conversations.length
      }
    });
  } catch (error: any) {
    console.error('[Conversations] Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search conversations'
    });
  }
});

// 编辑消息（重新生成之后的内容）
router.post('/:id/messages/:messageId/edit', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const messageId = req.params.messageId;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'content is required'
      });
    }

    const conversation = runQuery('SELECT * FROM conversations WHERE id = ?', [conversationId])[0] as any;
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    if (conversation.user_id && req.userId !== conversation.user_id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const message = runQuery('SELECT * FROM messages WHERE id = ? AND conversation_id = ?', [messageId, conversationId])[0] as any;
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // 删除该消息及其之后的所有消息
    runExec('DELETE FROM messages WHERE conversation_id = ? AND timestamp >= ?', [conversationId, message.timestamp]);

    // 插入编辑后的用户消息
    const now = Date.now();
    runInsert(
      `INSERT INTO messages (id, conversation_id, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [messageId, conversationId, 'user', typeof content === 'string' ? content : JSON.stringify(content), now]
    );

    runExec('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId]);

    // 重新获取上下文并生成回复
    const previousMessages = runQuery(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
      [conversationId]
    );

    const messagesForLLM = previousMessages.map((msg: any) => {
      try {
        const parsed = JSON.parse(msg.content);
        if (Array.isArray(parsed) || (typeof parsed === 'object' && parsed.type)) {
          return { role: msg.role, content: parsed };
        }
      } catch { /* not JSON */ }
      return { role: msg.role, content: msg.content };
    });

    const modelId = conversation.model_id;
    const modelData = getModelById(modelId, req.userId);
    if (!modelData) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }

    const modelConfig = buildModelConfig(modelData.provider, modelData.model);
    const settings = getUserSettings(req.userId);
    const processedMessages = await processMultimodalMessages(messagesForLLM, modelConfig, settings);

    // 创建 runtime task，通过 worker manager 执行
    const assistantMessageId = uuidv4();
    const taskId = uuidv4();

    createRuntimeTask({
      id: taskId,
      userId: req.userId,
      conversationId,
      kind: 'chat',
      prompt: `Chat edit in conversation ${conversationId}`,
      mode: 'chat',
      capability: 'chat',
      modelId,
      status: 'pending',
      metadata: {
        conversationId,
        messageId: assistantMessageId,
        providerId: modelData.provider.id,
        modelName: modelData.model.name
      },
    });

    const workerRunId = createWorkerRun(taskId, 'local-chat', {
      conversationId,
      messageId: assistantMessageId,
      modelId
    }, 'pending');

    runtimeWorkerManager.enqueue({
      taskId,
      workerRunId,
      workerType: 'local-chat',
      payload: {
        conversationId,
        messageId: assistantMessageId,
        messages: processedMessages,
        modelConfig,
        temperature: settings?.temperature ?? 0.7,
        maxTokens: settings?.max_tokens ?? 4096,
      },
      enqueuedAt: Date.now(),
    });

    res.status(202).json({
      success: true,
      data: {
        taskId,
        workerRunId,
        messageId: assistantMessageId,
        status: 'pending',
        eventsUrl: `/api/agent/tasks/${taskId}/events/live`
      }
    });
  } catch (error: any) {
    console.error('[Conversations] Edit message error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// 重新生成最后一条助手消息
router.post('/:id/regenerate', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;

    const conversation = runQuery('SELECT * FROM conversations WHERE id = ?', [conversationId])[0] as any;
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    if (conversation.user_id && req.userId !== conversation.user_id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // 找到最后一条助手消息并删除
    const lastAssistantMsg = runQuery(
      'SELECT * FROM messages WHERE conversation_id = ? AND role = ? ORDER BY timestamp DESC LIMIT 1',
      [conversationId, 'assistant']
    )[0] as any;

    if (lastAssistantMsg) {
      runExec('DELETE FROM messages WHERE id = ?', [lastAssistantMsg.id]);
    }

    // 重新生成
    const previousMessages = runQuery(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
      [conversationId]
    );

    if (previousMessages.length === 0) {
      return res.status(400).json({ success: false, error: 'No messages to regenerate from' });
    }

    const messagesForLLM = previousMessages.map((msg: any) => {
      try {
        const parsed = JSON.parse(msg.content);
        if (Array.isArray(parsed) || (typeof parsed === 'object' && parsed.type)) {
          return { role: msg.role, content: parsed };
        }
      } catch { /* not JSON */ }
      return { role: msg.role, content: msg.content };
    });

    const modelId = conversation.model_id;
    const modelData = getModelById(modelId, req.userId);
    if (!modelData) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }

    const modelConfig = buildModelConfig(modelData.provider, modelData.model);
    const settings = getUserSettings(req.userId);
    const processedMessages = await processMultimodalMessages(messagesForLLM, modelConfig, settings);

    // 创建 runtime task，通过 worker manager 执行
    const assistantMessageId = uuidv4();
    const taskId = uuidv4();

    createRuntimeTask({
      id: taskId,
      userId: req.userId,
      conversationId,
      kind: 'chat',
      prompt: `Chat regenerate in conversation ${conversationId}`,
      mode: 'chat',
      capability: 'chat',
      modelId,
      status: 'pending',
      metadata: {
        conversationId,
        messageId: assistantMessageId,
        providerId: modelData.provider.id,
        modelName: modelData.model.name
      },
    });

    const workerRunId = createWorkerRun(taskId, 'local-chat', {
      conversationId,
      messageId: assistantMessageId,
      modelId
    }, 'pending');

    runtimeWorkerManager.enqueue({
      taskId,
      workerRunId,
      workerType: 'local-chat',
      payload: {
        conversationId,
        messageId: assistantMessageId,
        messages: processedMessages,
        modelConfig,
        temperature: settings?.temperature ?? 0.7,
        maxTokens: settings?.max_tokens ?? 4096,
      },
      enqueuedAt: Date.now(),
    });

    res.status(202).json({
      success: true,
      data: {
        taskId,
        workerRunId,
        messageId: assistantMessageId,
        status: 'pending',
        eventsUrl: `/api/agent/tasks/${taskId}/events/live`
      }
    });
  } catch (error: any) {
    console.error('[Conversations] Regenerate error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// 自动生成对话标题
router.post('/:id/generate-title', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;

    const conversation = runQuery('SELECT * FROM conversations WHERE id = ?', [conversationId])[0] as any;
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    if (conversation.user_id && req.userId !== conversation.user_id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const messages = runQuery(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC LIMIT 10',
      [conversationId]
    );

    if (messages.length === 0) {
      return res.status(400).json({ success: false, error: 'No messages to generate title from' });
    }

    const modelId = conversation.model_id;
    const modelData = getModelById(modelId, req.userId);

    let title = '';

    if (modelData) {
      const modelConfig = buildModelConfig(modelData.provider, modelData.model);
      const firstUserMsg = messages.find((m: any) => m.role === 'user')?.content || '';
      const firstMsgText = typeof firstUserMsg === 'string' ? firstUserMsg.slice(0, 500) : '';

      try {
        const result = await callLLM(modelConfig as any, [
          {
            role: 'system',
            content: '你是一个对话标题生成器。根据用户的第一条消息，生成一个简洁、准确的中文标题，不超过20个字。只输出标题，不要任何其他内容，不要加引号。'
          },
          {
            role: 'user',
            content: `请为以下对话生成标题：\n${firstMsgText}`
          }
        ], {
          temperature: 0.3,
          maxTokens: 50
        });

        title = result.content?.trim()?.slice(0, 50) || '';
      } catch (err) {
        console.error('[Conversations] Title generation via LLM failed:', err);
      }
    }

    // Fallback: 使用第一条用户消息的前20个字符
    if (!title) {
      const firstUserMsg = messages.find((m: any) => m.role === 'user')?.content || '';
      const text = typeof firstUserMsg === 'string' ? firstUserMsg : JSON.stringify(firstUserMsg);
      title = text.slice(0, 20) + (text.length > 20 ? '...' : '');
    }

    const now = Date.now();
    runExec('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [title, now, conversationId]);

    res.json({
      success: true,
      data: { title }
    });
  } catch (error: any) {
    console.error('[Conversations] Generate title error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate title'
    });
  }
});

// 获取建议的起始 prompts
router.get('/suggestions/prompts', optionalAuth, (req: AuthRequest, res) => {
  try {
    const { mode = 'chat', category, limit = '8' } = req.query;

    const allSuggestions: Record<string, { title: string; prompt: string; category: string; icon?: string }[]> = {
      chat: [
        { title: '写代码', prompt: '用 Python 写一个快速排序算法，并解释时间复杂度', category: '编程', icon: 'code' },
        { title: '翻译', prompt: '把下面这段文字翻译成英文：人工智能正在改变世界', category: '翻译', icon: 'globe' },
        { title: '写作', prompt: '写一篇关于"时间管理"的短文，300字左右', category: '写作', icon: 'pen' },
        { title: '学习', prompt: '用通俗易懂的方式解释什么是Transformer模型', category: '学习', icon: 'book' },
        { title: '创意', prompt: '给我5个周末可以做的有趣活动创意', category: '创意', icon: 'lightbulb' },
        { title: '分析', prompt: '分析一下远程工作的优缺点', category: '分析', icon: 'chart' },
        { title: '建议', prompt: '我想开始学习机器学习，能给我一个学习路线图吗？', category: '建议', icon: 'compass' },
        { title: '总结', prompt: '帮我总结以下内容的要点：（粘贴内容）', category: '总结', icon: 'list' },
      ],
      task: [
        { title: '写代码项目', prompt: '帮我开发一个个人博客系统，使用 React + Node.js', category: '开发', icon: 'code' },
        { title: '研究报告', prompt: '研究一下2024年AI行业发展趋势，输出一份详细报告', category: '研究', icon: 'microscope' },
        { title: '数据分析', prompt: '分析给定数据集的统计特征并生成可视化图表', category: '分析', icon: 'chart' },
        { title: '文档撰写', prompt: '为一个开源项目编写完整的README文档', category: '文档', icon: 'file' },
      ],
    };

    let suggestions = allSuggestions[mode as string] || allSuggestions.chat;

    if (category) {
      suggestions = suggestions.filter(s => s.category === category);
    }

    const count = Math.min(parseInt(limit as string), suggestions.length);
    suggestions = suggestions.slice(0, count);

    res.json({
      success: true,
      data: {
        suggestions,
        total: suggestions.length
      }
    });
  } catch (error: any) {
    console.error('[Conversations] Suggestions error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get suggestions'
    });
  }
});

// 消息反馈（点赞/点踩）
router.post('/:id/messages/:messageId/feedback', optionalAuth, (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id;
    const messageId = req.params.messageId;
    const { type, reason } = req.body;

    if (!['like', 'dislike'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid feedback type. Must be "like" or "dislike"'
      });
    }

    const conversation = runQuery('SELECT * FROM conversations WHERE id = ?', [conversationId])[0] as any;
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const message = runQuery('SELECT * FROM messages WHERE id = ? AND conversation_id = ?', [messageId, conversationId])[0] as any;
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // 存储到 usage_stats 扩展字段或单独的表中，这里简单返回成功
    console.log(`[Feedback] ${type} on message ${messageId} in conversation ${conversationId}. Reason: ${reason || 'none'}`);

    res.json({
      success: true,
      data: { message: 'Feedback recorded', type, messageId }
    });
  } catch (error: any) {
    console.error('[Conversations] Feedback error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to record feedback'
    });
  }
});

function clearConversations(req: AuthRequest, res: any) {
  try {
    const userId = req.userId;

    let conversationIds: any[];
    if (userId) {
      conversationIds = runQuery('SELECT id FROM conversations WHERE user_id = ?', [userId]);
    } else {
      conversationIds = runQuery('SELECT id FROM conversations WHERE user_id IS NULL');
    }

    for (const conv of conversationIds) {
      runExec('DELETE FROM messages WHERE conversation_id = ?', [conv.id]);
    }

    if (userId) {
      runExec('DELETE FROM conversations WHERE user_id = ?', [userId]);
    } else {
      runExec('DELETE FROM conversations WHERE user_id IS NULL');
    }

    res.json({
      success: true,
      data: { message: 'All conversations cleared' }
    });
  } catch (error: any) {
    console.error('[Conversations] Clear error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear conversations'
    });
  }
}

router.post('/clear', optionalAuth, clearConversations);
router.delete('/', optionalAuth, clearConversations);

export default router;
