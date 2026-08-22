import { HTMLAttributes } from 'react';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 最大宽度
   */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  
  /**
   * 是否水平居中
   */
  centered?: boolean;
  
  /**
   * 内边距
   */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Container 组件 — 内容容器
 * 
 * @example
 * ```tsx
 * <Container maxWidth="lg" padding="md">
 *   内容区域
 * </Container>
 * ```
 */
export function Container({
  maxWidth = 'xl',
  centered = true,
  padding = 'md',
  className = '',
  children,
  ...props
}: ContainerProps) {
  const maxWidthStyles = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  }[maxWidth];

  const paddingStyles = {
    none: '',
    sm: 'px-4 py-3',
    md: 'px-6 py-4',
    lg: 'px-8 py-6',
  }[padding];

  return (
    <div
      className={`
        ${maxWidthStyles}
        ${centered ? 'mx-auto' : ''}
        ${paddingStyles}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
