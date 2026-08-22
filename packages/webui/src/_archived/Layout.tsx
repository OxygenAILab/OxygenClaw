import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const COLLAPSE_KEY = 'oxygenclaw:sidebar-collapsed';

const Layout: React.FC = () => {
  const location = useLocation();
  const isFullBleed = location.pathname.startsWith('/playgrounds');

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileNavOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 animate-slide-in-right">
            <Sidebar
              collapsed={false}
              onToggleCollapse={() => setMobileNavOpen(false)}
              overlay
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className={`flex-1 overflow-y-auto ${isFullBleed ? '' : 'p-4 sm:p-6'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
