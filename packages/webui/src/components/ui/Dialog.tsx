import { ReactNode, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface DialogProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调（点击遮罩、按 Esc、点关闭按钮时触发） */
  onClose: () => void;
  /** 标题 */
  title?: ReactNode;
  /** 描述文本（标题下方） */
  description?: ReactNode;
  /** 底部操作区 */
  footer?: ReactNode;
  /** 内容 */
  children?: ReactNode;
  /**
   * 尺寸
   * - sm: 360px
   * - md: 480px（默认）
   * - lg: 640px
   * - xl: 800px
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** 是否显示关闭按钮 */
  showClose?: boolean;
  /** 点击遮罩是否关闭 */
  closeOnOverlay?: boolean;
  /** 额外类名 */
  className?: string;
}

/**
 * Dialog 组件 — 模态对话框
 *
 * 基于 Portal 渲染到 body，支持 Esc 关闭、遮罩关闭、滚动锁定。
 *
 * @example
 * ```tsx
 * <Dialog open={open} onClose={() => setOpen(false)} title="确认删除"
 *   footer={<><Button variant="text" onClick={close}>取消</Button><Button onClick={confirm}>删除</Button></>}>
 *   此操作不可撤销，确定继续吗？
 * </Dialog>
 * ```
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = 'md',
  showClose = true,
  closeOnOverlay = true,
  className = '',
}: DialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${sizeStyles} bg-surface-container rounded-2xl shadow-xl flex flex-col max-h-[90vh] animate-scale-in ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-4 p-5 pb-3">
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
              )}
              {description && (
                <p className="text-sm text-on-surface-variant mt-1">{description}</p>
              )}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                className="p-1.5 -mr-1.5 -mt-1.5 rounded-lg text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors flex-shrink-0"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {children && (
          <div className="flex-1 overflow-y-auto px-5 py-2 text-sm text-on-surface">
            {children}
          </div>
        )}

        {footer && (
          <div className="flex items-center justify-end gap-2 p-5 pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

Dialog.displayName = 'Dialog';
