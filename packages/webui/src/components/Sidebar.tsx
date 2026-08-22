import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bot,
  Plug,
  Settings,
  Sparkles,
  LayoutDashboard,
  Store,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/playgrounds', label: 'Playgrounds', icon: Sparkles },
  { path: '/models', label: 'Models', icon: Bot },
  { path: '/mcp', label: 'MCP', icon: Plug },
  { path: '/marketplace', label: 'Marketplace', icon: Store },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar: React.FC = () => {
  return (
    <aside
      className="w-60 flex flex-col border-r"
      style={{
        background: 'var(--md-surface)',
        borderColor: 'var(--md-outline-variant)',
      }}
    >
      {/* Logo 区 */}
      <div
        className="px-6 py-6 border-b flex items-center gap-3"
        style={{ borderColor: 'var(--md-outline-variant)' }}
      >
        <div
          className="flex items-center justify-center"
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
        <div className="flex flex-col leading-tight">
          <span
            className="text-sm font-medium"
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
      </div>

      {/* 导航 */}
      <nav className="flex-1 px-3 py-4">
        <p
          className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--md-on-surface-variant)' }}
        >
          Workspace
        </p>
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all"
              style={({ isActive }) => ({
                background: isActive ? 'var(--md-surface-variant)' : 'transparent',
                color: isActive ? 'var(--md-on-surface)' : 'var(--md-on-surface-variant)',
                fontWeight: isActive ? 500 : 400,
              })}
            >
              <item.icon size={16} strokeWidth={1.75} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* 底部状态 */}
      <div
        className="px-6 py-4 border-t flex items-center gap-2"
        style={{ borderColor: 'var(--md-outline-variant)' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--md-on-surface-variant)' }}
        />
        <span
          className="text-[11px]"
          style={{ color: 'var(--md-on-surface-variant)' }}
        >
          Local Mode
        </span>
      </div>
    </aside>
  );
};

export default Sidebar;
