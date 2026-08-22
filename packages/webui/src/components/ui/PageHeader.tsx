import { HTMLAttributes, ReactNode } from 'react';

export interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 页面标题
   */
  title: string;
  
  /**
   * 副标题/描述
   */
  description?: string;
  
  /**
   * 右侧操作按钮区域
   */
  actions?: ReactNode;
  
  /**
   * 面包屑导航
   */
  breadcrumbs?: ReactNode;
}

/**
 * PageHeader 组件 — 页面头部
 * 
 * @example
 * ```tsx
 * <PageHeader
 *   title="模型管理"
 *   description="配置和管理 AI 模型"
 *   actions={<Button variant="filled">添加模型</Button>}
 * />
 * ```
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className = '',
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={`border-b border-outline-variant bg-surface px-6 py-4 ${className}`}
      {...props}
    >
      {breadcrumbs && <div className="mb-2">{breadcrumbs}</div>}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-on-surface">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
