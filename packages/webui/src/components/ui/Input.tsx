import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * 输入框尺寸
   */
  inputSize?: 'sm' | 'md' | 'lg';
  
  /**
   * 标签文本
   */
  label?: string;
  
  /**
   * 错误提示文本
   */
  error?: string;
  
  /**
   * 辅助提示文本
   */
  helper?: string;
  
  /**
   * 左侧图标
   */
  leftIcon?: ReactNode;
  
  /**
   * 右侧图标
   */
  rightIcon?: ReactNode;
  
  /**
   * 全宽
   */
  fullWidth?: boolean;
}

/**
 * Input 组件 — OxygenClaw 统一文本输入框
 * 
 * @example
 * ```tsx
 * <Input
 *   label="邮箱地址"
 *   placeholder="your@email.com"
 *   error="邮箱格式不正确"
 *   leftIcon={<Mail />}
 * />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      inputSize = 'md',
      label,
      error,
      helper,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const hasError = Boolean(error);

    const sizeStyles = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-3 text-sm',
      lg: 'h-12 px-4 text-base',
    }[inputSize];

    const inputStyles = [
      'rounded-lg border transition-all',
      'bg-surface text-on-surface placeholder:text-on-surface-variant',
      'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
      hasError
        ? 'border-error focus:ring-error'
        : 'border-outline-variant hover:border-outline',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
      leftIcon ? 'pl-10' : '',
      rightIcon ? 'pr-10' : '',
      fullWidth ? 'w-full' : '',
    ].join(' ');

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label className="block text-sm font-medium text-on-surface mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={`${inputStyles} ${sizeStyles} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              {rightIcon}
            </div>
          )}
        </div>
        {(error || helper) && (
          <p className={`mt-1.5 text-xs ${hasError ? 'text-error' : 'text-on-surface-variant'}`}>
            {error || helper}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
