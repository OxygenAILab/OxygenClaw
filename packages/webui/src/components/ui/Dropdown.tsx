import { ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownItem {
  /** 唯一键 */
  key: string;
  /** 显示标签 */
  label: ReactNode;
  /** 左侧图标 */
  icon?: ReactNode;
  /** 点击回调 */
  onClick?: () => void;
  /** 是否为危险操作（红色） */
  danger?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否为分隔线（其他字段忽略） */
  divider?: boolean;
}

export interface DropdownProps {
  /** 触发元素 */
  trigger: ReactNode;
  /** 菜单项 */
  items: DropdownItem[];
  /** 对齐方式 */
  align?: 'start' | 'end';
  /** 菜单最小宽度（px） */
  minWidth?: number;
}

/**
 * Dropdown 组件 — 下拉菜单
 *
 * 基于 Portal 渲染，点击外部或选择项后自动关闭。
 *
 * @example
 * ```tsx
 * <Dropdown trigger={<button><MoreVertical /></button>} items={[
 *   { key: 'rename', label: '重命名', icon: <Edit size={14} />, onClick: rename },
 *   { key: 'd1', divider: true },
 *   { key: 'delete', label: '删除', icon: <Trash2 size={14} />, danger: true, onClick: del },
 * ]} />
 * ```
 */
export function Dropdown({
  trigger,
  items,
  align = 'start',
  minWidth = 160,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const computePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = align === 'end' ? rect.right : rect.left;
    setCoords({ x, y: rect.bottom + 4 });
  }, [align]);

  const toggle = useCallback(() => {
    if (!open) computePosition();
    setOpen((v) => !v);
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  return (
    <>
      <div ref={triggerRef} onClick={toggle} className="inline-flex">
        {trigger}
      </div>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[60] py-1 rounded-xl bg-surface-container-high border border-outline-variant shadow-lg animate-scale-in"
            style={{
              left: coords.x,
              top: coords.y,
              minWidth,
              transform: align === 'end' ? 'translateX(-100%)' : undefined,
              transformOrigin: 'top',
            }}
          >
            {items.map((item) =>
              item.divider ? (
                <div
                  key={item.key}
                  className="my-1 h-px bg-outline-variant"
                  role="separator"
                />
              ) : (
                <button
                  key={item.key}
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    item.onClick?.();
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    item.danger
                      ? 'text-error hover:bg-error-container/40'
                      : 'text-on-surface hover:bg-surface-variant'
                  }`}
                >
                  {item.icon && (
                    <span className="flex-shrink-0 flex items-center">{item.icon}</span>
                  )}
                  <span className="flex-1 min-w-0 truncate">{item.label}</span>
                </button>
              )
            )}
          </div>,
          document.body
        )}
    </>
  );
}

Dropdown.displayName = 'Dropdown';
