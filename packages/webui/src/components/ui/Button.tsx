import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button 样式变体
   * - filled: 实心主色按钮（默认）
   * - tonal: 低调容器色按钮
   * - outlined: 边框按钮
   * - text: 文本按钮
   * - ghost: 幽灵按钮（hover 才有背景）
   */
  variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'ghost';
  
  /**
   * 尺寸
   * - sm: 32px 高度
   * - md: 40px 高度（默认）
   * - lg: 48px 高度
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * 加载状态（显示 spinner，禁用点击）
   */
  loading?: boolean;
  
  /**
   * 左侧图标
   */
  leftIcon?: ReactNode;
  
  /**
   * 右侧图标
   */
  rightIcon?: ReactNode;
  
  /**
   * 全宽按钮
   */
  fullWidth?: boolean;
}

/**
 * Button 组件 — OxygenClaw 统一按钮
 * 
 * 基于 Material 3 Button 规范，支持多种变体与状态。
 * 
 * @example
 * ```tsx
 * <Button variant="filled" size="md" leftIcon={<Plus />}>
 *   新建对话
 * </Button>
 * 
 * <Button variant="outlined" loading>
 *   保存中...
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'filled',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    // 基础样式
    const baseStyles = [
      'inline-flex items-center justify-center gap-2',
      'font-medium transition-all',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
      fullWidth ? 'w-full' : '',
    ].join(' ');

    // 尺寸样式
    const sizeStyles = {
      sm: 'h-8 px-3 text-sm rounded-lg',
      md: 'h-10 px-4 text-sm rounded-lg',
      lg: 'h-12 px-6 text-base rounded-xl',
    }[size];

    // 变体样式
    const variantStyles = {
      filled: [
        'bg-primary text-on-primary',
        'hover:opacity-90 active:opacity-80',
        'focus-visible:ring-primary',
      ].join(' '),
      tonal: [
        'bg-primary-container text-on-primary-container',
        'hover:bg-opacity-90 active:bg-opacity-80',
        'focus-visible:ring-primary',
      ].join(' '),
      outlined: [
        'border border-outline text-on-surface',
        'hover:bg-surface-container active:bg-surface-container-high',
        'focus-visible:ring-primary',
      ].join(' '),
      text: [
        'text-primary',
        'hover:bg-primary-container hover:bg-opacity-20',
        'active:bg-primary-container active:bg-opacity-30',
        'focus-visible:ring-primary',
      ].join(' '),
      ghost: [
        'text-on-surface',
        'hover:bg-surface-container active:bg-surface-container-high',
        'focus-visible:ring-outline',
      ].join(' '),
    }[variant];

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!loading && leftIcon && <span className="inline-flex">{leftIcon}</span>}
        {children}
        {!loading && rightIcon && <span className="inline-flex">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
