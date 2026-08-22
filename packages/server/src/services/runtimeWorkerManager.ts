import {
  RuntimeTaskStatus,
  completeWorkerRun,
  heartbeatWorkerRun,
  listInterruptedRuntimeTasks,
  listStaleRuntimeTasks,
  markWorkerRunStatus,
  recordRuntimeEvent,
  updateRuntimeTask,
} from './runtime';

export interface RuntimeWorkerContext<TPayload = any> {
  taskId: string;
  workerRunId: string;
  workerType: string;
  payload: TPayload;
  heartbeat: () => void;
  isCancelled: () => boolean;
}

export interface RuntimeWorkerAdapter<TPayload = any> {
  type: string;
  capabilities?: () => Promise<RuntimeWorkerCapability> | RuntimeWorkerCapability;
  run: (context: RuntimeWorkerContext<TPayload>) => Promise<void>;
  cancel?: (taskId: string) => void;
}

export interface RuntimeWorkerCapability {
  type: string;
  label: string;
  available: boolean;
  default: boolean;
  isolation: 'process' | 'container' | 'remote';
  supportsCancel: boolean;
  supportsHeartbeat: boolean;
  supportsArtifacts: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

interface RuntimeJob {
  taskId: string;
  workerRunId: string;
  workerType: string;
  payload: any;
  enqueuedAt: number;
}

interface ActiveRuntimeJob extends RuntimeJob {
  startedAt: number;
  heartbeatAt: number;
  cancelled: boolean;
}

export class RuntimeWorkerManager {
  private adapters = new Map<string, RuntimeWorkerAdapter>();
  private queue: RuntimeJob[] = [];
  private active = new Map<string, ActiveRuntimeJob>();
  private maxConcurrency: number;
  private heartbeatInterval?: NodeJS.Timeout;
  private sweepInterval?: NodeJS.Timeout;
  private staleTimeoutMs: number;

  constructor(options?: { maxConcurrency?: number; staleTimeoutMs?: number }) {
    this.maxConcurrency = options?.maxConcurrency || Number(process.env.RUNTIME_MAX_CONCURRENCY || 2);
    this.staleTimeoutMs = options?.staleTimeoutMs || Number(process.env.RUNTIME_STALE_TIMEOUT_MS || 10 * 60 * 1000);
  }

  register(adapter: RuntimeWorkerAdapter) {
    this.adapters.set(adapter.type, adapter);
  }

  enqueue(job: RuntimeJob) {
    if (!this.adapters.has(job.workerType)) {
      throw new Error(`Worker adapter not registered: ${job.workerType}`);
    }

    this.queue.push(job);
    recordRuntimeEvent({
      taskId: job.taskId,
      type: 'task_queued',
      payload: { taskId: job.taskId, status: 'pending', workerType: job.workerType, queueSize: this.queue.length }
    });
    this.schedule();
  }

  cancel(taskId: string) {
    const queuedIndex = this.queue.findIndex(job => job.taskId === taskId);
    if (queuedIndex >= 0) {
      const [job] = this.queue.splice(queuedIndex, 1);
      updateRuntimeTask(taskId, { status: 'cancelled' });
      completeWorkerRun(job.workerRunId, 'cancelled', 'Cancelled before start');
      recordRuntimeEvent({ taskId, type: 'task_cancelled', payload: { taskId, status: 'cancelled', cancelledAt: Date.now() } });
      return true;
    }

    const active = this.active.get(taskId);
    if (!active) return false;

    active.cancelled = true;
    const adapter = this.adapters.get(active.workerType);
    adapter?.cancel?.(taskId);
    updateRuntimeTask(taskId, { status: 'cancelled' });
    completeWorkerRun(active.workerRunId, 'cancelled', 'Cancelled by user');
    recordRuntimeEvent({ taskId, type: 'task_cancelled', payload: { taskId, status: 'cancelled', cancelledAt: Date.now() } });
    return true;
  }

  getStats() {
    return {
      maxConcurrency: this.maxConcurrency,
      queued: this.queue.length,
      running: this.active.size,
      adapters: Array.from(this.adapters.keys()),
      tasks: {
        queued: this.queue.map(job => ({ taskId: job.taskId, workerType: job.workerType, enqueuedAt: job.enqueuedAt })),
        running: Array.from(this.active.values()).map(job => ({
          taskId: job.taskId,
          workerType: job.workerType,
          startedAt: job.startedAt,
          heartbeatAt: job.heartbeatAt,
          cancelled: job.cancelled,
        })),
      },
    };
  }

  async getCapabilities() {
    const capabilities = [];
    for (const adapter of this.adapters.values()) {
      if (adapter.capabilities) {
        capabilities.push(await adapter.capabilities());
      } else {
        capabilities.push({
          type: adapter.type,
          label: adapter.type,
          available: true,
          default: adapter.type === 'local-agent' || adapter.type === 'local-computeruse',
          isolation: 'process',
          supportsCancel: !!adapter.cancel,
          supportsHeartbeat: true,
          supportsArtifacts: false,
        } as RuntimeWorkerCapability);
      }
    }
    return capabilities;
  }

  start() {
    this.failInterruptedTasks();
    if (!this.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => this.heartbeat(), 5000);
    }
    if (!this.sweepInterval) {
      this.sweepInterval = setInterval(() => this.sweepStaleTasks(), 30000);
    }
  }

  stop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.sweepInterval) clearInterval(this.sweepInterval);
    this.heartbeatInterval = undefined;
    this.sweepInterval = undefined;
  }

  sweepStaleTasks() {
    const staleTasks = listStaleRuntimeTasks(this.staleTimeoutMs);
    for (const task of staleTasks) {
      if (this.active.has(task.id)) continue;
      updateRuntimeTask(task.id, { status: 'failed', error: 'Runtime worker heartbeat timed out' });
      recordRuntimeEvent({
        taskId: task.id,
        type: 'task_error',
        payload: { taskId: task.id, error: 'Runtime worker heartbeat timed out', status: 'failed' }
      });
    }
  }

  failInterruptedTasks() {
    const interruptedTasks = listInterruptedRuntimeTasks();
    for (const task of interruptedTasks) {
      if (this.active.has(task.id) || this.queue.some(job => job.taskId === task.id)) continue;
      updateRuntimeTask(task.id, { status: 'failed', error: 'Runtime worker interrupted by server restart' });
      recordRuntimeEvent({
        taskId: task.id,
        type: 'task_error',
        payload: { taskId: task.id, error: 'Runtime worker interrupted by server restart', status: 'failed' }
      });
    }
  }

  private schedule() {
    while (this.active.size < this.maxConcurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.run(job);
    }
  }

  private run(job: RuntimeJob) {
    const adapter = this.adapters.get(job.workerType);
    if (!adapter) {
      throw new Error(`Worker adapter not registered: ${job.workerType}`);
    }

    const activeJob: ActiveRuntimeJob = {
      ...job,
      startedAt: Date.now(),
      heartbeatAt: Date.now(),
      cancelled: false,
    };

    this.active.set(job.taskId, activeJob);
    updateRuntimeTask(job.taskId, { status: 'running' });
    markWorkerRunStatus(job.workerRunId, 'running');
    recordRuntimeEvent({ taskId: job.taskId, type: 'task_start', payload: { taskId: job.taskId, status: 'running', workerType: job.workerType } });

    void adapter.run({
      taskId: job.taskId,
      workerRunId: job.workerRunId,
      workerType: job.workerType,
      payload: job.payload,
      heartbeat: () => this.touch(job.taskId),
      isCancelled: () => this.active.get(job.taskId)?.cancelled || false,
    }).catch((error: any) => {
      const message = error?.message || 'Runtime worker failed';
      updateRuntimeTask(job.taskId, { status: 'failed', error: message });
      completeWorkerRun(job.workerRunId, 'failed', message);
      recordRuntimeEvent({ taskId: job.taskId, type: 'task_error', payload: { taskId: job.taskId, error: message, status: 'failed' } });
    }).finally(() => {
      this.active.delete(job.taskId);
      this.schedule();
    });
  }

  private touch(taskId: string) {
    const active = this.active.get(taskId);
    if (!active) return;
    active.heartbeatAt = Date.now();
    heartbeatWorkerRun(active.workerRunId);
  }

  private heartbeat() {
    for (const taskId of this.active.keys()) {
      this.touch(taskId);
    }
  }
}

export const runtimeWorkerManager = new RuntimeWorkerManager();

