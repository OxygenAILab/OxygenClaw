import { ModelConfig, createAgent } from '@oxygen-claw/core';
import { completeWorkerRun, recordRuntimeEvent, updateRuntimeTask } from '../../services/runtime';
import { RuntimeWorkerAdapter, RuntimeWorkerContext } from '../../services/runtimeWorkerManager';
import { runExec } from '../../services/db';
import { activeAgents, cancelAgent } from './activeAgents';

export interface LocalAgentPayload {
  prompt: string;
  mode: string;
  capability: string;
  modelConfig: ModelConfig;
}

async function runLocalAgent(context: RuntimeWorkerContext<LocalAgentPayload>) {
  const { taskId, workerRunId } = context;
  const { prompt, mode, capability, modelConfig } = context.payload;

  try {
    const agent = createAgent({
      mode: capability as any,
      interactionMode: mode as any,
      model: modelConfig,
      mcpServers: [],
      enableGUI: false
    });

    activeAgents.set(taskId, agent);
    await agent.initialize();
    context.heartbeat();

    recordRuntimeEvent({ taskId, type: 'step', payload: { step: { type: 'think', content: 'Agent initialized, starting task execution...', timestamp: Date.now() } } });

    const task = await agent.executeTask(prompt);
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
      timestamp: s.timestamp
    }));

    for (const step of steps) {
      recordRuntimeEvent({ taskId, type: 'step', payload: { step } });
    }

    updateRuntimeTask(taskId, {
      status: (task.status || 'completed') as any,
      result: task.result || '',
      error: task.error || '',
    });
    completeWorkerRun(workerRunId, (task.status || 'completed') as any, task.error || undefined);

    runExec(`
      UPDATE agent_tasks
      SET status = ?, result = ?, error = ?, steps = ?, completed_at = ?
      WHERE id = ?
    `, [task.status || 'completed', task.result || '', task.error || '', JSON.stringify(steps), Date.now(), taskId]);

    recordRuntimeEvent({ taskId, type: 'task_complete', payload: { taskId, status: task.status || 'completed', result: task.result, error: task.error, steps } });
  } catch (error: any) {
    console.error('[LocalAgentAdapter] Execution error:', error);
    const message = error.message || 'Unknown error';
    updateRuntimeTask(taskId, { status: 'failed', error: message });
    completeWorkerRun(workerRunId, 'failed', message);
    runExec(`UPDATE agent_tasks SET status = ?, error = ?, completed_at = ? WHERE id = ?`, ['failed', message, Date.now(), taskId]);
    recordRuntimeEvent({ taskId, type: 'task_error', payload: { taskId, error: message } });
  } finally {
    activeAgents.delete(taskId);
  }
}

export const localAgentAdapter: RuntimeWorkerAdapter<LocalAgentPayload> = {
  type: 'local-agent',
  run: runLocalAgent,
  cancel: cancelAgent,
};

