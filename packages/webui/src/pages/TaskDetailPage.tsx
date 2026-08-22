import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTask, useCancelTask } from '../features/tasks/hooks/useTasks';
import { useTaskEventsStream } from '../features/tasks/hooks/useTaskEventsStream';
import { TaskList } from '../features/tasks/components/TaskList';
import { EventTimeline } from '../features/tasks/components/EventTimeline';
import { SSEStatusIndicator } from '../components/SSEStatusIndicator';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { RuntimeTask, RuntimeTaskWithEvents } from '../api/types';

export const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const { data: taskDetail, isLoading, error } = useTask(taskId || null);
  const cancelMutation = useCancelTask();

  const { events, isStreaming, error: streamingError, startStreaming, stopStreaming } = useTaskEventsStream({
    taskId: taskId || '',
    onComplete: () => {
      console.log('Task streaming completed');
    },
    onError: (err) => {
      console.error('Task streaming error:', err);
    },
  });

  // Start streaming when task is selected and in running state
  useEffect(() => {
    if (!taskId || !taskDetail) return;

    const task = taskDetail.task as RuntimeTaskWithEvents;
    if (task.status === 'running' && !isStreaming) {
      const lastSeq = task.events[task.events.length - 1]?.seq || 0;
      startStreaming(lastSeq);
    }

    return () => {
      stopStreaming();
    };
  }, [taskId, taskDetail, isStreaming, startStreaming, stopStreaming]);

  const handleTaskSelect = (task: RuntimeTask) => {
    navigate(`/tasks/${task.id}`);
  };

  const handleCancel = () => {
    if (!taskId) return;
    if (confirm('确定取消此任务？')) {
      cancelMutation.mutate(taskId);
    }
  };

  const handleBack = () => {
    navigate('/tasks');
  };

  // Merge stored events + streaming events
  const task = taskDetail?.task as RuntimeTaskWithEvents | undefined;
  const allEvents = [
    ...(task?.events || []),
    ...events,
  ];

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#F7F4EF]">
        {/* Left: Task List */}
        <div className="w-80 flex-shrink-0">
          <TaskList
            selectedId={taskId}
            onSelect={handleTaskSelect}
            limit={20}
          />
        </div>

        {/* Right: Task Detail */}
        <div className="flex-1 flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-[#5C635D]">
              加载中...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              加载失败: {error.message}
            </div>
          ) : !taskDetail ? (
            <div className="flex items-center justify-center h-full text-[#5C635D]">
              <div className="text-center">
                <p className="text-lg mb-2">请从左侧选择任务</p>
                <button
                  onClick={handleBack}
                  className="px-4 py-2 bg-white border border-[#E7E1D7] rounded-full hover:border-[#C4612F] transition-colors"
                >
                  返回任务列表
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-white border-b border-[#E7E1D7] px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleBack}
                      className="text-[#5C635D] hover:text-[#C4612F]"
                      title="返回"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <div>
                      <h1 className="text-xl font-medium text-[#1F2421]">
                        {taskDetail.task.prompt || taskDetail.task.id}
                      </h1>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(taskDetail.task.status)}`}>
                          {getStatusLabel(taskDetail.task.status)}
                        </span>
                        {taskDetail.task.kind && (
                          <span className="text-xs text-[#5C635D]">{taskDetail.task.kind}</span>
                        )}
                        <span className="text-xs text-[#5C635D]">
                          {new Date(taskDetail.task.createdAt).toLocaleString('zh-CN')}
                        </span>
                        <SSEStatusIndicator
                          isConnected={isStreaming}
                          error={streamingError}
                        />
                      </div>
                    </div>
                  </div>

                  {taskDetail.task.status === 'running' && (
                    <button
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                      className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      {cancelMutation.isPending ? '取消中...' : '取消任务'}
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="max-w-4xl mx-auto">
                {/* Task metadata */}
                {taskDetail.task.metadata && Object.keys(taskDetail.task.metadata).length > 0 && (
                  <div className="mb-6 p-4 bg-white rounded-lg border border-[#E7E1D7]">
                    <h2 className="text-sm font-medium text-[#1F2421] mb-2">任务元数据</h2>
                    <pre className="text-xs text-[#5C635D] overflow-x-auto">
                      {JSON.stringify(taskDetail.task.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Event timeline */}
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-[#1F2421] mb-3">事件时间线</h2>
                  <EventTimeline events={allEvents} isStreaming={isStreaming} />
                </div>

                {/* Worker runs (if any) */}
                {task?.workerRuns && task.workerRuns.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-sm font-medium text-[#1F2421] mb-3">Worker 运行记录</h2>
                    <div className="space-y-2">
                      {task.workerRuns.map((run) => (
                        <div key={run.id} className="p-3 bg-white rounded-lg border border-[#E7E1D7]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-[#1F2421]">Run #{run.id}</span>
                            <span className="text-xs text-[#5C635D]">
                              {new Date(run.startedAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          {run.metadata && (
                            <pre className="text-xs text-[#5C635D] bg-[#FBF9F5] p-2 rounded overflow-x-auto">
                              {JSON.stringify(run.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

function getStatusColor(status: string) {
  if (status === 'pending') return 'bg-gray-100 text-gray-600';
  if (status === 'running') return 'bg-blue-100 text-blue-600';
  if (status === 'completed') return 'bg-green-100 text-green-600';
  if (status === 'failed') return 'bg-red-100 text-red-600';
  if (status === 'cancelled') return 'bg-yellow-100 text-yellow-600';
  return 'bg-gray-100 text-gray-600';
}

function getStatusLabel(status: string) {
  if (status === 'pending') return '等待中';
  if (status === 'running') return '运行中';
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '失败';
  if (status === 'cancelled') return '已取消';
  return status;
}
