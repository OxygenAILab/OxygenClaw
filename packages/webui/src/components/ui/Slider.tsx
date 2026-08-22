import { forwardRef, InputHTMLAttributes } from 'react';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * 标签文本
   */
  label?: string;
  
  /**
   * 是否显示当前值
   */
  showValue?: boolean;
  
  /**
   * 值格式化函数
   */
  formatValue?: (value: number) => string;
  
  /**
   * 全宽
   */
  fullWidth?: boolean;
}

/**
 * Slider 组件 — OxygenClaw 统一滑块
 * 
 * @example
 * ```tsx
 * <Slider
 *   label="温度"
 *   min={0}
 *   max={2}
 *   step={0.1}
 *   value={temperature}
 *   onChange={(e) => setTemperature(parseFloat(e.target.value))}
 *   showValue
 *   formatValue={(v) => v.toFixed(1)}
 * />
 * ```
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      label,
      showValue = false,
      formatValue,
      fullWidth = false,
      disabled,
      className = '',
      value,
      min = 0,
      max = 100,
      step = 1,
      ...props
    },
    ref
  ) => {
    const currentValue = Number(value ?? min);
    const displayValue = formatValue
      ? formatValue(currentValue)
      : currentValue.toString();

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-on-surface">{label}</label>
            {showValue && (
              <span className="text-sm text-on-surface-variant font-mono">
                {displayValue}
              </span>
            )}
          </div>
        )}
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          className={`
            w-full h-2 rounded-full appearance-none cursor-pointer
            bg-surface-container-high
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-primary
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-surface
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-webkit-slider-thumb]:active:scale-95
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-primary
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-surface
            [&::-moz-range-thumb]:shadow-md
            [&::-moz-range-thumb]:transition-transform
            [&::-moz-range-thumb]:hover:scale-110
            [&::-moz-range-thumb]:active:scale-95
            ${className}
          `}
          {...props}
        />
      </div>
    );
  }
);

Slider.displayName = 'Slider';
