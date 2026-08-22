import {
  MCP_LIST_SERVERS,
  MCP_ADD_SERVER,
  MCP_REMOVE_SERVER,
  MCP_RESTART_SERVER
} from '../../../shared/ipc-channels'
import type {
  McpServer,
  McpAddServerRequest,
  McpRemoveServerRequest,
  McpRestartServerRequest
} from '../../../shared/ipc-types'
import type { IpcHandler } from '../router'

export const mcpHandlers: Record<string, IpcHandler<any, any>> = {
  [MCP_LIST_SERVERS]: async (): Promise<McpServer[]> => {
    // TODO: Phase 2 接入 MCP Manager
    return []
  },

  [MCP_ADD_SERVER]: async (_, req: McpAddServerRequest): Promise<McpServer> => {
    // TODO: Phase 2 接入 MCP Manager
    console.log('[IPC] Add MCP server:', req.name)
    return {
      id: `mcp_${Date.now()}`,
      name: req.name,
      command: req.command,
      args: req.args,
      env: req.env,
      status: 'stopped'
    }
  },

  [MCP_REMOVE_SERVER]: async (_, req: McpRemoveServerRequest): Promise<void> => {
    // TODO: Phase 2 接入 MCP Manager
    console.log('[IPC] Remove MCP server:', req.id)
  },

  [MCP_RESTART_SERVER]: async (_, req: McpRestartServerRequest): Promise<void> => {
    // TODO: Phase 2 接入 MCP Manager
    console.log('[IPC] Restart MCP server:', req.id)
  }
}
