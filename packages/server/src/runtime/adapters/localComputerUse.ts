import { ComputerUseAgent, ModelConfig, VisionComputerUseAgent, createComputerUseAgent, createVisionComputerUseAgent, createWindowsOperator } from '@oxygen-claw/core';
import { completeWorkerRun, recordRuntimeEvent, updateRuntimeTask } from '../../services/runtime';
import { RuntimeWorkerAdapter, RuntimeWorkerContext } from '../../services/runtimeWorkerManager';
import { runExec } from '../../services/db';
import { activeComputerUseAgents, stopComputerUseAgent } from './activeAgents';

export interface LocalComputerUsePayload {
  taskGoal: string;
  modelConfig: ModelConfig;
  settings: any;
  visionEnabled: boolean;
}

function buildVisionModelConfig(settings: any): ModelConfig {
  return {
    id: `vision:${settings.vision_model || 'step-3.7-flash'}`,
    name: settings.vision_model || 'step-3.7-flash',
    displayName: settings.vision_model || 'step-3.7-flash',
    provider: 'openai',
    apiKey: settings.vision_api_key,
    baseUrl: settings.vision_base_url || 'https://api.stepfun.com/step_plan/v1',
    maxTokens: 4096,
    supportsVision: true,
    supportsTools: false,
    costPer1KInput: 0,
    costPer1KOutput: 0,
    keywords: []
  } as ModelConfig;
}

async function runLocalComputerUse(context: RuntimeWorkerContext<LocalComputerUsePayload>) {
  const { taskId, workerRunId } = context;
  const { taskGoal, modelConfig, settings, visionEnabled } = context.payload;

  try {
    let agent: ComputerUseAgent | VisionComputerUseAgent;
    const useNativeOperator = process.platform === 'win32';
    const operator = useNativeOperator ? createWindowsOperator() : undefined;

    if (visionEnabled && settings?.vision_api_key) {
      const visionModelConfig = buildVisionModelConfig(settings);
      agent = createVisionComputerUseAgent({ model: modelConfig, visionModel: visionModelConfig, operator, maxSteps: 50 });
      recordRuntimeEvent({ taskId, type: 'step', payload: { step: { type: 'think', content: `Vision ComputerUse agent initialized with dedicated vision model and ${useNativeOperator ? 'native Windows' : 'mock'} operator, starting task...`, timestamp: Date.now() } } });
    } else {
      agent = createComputerUseAgent({ model: modelConfig, operator, maxSteps: 50, config: { enableVision: !!modelConfig.supportsVision } });
      recordRuntimeEvent({ taskId, type: 'step', payload: { step: { type: 'think', content: `ComputerUse agent initialized with ${useNativeOperator ? 'native Windows' : 'mock'} operator, starting task...`, timestamp: Date.now() } } });
    }

    activeComputerUseAgents.set(taskId, agent);
    await agent.initialize();
    context.heartbeat();

    const task = await agent.executeTask(taskGoal);
    context.heartbeat();

    // 取消优先：若 AbortController 已触发，用 cancelled 状态收尾，不回放 steps
    if (context.isCancelled()) {
      const cancelMsg = 'Task cancelled by user';
      updateRuntimeTask(taskId, { status: 'cancelled' as any, error: cancelMsg });
      completeWorkerRun(workerRunId, 'cancelled' as any, cancelMsg);
      runExec(`UPDATE agent_tasks SET status = ?, error = ?, completed_at = ? WHERE id = ?`,
        ['cancelled', cancelMsg, Date.now(), taskId]);
      recordRuntimeEvent({ taskId, type: 'task_complete', payload: { taskId, status: 'cancelled' } });
      return;
    }

    const steps = task.steps.map(s => ({
      type: s.type,
      content: s.content,
      action: s.action,
      timestamp: s.timestamp
    }));

    for (const step of steps) {
      recordRuntimeEvent({ taskId, type: 'step', payload: { step } });
    }

    updateRuntimeTask(taskId, { status: task.status as any, result: task.result || '', error: task.error || '' });
    completeWorkerRun(workerRunId, task.status as any, task.error || undefined);
    runExec(`UPDATE agent_tasks SET status = ?, result = ?, steps = ?, completed_at = ? WHERE id = ?`, [task.status, task.result || '', JSON.stringify(steps), Date.now(), taskId]);
    recordRuntimeEvent({ taskId, type: 'task_complete', payload: { taskId, status: task.status, result: task.result, error: task.error, steps } });
  } catch (error: any) {
    console.error('[LocalComputerUseAdapter] Execution error:', error);
    const message = error.message || 'Unknown error';
    updateRuntimeTask(taskId, { status: 'failed', error: message });
    completeWorkerRun(workerRunId, 'failed', message);
    runExec(`UPDATE agent_tasks SET status = ?, error = ?, completed_at = ? WHERE id = ?`, ['failed', message, Date.now(), taskId]);
    recordRuntimeEvent({ taskId, type: 'task_error', payload: { taskId, error: message } });
  } finally {
    activeComputerUseAgents.delete(taskId);
  }
}

export const localComputerUseAdapter: RuntimeWorkerAdapter<LocalComputerUsePayload> = {
  type: 'local-computeruse',
  run: runLocalComputerUse,
  cancel: stopComputerUseAgent,
};

