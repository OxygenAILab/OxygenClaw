import { forwardRef, InputHTMLAttributes } from 'react';

export interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /**
   * Toggle 尺寸
   */
  toggleSize?: 'sm' | 'md' | 'lg';
  
  /**
   * 标签文本（右侧）
   */
  label?: string;
  
  /**
   * 描述文本
   */
  description?: string;
}

/**
 * Toggle 组件 — OxygenClaw 统一开关
 * 
 * @example
 * ```tsx
 * <Toggle
 *   label="启用自动保存"
 *   description="修改后自动保存草稿"
 *   checked={autoSave}
 *   onChange={(e) => setAutoSave(e.target.checked)}
 * />
 * ```
 */
export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  (
    {
      toggleSize = 'md',
      label,
      description,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      sm: { track: 'w-8 h-5', thumb: 'w-3.5 h-3.5', translate: 'translate-x-3' },
      md: { track: 'w-10 h-6', thumb: 'w-4 h-4', translate: 'translate-x-4' },
      lg: { track: 'w-12 h-7', thumb: 'w-5 h-5', translate: 'translate-x-5' },
    }[toggleSize];

    return (
      <label
        className={`inline-flex items-start gap-3 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${className}`}
      >
        <div className="relative flex-shrink-0">
          <input
            ref={ref}
            type="checkbox"
            disabled={disabled}
            className="sr-only peer"
            {...props}
          />
          <div
            className={`
              ${sizeStyles.track}
              rounded-full transition-colors
              bg-surface-container-highest
              peer-checked:bg-primary
              peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2
            `}
          />
          <div
            className={`
              ${sizeStyles.thumb}
              absolute top-1 left-1 rounded-full transition-transform
              bg-outline
              peer-checked:bg-on-primary peer-checked:${sizeStyles.translate}
            `}
          />
        </div>
        {(label || description) && (
          <div className="flex-1 min-w-0">
            {label && (
              <div className="text-sm font-medium text-on-surface">{label}</div>
            )}
            {description && (
              <div className="text-xs text-on-surface-variant mt-0.5">{description}</div>
            )}
          </div>
        )}
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';
