import { forwardRef, HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 卡片变体
   * - elevated: 带阴影（默认）
   * - outlined: 边框卡片
   * - filled: 填充背景卡片
   */
  variant?: 'elevated' | 'outlined' | 'filled';
  
  /**
   * Hover 时是否 lift（增加阴影）
   */
  hover?: boolean;
  
  /**
   * 禁用 hover 效果（静态卡片）
   */
  static?: boolean;
  
  /**
   * 可点击卡片（显示指针光标 + hover/active 状态）
   */
  clickable?: boolean;
  
  /**
   * 内边距大小
   * - none: 无内边距
   * - sm: 12px
   * - md: 16px（默认）
   * - lg: 24px
   */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  
  /**
   * 卡片头部（自动添加底边距）
   */
  header?: ReactNode;
  
  /**
   * 卡片底部（自动添加顶边距）
   */
  footer?: ReactNode;
}

/**
 * Card 组件 — OxygenClaw 统一卡片容器
 * 
 * 基于 Material 3 Card 规范，支持多种变体与交互状态。
 * 
 * @example
 * ```tsx
 * <Card variant="elevated" hover clickable onClick={handleClick}>
 *   <h3>卡片标题</h3>
 *   <p>卡片内容</p>
 * </Card>
 * 
 * <Card variant="outlined" padding="lg" header={<h2>头部</h2>} footer={<Button>操作</Button>}>
 *   内容区域
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'elevated',
      hover = false,
      static: isStatic = false,
      clickable = false,
      padding = 'md',
      header,
      footer,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    // 基础样式
    const baseStyles = [
      'rounded-xl border transition-all',
      clickable ? 'cursor-pointer' : '',
      isStatic ? '' : 'transition-shadow duration-200',
    ].join(' ');

    // 内边距样式
    const paddingStyles = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    }[padding];

    // 变体样式
    const variantStyles = {
      elevated: [
        'bg-surface-container border-transparent',
        'shadow-md',
        !isStatic && hover ? 'hover:shadow-lg hover:-translate-y-0.5' : '',
        clickable ? 'active:shadow-sm active:translate-y-0' : '',
      ].join(' '),
      outlined: [
        'bg-surface border-outline-variant',
        !isStatic && hover ? 'hover:border-outline hover:bg-surface-container' : '',
        clickable ? 'active:bg-surface-container-high' : '',
      ].join(' '),
      filled: [
        'bg-surface-container-high border-transparent',
        !isStatic && hover ? 'hover:bg-surface-container-highest' : '',
        clickable ? 'active:bg-surface-container' : '',
      ].join(' '),
    }[variant];

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variantStyles} ${paddingStyles} ${className}`}
        {...props}
      >
        {header && (
          <div className={`${padding !== 'none' ? 'mb-4' : ''}`}>
            {header}
          </div>
        )}
        {children}
        {footer && (
          <div className={`${padding !== 'none' ? 'mt-4 pt-4 border-t border-outline-variant' : ''}`}>
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';
