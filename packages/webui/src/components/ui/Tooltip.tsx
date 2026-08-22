import { ReactNode, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  /** 提示内容 */
  content: ReactNode;
  /** 触发元素 */
  children: ReactNode;
  /** 方位 */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** 显示延迟（ms） */
  delay?: number;
  /** 禁用 */
  disabled?: boolean;
}

/**
 * Tooltip 组件 — 悬浮提示
 *
 * 基于 Portal 渲染，自动定位，避免被父容器裁剪。
 *
 * @example
 * ```tsx
 * <Tooltip content="删除会话" placement="top">
 *   <button><Trash2 /></button>
 * </Tooltip>
 * ```
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 300,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const computePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    let x = 0;
    let y = 0;
    switch (placement) {
      case 'top':
        x = rect.left + rect.width / 2;
        y = rect.top - gap;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2;
        y = rect.bottom + gap;
        break;
      case 'left':
        x = rect.left - gap;
        y = rect.top + rect.height / 2;
        break;
      case 'right':
        x = rect.right + gap;
        y = rect.top + rect.height / 2;
        break;
    }
    setCoords({ x, y });
  }, [placement]);

  const show = useCallback(() => {
    if (disabled || !content) return;
    timerRef.current = setTimeout(() => {
      computePosition();
      setVisible(true);
    }, delay);
  }, [disabled, content, delay, computePosition]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const transform = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  }[placement];

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[60] px-2.5 py-1.5 rounded-lg text-xs font-medium pointer-events-none animate-fade-in shadow-lg"
            style={{
              left: coords.x,
              top: coords.y,
              transform,
              backgroundColor: 'var(--md-inverse-surface)',
              color: 'var(--md-inverse-on-surface)',
              maxWidth: '240px',
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

Tooltip.displayName = 'Tooltip';
