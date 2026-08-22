import { HTMLAttributes, ReactNode } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * Badge 变体
   * - filled: 实心
   * - tonal: 容器色
   * - outlined: 边框
   */
  variant?: 'filled' | 'tonal' | 'outlined';
  
  /**
   * 颜色方案
   * - primary: 主色
   * - secondary: 次色
   * - success: 成功
   * - warning: 警告
   * - error: 错误
   * - info: 信息
   */
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  
  /**
   * 尺寸
   */
  size?: 'sm' | 'md';
  
  /**
   * 左侧图标/元素
   */
  leftIcon?: ReactNode;
  
  /**
   * 右侧图标/元素
   */
  rightIcon?: ReactNode;
}

/**
 * Badge 组件 — OxygenClaw 统一徽章
 * 
 * @example
 * ```tsx
 * <Badge color="success" variant="tonal">已完成</Badge>
 * <Badge color="error" variant="filled" leftIcon={<AlertCircle />}>失败</Badge>
 * ```
 */
export function Badge({
  variant = 'filled',
  color = 'primary',
  size = 'sm',
  leftIcon,
  rightIcon,
  className = '',
  children,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: 'h-5 px-2 text-xs gap-1',
    md: 'h-6 px-2.5 text-sm gap-1.5',
  }[size];

  const colorStyles = {
    filled: {
      primary: 'bg-primary text-on-primary',
      secondary: 'bg-secondary text-on-secondary',
      success: 'bg-success text-on-success',
      warning: 'bg-warning text-on-warning',
      error: 'bg-error text-on-error',
      info: 'bg-info text-on-info',
    },
    tonal: {
      primary: 'bg-primary-container text-on-primary-container',
      secondary: 'bg-secondary-container text-on-secondary-container',
      success: 'bg-success-container text-on-success-container',
      warning: 'bg-warning-container text-on-warning-container',
      error: 'bg-error-container text-on-error-container',
      info: 'bg-info-container text-on-info-container',
    },
    outlined: {
      primary: 'border border-primary text-primary',
      secondary: 'border border-secondary text-secondary',
      success: 'border border-success text-success',
      warning: 'border border-warning text-warning',
      error: 'border border-error text-error',
      info: 'border border-info text-info',
    },
  }[variant][color];

  return (
    <span
      className={`
        inline-flex items-center justify-center
        rounded-full font-medium whitespace-nowrap
        ${sizeStyles} ${colorStyles} ${className}
      `}
      {...props}
    >
      {leftIcon && <span className="inline-flex">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="inline-flex">{rightIcon}</span>}
    </span>
  );
}
