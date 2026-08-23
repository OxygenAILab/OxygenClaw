import React from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Playgrounds from './pages/Playgrounds';
import Models from './pages/Models';
import Settings from './pages/Settings';
import MCP from './pages/MCP';
import Dashboard from './pages/Dashboard';
import Marketplace from './pages/Marketplace';
import { TaskDetailPage } from './pages/TaskDetailPage';
import WelcomeScreen from './components/WelcomeScreen';
import { ToastProvider } from './components/Toast';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './contexts/ThemeContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000, // 30s
    },
  },
});

const WELCOMED_KEY = 'oxygenclaw:welcomed';

const RootRedirect: React.FC = () => {
  const location = useLocation();
  const welcomed = localStorage.getItem(WELCOMED_KEY);
  if (!welcomed) {
    return <Navigate to="/welcome" replace state={{ from: location }} />;
  }
  return <Navigate to="/dashboard" replace />;
};

// 简化布局组件（内联替代旧 Layout.tsx）
const SimpleLayout: React.FC = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>
              <Routes>
                <Route path="/welcome" element={<WelcomeScreen />} />
                <Route path="/" element={<SimpleLayout />}>
                  <Route index element={<RootRedirect />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="workbench" element={<Navigate to="/playgrounds" replace />} />
                  <Route path="tasks" element={<TaskDetailPage />} />
                  <Route path="tasks/:taskId" element={<TaskDetailPage />} />
                  <Route path="playgrounds" element={<Playgrounds />} />
                  <Route path="models" element={<Models />} />
                  <Route path="mcp" element={<MCP />} />
                  <Route path="marketplace" element={<Marketplace />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
