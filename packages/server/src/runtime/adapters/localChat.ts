import { ModelConfig, callLLM, LLMStreamChunk } from '@oxygen-claw/core';
import { completeWorkerRun, recordRuntimeEvent, updateRuntimeTask } from '../../services/runtime';
import { RuntimeWorkerAdapter, RuntimeWorkerContext } from '../../services/runtimeWorkerManager';
import { runExec, runInsert } from '../../services/db';

export interface LocalChatPayload {
  conversationId: string;
  messageId: string;
  messages: Array<{ role: string; content: any }>;
  modelConfig: ModelConfig;
  temperature?: number;
  maxTokens?: number;
}

const activeChatAborts = new Map<string, AbortController>();

async function runLocalChat(context: RuntimeWorkerContext<LocalChatPayload>) {
  const { taskId, workerRunId } = context;
  const { conversationId, messageId, messages, modelConfig, temperature, maxTokens } = context.payload;

  const abortController = new AbortController();
  activeChatAborts.set(taskId, abortController);

  try {
    context.heartbeat();
    recordRuntimeEvent({ taskId, type: 'chat_start', payload: { conversationId, messageId } });

    let fullContent = '';
    const startTime = Date.now();

    await callLLM(modelConfig, messages, {
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 4096,
      streaming: true,
      signal: abortController.signal,
      onChunk: (chunk: LLMStreamChunk) => {
        if (context.isCancelled()) {
          abortController.abort();
          return;
        }

        fullContent += chunk.content;
        recordRuntimeEvent({
          taskId,
          type: 'chat_chunk',
          payload: {
            delta: chunk.content,
            done: chunk.done,
            usage: chunk.usage,
          }
        });
        context.heartbeat();
      }
    });

    // 取消优先：若已触发取消，用 cancelled 状态收尾
    if (context.isCancelled()) {
      const cancelMsg = 'Chat generation cancelled by user';
      updateRuntimeTask(taskId, { status: 'cancelled' as any, error: cancelMsg });
      completeWorkerRun(workerRunId, 'cancelled' as any, cancelMsg);
      recordRuntimeEvent({ taskId, type: 'task_cancelled', payload: { taskId, status: 'cancelled' } });
      return;
    }

    const latency = Date.now() - startTime;
    const now = Date.now();

    // 写入 assistant 消息到 messages 表
    runInsert(
      `INSERT INTO messages (id, conversation_id, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [messageId, conversationId, 'assistant', fullContent, now]
    );

    // 更新会话的 updated_at
    runExec('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId]);

    updateRuntimeTask(taskId, {
      status: 'completed' as any,
      result: fullContent,
    });
    completeWorkerRun(workerRunId, 'completed' as any);

    recordRuntimeEvent({
      taskId,
      type: 'task_complete',
      payload: {
        taskId,
        status: 'completed',
        conversationId,
        messageId,
        content: fullContent,
        latency,
      }
    });

  } catch (error: any) {
    // 若是 AbortError 且已标记取消，已在上面取消优先块处理，这里静默忽略
    if (error.name === 'AbortError' && context.isCancelled()) {
      return;
    }

    console.error('[LocalChatAdapter] Execution error:', error);
    const message = error.message || 'Chat generation failed';
    updateRuntimeTask(taskId, { status: 'failed', error: message });
    completeWorkerRun(workerRunId, 'failed', message);
    recordRuntimeEvent({ taskId, type: 'task_error', payload: { taskId, error: message } });
  } finally {
    activeChatAborts.delete(taskId);
  }
}

function cancelLocalChat(taskId: string) {
  const abortController = activeChatAborts.get(taskId);
  if (abortController) {
    abortController.abort();
    activeChatAborts.delete(taskId);
  }
}

export const localChatAdapter: RuntimeWorkerAdapter<LocalChatPayload> = {
  type: 'local-chat',
  run: runLocalChat,
  cancel: cancelLocalChat,
};
