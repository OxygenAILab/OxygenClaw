import React from 'react';
import { useRecentTasks, useDeleteTask } from '../hooks/useTasks';
import type { RuntimeTask } from '../../../api/types';

interface TaskListProps {
  selectedId?: string;
  onSelect: (task: RuntimeTask) => void;
  limit?: number;
}

const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-600',
  completed: 'bg-green-100 text-green-600',
  failed: 'bg-red-100 text-red-600',
  cancelled: 'bg-yellow-100 text-yellow-600',
};

const STATUS_LABELS = {
  pending: '等待中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

export const TaskList: React.FC<TaskListProps> = ({
  selectedId,
  onSelect,
  limit = 20,
}) => {
  const { data, isLoading, error } = useRecentTasks(limit);
  const deleteMutation = useDeleteTask();

  const handleDelete = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (confirm('确定删除此任务？')) {
      deleteMutation.mutate(taskId);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        加载任务失败: {error.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#FBF9F5] border-r border-[#E7E1D7]">
      {/* Header */}
      <div className="p-4 border-b border-[#E7E1D7]">
        <h2 className="text-lg font-medium text-[#1F2421]">运行时任务</h2>
        <p className="text-xs text-[#5C635D] mt-1">最近 {limit} 条</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-[#5C635D]">
            加载中...
          </div>
        ) : data?.tasks.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-[#5C635D]">
            暂无任务
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {data?.tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelect(task)}
                className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedId === task.id
                    ? 'bg-white border border-[#C4612F]'
                    : 'hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          STATUS_COLORS[task.status] || STATUS_COLORS.pending
                        }`}
                      >
                        {STATUS_LABELS[task.status] || task.status}
                      </span>
                      {task.kind && (
                        <span className="text-xs text-[#5C635D]">
                          {task.kind}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#1F2421] truncate">
                      {task.prompt || task.id}
                    </p>
                    <p className="text-xs text-[#5C635D] mt-1">
                      {new Date(task.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, task.id)}
                    className="opacity-0 group-hover:opacity-100 ml-2 text-[#5C635D] hover:text-red-500 transition-opacity"
                    title="删除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
