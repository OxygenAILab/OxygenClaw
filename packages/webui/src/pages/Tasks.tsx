import React, { useState, useEffect } from 'react';
import { Plus, Play, Pause, Trash2, Clock, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { agentApi, llmApi, AgentTask, ModelInfo } from '../services/api';
import { useToast } from '../components/Toast';
import { PageHeader, Button, Badge, Card, Dialog, EmptyState } from '../components/ui';

const Tasks: React.FC = () => {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskPrompt, setNewTaskPrompt] = useState('');
  const [selectedMode, setSelectedMode] = useState<'quick' | 'expert' | 'task'>('expert');
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const result = await agentApi.getTasks();
      if (result.success && result.data) {
        setTasks(result.data);
      } else {
        setTasks([]);
      }
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    llmApi.getModels().then(result => {
      const availableModels = result.data?.models || [];
      setModels(availableModels);
      setSelectedModelId(current => current || availableModels[0]?.id || '');
    }).catch(() => undefined);
  }, []);

  const getStatusIcon = (status: AgentTask['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-success" />;
      case 'running': return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case 'failed': return <XCircle className="w-5 h-5 text-error" />;
      default: return <Clock className="w-5 h-5 text-on-surface-variant" />;
    }
  };

  const getModeBadgeColor = (mode?: string) => {
    switch (mode) {
      case 'quick':
      case 'fast': return 'success';
      case 'expert':
      case 'think': return 'primary';
      case 'task':
      case 'research': return 'info';
      default: return 'secondary';
    }
  };

  const formatDuration = (createdAt: string, updatedAt?: string): string => {
    const start = new Date(createdAt).getTime();
    const end = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    const diff = Math.max(0, Math.floor((end - start) / 1000));
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const submitTask = async () => {
    if (!newTaskPrompt.trim()) return;
    if (!selectedModelId) {
      showToast({ type: 'error', title: '创建任务失败', description: '请先选择模型' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await agentApi.execute({
        prompt: newTaskPrompt.trim(),
        mode: selectedMode === 'quick' ? 'chat' : 'task',
        capability: selectedMode === 'expert' ? 'expert' : selectedMode === 'quick' ? 'fast' : 'research',
        modelId: selectedModelId,
      });

      if (result && typeof result === 'object' && 'success' in result && !result.success) {
        showToast({ type: 'error', title: '创建任务失败', description: (result as any).error });
      } else {
        showToast({ type: 'success', title: '任务已创建' });
        setShowNewTask(false);
        setNewTaskPrompt('');
        setTimeout(fetchTasks, 1000);
      }
    } catch (e: any) {
      showToast({ type: 'error', title: '创建任务失败', description: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  const stats = {
    total: tasks.length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="任务"
        description="管理和监控 Agent 任务"
        actions={
          <>
            <Button
              variant="tonal"
              size="sm"
              leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              onClick={fetchTasks}
              disabled={loading}
            >
              刷新
            </Button>
            <Button
              variant="filled"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowNewTask(true)}
            >
              新建任务
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full space-y-6">

      {/* Task Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant="outlined">
          <p className="text-sm text-on-surface-variant">总任务数</p>
          <p className="text-2xl font-semibold text-on-surface mt-1">{stats.total}</p>
        </Card>
        <Card variant="outlined">
          <p className="text-sm text-on-surface-variant">运行中</p>
          <p className="text-2xl font-semibold text-primary mt-1">{stats.running}</p>
        </Card>
        <Card variant="outlined">
          <p className="text-sm text-on-surface-variant">已完成</p>
          <p className="text-2xl font-semibold text-success mt-1">{stats.completed}</p>
        </Card>
        <Card variant="outlined">
          <p className="text-sm text-on-surface-variant">失败</p>
          <p className="text-2xl font-semibold text-error mt-1">{stats.failed}</p>
        </Card>
      </div>

      {/* Tasks List */}
      <Card variant="outlined" padding="none">
        <div className="p-4 border-b border-outline-variant">
          <h2 className="text-base font-medium text-on-surface">任务列表</h2>
        </div>
        {loading && tasks.length === 0 ? (
          <div className="py-12 text-center">
            <Loader2 size={32} className="mx-auto animate-spin text-on-surface-variant mb-3" />
            <div className="text-sm text-on-surface-variant">加载中...</div>
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="暂无任务"
            description="创建你的第一个任务，让 Agent 帮你完成工作"
            action={
              <Button variant="filled" size="md" onClick={() => setShowNewTask(true)}>
                创建任务
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-outline-variant">
            {tasks.map((task) => (
              <div key={task.id} className="p-4 hover:bg-surface-variant/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(task.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-on-surface font-medium truncate">
                        {task.prompt || task.task || '未命名任务'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="tonal" color={getModeBadgeColor(task.mode || task.status) as any}>
                          {task.mode || task.status}
                        </Badge>
                        <span className="text-xs text-on-surface-variant">
                          {task.steps?.length || 0} 步骤
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          {formatDuration(task.createdAt, task.updatedAt)}
                        </span>
                        <span className="text-xs text-on-surface-variant">
                          {new Date(task.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {task.status === 'running' ? (
                      <button className="p-2 rounded-lg hover:bg-surface-variant text-on-surface-variant hover:text-on-surface">
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : (
                      <button className="p-2 rounded-lg hover:bg-surface-variant text-on-surface-variant hover:text-on-surface">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('确定要删除这个任务吗？')) {
                          setTasks(prev => prev.filter(t => t.id !== task.id));
                          showToast({ type: 'success', title: '任务已删除' });
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-surface-variant text-on-surface-variant hover:text-error"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* New Task Modal */}
      <Dialog
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        title="创建新任务"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="text" size="sm" onClick={() => setShowNewTask(false)}>
              取消
            </Button>
            <Button
              variant="filled"
              size="sm"
              leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              onClick={submitTask}
              disabled={!newTaskPrompt.trim() || !selectedModelId || submitting}
            >
              {submitting ? '提交中...' : '运行任务'}
            </Button>
          </div>
        }
      >
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-on-surface-variant mb-1.5">任务描述</label>
                <textarea
                  value={newTaskPrompt}
                  onChange={(e) => setNewTaskPrompt(e.target.value)}
                  placeholder="描述你的任务..."
                  className="w-full h-24 p-3 bg-surface-variant rounded-lg border border-outline-variant focus:border-primary outline-none resize-none text-sm text-on-surface"
                />
              </div>
              <div>
                <label className="block text-sm text-on-surface-variant mb-1.5">模型</label>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="w-full p-2.5 bg-surface-variant rounded-lg border border-outline-variant focus:border-primary outline-none text-sm text-on-surface"
                >
                  {models.length === 0 ? (
                    <option value="">暂无可用模型</option>
                  ) : models.map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-on-surface-variant mb-1.5">模式</label>
                <div className="flex gap-2">
                  {(['quick', 'expert', 'task'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSelectedMode(mode)}
                      className={`flex-1 py-2 px-4 rounded-lg border transition-all text-sm font-medium ${
                        selectedMode === mode
                          ? 'border-primary bg-primary-container text-primary'
                          : 'border-outline-variant hover:border-outline text-on-surface-variant'
                      }`}
                    >
                      {mode === 'quick' ? '快速' : mode === 'expert' ? '专家' : '任务'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
      </Dialog>
      </div>
    </div>
  );
};

export default Tasks;
