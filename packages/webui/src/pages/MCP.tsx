import React, { useState, useEffect } from 'react';
import {
  Server, Plus, Copy, RefreshCw, Trash2, ExternalLink,
  CheckCircle, AlertCircle, MoreVertical
} from 'lucide-react';
import { useToast } from '../components/Toast';
import {
  PageHeader, Button, Badge, Card, Dialog, EmptyState, Dropdown,
  type DropdownItem
} from '../components/ui';

interface McpAgent {
  id: string;
  agent_id: string;
  agent_type: string;
  main_agent_id: string | null;
  name: string;
  description: string | null;
  token: string;
  status: string;
  last_seen_at: string | null;
  created_at: string;
}

interface McpTask {
  id: string;
  main_agent_id: string;
  sub_agent_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  created_at: string;
  completed_at: string | null;
}

const LOCAL_MCP_AGENTS_KEY = 'oxygenclaw:mcp-agents';
const LOCAL_MCP_TASKS_KEY = 'oxygenclaw:mcp-tasks';

function getLocalAgents(): McpAgent[] {
  try {
    const data = localStorage.getItem(LOCAL_MCP_AGENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalAgents(agents: McpAgent[]): void {
  localStorage.setItem(LOCAL_MCP_AGENTS_KEY, JSON.stringify(agents));
}

function getLocalTasks(): McpTask[] {
  try {
    const data = localStorage.getItem(LOCAL_MCP_TASKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

const MCP: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'server' | 'agents' | 'tasks' | 'clients'>('server');
  const [agents, setAgents] = useState<McpAgent[]>([]);
  const [tasks, setTasks] = useState<McpTask[]>([]);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({
    agentId: '',
    name: '',
    description: '',
    type: 'sub-agent',
    mainAgentId: '',
  });
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    setAgents(getLocalAgents());
    setTasks(getLocalTasks());
  }, []);

  const handleAddAgent = () => {
    if (!newAgent.agentId.trim() || !newAgent.name.trim()) {
      showToast({ type: 'error', title: '请填写 Agent ID 和名称' });
      return;
    }

    const agent: McpAgent = {
      id: `mcp-agent-${Date.now()}`,
      agent_id: newAgent.agentId,
      agent_type: newAgent.type,
      main_agent_id: newAgent.mainAgentId || null,
      name: newAgent.name,
      description: newAgent.description || null,
      token: `token-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      status: 'active',
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const updated = [...agents, agent];
    setAgents(updated);
    saveLocalAgents(updated);
    setShowAddAgent(false);
    setNewAgent({ agentId: '', name: '', description: '', type: 'sub-agent', mainAgentId: '' });
    showToast({ type: 'success', title: 'Agent 注册成功' });
  };

  const handleDeleteAgent = (id: string) => {
    if (!confirm('确定要删除这个 Agent 吗？')) return;
    const updated = agents.filter(a => a.id !== id);
    setAgents(updated);
    saveLocalAgents(updated);
    showToast({ type: 'success', title: '已删除' });
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    showToast({ type: 'success', title: 'Token 已复制' });
  };

  const handleCopyConfig = () => {
    const config = getMcpConfigJson();
    navigator.clipboard.writeText(config);
    showToast({ type: 'success', title: '配置已复制' });
  };

  const getMcpConfigJson = (): string => {
    return JSON.stringify({
      mcpServers: {
        oxygenclaw: {
          url: `${window.location.origin}/api/mcp`,
          headers: {
            Authorization: 'Bearer <your-token-here>',
          },
        },
      },
    }, null, 2);
  };

  const mainAgents = agents.filter(a => a.agent_type === 'main-agent');
  const subAgents = agents.filter(a => a.agent_type === 'sub-agent');

  const tabs = [
    { id: 'server', label: '服务器' },
    { id: 'agents', label: 'Agent 管理' },
    { id: 'tasks', label: '任务' },
    { id: 'clients', label: 'MCP 客户端' },
  ];

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="MCP"
        description="OxygenClaw 作为 MCP 服务器，支持外源 Agent 接入和任务调度"
        actions={
          <>
            <Button
              variant="tonal"
              size="sm"
              leftIcon={<Server size={14} />}
              onClick={() => setShowConfig(!showConfig)}
            >
              配置 JSON
            </Button>
            <Button
              variant="filled"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => setShowAddAgent(true)}
            >
              注册 Agent
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full">

      <div className="segmented-control mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`segmented-control-item ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {showConfig && (
        <div className="mb-6 card animate-slide-down">
          <div className="flex items-center justify-between mb-3">
            <div className="text-on-surface font-medium">MCP 接入配置</div>
            <button
              onClick={handleCopyConfig}
              className="px-3 py-1 bg-surface-variant text-on-surface-variant rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-outline-variant/50 transition-colors"
            >
              <Copy size={12} />
              复制
            </button>
          </div>
          <pre className="text-on-surface-variant font-mono text-xs overflow-auto max-h-64 bg-surface-variant p-3 rounded-lg">
            {getMcpConfigJson()}
          </pre>
          <div className="mt-3 pt-3 border-t border-outline-variant text-xs text-on-surface-variant">
            <p>将此配置添加到你的 MCP 客户端（如 Claude Desktop、OpenClaw 等）的 mcp.json 中，</p>
            <p>替换 <code className="text-primary">{'<your-token-here>'}</code> 为你的 Agent Token。</p>
          </div>
        </div>
      )}

      {activeTab === 'server' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-medium text-on-surface mb-4">
              服务器状态
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-surface-variant rounded-lg">
                <div className="text-2xl font-semibold text-on-surface">{agents.length}</div>
                <div className="text-xs text-on-surface-variant mt-1">已注册 Agent</div>
              </div>
              <div className="p-4 bg-surface-variant rounded-lg">
                <div className="text-2xl font-semibold text-on-surface">{mainAgents.length}</div>
                <div className="text-xs text-on-surface-variant mt-1">Main Agent</div>
              </div>
              <div className="p-4 bg-surface-variant rounded-lg">
                <div className="text-2xl font-semibold text-on-surface">{subAgents.length}</div>
                <div className="text-xs text-on-surface-variant mt-1">Sub Agent</div>
              </div>
              <div className="p-4 bg-surface-variant rounded-lg">
                <div className="text-2xl font-semibold text-on-surface">{tasks.length}</div>
                <div className="text-xs text-on-surface-variant mt-1">任务总数</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-medium text-on-surface mb-4">
              接入能力
            </h2>
            <div className="space-y-3">
              {[
                { name: 'Agent 注册', desc: '支持 main-agent 和 sub-agent 注册', enabled: true },
                { name: '任务分配', desc: 'Main Agent 可向 Sub Agent 分配任务', enabled: true },
                { name: '任务交付', desc: 'Sub Agent 完成任务后交付结果', enabled: true },
                { name: 'LLM 代理', desc: '通过 OxygenClaw 调用模型能力', enabled: true },
                { name: '工具调用', desc: '共享 MCP 工具集', enabled: false },
              ].map(cap => (
                <div key={cap.name} className="flex items-center gap-3 p-3 bg-surface-variant rounded-lg transition-apple hover:bg-outline-variant/50">
                  {cap.enabled ? (
                    <CheckCircle size={18} className="text-success flex-shrink-0" />
                  ) : (
                    <AlertCircle size={18} className="text-on-surface-variant flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-on-surface">{cap.name}</div>
                    <div className="text-xs text-on-surface-variant">{cap.desc}</div>
                  </div>
                  <Badge variant="tonal" color={cap.enabled ? 'success' : 'secondary'}>
                    {cap.enabled ? '已启用' : '开发中'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-medium text-on-surface mb-4">
              API 端点
            </h2>
            <div className="space-y-2 font-mono text-xs">
              {[
                ['POST', '/api/mcp/agents/register', '注册 Agent'],
                ['POST', '/api/mcp/tasks/wait', '等待任务（Sub Agent 轮询）'],
                ['POST', '/api/mcp/tasks/deliver', '交付任务结果'],
                ['POST', '/api/mcp/tasks/assign', '分配任务（Main Agent）'],
                ['GET', '/api/mcp/agents', '列出所有 Agent'],
                ['GET', '/api/mcp/tasks', '列出所有任务'],
                ['GET', '/api/mcp/config', '获取服务器配置'],
                ['GET', '/api/mcp/tools', '获取可用工具'],
              ].map(([method, path, desc]) => (
                <div key={path} className="flex items-center gap-3 p-2 rounded hover:bg-surface-variant transition-colors">
                  <Badge 
                    variant="tonal" 
                    color={method === 'GET' ? 'success' : 'primary'}
                    className="w-16 justify-center font-bold"
                  >
                    {method}
                  </Badge>
                  <code className="text-on-surface">{path}</code>
                  <span className="text-on-surface-variant ml-auto text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'agents' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-on-surface">已注册 Agent</h2>
            <Button
              variant="tonal"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={() => { setAgents(getLocalAgents()); }}
            >
              刷新
            </Button>
          </div>

          {agents.length === 0 ? (
            <Card variant="outlined">
              <EmptyState
                icon={Server}
                title="暂无已注册 Agent"
                description="注册外源 Agent 以扩展 OxygenClaw 的能力"
                action={
                  <Button
                    variant="filled"
                    size="md"
                    leftIcon={<Plus size={14} />}
                    onClick={() => setShowAddAgent(true)}
                  >
                    注册 Agent
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {agents.map(agent => {
                const agentMenuItems: DropdownItem[] = [
                  {
                    key: 'copy-token',
                    label: '复制 Token',
                    icon: <Copy size={14} />,
                    onClick: () => handleCopyToken(agent.token),
                  },
                  { key: 'div1', label: '', divider: true },
                  {
                    key: 'delete',
                    label: '删除',
                    icon: <Trash2 size={14} />,
                    danger: true,
                    onClick: () => handleDeleteAgent(agent.id),
                  },
                ];

                return (
                  <Card key={agent.id} variant="outlined">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-medium text-on-surface flex items-center gap-2">
                          {agent.name}
                          <Badge variant="tonal" color={agent.agent_type === 'main-agent' ? 'info' : 'primary'}>
                            {agent.agent_type === 'main-agent' ? 'Main' : 'Sub'}
                          </Badge>
                          <Badge variant="tonal" color={agent.status === 'active' ? 'success' : 'secondary'}>
                            {agent.status === 'active' ? '在线' : '离线'}
                          </Badge>
                        </div>
                        <div className="text-xs text-on-surface-variant mt-1">
                          ID: {agent.agent_id}
                          {agent.main_agent_id && ` · 绑定于: ${agent.main_agent_id}`}
                        </div>
                      </div>
                      <Dropdown
                        align="end"
                        trigger={
                          <Button variant="ghost" size="sm" className="!px-2">
                            <MoreVertical size={16} />
                          </Button>
                        }
                        items={agentMenuItems}
                      />
                    </div>
                    {agent.description && (
                      <div className="text-sm text-on-surface-variant mb-2">{agent.description}</div>
                    )}
                    <div className="text-xs text-on-surface-variant flex items-center gap-4">
                      <span>注册于: {new Date(agent.created_at).toLocaleDateString()}</span>
                      {agent.last_seen_at && (
                        <span>最后在线: {new Date(agent.last_seen_at).toLocaleString()}</span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-on-surface">任务列表</h2>
            <Button
              variant="tonal"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={() => { setTasks(getLocalTasks()); }}
            >
              刷新
            </Button>
          </div>

          {tasks.length === 0 ? (
            <Card variant="outlined">
              <EmptyState
                icon={RefreshCw}
                title="暂无任务"
                description="通过 Main Agent 分配任务给 Sub Agent"
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <Card key={task.id} variant="outlined">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-on-surface">{task.title}</div>
                    <Badge 
                      variant="tonal" 
                      color={
                        task.status === 'completed' ? 'success' :
                        task.status === 'processing' ? 'primary' :
                        task.status === 'assigned' ? 'warning' : 'secondary'
                      }
                    >
                      {task.status === 'completed' ? '已完成' : 
                       task.status === 'processing' ? '处理中' : 
                       task.status === 'assigned' ? '已分配' : task.status}
                    </Badge>
                  </div>
                  {task.description && (
                    <div className="text-sm text-on-surface-variant mb-2">{task.description}</div>
                  )}
                  <div className="text-xs text-on-surface-variant flex items-center gap-4">
                    <span>Main: {task.main_agent_id}</span>
                    {task.sub_agent_id && <span>Sub: {task.sub_agent_id}</span>}
                    <span>创建于: {new Date(task.created_at).toLocaleString()}</span>
                    {task.completed_at && <span>完成于: {new Date(task.completed_at).toLocaleString()}</span>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'clients' && (
        <div>
          <h2 className="text-lg font-medium text-on-surface mb-4">MCP 客户端</h2>
          <Card variant="outlined">
            <EmptyState
              icon={Server}
              title="暂无 MCP 客户端连接"
              description="配置 MCP 客户端以接入外部工具和服务"
              action={
                <Button
                  variant="filled"
                  size="md"
                  leftIcon={<ExternalLink size={14} />}
                  onClick={() => window.open('https://openclawmp.stepfun.com', '_blank')}
                >
                  了解更多
                </Button>
              }
            />
          </Card>
        </div>
      )}

      <Dialog
        open={showAddAgent}
        onClose={() => setShowAddAgent(false)}
        title="注册 Agent"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="text" size="sm" onClick={() => setShowAddAgent(false)}>
              取消
            </Button>
            <Button variant="filled" size="sm" onClick={handleAddAgent}>
              注册
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">Agent 类型</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewAgent(prev => ({ ...prev, type: 'main-agent' }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newAgent.type === 'main-agent'
                        ? 'bg-tertiary-container text-tertiary'
                        : 'bg-surface-variant text-on-surface-variant'
                    }`}
                  >
                    Main Agent
                  </button>
                  <button
                    onClick={() => setNewAgent(prev => ({ ...prev, type: 'sub-agent' }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newAgent.type === 'sub-agent'
                        ? 'bg-primary-container text-primary'
                        : 'bg-surface-variant text-on-surface-variant'
                    }`}
                  >
                    Sub Agent
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">Agent ID</label>
                <input
                  type="text"
                  value={newAgent.agentId}
                  onChange={e => setNewAgent(prev => ({ ...prev, agentId: e.target.value }))}
                  placeholder="main-agent@xxxxxxxx 或 sub-agent ID"
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">名称</label>
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={e => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Agent 显示名称"
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">描述</label>
                <textarea
                  value={newAgent.description}
                  onChange={e => setNewAgent(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="简短描述这个 Agent 的作用"
                  rows={2}
                  className="w-full resize-none"
                />
              </div>
              {newAgent.type === 'sub-agent' && (
                <div>
                  <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">绑定 Main Agent ID</label>
                  <input
                    type="text"
                    value={newAgent.mainAgentId}
                    onChange={e => setNewAgent(prev => ({ ...prev, mainAgentId: e.target.value }))}
                    placeholder="可选，绑定到特定的 Main Agent"
                    className="w-full"
                  />
                </div>
              )}
        </div>
      </Dialog>
      </div>
    </div>
  );
};

export default MCP;
