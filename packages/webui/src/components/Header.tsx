import React, { useState } from 'react';
import { Sun, Moon, Globe, ChevronDown, LogOut, User as UserIcon, Settings as SettingsIcon, Menu } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loadUser, saveUser, UserAccount } from '../store';
import { useI18n } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { Dialog } from './ui/Dialog';

const Header: React.FC<{ onMenuClick?: () => void }> = ({ onMenuClick }) => {
  const [accountOpen, setAccountOpen] = useState(false);
  const [user, setUser] = useState<UserAccount | null>(() => loadUser());
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, setLocale, t } = useI18n();
  const { isDark, toggleTheme } = useTheme();

  const pageTitle = (() => {
    const path = location.pathname.replace('/', '');
    if (!path) return 'Dashboard';
    return path.charAt(0).toUpperCase() + path.slice(1);
  })();

  const handleLogout = () => {
    saveUser(null);
    setUser(null);
    setAccountOpen(false);
  };

  return (
    <header
      className="h-14 flex items-center justify-between px-6 border-b sticky top-0 z-40"
      style={{
        background: 'var(--glass-header-bg)',
        borderColor: 'var(--md-outline-variant)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* 左侧：页面标题 */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-8 h-8 rounded-md flex items-center justify-center transition-colors flex-none"
          style={{ color: 'var(--md-on-surface-variant)' }}
          title="菜单"
        >
          <Menu size={18} strokeWidth={1.75} />
        </button>
        <h2
          className="text-base font-medium truncate"
          style={{ color: 'var(--md-on-surface)' }}
        >
          {pageTitle}
        </h2>
      </div>

      {/* 右侧：操作区 */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
          style={{ color: 'var(--md-on-surface-variant)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--md-surface-variant)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title={isDark ? '切换到浅色' : '切换到深色'}
        >
          {isDark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
        </button>

        <button
          onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
          className="h-8 px-2.5 rounded-md flex items-center gap-1.5 transition-colors text-xs"
          style={{ color: 'var(--md-on-surface-variant)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--md-surface-variant)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title={locale === 'zh' ? '切换到 English' : '切换到 中文'}
        >
          <Globe size={14} strokeWidth={1.75} />
          <span className="uppercase">{locale}</span>
        </button>

        <div className="w-px h-5 mx-1" style={{ background: 'var(--md-outline-variant)' }} />

        {/* 账号中心（豆包式弹窗） */}
        <button
          onClick={() => setAccountOpen(true)}
          className="h-8 pl-1.5 pr-2 rounded-md flex items-center gap-2 transition-colors"
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--md-surface-variant)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          title="账号中心"
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium"
            style={{
              background: 'var(--md-surface-variant)',
              color: 'var(--md-on-surface)',
            }}
          >
            {user ? user.username.charAt(0).toUpperCase() : '?'}
          </div>
          <ChevronDown size={12} style={{ color: 'var(--md-on-surface-variant)' }} />
        </button>

        {/* Account center dialog */}
        <Dialog open={accountOpen} onClose={() => setAccountOpen(false)} title={undefined} size="sm" showClose={true}>
          <div>
            {/* 头像区 */}
            <div className="flex flex-col items-center pb-4 border-b" style={{ borderColor: 'var(--md-outline-variant)' }}>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold mb-3"
                style={{ background: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)' }}
              >
                {user ? user.username.charAt(0).toUpperCase() : '?'}
              </div>
              {user ? (
                <>
                  <div className="text-base font-medium" style={{ color: 'var(--md-on-surface)' }}>
                    {user.username}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--md-on-surface-variant)' }}>
                    {user.email}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full mt-2" style={{ background: 'var(--md-secondary-container)', color: 'var(--md-on-secondary-container)' }}>
                    OxygenClaw 本地账户
                  </span>
                </>
              ) : (
                <div className="text-sm" style={{ color: 'var(--md-on-surface-variant)' }}>
                  {t.nav.notSignedIn}
                </div>
              )}
            </div>

            {/* 分组入口 */}
            <div className="py-2">
              <button
                onClick={() => { setAccountOpen(false); navigate('/settings'); }}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 rounded-lg transition-colors"
                style={{ color: 'var(--md-on-surface)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--md-surface-variant)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <UserIcon size={15} strokeWidth={1.75} />
                {t.account.profile}
              </button>
              <button
                onClick={() => { setAccountOpen(false); navigate('/settings'); }}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 rounded-lg transition-colors"
                style={{ color: 'var(--md-on-surface)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--md-surface-variant)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <SettingsIcon size={15} strokeWidth={1.75} />
                {t.header.settings}
              </button>
              <button
                onClick={() => { toggleTheme(); }}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 rounded-lg transition-colors"
                style={{ color: 'var(--md-on-surface)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--md-surface-variant)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {isDark ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
                {isDark ? '切换到浅色模式' : '切换到深色模式'}
              </button>
            </div>
            <div className="border-t pt-2" style={{ borderColor: 'var(--md-outline-variant)' }}>
              {user ? (
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 rounded-lg transition-colors"
                  style={{ color: 'var(--md-error)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--md-surface-variant)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <LogOut size={15} strokeWidth={1.75} />
                  {t.account.logout}
                </button>
              ) : (
                <button
                  onClick={() => { setAccountOpen(false); navigate('/settings'); }}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 rounded-lg transition-colors"
                  style={{ color: 'var(--md-on-surface)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--md-surface-variant)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <LogOut size={15} strokeWidth={1.75} />
                  {t.nav.signInRegister}
                </button>
              )}
            </div>
          </div>
        </Dialog>
      </div>
    </header>
  );
};

export default Header;
