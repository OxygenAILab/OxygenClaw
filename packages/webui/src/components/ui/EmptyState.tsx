import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  /**
   * 图标组件
   */
  icon?: LucideIcon;
  
  /**
   * 标题
   */
  title: string;
  
  /**
   * 描述文本
   */
  description?: string;
  
  /**
   * 操作按钮区域
   */
  action?: ReactNode;
  
  /**
   * 图标大小
   */
  iconSize?: 'md' | 'lg';
}

/**
 * EmptyState 组件 — OxygenClaw 统一空状态
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon={Inbox}
 *   title="暂无对话"
 *   description="点击下方按钮创建新对话"
 *   action={<Button variant="filled">新建对话</Button>}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  iconSize = 'lg',
}: EmptyStateProps) {
  const iconSizeClass = {
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }[iconSize];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="mb-4">
          <Icon className={`${iconSizeClass} text-on-surface-variant opacity-40`} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-on-surface mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-on-surface-variant max-w-sm mb-6">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
