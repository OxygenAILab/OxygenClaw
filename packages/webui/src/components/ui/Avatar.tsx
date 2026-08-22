import { ImgHTMLAttributes } from 'react';
import { User } from 'lucide-react';

export interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /**
   * 头像 URL
   */
  src?: string;
  
  /**
   * 姓名（用于生成 fallback 首字母）
   */
  name?: string;
  
  /**
   * 尺寸
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * 是否圆形
   */
  rounded?: boolean;
  
  /**
   * 状态点（在线/离线/忙碌）
   */
  status?: 'online' | 'offline' | 'busy';
}

/**
 * Avatar 组件 — OxygenClaw 统一头像
 * 
 * @example
 * ```tsx
 * <Avatar src="/user.jpg" name="张三" size="md" status="online" />
 * <Avatar name="李四" size="lg" rounded />
 * ```
 */
export function Avatar({
  src,
  name,
  size = 'md',
  rounded = true,
  status,
  className = '',
  alt,
  ...props
}: AvatarProps) {
  const sizeStyles = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-2xl',
  }[size];

  const statusDotSize = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4',
  }[size];

  const statusColor = {
    online: 'bg-success',
    offline: 'bg-surface-variant',
    busy: 'bg-warning',
  }[status || 'offline'];

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className={`relative inline-block ${sizeStyles}`}>
      {src ? (
        <img
          src={src}
          alt={alt || name || '头像'}
          className={`
            w-full h-full object-cover
            ${rounded ? 'rounded-full' : 'rounded-lg'}
            ${className}
          `}
          {...props}
        />
      ) : name ? (
        <div
          className={`
            w-full h-full flex items-center justify-center
            bg-primary-container text-on-primary-container
            font-semibold
            ${rounded ? 'rounded-full' : 'rounded-lg'}
            ${className}
          `}
        >
          {getInitials(name)}
        </div>
      ) : (
        <div
          className={`
            w-full h-full flex items-center justify-center
            bg-surface-container text-on-surface-variant
            ${rounded ? 'rounded-full' : 'rounded-lg'}
            ${className}
          `}
        >
          <User className="w-1/2 h-1/2" />
        </div>
      )}
      {status && (
        <span
          className={`
            absolute bottom-0 right-0
            ${statusDotSize} ${statusColor}
            rounded-full border-2 border-surface
          `}
        />
      )}
    </div>
  );
}
