import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ModelConfig } from '@oxygen-claw/core';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth';
import { runQuery, runInsert, runExec } from '../services/db';
import {
  createRuntimeTask,
  createWorkerRun,
  deleteRuntimeTask,
  getRuntimeTaskWithEvents,
  listRuntimeEvents,
  listRuntimeEventsAfter,
  listRuntimeTasks,
  listWorkerRuns,
  subscribeRuntimeEvents,
} from '../services/runtime';
import { runtimeWorkerManager } from '../services/runtimeWorkerManager';

const router = Router();

function buildModelConfig(provider: any, model: any): ModelConfig {
  return {
    id: `${provider.id}:${model.name}`,
    name: model.name,
    displayName: model.display_name || model.name,
    provider: provider.type === 'openai-compatible' ? 'openai' : provider.type,
    apiKey: provider.api_key,
    baseUrl: provider.base_url,
    maxTokens: model.max_output || 4096,
    supportsVision: !!model.supports_vision,
    supportsTools: !!model.supports_tools,
    costPer1KInput: model.cost_per_1k_input || 0,
    costPer1KOutput: model.cost_per_1k_output || 0,
    keywords: []
  } as ModelConfig;
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
  
  const model = runQuery('SELECT * FROM models WHERE provider_id = ? AND name = ? AND enabled = 1', [providerId, modelName])[0];
  if (!model) return null;
  
  return { provider, model };
}

function getUserSettings(userId?: string): any {
  if (!userId) {
    return null;
  }
  return runQuery('SELECT * FROM settings WHERE user_id = ?', [userId])[0] || null;
}

function recordAgentTask(taskId: string, userId: string | undefined, prompt: string, mode: string, capability: string, modelId: string, status = 'pending') {
  runInsert(`
    INSERT INTO agent_tasks (id, user_id, prompt, mode, capability, model_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [taskId, userId || null, prompt, mode, capability, modelId, status, Date.now()]);
}

function createAgentRuntimeJob(input: {
  userId?: string;
  prompt: string;
  mode: string;
  capability: string;
  modelId: string;
  modelConfig: ModelConfig;
  providerId: string;
  modelName: string;
  workerType?: 'local-agent' | 'container-agent';
}) {
  const taskId = uuidv4();
  const workerType = input.workerType || 'local-agent';
  createRuntimeTask({
    id: taskId,
    userId: input.userId,
    kind: 'agent',
    prompt: input.prompt,
    mode: input.mode,
    capability: input.capability,
    modelId: input.modelId,
    status: 'pending',
    metadata: { providerId: input.providerId, modelName: input.modelName, workerType },
  });
  const workerRunId = createWorkerRun(taskId, workerType, { mode: input.mode, capability: input.capability, modelId: input.modelId }, 'pending');
  recordAgentTask(taskId, input.userId, input.prompt, input.mode, input.capability, input.modelId);
  runtimeWorkerManager.enqueue({
    taskId,
    workerRunId,
    workerType,
    payload: { prompt: input.prompt, mode: input.mode, capability: input.capability, modelConfig: input.modelConfig, modelId: input.modelId },
    enqueuedAt: Date.now(),
  });
  return { taskId, workerRunId };
}

function createComputerUseRuntimeJob(input: {
  userId?: string;
  taskGoal: string;
  modelId: string;
  modelConfig: ModelConfig;
  settings: any;
  visionEnabled: boolean;
  providerId: string;
  modelName: string;
}) {
  const taskId = uuidv4();
  createRuntimeTask({
    id: taskId,
    userId: input.userId,
    kind: 'computeruse',
    prompt: input.taskGoal,
    mode: 'computeruse',
    capability: 'expert',
    modelId: input.modelId,
    status: 'pending',
    metadata: { visionEnabled: input.visionEnabled, providerId: input.providerId, modelName: input.modelName },
  });
  const workerRunId = createWorkerRun(taskId, 'local-computeruse', { modelId: input.modelId, visionEnabled: input.visionEnabled }, 'pending');
  recordAgentTask(taskId, input.userId, input.taskGoal, 'computeruse', 'expert', input.modelId);
  runtimeWorkerManager.enqueue({
    taskId,
    workerRunId,
    workerType: 'local-computeruse',
    payload: { taskGoal: input.taskGoal, modelConfig: input.modelConfig, settings: input.settings, visionEnabled: input.visionEnabled },
    enqueuedAt: Date.now(),
  });
  return { taskId, workerRunId };
}

function writeRuntimeSse(res: any, event: any) {
  res.write(`data: ${JSON.stringify({ type: event.type, seq: event.seq, ...event.payload })}\n\n`);
}

function streamRuntimeTask(taskId: string, res: any) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  for (const event of listRuntimeEvents(taskId)) {
    writeRuntimeSse(res, event);
  }

  const unsubscribe = subscribeRuntimeEvents(taskId, event => {
    writeRuntimeSse(res, event);
    if (event.type === 'task_complete' || event.type === 'task_error' || event.type === 'task_cancelled') {
      res.write('data: [DONE]\n\n');
      res.end();
      unsubscribe();
    }
  });

  res.on('close', () => {
    unsubscribe();
  });
}

router.post('/execute', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { prompt, mode = 'task', capability = 'expert', modelId, workerType = 'local-agent' } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    if (!modelId) {
      return res.status(400).json({
        success: false,
        error: 'Model is required. Please select a model first.'
      });
    }

    if (workerType !== 'local-agent' && workerType !== 'container-agent') {
      return res.status(400).json({ success: false, error: 'Unsupported workerType' });
    }

    const modelData = getModelById(modelId, req.userId);
    if (!modelData) {
      return res.status(404).json({
        success: false,
        error: 'Model not found or not enabled'
      });
    }

    const modelConfig = buildModelConfig(modelData.provider, modelData.model);
    const { taskId, workerRunId } = createAgentRuntimeJob({
      userId: req.userId,
      prompt,
      mode,
      capability,
      modelId,
      modelConfig,
      providerId: modelData.provider.id,
      modelName: modelData.model.name,
      workerType,
    });

    const wantsSse = req.headers.accept?.includes('text/event-stream') || req.body.stream === true;
    if (!wantsSse) {
      return res.status(202).json({
        success: true,
        data: {
          taskId,
          workerRunId,
          workerType,
          status: 'pending',
          eventsUrl: `/api/agent/tasks/${taskId}/events/live`
        }
      });
    }

    streamRuntimeTask(taskId, res);

  } catch (error: any) {
    console.error('[Agent] Execute error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Agent execution failed'
      });
    }
  }
});

router.post('/start', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { prompt, mode = 'task', capability = 'expert', modelId, workerType = 'local-agent' } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    if (!modelId) {
      return res.status(400).json({ success: false, error: 'Model is required. Please select a model first.' });
    }

    if (workerType !== 'local-agent' && workerType !== 'container-agent') {
      return res.status(400).json({ success: false, error: 'Unsupported workerType' });
    }

    const modelData = getModelById(modelId, req.userId);
    if (!modelData) {
      return res.status(404).json({ success: false, error: 'Model not found or not enabled' });
    }

    const modelConfig = buildModelConfig(modelData.provider, modelData.model);
    const { taskId, workerRunId } = createAgentRuntimeJob({
      userId: req.userId,
      prompt,
      mode,
      capability,
      modelId,
      modelConfig,
      providerId: modelData.provider.id,
      modelName: modelData.model.name,
      workerType,
    });

    res.status(202).json({
      success: true,
      data: {
        taskId,
        workerRunId,
        workerType,
        status: 'pending',
        eventsUrl: `/api/agent/tasks/${taskId}/events/live`
      }
    });
  } catch (error: any) {
    console.error('[Agent] Start error:', error);
    res.status(500).json({ success: false, error: error.message || 'Agent start failed' });
  }
});

router.get('/tasks', optionalAuth, (req: AuthRequest, res) => {
  const tasks = listRuntimeTasks(req.userId);

  res.json({
    success: true,
    data: { tasks }
  });
});

router.get('/tasks/recent', optionalAuth, (req: AuthRequest, res) => {
  const limit = Math.min(Number(req.query.limit || 10), 100);
  const tasks = listRuntimeTasks(req.userId).slice(0, limit);

  res.json({
    success: true,
    data: { tasks, total: tasks.length }
  });
});

router.get('/history', optionalAuth, (req: AuthRequest, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const tasks = listRuntimeTasks(req.userId).slice(0, limit);

  res.json({
    success: true,
    data: { tasks, total: tasks.length }
  });
});

router.get('/runtime/workers', optionalAuth, (_req: AuthRequest, res) => {
  res.json({
    success: true,
    data: runtimeWorkerManager.getStats()
  });
});

router.get('/runtime/workers/capabilities', optionalAuth, async (_req: AuthRequest, res) => {
  res.json({
    success: true,
    data: { workers: await runtimeWorkerManager.getCapabilities() }
  });
});

router.get('/tasks/:id', optionalAuth, (req: AuthRequest, res) => {
  const taskId = req.params.id;
  const task = getRuntimeTaskWithEvents(taskId);
  
  if (!task) {
    return res.status(404).json({
      success: false,
      error: 'Task not found'
    });
  }

  if (task.userId && req.userId !== task.userId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  res.json({
    success: true,
    data: { task }
  });
});

router.get('/tasks/:id/events', optionalAuth, (req: AuthRequest, res) => {
  const taskId = req.params.id;
  const afterSeq = Number(req.query.afterSeq || 0);
  const task = getRuntimeTaskWithEvents(taskId);

  if (!task) {
    return res.status(404).json({
      success: false,
      error: 'Task not found'
    });
  }

  if (task.userId && req.userId !== task.userId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  res.json({
    success: true,
    data: {
      taskId,
      events: afterSeq > 0 ? listRuntimeEventsAfter(taskId, afterSeq) : listRuntimeEvents(taskId)
    }
  });
});

router.get('/tasks/:id/events/stream', optionalAuth, (req: AuthRequest, res) => {
  const taskId = req.params.id;
  const afterSeq = Number(req.query.afterSeq || 0);
  const task = getRuntimeTaskWithEvents(taskId);

  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found' });
  }

  if (task.userId && req.userId !== task.userId) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const events = listRuntimeEventsAfter(taskId, afterSeq);
  for (const event of events) {
    res.write(`data: ${JSON.stringify({ type: event.type, seq: event.seq, ...event.payload })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
});

router.get('/tasks/:id/events/live', optionalAuth, (req: AuthRequest, res) => {
  const taskId = req.params.id;
  const afterSeq = Number(req.query.afterSeq || 0);
  const task = getRuntimeTaskWithEvents(taskId);

  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found' });
  }

  if (task.userId && req.userId !== task.userId) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const replayedEvents = listRuntimeEventsAfter(taskId, afterSeq);
  for (const event of replayedEvents) {
    res.write(`data: ${JSON.stringify({ type: event.type, seq: event.seq, ...event.payload })}\n\n`);
  }

  const latestTerminalEvent = [...replayedEvents, ...listRuntimeEvents(taskId)]
    .reverse()
    .find(event => event.type === 'task_complete' || event.type === 'task_error' || event.type === 'task_cancelled');

  if (latestTerminalEvent) {
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  const unsubscribe = subscribeRuntimeEvents(taskId, event => {
    res.write(`data: ${JSON.stringify({ type: event.type, seq: event.seq, ...event.payload })}\n\n`);
    if (event.type === 'task_complete' || event.type === 'task_error' || event.type === 'task_cancelled') {
      res.write('data: [DONE]\n\n');
      res.end();
      unsubscribe();
    }
  });

  res.on('close', () => unsubscribe());
});

router.get('/tasks/:id/workers', optionalAuth, (req: AuthRequest, res) => {
  const taskId = req.params.id;
  const task = getRuntimeTaskWithEvents(taskId);

  if (!task) {
    return res.status(404).json({ success: false, error: 'Task not found' });
  }

  if (task.userId && req.userId !== task.userId) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  res.json({
    success: true,
    data: {
      taskId,
      workerRuns: listWorkerRuns(taskId)
    }
  });
});

router.post('/computeruse/execute', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { task: taskGoal, modelId } = req.body;

    if (!taskGoal) {
      return res.status(400).json({
        success: false,
        error: 'Task description is required'
      });
    }

    if (!modelId) {
      return res.status(400).json({
        success: false,
        error: 'Model is required for ComputerUse'
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
    const visionEnabled = settings?.vision_enabled === 1 || settings?.vision_enabled === true;
    const { taskId } = createComputerUseRuntimeJob({
      userId: req.userId,
      taskGoal,
      modelId,
      modelConfig,
      settings,
      visionEnabled,
      providerId: modelData.provider.id,
      modelName: modelData.model.name,
    });
    streamRuntimeTask(taskId, res);

  } catch (error: any) {
    console.error('[ComputerUse] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'ComputerUse execution failed'
      });
    }
  }
});

router.post('/computeruse/start', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { task: taskGoal, modelId } = req.body;

    if (!taskGoal) {
      return res.status(400).json({ success: false, error: 'Task description is required' });
    }

    if (!modelId) {
      return res.status(400).json({ success: false, error: 'Model is required for ComputerUse' });
    }

    const modelData = getModelById(modelId, req.userId);
    if (!modelData) {
      return res.status(404).json({ success: false, error: 'Model not found or not enabled' });
    }

    const modelConfig = buildModelConfig(modelData.provider, modelData.model);
    const settings = getUserSettings(req.userId);
    const visionEnabled = settings?.vision_enabled === 1 || settings?.vision_enabled === true;
    const { taskId, workerRunId } = createComputerUseRuntimeJob({
      userId: req.userId,
      taskGoal,
      modelId,
      modelConfig,
      settings,
      visionEnabled,
      providerId: modelData.provider.id,
      modelName: modelData.model.name,
    });

    res.status(202).json({
      success: true,
      data: {
        taskId,
        workerRunId,
        status: 'pending',
        eventsUrl: `/api/agent/tasks/${taskId}/events/live`
      }
    });
  } catch (error: any) {
    console.error('[ComputerUse] Start error:', error);
    res.status(500).json({ success: false, error: error.message || 'ComputerUse start failed' });
  }
});

router.post('/tasks/:id/cancel', optionalAuth, (req: AuthRequest, res) => {
  try {
    const taskId = req.params.id;

    const task = getRuntimeTaskWithEvents(taskId) as any;

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    if (task.userId && req.userId !== task.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (task.status !== 'running' && task.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Task is not running or pending'
      });
    }

    const cancelled = runtimeWorkerManager.cancel(taskId);

    runExec(
      `UPDATE agent_tasks SET status = ?, completed_at = ? WHERE id = ?`,
      ['cancelled', Date.now(), taskId]
    );

    res.json({
      success: true,
      data: {
        taskId,
        status: 'cancelled',
        message: cancelled ? 'Task cancelled successfully' : 'Task marked as cancelled'
      }
    });
  } catch (error: any) {
    console.error('[Agent] Cancel task error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel task'
    });
  }
});

router.delete('/tasks/:id', optionalAuth, (req: AuthRequest, res) => {
  try {
    const taskId = req.params.id;

    const task = getRuntimeTaskWithEvents(taskId) as any;

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    if (task.userId && req.userId !== task.userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (task.status === 'running' || task.status === 'pending') {
      runtimeWorkerManager.cancel(taskId);
    }

    runExec('DELETE FROM agent_tasks WHERE id = ?', [taskId]);
    deleteRuntimeTask(taskId);

    res.json({
      success: true,
      data: { message: 'Task deleted successfully' }
    });
  } catch (error: any) {
    console.error('[Agent] Delete task error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete task'
    });
  }
});

export default router;
