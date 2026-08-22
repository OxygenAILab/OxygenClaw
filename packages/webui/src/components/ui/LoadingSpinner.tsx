import { HTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingSpinnerProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 尺寸
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * 是否居中显示（水平垂直居中）
   */
  centered?: boolean;
  
  /**
   * 加载文案
   */
  label?: string;
}

/**
 * LoadingSpinner 组件 — OxygenClaw 统一加载动画
 * 
 * @example
 * ```tsx
 * <LoadingSpinner size="lg" centered label="加载中..." />
 * <LoadingSpinner size="sm" />
 * ```
 */
export function LoadingSpinner({
  size = 'md',
  centered = false,
  label,
  className = '',
  ...props
}: LoadingSpinnerProps) {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  }[size];

  const spinner = (
    <div
      className={`
        flex flex-col items-center justify-center gap-2
        ${className}
      `}
      {...props}
    >
      <Loader2 className={`${sizeStyles} text-primary animate-spin`} />
      {label && <span className="text-sm text-on-surface-variant">{label}</span>}
    </div>
  );

  if (centered) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[200px]">
        {spinner}
      </div>
    );
  }

  return spinner;
}
