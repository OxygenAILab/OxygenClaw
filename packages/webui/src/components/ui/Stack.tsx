import { HTMLAttributes } from 'react';

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 方向
   */
  direction?: 'horizontal' | 'vertical';
  
  /**
   * 间距大小
   */
  spacing?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
  
  /**
   * 对齐方式（主轴）
   */
  align?: 'start' | 'center' | 'end' | 'stretch';
  
  /**
   * 对齐方式（交叉轴）
   */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  
  /**
   * 是否换行
   */
  wrap?: boolean;
}

/**
 * Stack 组件 — 堆叠布局（Flexbox 快捷方式）
 * 
 * @example
 * ```tsx
 * <Stack direction="horizontal" spacing={4} align="center">
 *   <Button>按钮1</Button>
 *   <Button>按钮2</Button>
 * </Stack>
 * ```
 */
export function Stack({
  direction = 'vertical',
  spacing = 4,
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className = '',
  children,
  ...props
}: StackProps) {
  const directionStyles = direction === 'horizontal' ? 'flex-row' : 'flex-col';
  const spacingStyles = `gap-${spacing}`;
  
  const alignStyles = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }[align];
  
  const justifyStyles = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
  }[justify];

  return (
    <div
      className={`
        flex ${directionStyles} ${spacingStyles} ${alignStyles} ${justifyStyles}
        ${wrap ? 'flex-wrap' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
