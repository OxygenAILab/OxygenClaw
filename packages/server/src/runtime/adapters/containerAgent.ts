import { completeWorkerRun, recordRuntimeEvent, updateRuntimeTask } from '../../services/runtime';
import { RuntimeWorkerAdapter, RuntimeWorkerContext } from '../../services/runtimeWorkerManager';
import { runExec } from '../../services/db';
import { probeContainerEnvironment } from '../containerEnvironment';

export interface ContainerAgentPayload {
  prompt: string;
  mode: string;
  capability: string;
  modelId: string;
}

async function failContainerTask(taskId: string, workerRunId: string, message: string) {
  updateRuntimeTask(taskId, { status: 'failed', error: message });
  completeWorkerRun(workerRunId, 'failed', message);
  runExec(`UPDATE agent_tasks SET status = ?, error = ?, completed_at = ? WHERE id = ?`, ['failed', message, Date.now(), taskId]);
  recordRuntimeEvent({ taskId, type: 'task_error', payload: { taskId, error: message, status: 'failed' } });
}

async function runContainerAgent(context: RuntimeWorkerContext<ContainerAgentPayload>) {
  const { taskId, workerRunId } = context;
  context.heartbeat();

  const env = await probeContainerEnvironment();
  if (!env.available) {
    await failContainerTask(taskId, workerRunId, env.reason || 'Container runtime is not available');
    return;
  }

  if (process.env.RUNTIME_ENABLE_CONTAINER_AGENT !== 'true') {
    await failContainerTask(taskId, workerRunId, 'Container agent worker is registered but not enabled. Set RUNTIME_ENABLE_CONTAINER_AGENT=true after sandbox image wiring is complete.');
    return;
  }

  await failContainerTask(taskId, workerRunId, 'Container agent worker scaffold is available, but sandbox execution is not implemented yet.');
}

export const containerAgentAdapter: RuntimeWorkerAdapter<ContainerAgentPayload> = {
  type: 'container-agent',
  capabilities: async () => {
    const env = await probeContainerEnvironment();
    const enabled = process.env.RUNTIME_ENABLE_CONTAINER_AGENT === 'true';
    return {
      type: 'container-agent',
      label: 'Container Agent',
      available: env.available && enabled,
      default: false,
      isolation: 'container',
      supportsCancel: true,
      supportsHeartbeat: true,
      supportsArtifacts: false,
      reason: enabled ? env.reason : 'Disabled by default; set RUNTIME_ENABLE_CONTAINER_AGENT=true after sandbox image wiring is complete.',
      metadata: { image: env.image, socket: env.socket },
    };
  },
  run: runContainerAgent,
};

