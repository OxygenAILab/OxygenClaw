import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { runExec, runInsert, runQuery, runTransaction } from './db';

export type RuntimeTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CreateRuntimeTaskInput {
  id?: string;
  userId?: string;
  conversationId?: string;
  kind: string;
  prompt: string;
  mode: string;
  capability: string;
  modelId?: string;
  status?: RuntimeTaskStatus;
  metadata?: Record<string, any>;
}

export interface RuntimeEventInput {
  taskId: string;
  type: string;
  payload: Record<string, any>;
}

export interface RuntimeEventRecord {
  id: string;
  taskId: string;
  seq: number;
  type: string;
  payload: Record<string, any>;
  createdAt: number;
}

const runtimeEventBus = new EventEmitter();
runtimeEventBus.setMaxListeners(1000);

function parseJson(value: any, fallback: any) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function createRuntimeTask(input: CreateRuntimeTaskInput) {
  const id = input.id || uuidv4();
  const now = Date.now();

  runInsert(
    `INSERT INTO runtime_tasks (id, user_id, conversation_id, kind, prompt, mode, capability, model_id, status, created_at, started_at, updated_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId || null,
      input.conversationId || null,
      input.kind,
      input.prompt,
      input.mode,
      input.capability,
      input.modelId || null,
      input.status || 'running',
      now,
      input.status === 'pending' ? null : now,
      now,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );

  return getRuntimeTask(id);
}

export function createWorkerRun(taskId: string, workerType: string, metadata?: Record<string, any>, status: RuntimeTaskStatus = 'running') {
  const id = uuidv4();
  const now = Date.now();
  runInsert(
    `INSERT INTO worker_runs (id, task_id, worker_type, status, started_at, heartbeat_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, taskId, workerType, status, now, now, metadata ? JSON.stringify(metadata) : null]
  );
  return id;
}

export function completeWorkerRun(id: string, status: RuntimeTaskStatus, exitReason?: string) {
  const now = Date.now();
  runExec(
    `UPDATE worker_runs SET status = ?, heartbeat_at = ?, completed_at = ?, exit_reason = ? WHERE id = ?`,
    [status, now, now, exitReason || null, id]
  );
}

export function heartbeatWorkerRun(id: string) {
  runExec('UPDATE worker_runs SET heartbeat_at = ? WHERE id = ?', [Date.now(), id]);
}

export function markWorkerRunStatus(id: string, status: RuntimeTaskStatus) {
  runExec('UPDATE worker_runs SET status = ?, heartbeat_at = ? WHERE id = ?', [status, Date.now(), id]);
}

export function recordRuntimeEvent(input: RuntimeEventInput) {
  const id = uuidv4();
  const now = Date.now();

  // Allocate seq and insert atomically. Previously "SELECT MAX(seq)+1" and the
  // INSERT were two separate statements, so two concurrent events could read the
  // same MAX and collide on seq — breaking ordering and afterSeq incremental
  // fetch. A synchronous transaction serializes allocation; the UNIQUE index on
  // (task_id, seq) is a hard backstop.
  const seq = runTransaction(() => {
    const existing = runQuery(
      'SELECT MAX(seq) as seq FROM runtime_events WHERE task_id = ?',
      [input.taskId]
    )[0] as any;
    const nextSeq = Number(existing?.seq || 0) + 1;
    runInsert(
      `INSERT INTO runtime_events (id, task_id, seq, type, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.taskId, nextSeq, input.type, JSON.stringify(input.payload), now]
    );
    return nextSeq;
  });

  const event = { id, taskId: input.taskId, seq, type: input.type, payload: input.payload, createdAt: now };
  runtimeEventBus.emit('event', event);
  runtimeEventBus.emit(`task:${input.taskId}`, event);
  return event;
}

export function subscribeRuntimeEvents(taskId: string, listener: (event: RuntimeEventRecord) => void) {
  const channel = `task:${taskId}`;
  runtimeEventBus.on(channel, listener);
  return () => runtimeEventBus.off(channel, listener);
}

export function updateRuntimeTask(id: string, updates: { status?: RuntimeTaskStatus; result?: string; error?: string; metadata?: Record<string, any> }) {
  const fields: string[] = [];
  const values: any[] = [];
  const now = Date.now();

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
    if (updates.status === 'running') {
      fields.push('started_at = COALESCE(started_at, ?)');
      values.push(now);
    }
    if (updates.status === 'completed' || updates.status === 'failed') {
      fields.push('completed_at = ?');
      values.push(now);
    }
    if (updates.status === 'cancelled') {
      fields.push('cancelled_at = ?');
      values.push(now);
      fields.push('completed_at = ?');
      values.push(now);
    }
  }
  if (updates.result !== undefined) {
    fields.push('result = ?');
    values.push(updates.result);
  }
  if (updates.error !== undefined) {
    fields.push('error = ?');
    values.push(updates.error);
  }
  if (updates.metadata !== undefined) {
    fields.push('metadata = ?');
    values.push(JSON.stringify(updates.metadata));
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  runExec(`UPDATE runtime_tasks SET ${fields.join(', ')} WHERE id = ?`, values);
  return getRuntimeTask(id);
}

export function getRuntimeTask(id: string) {
  const task = runQuery('SELECT * FROM runtime_tasks WHERE id = ?', [id])[0] as any;
  if (!task) return null;
  return formatRuntimeTask(task);
}

export function listRuntimeTasks(userId?: string) {
  const rows = userId
    ? runQuery('SELECT * FROM runtime_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [userId])
    : runQuery('SELECT * FROM runtime_tasks WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 50');
  return rows.map(formatRuntimeTask);
}

export function listStaleRuntimeTasks(timeoutMs: number) {
  const cutoff = Date.now() - timeoutMs;
  return runQuery(
    `SELECT rt.* FROM runtime_tasks rt
     LEFT JOIN worker_runs wr ON wr.task_id = rt.id
     WHERE rt.status = 'running' AND (wr.heartbeat_at IS NULL OR wr.heartbeat_at < ?)
     ORDER BY rt.updated_at ASC`,
    [cutoff]
  ).map(formatRuntimeTask);
}

export function listInterruptedRuntimeTasks() {
  return runQuery(
    `SELECT * FROM runtime_tasks
     WHERE status IN ('pending', 'running')
     ORDER BY updated_at ASC`
  ).map(formatRuntimeTask);
}

export function listRuntimeEvents(taskId: string) {
  return runQuery('SELECT * FROM runtime_events WHERE task_id = ? ORDER BY seq ASC', [taskId]).map((event: any) => ({
    id: event.id,
    taskId: event.task_id,
    seq: event.seq,
    type: event.type,
    payload: parseJson(event.payload, {}),
    createdAt: event.created_at,
  }));
}

export function listRuntimeEventsAfter(taskId: string, afterSeq = 0) {
  return runQuery(
    'SELECT * FROM runtime_events WHERE task_id = ? AND seq > ? ORDER BY seq ASC',
    [taskId, afterSeq]
  ).map((event: any) => ({
    id: event.id,
    taskId: event.task_id,
    seq: event.seq,
    type: event.type,
    payload: parseJson(event.payload, {}),
    createdAt: event.created_at,
  }));
}

export function listWorkerRuns(taskId: string) {
  return runQuery('SELECT * FROM worker_runs WHERE task_id = ? ORDER BY started_at ASC', [taskId]).map((run: any) => ({
    id: run.id,
    taskId: run.task_id,
    workerType: run.worker_type,
    status: run.status,
    startedAt: run.started_at,
    heartbeatAt: run.heartbeat_at,
    completedAt: run.completed_at,
    exitReason: run.exit_reason || undefined,
    metadata: parseJson(run.metadata, {}),
  }));
}

export function getRuntimeTaskWithEvents(id: string) {
  const task = getRuntimeTask(id);
  if (!task) return null;
  const events = listRuntimeEvents(id);
  return {
    ...task,
    events,
    workerRuns: listWorkerRuns(id),
    steps: events.filter(event => event.type === 'step').map(event => event.payload.step || event.payload),
  };
}

export function deleteRuntimeTask(id: string) {
  runExec('DELETE FROM runtime_events WHERE task_id = ?', [id]);
  runExec('DELETE FROM worker_runs WHERE task_id = ?', [id]);
  runExec('DELETE FROM runtime_tasks WHERE id = ?', [id]);
}

export function formatRuntimeTask(task: any) {
  return {
    id: task.id,
    userId: task.user_id,
    conversationId: task.conversation_id,
    kind: task.kind,
    prompt: task.prompt,
    task: task.prompt,
    mode: task.mode,
    capability: task.capability,
    modelId: task.model_id,
    status: task.status,
    result: task.result || undefined,
    error: task.error || undefined,
    createdAt: task.created_at,
    startedAt: task.started_at,
    updatedAt: task.updated_at,
    completedAt: task.completed_at,
    cancelledAt: task.cancelled_at,
    metadata: parseJson(task.metadata, {}),
  };
}
