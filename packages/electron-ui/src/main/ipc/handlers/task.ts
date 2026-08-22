import { TASK_LIST, TASK_GET, TASK_CANCEL } from '../../../shared/ipc-channels'
import type { Task, TaskCancelRequest } from '../../../shared/ipc-types'
import type { IpcHandler } from '../router'

export const taskHandlers: Record<string, IpcHandler<any, any>> = {
  [TASK_LIST]: async (): Promise<Task[]> => {
    // TODO: 从 DB 读取
    return []
  },

  [TASK_GET]: async (_, { id }: { id: string }): Promise<Task | null> => {
    // TODO: 从 DB 读取
    console.log('[IPC] Get task:', id)
    return null
  },

  [TASK_CANCEL]: async (_, req: TaskCancelRequest): Promise<void> => {
    // TODO: 取消任务执行
    console.log('[IPC] Cancel task:', req.id)
  }
}
