import { Router, Request, Response } from 'express';
import { runQuery, runExec } from '../services/db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

function ensureTables() {
  try {
    runExec(`
      CREATE TABLE IF NOT EXISTS mcp_agents (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_type TEXT NOT NULL DEFAULT 'sub-agent',
        main_agent_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active',
        config TEXT,
        last_seen_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  } catch {}

  try {
    runExec(`
      CREATE TABLE IF NOT EXISTS mcp_tasks (
        id TEXT PRIMARY KEY,
        main_agent_id TEXT NOT NULL,
        sub_agent_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        input_data TEXT,
        output_data TEXT,
        result_path TEXT,
        deliverable_note TEXT,
        assigned_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  } catch {}
}

ensureTables();

const PACKAGE_VERSION = '26.0.0-alpha.1';

function generateToken(): string {
  return 'oc-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

router.get('/config', (_req, res) => {
  const config = {
    mcpVersion: '2024-11-05',
    server: {
      name: 'OxygenClaw MCP Server',
      version: PACKAGE_VERSION,
    },
    capabilities: {
      agentRegistration: true,
      taskAssignment: true,
      taskDelivery: true,
      llmProxy: true,
    },
    endpoints: {
      register: '/api/mcp/agents/register',
      waitTask: '/api/mcp/tasks/wait',
      deliverTask: '/api/mcp/tasks/deliver',
      tools: '/api/mcp/tools',
      llm: '/api/mcp/llm/chat',
    },
    auth: {
      type: 'bearer-token',
      header: 'Authorization',
    },
  };

  res.json({
    success: true,
    data: config,
  });
});

router.get('/tools', (_req, res) => {
  const tools = [
    {
      name: 'list_agents',
      description: '列出所有已注册的 Agent',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['main', 'sub', 'all'] },
        },
      },
    },
    {
      name: 'assign_task',
      description: '给 sub-agent 分配任务',
      inputSchema: {
        type: 'object',
        properties: {
          subAgentId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          inputData: { type: 'object' },
        },
        required: ['subAgentId', 'title'],
      },
    },
    {
      name: 'get_task_status',
      description: '获取任务状态',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
        },
        required: ['taskId'],
      },
    },
  ];

  res.json({
    success: true,
    data: { tools },
  });
});

router.post('/agents/register', (req, res) => {
  try {
    const { agentId, name, description, type = 'sub-agent', mainAgentId } = req.body;

    if (!agentId || !name) {
      return res.status(400).json({
        success: false,
        error: 'agentId and name are required',
      });
    }

    const existing = runQuery('SELECT * FROM mcp_agents WHERE agent_id = ?', [agentId])[0] as any;
    const token = existing?.token || generateToken();
    const now = new Date().toISOString();
    const id = existing?.id || `agent-${Date.now()}`;

    if (existing) {
      runExec(
        'UPDATE mcp_agents SET name = ?, description = ?, agent_type = ?, main_agent_id = ?, last_seen_at = ?, updated_at = ? WHERE id = ?',
        [name, description || null, type, mainAgentId || null, now, now, id]
      );
    } else {
      runExec(
        'INSERT INTO mcp_agents (id, agent_id, agent_type, main_agent_id, name, description, token, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, agentId, type, mainAgentId || null, name, description || null, token, 'active', now, now]
      );
    }

    const agent = runQuery('SELECT * FROM mcp_agents WHERE id = ?', [id])[0];

    res.json({
      success: true,
      data: {
        agent,
        token,
        serverEndpoints: {
          baseUrl: '/api/mcp',
          waitTask: '/api/mcp/tasks/wait',
          deliverTask: '/api/mcp/tasks/deliver',
          llmChat: '/api/mcp/llm/chat',
        },
      },
    });
  } catch (error: any) {
    console.error('[MCP] Register error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
});

router.get('/agents', (_req, res) => {
  try {
    const agents = runQuery('SELECT id, agent_id, agent_type, main_agent_id, name, description, status, last_seen_at, created_at FROM mcp_agents ORDER BY created_at DESC') as any[];

    res.json({
      success: true,
      data: {
        agents,
        total: agents.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post('/agents/:id/delete', (req, res) => {
  try {
    const { id } = req.params;
    runExec('DELETE FROM mcp_agents WHERE id = ?', [id]);

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post('/tasks/wait', (req, res) => {
  try {
    const { agentId, timeout = 30000 } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'agentId is required',
      });
    }

    const task = runQuery(
      'SELECT * FROM mcp_tasks WHERE sub_agent_id = ? AND status = ? ORDER BY priority DESC, created_at ASC LIMIT 1',
      [agentId, 'assigned']
    )[0] as any;

    if (task) {
      runExec(
        'UPDATE mcp_tasks SET status = ?, updated_at = ? WHERE id = ?',
        ['processing', new Date().toISOString(), task.id]
      );

      return res.json({
        success: true,
        data: {
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            inputData: task.input_data ? JSON.parse(task.input_data) : null,
            priority: task.priority,
          },
          hasTask: true,
        },
      });
    }

    res.json({
      success: true,
      data: {
        task: null,
        hasTask: false,
        waitTime: timeout,
      },
    });
  } catch (error: any) {
    console.error('[MCP] Wait task error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Wait task failed',
    });
  }
});

router.post('/tasks/deliver', (req, res) => {
  try {
    const { taskId, agentId, outputData, resultPath, deliverableNote } = req.body;

    if (!taskId || !agentId) {
      return res.status(400).json({
        success: false,
        error: 'taskId and agentId are required',
      });
    }

    const now = new Date().toISOString();
    runExec(
      'UPDATE mcp_tasks SET status = ?, output_data = ?, result_path = ?, deliverable_note = ?, completed_at = ?, updated_at = ? WHERE id = ?',
      [
        'completed',
        outputData ? JSON.stringify(outputData) : null,
        resultPath || null,
        deliverableNote || null,
        now,
        now,
        taskId,
      ]
    );

    const task = runQuery('SELECT * FROM mcp_tasks WHERE id = ?', [taskId])[0];

    res.json({
      success: true,
      data: {
        task,
        delivered: true,
      },
    });
  } catch (error: any) {
    console.error('[MCP] Deliver task error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Deliver task failed',
    });
  }
});

router.post('/tasks/assign', (req, res) => {
  try {
    const { mainAgentId, subAgentId, title, description, inputData, priority = 0 } = req.body;

    if (!mainAgentId || !subAgentId || !title) {
      return res.status(400).json({
        success: false,
        error: 'mainAgentId, subAgentId and title are required',
      });
    }

    const taskId = `task-${Date.now()}`;
    const now = new Date().toISOString();

    runExec(
      'INSERT INTO mcp_tasks (id, main_agent_id, sub_agent_id, title, description, status, priority, input_data, assigned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        taskId,
        mainAgentId,
        subAgentId,
        title,
        description || null,
        'assigned',
        priority,
        inputData ? JSON.stringify(inputData) : null,
        now,
        now,
        now,
      ]
    );

    const task = runQuery('SELECT * FROM mcp_tasks WHERE id = ?', [taskId])[0];

    res.json({
      success: true,
      data: { task },
    });
  } catch (error: any) {
    console.error('[MCP] Assign task error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Assign task failed',
    });
  }
});

router.get('/tasks', (req, res) => {
  try {
    const { agentId, status } = req.query;
    let query = 'SELECT * FROM mcp_tasks';
    const params: any[] = [];
    const conditions: string[] = [];

    if (agentId) {
      conditions.push('(main_agent_id = ? OR sub_agent_id = ?)');
      params.push(agentId, agentId);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC LIMIT 100';

    const tasks = runQuery(query, params) as any[];

    res.json({
      success: true,
      data: { tasks, total: tasks.length },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

interface JsonRpcRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number | string | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface McpSession {
  id: string;
  agentId: string;
  agentInfo: any;
  initialized: boolean;
  sseResponse: Response | null;
  createdAt: string;
  lastActiveAt: string;
}

const sessions = new Map<string, McpSession>();

const MCP_PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = {
  name: 'OxygenClaw MCP Server',
  version: PACKAGE_VERSION,
};

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

function authenticateAgent(token: string): any | null {
  const agent = runQuery('SELECT * FROM mcp_agents WHERE token = ? AND status = ?', [token, 'active'])[0];
  return agent || null;
}

function getSessionId(req: Request): string | null {
  return (req.headers['mcp-session-id'] as string) || null;
}

function getOrCreateSession(req: Request, agentInfo: any): McpSession {
  const sessionId = getSessionId(req);
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    session.lastActiveAt = new Date().toISOString();
    return session;
  }

  const newSessionId = uuidv4();
  const newSession: McpSession = {
    id: newSessionId,
    agentId: agentInfo.agent_id,
    agentInfo,
    initialized: false,
    sseResponse: null,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
  sessions.set(newSessionId, newSession);
  return newSession;
}

const mcpTools = [
  {
    name: 'list_agents',
    description: '列出所有已注册的 Agent',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['main', 'sub', 'all'],
          description: 'Agent 类型过滤',
        },
      },
    },
  },
  {
    name: 'register_agent',
    description: '注册一个新的 Agent',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID' },
        name: { type: 'string', description: 'Agent 名称' },
        description: { type: 'string', description: 'Agent 描述' },
        type: {
          type: 'string',
          enum: ['main-agent', 'sub-agent'],
          description: 'Agent 类型',
        },
        mainAgentId: { type: 'string', description: '主 Agent ID（仅 sub-agent 需要）' },
      },
      required: ['agentId', 'name'],
    },
  },
  {
    name: 'assign_task',
    description: '给子 Agent 分配任务',
    inputSchema: {
      type: 'object',
      properties: {
        subAgentId: { type: 'string', description: '子 Agent ID' },
        title: { type: 'string', description: '任务标题' },
        description: { type: 'string', description: '任务描述' },
        inputData: { type: 'object', description: '输入数据' },
        priority: { type: 'number', description: '优先级' },
      },
      required: ['subAgentId', 'title'],
    },
  },
  {
    name: 'get_task_status',
    description: '获取任务状态',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务 ID' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'list_tasks',
    description: '列出任务',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID' },
        status: { type: 'string', description: '任务状态过滤' },
      },
    },
  },
  {
    name: 'deliver_task',
    description: '提交任务结果',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: '任务 ID' },
        outputData: { type: 'object', description: '输出数据' },
        resultPath: { type: 'string', description: '结果路径' },
        deliverableNote: { type: 'string', description: '交付说明' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'chat_completion',
    description: '调用 LLM 聊天补全',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: '模型 ID' },
        messages: {
          type: 'array',
          description: '消息列表',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' },
            },
          },
        },
        temperature: { type: 'number', description: '温度' },
        maxTokens: { type: 'number', description: '最大 token 数' },
      },
      required: ['model', 'messages'],
    },
  },
  {
    name: 'list_models',
    description: '列出可用模型',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function handleToolCall(toolName: string, args: any, session: McpSession): Promise<any> {
  switch (toolName) {
    case 'list_agents': {
      const { type = 'all' } = args;
      let query = 'SELECT id, agent_id, agent_type, main_agent_id, name, description, status, created_at FROM mcp_agents';
      const params: any[] = [];

      if (type === 'main') {
        query += ' WHERE agent_type = ?';
        params.push('main-agent');
      } else if (type === 'sub') {
        query += ' WHERE agent_type = ?';
        params.push('sub-agent');
      }

      query += ' ORDER BY created_at DESC';
      const agents = runQuery(query, params);
      return { agents, total: agents.length };
    }

    case 'register_agent': {
      const { agentId, name, description, type = 'sub-agent', mainAgentId } = args;

      if (!agentId || !name) {
        throw new Error('agentId and name are required');
      }

      const existing = runQuery('SELECT * FROM mcp_agents WHERE agent_id = ?', [agentId])[0] as any;
      const token = existing?.token || generateToken();
      const now = new Date().toISOString();
      const id = existing?.id || `agent-${Date.now()}`;

      if (existing) {
        runExec(
          'UPDATE mcp_agents SET name = ?, description = ?, agent_type = ?, main_agent_id = ?, last_seen_at = ?, updated_at = ? WHERE id = ?',
          [name, description || null, type, mainAgentId || null, now, now, id]
        );
      } else {
        runExec(
          'INSERT INTO mcp_agents (id, agent_id, agent_type, main_agent_id, name, description, token, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, agentId, type, mainAgentId || null, name, description || null, token, 'active', now, now]
        );
      }

      const agent = runQuery('SELECT * FROM mcp_agents WHERE id = ?', [id])[0];
      return { agent, token };
    }

    case 'assign_task': {
      const { subAgentId, title, description, inputData, priority = 0 } = args;

      if (!subAgentId || !title) {
        throw new Error('subAgentId and title are required');
      }

      const taskId = `task-${Date.now()}`;
      const now = new Date().toISOString();

      runExec(
        'INSERT INTO mcp_tasks (id, main_agent_id, sub_agent_id, title, description, status, priority, input_data, assigned_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          taskId,
          session.agentId,
          subAgentId,
          title,
          description || null,
          'assigned',
          priority,
          inputData ? JSON.stringify(inputData) : null,
          now,
          now,
          now,
        ]
      );

      const task = runQuery('SELECT * FROM mcp_tasks WHERE id = ?', [taskId])[0];
      return { task };
    }

    case 'get_task_status': {
      const { taskId } = args;

      if (!taskId) {
        throw new Error('taskId is required');
      }

      const task = runQuery('SELECT * FROM mcp_tasks WHERE id = ?', [taskId])[0];
      if (!task) {
        throw new Error('Task not found');
      }

      return { task };
    }

    case 'list_tasks': {
      const { agentId, status } = args;
      let query = 'SELECT * FROM mcp_tasks';
      const params: any[] = [];
      const conditions: string[] = [];

      if (agentId) {
        conditions.push('(main_agent_id = ? OR sub_agent_id = ?)');
        params.push(agentId, agentId);
      }
      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY created_at DESC LIMIT 100';

      const tasks = runQuery(query, params);
      return { tasks, total: tasks.length };
    }

    case 'deliver_task': {
      const { taskId, outputData, resultPath, deliverableNote } = args;

      if (!taskId) {
        throw new Error('taskId is required');
      }

      const now = new Date().toISOString();
      runExec(
        'UPDATE mcp_tasks SET status = ?, output_data = ?, result_path = ?, deliverable_note = ?, completed_at = ?, updated_at = ? WHERE id = ?',
        [
          'completed',
          outputData ? JSON.stringify(outputData) : null,
          resultPath || null,
          deliverableNote || null,
          now,
          now,
          taskId,
        ]
      );

      const task = runQuery('SELECT * FROM mcp_tasks WHERE id = ?', [taskId])[0];
      return { task, delivered: true };
    }

    case 'list_models': {
      const providers = runQuery('SELECT * FROM model_providers WHERE user_id IS NULL');
      const models: any[] = [];

      for (const provider of providers as any[]) {
        const providerModels = runQuery(
          'SELECT * FROM models WHERE provider_id = ? AND enabled = 1',
          [provider.id]
        );
        for (const m of providerModels as any[]) {
          models.push({
            id: `${provider.id}:${m.name}`,
            name: m.name,
            displayName: m.display_name || m.name,
            provider: provider.type,
            providerId: provider.id,
            providerName: provider.name,
            supportsVision: !!m.supports_vision,
            supportsTools: !!m.supports_tools,
            contextWindow: m.context_window,
            maxOutput: m.max_output,
          });
        }
      }

      return { models };
    }

    case 'chat_completion': {
      const { model: modelId, messages, temperature = 0.7, maxTokens = 4096 } = args;

      if (!modelId || !messages) {
        throw new Error('model and messages are required');
      }

      const parts = modelId.split(':');
      if (parts.length < 2) {
        throw new Error('Invalid model ID format');
      }

      const providerId = parts[0];
      const modelName = parts.slice(1).join(':');

      const provider = runQuery(
        'SELECT * FROM model_providers WHERE id = ? AND user_id IS NULL',
        [providerId]
      )[0] as any;

      if (!provider) {
        throw new Error('Provider not found');
      }

      const model = runQuery(
        'SELECT * FROM models WHERE provider_id = ? AND name = ? AND enabled = 1',
        [providerId, modelName]
      )[0] as any;

      if (!model) {
        throw new Error('Model not found or not enabled');
      }

      const { callLLM } = await import('@oxygen-claw/core');

      const modelConfig = {
        name: model.name,
        provider: provider.type === 'openai-compatible' ? 'openai' : provider.type,
        apiKey: provider.api_key,
        baseUrl: provider.base_url,
        maxTokens: model.max_output || 4096,
        supportsVision: !!model.supports_vision,
        supportsTools: !!model.supports_tools,
      };

      const result = await callLLM(modelConfig as any, messages, {
        temperature,
        maxTokens,
      });

      return {
        content: result.content,
        finishReason: result.finishReason || 'stop',
        usage: result.usage,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function handleMcpRequest(
  request: JsonRpcRequest,
  session: McpSession
): Promise<JsonRpcResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize': {
        const { protocolVersion, capabilities, clientInfo } = params || {};

        session.initialized = true;

        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
            serverInfo: SERVER_INFO,
          },
        };
      }

      case 'notifications/initialized': {
        return {
          jsonrpc: '2.0',
          id: null,
        };
      }

      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: mcpTools,
          },
        };
      }

      case 'tools/call': {
        const { name, arguments: args } = params || {};

        if (!name) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'Tool name is required',
            },
          };
        }

        const tool = mcpTools.find((t) => t.name === name);
        if (!tool) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Unknown tool: ${name}`,
            },
          };
        }

        try {
          const result = await handleToolCall(name, args || {}, session);

          const content = Array.isArray(result)
            ? result.map((item) => ({
                type: 'text',
                text: JSON.stringify(item, null, 2),
              }))
            : [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ];

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content,
            },
          };
        } catch (toolError: any) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32000,
              message: toolError.message || 'Tool execution failed',
            },
          };
        }
      }

      case 'resources/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            resources: [],
          },
        };
      }

      case 'prompts/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            prompts: [],
          },
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error: any) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message || 'Internal error',
      },
    };
  }
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32001,
          message: 'Unauthorized: Missing bearer token',
        },
      });
    }

    const agentInfo = authenticateAgent(token);
    if (!agentInfo) {
      return res.status(401).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32001,
          message: 'Unauthorized: Invalid token',
        },
      });
    }

    const session = getOrCreateSession(req, agentInfo);

    const request = req.body as JsonRpcRequest;
    if (!request || request.jsonrpc !== '2.0' || !request.method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: request?.id || null,
        error: {
          code: -32700,
          message: 'Invalid JSON-RPC request',
        },
      });
    }

    const response = await handleMcpRequest(request, session);

    res.setHeader('mcp-session-id', session.id);
    res.setHeader('Content-Type', 'application/json');
    res.json(response);
  } catch (error: any) {
    console.error('[MCP Standard] Request error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: error.message || 'Internal server error',
      },
    });
  }
});

router.get('/sse', (req: Request, res: Response) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).send('Unauthorized: Missing bearer token');
  }

  const agentInfo = authenticateAgent(token);
  if (!agentInfo) {
    return res.status(401).send('Unauthorized: Invalid token');
  }

  const session = getOrCreateSession(req, agentInfo);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('mcp-session-id', session.id);

  session.sseResponse = res;

  const endpointEvent = {
    jsonrpc: '2.0',
    method: 'notifications/endpoint',
    params: {
      uri: '/api/mcp',
    },
  };

  res.write(`event: message\ndata: ${JSON.stringify(endpointEvent)}\n\n`);

  const heartbeatInterval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(heartbeatInterval);
      return;
    }
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    session.sseResponse = null;
    console.log(`[MCP SSE] Session ${session.id} disconnected`);
  });

  console.log(`[MCP SSE] Session ${session.id} connected for agent ${session.agentId}`);
});

export default router;
