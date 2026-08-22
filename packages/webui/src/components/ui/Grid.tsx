import { HTMLAttributes } from 'react';

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 列数（响应式）
   * - 数字: 固定列数
   * - 'auto-fit': 自动适应（最小列宽 minColWidth）
   */
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 'auto-fit';
  
  /**
   * 最小列宽（用于 auto-fit 模式）
   */
  minColWidth?: string;
  
  /**
   * 间距大小
   */
  spacing?: 2 | 3 | 4 | 5 | 6 | 8;
  
  /**
   * 行间距（默认与 spacing 相同）
   */
  rowSpacing?: 2 | 3 | 4 | 5 | 6 | 8;
}

/**
 * Grid 组件 — 网格布局
 * 
 * @example
 * ```tsx
 * <Grid cols={3} spacing={4}>
 *   <Card>卡片1</Card>
 *   <Card>卡片2</Card>
 *   <Card>卡片3</Card>
 * </Grid>
 * 
 * <Grid cols="auto-fit" minColWidth="300px" spacing={6}>
 *   <Card>自适应卡片</Card>
 * </Grid>
 * ```
 */
export function Grid({
  cols = 3,
  minColWidth = '250px',
  spacing = 4,
  rowSpacing,
  className = '',
  children,
  ...props
}: GridProps) {
  const gapX = `gap-x-${spacing}`;
  const gapY = `gap-y-${rowSpacing || spacing}`;

  const gridCols =
    cols === 'auto-fit'
      ? { gridTemplateColumns: `repeat(auto-fit, minmax(${minColWidth}, 1fr))` }
      : {};

  const gridColsClass = typeof cols === 'number' ? `grid-cols-${cols}` : '';

  return (
    <div
      className={`grid ${gridColsClass} ${gapX} ${gapY} ${className}`}
      style={gridCols}
      {...props}
    >
      {children}
    </div>
  );
}
