import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bot,
  Plug,
  Settings,
  Sparkles,
  LayoutDashboard,
  Store,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

// Watermark: GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hotkey: 'G+D' },
  { path: '/playgrounds', label: 'Playgrounds', icon: Sparkles, hotkey: 'G+P' },
  { path: '/models', label: 'Models', icon: Bot, hotkey: 'G+M' },
  { path: '/mcp', label: 'MCP', icon: Plug, hotkey: '' },
  { path: '/marketplace', label: 'Marketplace', icon: Store, hotkey: '' },
  { path: '/settings', label: 'Settings', icon: Settings, hotkey: '' },
];

const COLLAPSED_KEY = 'oxygenclaw:sidebar-collapsed';

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      try { localStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1'); } catch {}
      return !prev;
    });
  };

  return (
    <aside
      className="h-full flex flex-col border-r overflow-hidden transition-[width] duration-300"
      style={{
        background: 'var(--md-surface)',
        borderColor: 'var(--md-outline-variant)',
        width: collapsed ? 64 : 240,
      }}
    >
      {/* Logo 区 */}
      <div
        className={`border-b flex items-center flex-shrink-0 ${collapsed ? 'px-3 justify-center h-16' : 'px-6 py-6 gap-3'}`}
        style={{ borderColor: 'var(--md-outline-variant)', minHeight: collapsed ? 64 : 88 }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--md-on-surface)',
            color: 'var(--md-surface)',
            fontWeight: 500,
            fontSize: 14,
          }}
        >
          O₂
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight min-w-0">
            <span
              className="text-sm font-medium truncate"
              style={{ color: 'var(--md-on-surface)' }}
            >
              OxygenClaw
            </span>
            <span
              className="text-[10px] tracking-wider uppercase"
              style={{ color: 'var(--md-on-surface-variant)' }}
            >
              v26 · Alpha
            </span>
          </div>
        )}
      </div>

      {/* 收起/展开按钮 */}
      <div className={`flex ${collapsed ? 'justify-center py-2' : 'justify-end px-3 pt-2'}`}>
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--md-on-surface-variant)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--md-surface-variant)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title={collapsed ? '展开侧栏' : '收起侧栏'}
        >
          {collapsed ? <PanelLeftOpen size={15} strokeWidth={1.75} /> : <PanelLeftClose size={15} strokeWidth={1.75} />}
        </button>
      </div>

      {/* 导航 */}
      <nav className={`flex-1 ${collapsed ? 'px-2 py-2' : 'px-3 py-2'}`}>
        {!collapsed && (
          <p
            className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--md-on-surface-variant)' }}
          >
            Workspace
          </p>
        )}
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-md text-sm transition-all ${
                collapsed ? 'justify-center py-2.5' : 'gap-3 px-3 py-2'
              }`}
              style={({ isActive }) => ({
                background: isActive ? 'var(--md-surface-variant)' : 'transparent',
                color: isActive ? 'var(--md-on-surface)' : 'var(--md-on-surface-variant)',
                fontWeight: isActive ? 500 : 400,
              })}
            >
              <item.icon size={16} strokeWidth={1.75} className="flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hotkey && (
                    <span
                      className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--md-on-surface-variant)' }}
                    >
                      {item.hotkey}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* 底部状态 */}
      <div
        className={`border-t flex items-center gap-2 flex-shrink-0 ${collapsed ? 'px-3 py-4 justify-center' : 'px-6 py-4'}`}
        style={{ borderColor: 'var(--md-outline-variant)' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: 'var(--md-on-surface-variant)' }}
        />
        {!collapsed && (
          <span
            className="text-[11px]"
            style={{ color: 'var(--md-on-surface-variant)' }}
          >
            Local Mode
          </span>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
