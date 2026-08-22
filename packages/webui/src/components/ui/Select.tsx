import { forwardRef, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * 选择框尺寸
   */
  selectSize?: 'sm' | 'md' | 'lg';
  
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
   * 选项数据
   */
  options?: Array<{ value: string | number; label: string; disabled?: boolean }>;
  
  /**
   * 全宽
   */
  fullWidth?: boolean;
}

/**
 * Select 组件 — OxygenClaw 统一下拉选择框
 * 
 * @example
 * ```tsx
 * <Select
 *   label="选择模型"
 *   options={[
 *     { value: 'gpt-4', label: 'GPT-4' },
 *     { value: 'claude-3', label: 'Claude 3' },
 *   ]}
 * />
 * ```
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      selectSize = 'md',
      label,
      error,
      helper,
      options,
      disabled,
      fullWidth = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const hasError = Boolean(error);

    const sizeStyles = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-3 text-sm',
      lg: 'h-12 px-4 text-base',
    }[selectSize];

    const selectStyles = [
      'rounded-lg border transition-all appearance-none',
      'bg-surface text-on-surface',
      'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
      hasError
        ? 'border-error focus:ring-error'
        : 'border-outline-variant hover:border-outline',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      'pr-10', // 为下拉箭头留空间
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
          <select
            ref={ref}
            disabled={disabled}
            className={`${selectStyles} ${sizeStyles} ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none"
          />
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

Select.displayName = 'Select';
