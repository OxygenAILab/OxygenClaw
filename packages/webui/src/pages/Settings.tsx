import React, { useState, useEffect } from 'react';
import {
  User, Eye, Bell, Puzzle, Crown, Wrench, Info,
  Palette, MessageSquare, Clock, Folder,
  ChevronRight, Edit2, X, Loader2, Plus, ExternalLink, Save, RefreshCw,
  Settings as SettingsIcon, BarChart3, Download,
  Upload, Trash2, Sparkles
} from 'lucide-react';
import { authApi, settingsApi, User as ApiUser, AppSettings } from '../services/api';
import { useToast } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../i18n';

type SettingsTab =
  | 'account' | 'appearance' | 'chat' | 'multimodal'
  | 'notifications' | 'triggers' | 'skills'
  | 'agents' | 'tools' | 'data' | 'system' | 'about';

const tabs: { id: SettingsTab; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'account', label: '我的账户', icon: User },
  { id: 'appearance', label: '外观与主题', icon: Palette },
  { id: 'chat', label: '聊天设置', icon: MessageSquare },
  { id: 'multimodal', label: '多模态', icon: Eye },
  { id: 'notifications', label: '通知提醒', icon: Bell },
  { id: 'triggers', label: '触发任务', icon: Clock },
  { id: 'skills', label: '技能管理', icon: Puzzle },
  { id: 'agents', label: 'Agent 管理', icon: Crown },
  { id: 'tools', label: '工具箱', icon: Wrench },
  { id: 'data', label: '数据看板', icon: BarChart3 },
  { id: 'system', label: '系统设置', icon: SettingsIcon },
  { id: 'about', label: '关于', icon: Info },
];

const LOCAL_USER_KEY = 'oxygenclaw:local-user';
const LOCAL_SETTINGS_KEY = 'oxygenclaw:local-settings';
const LOCAL_TRIGGERS_KEY = 'oxygenclaw:local-triggers';

interface LocalUser {
  id: string;
  email: string;
  username: string;
  password?: string;
  createdAt: string;
}

interface TriggerTask {
  id: string;
  name: string;
  description: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'cron' | 'interval';
  cron?: string;
  time?: string;
  daysOfWeek?: string[];
  enabled: boolean;
  createdAt: string;
}

function getLocalUser(): LocalUser | null {
  try {
    const data = localStorage.getItem(LOCAL_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function saveLocalUser(user: LocalUser): void {
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
}

function getLocalSettings(): AppSettings | null {
  try {
    const data = localStorage.getItem(LOCAL_SETTINGS_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function saveLocalSettings(settings: AppSettings): void {
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
}

function getLocalTriggers(): TriggerTask[] {
  try {
    const data = localStorage.getItem(LOCAL_TRIGGERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalTriggers(triggers: TriggerTask[]): void {
  localStorage.setItem(LOCAL_TRIGGERS_KEY, JSON.stringify(triggers));
}

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div
      className={`toggle-switch ${checked ? 'active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div className="toggle-switch-thumb" />
    </div>
  );
}

function SettingsRow({ label, desc, right, onClick, danger }: {
  label: string;
  desc?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <div
      className={`settings-row ${onClick ? 'cursor-pointer' : ''} ${danger ? 'text-error' : ''}`}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0 pr-4">
        <div className="settings-row-label">{label}</div>
        {desc && <div className="settings-row-desc">{desc}</div>}
      </div>
      <div className="settings-row-value">
        {right}
        {onClick && !right && <ChevronRight size={16} />}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 mt-6 first:mt-0 px-1">
      {children}
    </div>
  );
}

function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      {title && <SectionTitle>{title}</SectionTitle>}
      <div className="settings-list">
        {children}
      </div>
    </div>
  );
}

const FONT_SIZE_MAP: Record<string, string> = {
  small: '12px',
  normal: '14px',
  large: '16px',
  xlarge: '18px',
};

const SIDEBAR_ICON_SIZE_MAP: Record<string, string> = {
  small: '16px',
  medium: '20px',
  large: '24px',
};

const Settings: React.FC = () => {
  const { showToast } = useToast();
  const { themeMode, setThemeMode } = useTheme();
  const { locale, setLocale } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [user, setUser] = useState<ApiUser | null>(null);
  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [settings, setSettings] = useState<AppSettings>({});
  const [triggers, setTriggers] = useState<TriggerTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useLocalMode, setUseLocalMode] = useState(false);
  const [dashboardApiHeaders, setDashboardApiHeaders] = useState<{ key: string; value: string }[]>([]);
  const [dashboardApiVariables, setDashboardApiVariables] = useState<{ key: string; value: string }[]>([]);
  const [showCurlImport, setShowCurlImport] = useState(false);
  const [curlCommand, setCurlCommand] = useState('');

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const [editProfileData, setEditProfileData] = useState({ username: '', email: '' });
  const [changePasswordData, setChangePasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [createTaskData, setCreateTaskData] = useState({
    name: '', description: '', schedule: 'daily' as TriggerTask['schedule'],
    time: '09:00', cron: '', intervalMinutes: 60,
    daysOfWeek: ['1', '2', '3', '4', '5'] as string[]
  });

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const [userResult, settingsResult] = await Promise.all([
        authApi.me(),
        settingsApi.get(),
      ]);

      if (userResult.success && userResult.data) {
        setUser(userResult.data);
        setUseLocalMode(false);
      } else {
        const local = getLocalUser();
        if (local) {
          setLocalUser(local);
          setUseLocalMode(true);
        }
      }

      if (settingsResult.success && settingsResult.data) {
        setSettings(settingsResult.data);
      } else {
        const localSettings = getLocalSettings();
        if (localSettings) {
          setSettings(localSettings);
        }
      }
    } catch {
      const local = getLocalUser();
      const localSettings = getLocalSettings();
      if (local) {
        setLocalUser(local);
        setUseLocalMode(true);
      }
      if (localSettings) {
        setSettings(localSettings);
      }
    } finally {
      setTriggers(getLocalTriggers());
      setLoading(false);
    }
  };

  const applySettings = (newSettings: AppSettings) => {
    const root = document.documentElement;

    if (newSettings.fontSize) {
      const fontSize = FONT_SIZE_MAP[newSettings.fontSize] || FONT_SIZE_MAP.normal;
      root.style.setProperty('--font-size', fontSize);
      root.style.fontSize = fontSize;
    }

    if (newSettings.animations === false || newSettings.reduceMotion) {
      root.style.setProperty('--animation-duration', '0ms');
      document.body.classList.add('reduce-motion');
    } else {
      root.style.removeProperty('--animation-duration');
      document.body.classList.remove('reduce-motion');
    }

    if (newSettings.sidebarIconSize) {
      root.style.setProperty('--sidebar-icon-size', SIDEBAR_ICON_SIZE_MAP[newSettings.sidebarIconSize] || SIDEBAR_ICON_SIZE_MAP.medium);
    }

    if (newSettings.sidebarDensity) {
      root.style.setProperty('--sidebar-density', newSettings.sidebarDensity);
    }

    if (newSettings.zoomLevel) {
      const zoom = parseInt(newSettings.zoomLevel) / 100;
      root.style.setProperty('--zoom-level', zoom.toString());
    }

    if (newSettings.language) {
      localStorage.setItem('oxygenclaw:language', newSettings.language);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    const localSettings = getLocalSettings();
    if (localSettings) {
      applySettings(localSettings);
    }
  }, []);

  useEffect(() => {
    if (Object.keys(settings).length > 0) {
      applySettings(settings);
      if (settings.language && settings.language !== locale) {
        setLocale(settings.language as 'zh' | 'en');
      }
    }
  }, [settings]);

  const updateSettings = async (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    applySettings(newSettings);

    if (useLocalMode || !user) {
      saveLocalSettings(newSettings);
      showToast({ type: 'success', title: '设置已保存' });
      return;
    }

    setSaving(true);
    try {
      const result = await settingsApi.update(newSettings);
      if (result.success && result.data) {
        setSettings(result.data);
        applySettings(result.data);
        showToast({ type: 'success', title: '设置已保存' });
      } else {
        saveLocalSettings(newSettings);
        showToast({ type: 'info', title: '已保存到本地', description: '后端不可用，设置已保存到本地存储' });
      }
    } catch (e: any) {
      saveLocalSettings(newSettings);
      showToast({ type: 'info', title: '已保存到本地', description: '后端不可用，设置已保存到本地存储' });
    } finally {
      setSaving(false);
    }
  };

  const handleThemeModeChange = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
    updateSettings({ theme: mode });
  };

  const handleLanguageChange = (language: 'zh' | 'en') => {
    setLocale(language);
    updateSettings({ language });
  };

  const headerTemplates = [
    {
      name: 'OpenAI API',
      headers: [{ key: 'Authorization', value: 'Bearer ${API_KEY}' }, { key: 'Content-Type', value: 'application/json' }]
    },
    {
      name: 'GitHub API',
      headers: [{ key: 'Authorization', value: 'Bearer ${GITHUB_TOKEN}' }, { key: 'Accept', value: 'application/vnd.github.v3+json' }]
    },
    {
      name: 'Stripe API',
      headers: [{ key: 'Authorization', value: 'Bearer ${STRIPE_KEY}' }]
    },
    {
      name: '自定义 JSON',
      headers: [{ key: 'Content-Type', value: 'application/json' }]
    },
  ];

  const extractVariables = (text: string): string[] => {
    const regex = /\$\{([^}]+)\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables;
  };

  const getAllHeaderVariables = (): string[] => {
    const allText = dashboardApiHeaders.map(h => `${h.key}:${h.value}`).join('\n');
    if (settings.dashboardApiUrl) {
      return extractVariables(allText + settings.dashboardApiUrl);
    }
    return extractVariables(allText);
  };

  const applyHeaderTemplate = (template: typeof headerTemplates[0]) => {
    const newHeaders = [...template.headers];
    setDashboardApiHeaders(newHeaders);
    updateSettings({ dashboardApiHeaders: newHeaders as any });
    showToast({ type: 'success', title: '模板已应用', description: `已应用 ${template.name} 模板` });
  };

  const addHeader = () => {
    const newHeaders = [...dashboardApiHeaders, { key: '', value: '' }];
    setDashboardApiHeaders(newHeaders);
    updateSettings({ dashboardApiHeaders: newHeaders as any });
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...dashboardApiHeaders];
    newHeaders[index][field] = value;
    setDashboardApiHeaders(newHeaders);
    updateSettings({ dashboardApiHeaders: newHeaders as any });
  };

  const removeHeader = (index: number) => {
    const newHeaders = dashboardApiHeaders.filter((_, i) => i !== index);
    setDashboardApiHeaders(newHeaders);
    updateSettings({ dashboardApiHeaders: newHeaders as any });
  };

  const importHeadersFromJson = () => {
    const jsonStr = prompt('请输入请求头 JSON 格式（例如：{"Authorization": "Bearer xxx"}）：');
    if (!jsonStr) return;
    try {
      const parsed = JSON.parse(jsonStr);
      const newHeaders = Object.entries(parsed).map(([key, value]) => ({ key, value: value as string }));
      setDashboardApiHeaders(newHeaders);
      updateSettings({ dashboardApiHeaders: newHeaders as any });
      showToast({ type: 'success', title: '导入成功', description: `已导入 ${newHeaders.length} 个请求头` });
    } catch {
      showToast({ type: 'error', title: '导入失败', description: 'JSON 格式不正确' });
    }
  };

  const addVariable = () => {
    const newVariables = [...dashboardApiVariables, { key: '', value: '' }];
    setDashboardApiVariables(newVariables);
    updateSettings({ dashboardApiVariables: newVariables.reduce((acc, v) => {
      if (v.key) acc[v.key] = v.value;
      return acc;
    }, {} as Record<string, string>) });
  };

  const updateVariable = (index: number, field: 'key' | 'value', value: string) => {
    const newVariables = [...dashboardApiVariables];
    newVariables[index][field] = value;
    setDashboardApiVariables(newVariables);
    updateSettings({ dashboardApiVariables: newVariables.reduce((acc, v) => {
      if (v.key) acc[v.key] = v.value;
      return acc;
    }, {} as Record<string, string>) });
  };

  const removeVariable = (index: number) => {
    const newVariables = dashboardApiVariables.filter((_, i) => i !== index);
    setDashboardApiVariables(newVariables);
    updateSettings({ dashboardApiVariables: newVariables.reduce((acc, v) => {
      if (v.key) acc[v.key] = v.value;
      return acc;
    }, {} as Record<string, string>) });
  };

  const parseCurlCommand = (curl: string) => {
    const result: {
      url: string;
      method: string;
      headers: { key: string; value: string }[];
      body: string;
    } = {
      url: '',
      method: 'GET',
      headers: [],
      body: '',
    };

    const lines = curl.split('\\\n').map(l => l.trim()).filter(l => l);
    let currentPart = '';

    for (const line of lines) {
      currentPart += ' ' + line;
    }

    const urlMatch = curl.match(/curl\s+['"]?([^'"\s]+)['"]?/);
    if (urlMatch) {
      result.url = urlMatch[1];
    }

    const methodMatch = curl.match(/-X\s+(\w+)/);
    if (methodMatch) {
      result.method = methodMatch[1].toUpperCase();
    }

    const headerRegex = /-H\s+['"]([^'"]+)['"]/g;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(curl)) !== null) {
      const colonIndex = headerMatch[1].indexOf(':');
      if (colonIndex > -1) {
        const key = headerMatch[1].substring(0, colonIndex).trim();
        const value = headerMatch[1].substring(colonIndex + 1).trim();
        result.headers.push({ key, value });
      }
    }

    const bodyMatch = curl.match(/--data(?:-raw)?\s+['"]([\s\S]*?)['"]/);
    if (bodyMatch) {
      result.body = bodyMatch[1];
      if (!methodMatch) {
        result.method = 'POST';
      }
    }

    return result;
  };

  const importFromCurl = () => {
    if (!curlCommand.trim()) {
      showToast({ type: 'error', title: '请输入 curl 命令' });
      return;
    }

    try {
      const parsed = parseCurlCommand(curlCommand);

      if (parsed.url) {
        updateSettings({ dashboardApiUrl: parsed.url });
      }

      if (parsed.method) {
        updateSettings({ dashboardApiMethod: parsed.method as any });
      }

      if (parsed.headers.length > 0) {
        setDashboardApiHeaders(parsed.headers);
        updateSettings({ dashboardApiHeaders: parsed.headers as any });
      }

      if (parsed.body) {
        updateSettings({ dashboardApiBody: parsed.body });
      }

      showToast({
        type: 'success',
        title: '导入成功',
        description: `已解析 URL、${parsed.headers.length} 个请求头${parsed.body ? '和请求体' : ''}`,
      });
      setShowCurlImport(false);
      setCurlCommand('');
    } catch {
      showToast({ type: 'error', title: '解析失败', description: '无法解析 curl 命令' });
    }
  };

  const testApiConnection = async () => {
    if (!settings.dashboardApiUrl) {
      showToast({ type: 'error', title: '请先配置 API 地址' });
      return;
    }
    setSaving(true);
    try {
      const variableMap: Record<string, string> = {};
      dashboardApiVariables.forEach(v => {
        if (v.key) {
          variableMap[v.key] = v.value;
        }
      });

      const replaceVariables = (text: string): string => {
        let result = text;
        const variables = extractVariables(result);
        variables.forEach(v => {
          const envValue = variableMap[v] || (import.meta as any).env[`VITE_${v}`] || localStorage.getItem(`oxygenclaw:var:${v}`) || '';
          result = result.replace(`\${${v}}`, envValue);
        });
        return result;
      };

      const headers: Record<string, string> = {};
      dashboardApiHeaders.forEach(h => {
        if (h.key && h.value) {
          headers[h.key] = replaceVariables(h.value);
        }
      });

      if (settings.dashboardApiAuthType === 'bearer') {
        headers['Authorization'] = `Bearer ${settings.dashboardApiAuthToken || ''}`;
      } else if (settings.dashboardApiAuthType === 'apikey') {
        headers['X-API-Key'] = settings.dashboardApiAuthToken || '';
      } else if (settings.dashboardApiAuthType === 'custom' && settings.dashboardApiAuthHeader) {
        headers[settings.dashboardApiAuthHeader] = settings.dashboardApiAuthToken || '';
      }

      let apiUrl = replaceVariables(settings.dashboardApiUrl);

      const method = settings.dashboardApiMethod || 'GET';
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if ((method === 'POST' || method === 'PUT') && settings.dashboardApiBody) {
        fetchOptions.body = replaceVariables(settings.dashboardApiBody);
      }

      const result = await fetch(apiUrl, fetchOptions);

      if (result.ok) {
        showToast({ type: 'success', title: '连接成功', description: 'API 配置正确' });
      } else {
        showToast({ type: 'error', title: '连接失败', description: `HTTP ${result.status}: ${result.statusText}` });
      }
    } catch (e: any) {
      showToast({ type: 'error', title: '连接失败', description: e?.message || '请求失败' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (settings.dashboardApiHeaders && Array.isArray(settings.dashboardApiHeaders)) {
      setDashboardApiHeaders(settings.dashboardApiHeaders);
    }
    if (settings.dashboardApiVariables && typeof settings.dashboardApiVariables === 'object') {
      const vars = Object.entries(settings.dashboardApiVariables).map(([key, value]) => ({ key, value: value as string }));
      setDashboardApiVariables(vars);
    }
  }, []);

  const handleLogout = () => {
    try { authApi.logout(); } catch {}
    authApi.setToken(null);
    setUser(null);
    setLocalUser(null);
    setUseLocalMode(false);
    localStorage.removeItem(LOCAL_USER_KEY);
    showToast({ type: 'success', title: '已退出登录' });
  };

  const handleEditProfile = () => {
    if (useLocalMode && localUser) {
      setEditProfileData({ username: localUser.username, email: localUser.email });
    } else if (user) {
      setEditProfileData({ username: user.username, email: user.email });
    }
    setShowEditProfile(true);
  };

  const handleSaveProfile = () => {
    if (!editProfileData.username.trim()) {
      showToast({ type: 'error', title: '请输入用户名' });
      return;
    }
    if (!editProfileData.email.trim()) {
      showToast({ type: 'error', title: '请输入邮箱' });
      return;
    }

    if (useLocalMode && localUser) {
      const updatedUser = { ...localUser, ...editProfileData };
      saveLocalUser(updatedUser);
      setLocalUser(updatedUser);
      showToast({ type: 'success', title: '个人资料已更新' });
    } else {
      showToast({ type: 'info', title: '功能开发中', description: '在线编辑个人资料功能将在后续版本开放' });
    }
    setShowEditProfile(false);
  };

  const handleChangePassword = () => {
    setChangePasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setShowChangePassword(true);
  };

  const handleSavePassword = () => {
    if (!useLocalMode) {
      showToast({ type: 'info', title: '功能开发中', description: '在线修改密码功能将在后续版本开放' });
      setShowChangePassword(false);
      return;
    }

    if (!changePasswordData.newPassword.trim()) {
      showToast({ type: 'error', title: '请输入新密码' });
      return;
    }
    if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
      showToast({ type: 'error', title: '两次输入的密码不一致' });
      return;
    }

    if (localUser) {
      const updatedUser = { ...localUser, password: changePasswordData.newPassword };
      saveLocalUser(updatedUser);
      setLocalUser(updatedUser);
      showToast({ type: 'success', title: '密码已修改' });
    }
    setShowChangePassword(false);
  };

  const handleCreateLocalUser = () => {
    if (!localUser?.username?.trim() || !localUser?.email?.trim()) {
      showToast({ type: 'error', title: '请填写用户名和邮箱' });
      return;
    }
    const newUser: LocalUser = {
      id: localUser.id || `local-${Date.now()}`,
      username: localUser.username,
      email: localUser.email,
      password: localUser.password || '',
      createdAt: new Date().toISOString(),
    };
    saveLocalUser(newUser);
    setLocalUser(newUser);
    setUseLocalMode(true);
    showToast({ type: 'success', title: '本地账户已创建' });
  };

  const handleCreateTask = () => {
    setCreateTaskData({
      name: '', description: '', schedule: 'daily',
      time: '09:00', cron: '', intervalMinutes: 60,
      daysOfWeek: ['1', '2', '3', '4', '5']
    });
    setShowCreateTask(true);
  };

  const handleSaveTask = () => {
    if (!createTaskData.name.trim()) {
      showToast({ type: 'error', title: '请输入任务名称' });
      return;
    }

    const newTask: TriggerTask = {
      id: `trigger-${Date.now()}`,
      name: createTaskData.name,
      description: createTaskData.description,
      schedule: createTaskData.schedule,
      time: createTaskData.time,
      cron: createTaskData.cron,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    const newTriggers = [...triggers, newTask];
    setTriggers(newTriggers);
    saveLocalTriggers(newTriggers);
    showToast({ type: 'success', title: '触发任务已创建' });
    setShowCreateTask(false);
  };

  const handleToggleTrigger = (id: string) => {
    const newTriggers = triggers.map(t =>
      t.id === id ? { ...t, enabled: !t.enabled } : t
    );
    setTriggers(newTriggers);
    saveLocalTriggers(newTriggers);
  };

  const handleDeleteTrigger = (id: string) => {
    if (confirm('确定要删除这个触发任务吗？')) {
      const newTriggers = triggers.filter(t => t.id !== id);
      setTriggers(newTriggers);
      saveLocalTriggers(newTriggers);
      showToast({ type: 'success', title: '任务已删除' });
    }
  };

  const handleGoToMarketplace = () => {
    window.open('https://openclawmp.stepfun.com', '_blank');
  };

  const currentUser = useLocalMode ? localUser : user;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-56 bg-surface-variant border-r border-outline-variant flex flex-col flex-shrink-0">
        <div className="px-5 py-4 border-b border-outline-variant">
          <h1 className="text-lg font-semibold text-on-surface">设置</h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-start gap-3 px-3 py-2.5 rounded-lg text-sm transition-apple text-left ${
                  active
                    ? 'bg-primary-container text-on-primary-container font-medium'
                    : 'text-on-surface-variant hover:bg-surface hover:text-on-surface'
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 bg-background overflow-y-auto">
        <div key={activeTab} className="max-w-3xl mx-auto py-10 px-10 animate-fade-in">
          {activeTab === 'account' && (
            <div>
              <h2 className="text-2xl font-semibold text-on-surface mb-6">我的账户</h2>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-on-surface-variant" />
                </div>
              ) : currentUser ? (
                <div className="bg-surface rounded-xl p-5 mb-6 border border-outline-variant">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-2xl font-semibold">
                      {currentUser.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-medium text-on-surface">{currentUser.username}</div>
                      <div className="text-sm text-on-surface-variant flex items-center gap-2 flex-wrap">
                        <span>{currentUser.email}</span>
                        {useLocalMode && (
                          <span className="text-xs px-2 py-0.5 bg-warning-container text-on-warning-container rounded-full">
                            本地模式
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 text-sm bg-surface-variant text-on-surface-variant rounded-lg hover:bg-outline-variant transition-colors"
                    >
                      退出登录
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <SettingsGroup title="本地登录">
                    <div className="p-4 space-y-4">
                      <p className="text-sm text-on-surface-variant">设置用户名和密码，使用本地存储管理账户</p>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="用户名"
                          onChange={e => setLocalUser(prev => ({
                            id: 'local-1', username: e.target.value, email: prev?.email || '', password: prev?.password || '', createdAt: prev?.createdAt || new Date().toISOString()
                          }))}
                          className="w-full"
                        />
                        <input
                          type="email"
                          placeholder="邮箱"
                          onChange={e => setLocalUser(prev => ({
                            id: 'local-1', username: prev?.username || '', email: e.target.value, password: prev?.password || '', createdAt: prev?.createdAt || new Date().toISOString()
                          }))}
                          className="w-full"
                        />
                        <input
                          type="password"
                          placeholder="密码"
                          onChange={e => setLocalUser(prev => ({
                            id: 'local-1', username: prev?.username || '', email: prev?.email || '', password: e.target.value, createdAt: prev?.createdAt || new Date().toISOString()
                          }))}
                          className="w-full"
                        />
                      </div>
                      <button
                        onClick={handleCreateLocalUser}
                        className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                        <Save size={14} />
                        创建本地账户
                      </button>
                    </div>
                  </SettingsGroup>
                </div>
              )}

              {currentUser && (
                <>
                  <SettingsGroup title="个人信息">
                    <SettingsRow
                      label="头像"
                      desc="点击上传头像"
                      onClick={() => showToast({ type: 'info', title: '功能开发中', description: '头像上传功能将在后续版本开放' })}
                      right={
                        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-medium text-sm">
                          {currentUser.username.charAt(0).toUpperCase()}
                        </div>
                      }
                    />
                    <SettingsRow label="编辑个人资料" onClick={handleEditProfile} right={<Edit2 size={16} />} />
                    <SettingsRow label="修改密码" onClick={handleChangePassword} />
                    <SettingsRow
                      label="个人简介"
                      desc={settings.bio || '未设置'}
                      onClick={() => {
                        const bio = prompt('输入个人简介：', settings.bio || '');
                        if (bio !== null) {
                          updateSettings({ bio: bio.trim() });
                        }
                      }}
                      right={<ChevronRight size={16} />}
                    />
                  </SettingsGroup>

                  <SettingsGroup title="安全">
                    <SettingsRow label="两步验证" desc="增强账户安全性" onClick={() => showToast({ type: 'info', title: '功能开发中' })} />
                    <SettingsRow label="登录设备" desc="管理已登录的设备" onClick={() => showToast({ type: 'info', title: '功能开发中' })} />
                    <SettingsRow label="API 密钥" desc="管理你的 API 访问密钥" onClick={() => showToast({ type: 'info', title: '功能开发中' })} />
                    <SettingsRow
                      label="登录提醒"
                      desc="新设备登录时发送通知"
                      right={
                        <Toggle
                          checked={settings.loginAlerts !== false}
                          onChange={v => updateSettings({ loginAlerts: v })}
                          disabled={saving}
                        />
                      }
                    />
                  </SettingsGroup>

                  <SettingsGroup title="偏好">
                    <SettingsRow
                      label="时区"
                      desc="显示日期和时间的时区"
                      right={
                        <select
                          value={settings.timezone || 'local'}
                          onChange={e => updateSettings({ timezone: e.target.value })}
                          style={{ minWidth: 140 }}
                        >
                          <option value="local">跟随系统</option>
                          <option value="Asia/Shanghai">中国标准时间 (UTC+8)</option>
                          <option value="America/New_York">美东时间 (UTC-5)</option>
                          <option value="Europe/London">伦敦时间 (UTC+0)</option>
                          <option value="Asia/Tokyo">东京时间 (UTC+9)</option>
                        </select>
                      }
                    />
                    <SettingsRow
                      label="时间格式"
                      desc="12小时制或24小时制"
                      right={
                        <select
                          value={settings.timeFormat || '24h'}
                          onChange={e => updateSettings({ timeFormat: e.target.value })}
                          style={{ minWidth: 100 }}
                        >
                          <option value="12h">12 小时制</option>
                          <option value="24h">24 小时制</option>
                        </select>
                      }
                    />
                    <SettingsRow
                      label="星期起始日"
                      desc="日历每周的第一天"
                      right={
                        <select
                          value={settings.weekStart || 'sunday'}
                          onChange={e => updateSettings({ weekStart: e.target.value })}
                          style={{ minWidth: 100 }}
                        >
                          <option value="sunday">周日</option>
                          <option value="monday">周一</option>
                        </select>
                      }
                    />
                  </SettingsGroup>

                  <SettingsGroup title="危险操作">
                    <SettingsRow
                      label="注销账户"
                      desc="永久删除你的账户和所有数据"
                      danger
                      onClick={() => {
                        if (confirm('确定要注销账户吗？此操作不可撤销。')) {
                          localStorage.clear();
                          location.reload();
                        }
                      }}
                    />
                  </SettingsGroup>
                </>
              )}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div>
              <h2 className="text-2xl font-semibold text-on-surface mb-6">外观与主题</h2>

              <SettingsGroup title="主题模式">
                <SettingsRow
                  label="主题模式"
                  right={
                    <div className="segmented-control">
                      {(['light', 'dark', 'system'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => handleThemeModeChange(t)}
                          className={`segmented-control-item ${(themeMode || 'system') === t ? 'active' : ''}`}
                        >
                          {t === 'light' ? '浅色' : t === 'dark' ? '深色' : '系统'}
                        </button>
                      ))}
                    </div>
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="显示">
                <SettingsRow
                  label="界面语言"
                  right={
                    <select
                      value={locale}
                      onChange={e => handleLanguageChange(e.target.value as 'zh' | 'en')}
                      style={{ minWidth: 120 }}
                    >
                      <option value="zh">中文</option>
                      <option value="en">English</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="字体大小"
                  right={
                    <select
                      value={settings.fontSize || 'normal'}
                      onChange={e => updateSettings({ fontSize: e.target.value as any })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="small">小号</option>
                      <option value="normal">标准</option>
                      <option value="large">大号</option>
                      <option value="xlarge">特大号</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="侧边栏密度"
                  desc="调整侧边栏图标的大小和间距"
                  right={
                    <select
                      value={settings.sidebarDensity || 'normal'}
                      onChange={e => updateSettings({ sidebarDensity: e.target.value })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="compact">紧凑</option>
                      <option value="normal">标准</option>
                      <option value="comfortable">舒适</option>
                    </select>
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="聊天界面">
                <SettingsRow
                  label="消息气泡样式"
                  desc="聊天消息气泡的显示样式"
                  right={
                    <select
                      value={settings.bubbleStyle || 'rounded'}
                      onChange={e => updateSettings({ bubbleStyle: e.target.value })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="rounded">圆角</option>
                      <option value="square">方形</option>
                      <option value="minimal">极简</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="显示消息时间"
                  desc="在消息旁显示发送时间"
                  right={
                    <Toggle
                      checked={!!settings.showMessageTime}
                      onChange={v => updateSettings({ showMessageTime: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="显示用户头像"
                  desc="在聊天中显示用户头像"
                  right={
                    <Toggle
                      checked={settings.showAvatar !== false}
                      onChange={v => updateSettings({ showAvatar: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="代码块主题"
                  desc="代码高亮的颜色主题"
                  right={
                    <select
                      value={settings.codeTheme || 'github'}
                      onChange={e => updateSettings({ codeTheme: e.target.value })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="github">GitHub</option>
                      <option value="monokai">Monokai</option>
                      <option value="dracula">Dracula</option>
                      <option value="one-dark">One Dark</option>
                    </select>
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="动画效果">
                <SettingsRow
                  label="界面动画"
                  desc="启用界面过渡动画"
                  right={
                    <Toggle
                      checked={settings.animations !== false}
                      onChange={v => updateSettings({ animations: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="减少动态效果"
                  desc="降低界面动画的强度"
                  right={
                    <Toggle
                      checked={!!settings.reduceMotion}
                      onChange={v => updateSettings({ reduceMotion: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="侧边栏">
                <SettingsRow
                  label="显示侧边栏"
                  desc="显示左侧主导航栏"
                  right={
                    <Toggle
                      checked={settings.showSidebar !== false}
                      onChange={v => updateSettings({ showSidebar: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="侧边栏图标大小"
                  desc="调整侧边栏图标的尺寸"
                  right={
                    <select
                      value={settings.sidebarIconSize || 'medium'}
                      onChange={e => updateSettings({ sidebarIconSize: e.target.value })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="small">小</option>
                      <option value="medium">中</option>
                      <option value="large">大</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="侧边栏位置"
                  desc="侧边栏显示在左侧还是右侧"
                  right={
                    <select
                      value={settings.sidebarPosition || 'left'}
                      onChange={e => updateSettings({ sidebarPosition: e.target.value })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="left">左侧</option>
                      <option value="right">右侧</option>
                    </select>
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="窗口">
                <SettingsRow
                  label="标题栏样式"
                  desc="窗口标题栏的显示风格"
                  right={
                    <select
                      value={settings.titleBarStyle || 'default'}
                      onChange={e => updateSettings({ titleBarStyle: e.target.value })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="default">默认</option>
                      <option value="compact">紧凑</option>
                      <option value="hidden">隐藏</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="窗口缩放"
                  desc="界面整体缩放比例"
                  right={
                    <select
                      value={settings.zoomLevel || '100'}
                      onChange={e => updateSettings({ zoomLevel: e.target.value })}
                      style={{ minWidth: 100 }}
                    >
                      <option value="80">80%</option>
                      <option value="90">90%</option>
                      <option value="100">100%</option>
                      <option value="110">110%</option>
                      <option value="125">125%</option>
                      <option value="150">150%</option>
                    </select>
                  }
                />
              </SettingsGroup>
            </div>
          )}

          {activeTab === 'chat' && (
            <div>
              <h2 className="text-2xl font-semibold text-on-surface mb-6">聊天设置</h2>

              <SettingsGroup title="默认设置">
                <SettingsRow
                  label="默认模型"
                  desc={settings.defaultModel || '未设置'}
                  right={
                    <select
                      value={settings.defaultModel || ''}
                      onChange={e => updateSettings({ defaultModel: e.target.value })}
                      style={{ minWidth: 160 }}
                    >
                      <option value="">选择模型</option>
                      <option value="step-1.5-turbo">Step-1.5-Turbo</option>
                      <option value="step-3.7-flash">Step-3.7-Flash</option>
                      <option value="step-3.7">Step-3.7</option>
                      <option value="seed-2.0-pro">Seed-2.0-Pro</option>
                      <option value="seed-2.1-turbo">Seed-2.1-Turbo</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="默认模式"
                  right={
                    <div className="segmented-control">
                      <button
                        onClick={() => updateSettings({ defaultMode: 'chat' })}
                        className={`segmented-control-item ${(settings.defaultMode || 'chat') === 'chat' ? 'active' : ''}`}
                      >
                        聊天
                      </button>
                      <button
                        onClick={() => updateSettings({ defaultMode: 'task' })}
                        className={`segmented-control-item ${settings.defaultMode === 'task' ? 'active' : ''}`}
                      >
                        任务
                      </button>
                    </div>
                  }
                />
                <SettingsRow
                  label="默认能力模式"
                  desc="Playgrounds 默认使用的能力模式"
                  right={
                    <select
                      value={settings.defaultCapability || 'fast'}
                      onChange={e => updateSettings({ defaultCapability: e.target.value as any })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="fast">快速</option>
                      <option value="think">思考</option>
                      <option value="expert">专家</option>
                      <option value="research">研究</option>
                      <option value="moa">协作 (MoA)</option>
                    </select>
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="生成参数">
                <SettingsRow
                  label="温度 (Temperature)"
                  desc="控制输出的随机性，越高越随机"
                  right={
                    <div className="flex items-center gap-2" style={{ minWidth: 160 }}>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={settings.temperature ?? 0.7}
                        onChange={e => updateSettings({ temperature: parseFloat(e.target.value) })}
                        className="flex-1 min-w-0"
                      />
                      <span className="text-xs text-on-surface-variant flex-shrink-0 tabular-nums" style={{ minWidth: 32, textAlign: 'right' }}>
                        {parseFloat((settings.temperature ?? 0.7).toString()).toFixed(1)}
                      </span>
                    </div>
                  }
                />
                <SettingsRow
                  label="最大 Token"
                  desc="单次回复的最大 Token 数"
                  right={
                    <input
                      type="number"
                      value={settings.maxTokens || 4096}
                      onChange={e => updateSettings({ maxTokens: parseInt(e.target.value) || 4096 })}
                      style={{ width: 100 }}
                    />
                  }
                />
                <SettingsRow
                  label="Top P"
                  desc="核采样参数，控制输出多样性"
                  right={
                    <div className="flex items-center gap-2" style={{ minWidth: 160 }}>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.topP ?? 1}
                        onChange={e => updateSettings({ topP: parseFloat(e.target.value) })}
                        className="flex-1 min-w-0"
                      />
                      <span className="text-xs text-on-surface-variant flex-shrink-0 tabular-nums" style={{ minWidth: 32, textAlign: 'right' }}>
                        {parseFloat((settings.topP ?? 1).toString()).toFixed(2)}
                      </span>
                    </div>
                  }
                />
                <SettingsRow
                  label="上下文长度"
                  desc="对话上下文保留的消息数量"
                  right={
                    <select
                      value={settings.contextLength || 'unlimited'}
                      onChange={e => updateSettings({ contextLength: e.target.value })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="10">最近 10 条</option>
                      <option value="20">最近 20 条</option>
                      <option value="50">最近 50 条</option>
                      <option value="unlimited">不限制</option>
                    </select>
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="对话设置">
                <SettingsRow
                  label="自动滚动到最新消息"
                  desc="新消息到达时自动滚动到底部"
                  right={
                    <Toggle
                      checked={settings.autoScroll !== false}
                      onChange={v => updateSettings({ autoScroll: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="发送消息快捷键"
                  desc="按 Enter 发送还是换行"
                  right={
                    <select
                      value={settings.sendShortcut || 'enter'}
                      onChange={e => updateSettings({ sendShortcut: e.target.value })}
                      style={{ minWidth: 140 }}
                    >
                      <option value="enter">Enter 发送</option>
                      <option value="cmdEnter">Ctrl+Enter 发送</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="自动保存草稿"
                  desc="自动保存未发送的消息草稿"
                  right={
                    <Toggle
                      checked={settings.autoSaveDraft !== false}
                      onChange={v => updateSettings({ autoSaveDraft: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="Markdown 渲染"
                  desc="在消息中渲染 Markdown 格式"
                  right={
                    <Toggle
                      checked={settings.markdownRender !== false}
                      onChange={v => updateSettings({ markdownRender: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="输入">
                <SettingsRow
                  label="输入框高度"
                  desc="聊天输入框的默认高度"
                  right={
                    <select
                      value={settings.inputHeight || 'auto'}
                      onChange={e => updateSettings({ inputHeight: e.target.value })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="compact">紧凑</option>
                      <option value="auto">自适应</option>
                      <option value="large">大号</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="拼写检查"
                  desc="启用输入时拼写检查"
                  right={
                    <Toggle
                      checked={!!settings.spellCheck}
                      onChange={v => updateSettings({ spellCheck: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="智能补全"
                  desc="输入时提供智能补全建议"
                  right={
                    <Toggle
                      checked={settings.smartComplete !== false}
                      onChange={v => updateSettings({ smartComplete: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="回复">
                <SettingsRow
                  label="流式输出"
                  desc="实时显示 AI 回复内容"
                  right={
                    <Toggle
                      checked={settings.streamOutput !== false}
                      onChange={v => updateSettings({ streamOutput: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="打字机效果"
                  desc="AI 回复时显示打字机动画"
                  right={
                    <Toggle
                      checked={settings.typingEffect !== false}
                      onChange={v => updateSettings({ typingEffect: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="显示思考过程"
                  desc="显示 AI 的思考过程（如果支持）"
                  right={
                    <Toggle
                      checked={!!settings.showThinking}
                      onChange={v => updateSettings({ showThinking: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="引用消息"
                  desc="回复时自动引用上一条消息"
                  right={
                    <Toggle
                      checked={!!settings.autoQuote}
                      onChange={v => updateSettings({ autoQuote: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="历史记录">
                <SettingsRow
                  label="自动命名对话"
                  desc="根据对话内容自动生成标题"
                  right={
                    <Toggle
                      checked={settings.autoRenameConversation !== false}
                      onChange={v => updateSettings({ autoRenameConversation: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="最大历史对话数"
                  desc="保留的历史对话数量上限"
                  right={
                    <select
                      value={settings.maxHistoryConversations || '100'}
                      onChange={e => updateSettings({ maxHistoryConversations: e.target.value })}
                      style={{ minWidth: 100 }}
                    >
                      <option value="20">20 条</option>
                      <option value="50">50 条</option>
                      <option value="100">100 条</option>
                      <option value="500">500 条</option>
                      <option value="unlimited">不限制</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="搜索历史消息"
                  desc="在对话中搜索历史消息"
                  right={
                    <Toggle
                      checked={settings.searchInConversation !== false}
                      onChange={v => updateSettings({ searchInConversation: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>
            </div>
          )}

          {activeTab === 'multimodal' && (
            <div>
              <h2 className="text-2xl font-semibold text-on-surface mb-6">多模态</h2>

              <SettingsGroup title="视觉模型">
                <SettingsRow
                  label="启用视觉模型"
                  desc="用于图片识别和视频理解"
                  right={
                    <Toggle
                      checked={!!settings.visionEnabled}
                      onChange={v => updateSettings({ visionEnabled: v })}
                      disabled={saving}
                    />
                  }
                />
                {settings.visionEnabled && (
                  <>
                    <SettingsRow
                      label="API Key"
                      right={
                        <input
                          type="password"
                          value={settings.visionApiKey || ''}
                          onChange={e => updateSettings({ visionApiKey: e.target.value })}
                          placeholder="输入视觉模型 API Key"
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="Base URL"
                      right={
                        <input
                          type="text"
                          value={settings.visionBaseUrl || ''}
                          onChange={e => updateSettings({ visionBaseUrl: e.target.value })}
                          placeholder="https://..."
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="模型名称"
                      right={
                        <input
                          type="text"
                          value={settings.visionModel || ''}
                          onChange={e => updateSettings({ visionModel: e.target.value })}
                          placeholder="step-3.7-flash"
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="图片最大尺寸"
                      desc="上传图片的最大分辨率"
                      right={
                        <select
                          value={settings.maxImageSize || '2048'}
                          onChange={e => updateSettings({ maxImageSize: e.target.value })}
                          style={{ minWidth: 120 }}
                        >
                          <option value="1024">1024px</option>
                          <option value="2048">2048px</option>
                          <option value="4096">4096px</option>
                        </select>
                      }
                    />
                  </>
                )}
              </SettingsGroup>

              <SettingsGroup title="语音识别">
                <SettingsRow
                  label="启用语音输入"
                  desc="使用麦克风进行语音输入"
                  right={
                    <Toggle
                      checked={!!settings.asrEnabled}
                      onChange={v => updateSettings({ asrEnabled: v, voiceInputEnabled: v })}
                      disabled={saving}
                    />
                  }
                />
                {settings.asrEnabled && (
                  <>
                    <SettingsRow
                      label="API Key"
                      right={
                        <input
                          type="password"
                          value={settings.asrApiKey || ''}
                          onChange={e => updateSettings({ asrApiKey: e.target.value })}
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow label="Base URL"
                      right={
                        <input
                          type="text"
                          value={settings.asrBaseUrl || ''}
                          onChange={e => updateSettings({ asrBaseUrl: e.target.value })}
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="模型名称"
                      right={
                        <input
                          type="text"
                          value={settings.asrModel || ''}
                          onChange={e => updateSettings({ asrModel: e.target.value })}
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="自动标点"
                      desc="识别结果自动添加标点符号"
                      right={
                        <Toggle
                          checked={settings.asrPunctuation !== false}
                          onChange={v => updateSettings({ asrPunctuation: v })}
                          disabled={saving}
                        />
                      }
                    />
                  </>
                )}
              </SettingsGroup>

              <SettingsGroup title="语音合成">
                <SettingsRow
                  label="启用语音播报"
                  desc="将 AI 回复转换为语音播放"
                  right={
                    <Toggle
                      checked={!!settings.ttsEnabled}
                      onChange={v => updateSettings({ ttsEnabled: v, voiceOutputEnabled: v })}
                      disabled={saving}
                    />
                  }
                />
                {settings.ttsEnabled && (
                  <>
                    <SettingsRow
                      label="API Key"
                      right={
                        <input
                          type="password"
                          value={settings.ttsApiKey || ''}
                          onChange={e => updateSettings({ ttsApiKey: e.target.value })}
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="Base URL"
                      right={
                        <input
                          type="text"
                          value={settings.ttsBaseUrl || ''}
                          onChange={e => updateSettings({ ttsBaseUrl: e.target.value })}
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="模型名称"
                      right={
                        <input
                          type="text"
                          value={settings.ttsModel || ''}
                          onChange={e => updateSettings({ ttsModel: e.target.value })}
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="音色"
                      right={
                        <input
                          type="text"
                          value={settings.ttsVoice || ''}
                          onChange={e => updateSettings({ ttsVoice: e.target.value })}
                          placeholder="选择或输入音色名称"
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="语速"
                      desc="语音播放的速度"
                      right={
                        <div className="flex items-center gap-3 flex-shrink-0" style={{ minWidth: 180 }}>
                          <input
                            type="range"
                            min="0.5"
                            max="2"
                            step="0.1"
                            value={settings.ttsSpeed ?? 1}
                            onChange={e => updateSettings({ ttsSpeed: parseFloat(e.target.value) })}
                            className="flex-1 min-w-0 w-full"
                          />
                          <span className="text-xs text-on-surface-variant flex-shrink-0 tabular-nums font-medium" style={{ minWidth: 40, textAlign: 'right' }}>
                            {parseFloat((settings.ttsSpeed ?? 1).toString()).toFixed(1)}x
                          </span>
                        </div>
                      }
                    />
                  </>
                )}
              </SettingsGroup>

              <SettingsGroup title="图像生成">
                <SettingsRow
                  label="启用图像生成"
                  desc="使用 AI 生成图片"
                  right={
                    <Toggle
                      checked={!!settings.imageGenEnabled}
                      onChange={v => updateSettings({ imageGenEnabled: v })}
                      disabled={saving}
                    />
                  }
                />
                {settings.imageGenEnabled && (
                  <>
                    <SettingsRow
                      label="默认生图模型"
                      desc="选择默认使用的生图模型"
                      right={
                        <select
                          value={settings.imageGenDefaultModel || ''}
                          onChange={e => updateSettings({ imageGenDefaultModel: e.target.value })}
                          style={{ minWidth: 160 }}
                        >
                          <option value="">选择模型</option>
                          <option value="step-image">Step-Image</option>
                          <option value="stable-diffusion">Stable Diffusion</option>
                          <option value="dall-e-3">DALL·E 3</option>
                          <option value="dall-e-2">DALL·E 2</option>
                          <option value="midjourney">Midjourney</option>
                        </select>
                      }
                    />
                    <SettingsRow
                      label="API Key"
                      right={
                        <input
                          type="password"
                          value={settings.imageGenApiKey || ''}
                          onChange={e => updateSettings({ imageGenApiKey: e.target.value })}
                          placeholder="输入生图 API Key"
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="Base URL"
                      right={
                        <input
                          type="text"
                          value={settings.imageGenBaseUrl || ''}
                          onChange={e => updateSettings({ imageGenBaseUrl: e.target.value })}
                          placeholder="https://..."
                          style={{ width: 200 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="默认尺寸"
                      desc="生成图片的默认分辨率"
                      right={
                        <select
                          value={settings.imageGenDefaultSize || '1024x1024'}
                          onChange={e => updateSettings({ imageGenDefaultSize: e.target.value })}
                          style={{ minWidth: 140 }}
                        >
                          <option value="512x512">512 × 512</option>
                          <option value="768x768">768 × 768</option>
                          <option value="1024x1024">1024 × 1024</option>
                          <option value="1024x768">1024 × 768</option>
                          <option value="768x1024">768 × 1024</option>
                          <option value="1280x720">1280 × 720</option>
                          <option value="720x1280">720 × 1280</option>
                        </select>
                      }
                    />
                    <SettingsRow
                      label="默认质量"
                      desc="生成图片的质量"
                      right={
                        <select
                          value={settings.imageGenDefaultQuality || 'standard'}
                          onChange={e => updateSettings({ imageGenDefaultQuality: e.target.value })}
                          style={{ minWidth: 120 }}
                        >
                          <option value="standard">标准</option>
                          <option value="hd">高清</option>
                        </select>
                      }
                    />
                    <SettingsRow
                      label="默认步数"
                      desc="采样步数，越高细节越丰富但速度越慢"
                      right={
                        <div className="flex items-center gap-2" style={{ minWidth: 160 }}>
                          <input
                            type="range"
                            min="1"
                            max="50"
                            value={settings.imageGenDefaultSteps ?? 30}
                            onChange={e => updateSettings({ imageGenDefaultSteps: parseInt(e.target.value) })}
                            className="flex-1 min-w-0"
                          />
                          <span className="text-xs text-on-surface-variant flex-shrink-0 tabular-nums" style={{ minWidth: 28, textAlign: 'right' }}>
                            {settings.imageGenDefaultSteps ?? 30}
                          </span>
                        </div>
                      }
                    />
                    <SettingsRow
                      label="CFG Scale"
                      desc="提示词相关性，越高越严格遵循提示"
                      right={
                        <div className="flex items-center gap-2" style={{ minWidth: 160 }}>
                          <input
                            type="range"
                            min="1"
                            max="20"
                            step="0.5"
                            value={settings.imageGenDefaultCfgScale ?? 7}
                            onChange={e => updateSettings({ imageGenDefaultCfgScale: parseFloat(e.target.value) })}
                            className="flex-1 min-w-0"
                          />
                          <span className="text-xs text-on-surface-variant flex-shrink-0 tabular-nums" style={{ minWidth: 32, textAlign: 'right' }}>
                            {parseFloat((settings.imageGenDefaultCfgScale ?? 7).toString())}
                          </span>
                        </div>
                      }
                    />
                    <SettingsRow
                      label="保存生成历史"
                      desc="在本地保存生成的图片记录"
                      right={
                        <Toggle
                          checked={settings.imageGenSaveHistory !== false}
                          onChange={v => updateSettings({ imageGenSaveHistory: v })}
                          disabled={saving}
                        />
                      }
                    />
                  </>
                )}
              </SettingsGroup>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-2xl font-semibold text-on-surface mb-6">通知提醒</h2>

              <SettingsGroup title="通知设置">
                <SettingsRow
                  label="启用桌面通知"
                  desc="接收新消息和任务完成通知"
                  right={
                    <Toggle
                      checked={!!settings.notificationsEnabled}
                      onChange={v => updateSettings({ notificationsEnabled: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="消息提示音"
                  desc="收到新消息时播放提示音"
                  right={
                    <Toggle
                      checked={!!settings.soundEnabled}
                      onChange={v => updateSettings({ soundEnabled: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="任务完成提醒"
                  desc="任务执行完成后发送通知"
                  right={
                    <Toggle
                      checked={!!settings.taskRemindersEnabled}
                      onChange={v => updateSettings({ taskRemindersEnabled: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="重要消息弹窗"
                  desc="重要消息弹出窗口提醒"
                  right={
                    <Toggle
                      checked={!!settings.importantPopup}
                      onChange={v => updateSettings({ importantPopup: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="免打扰">
                <SettingsRow
                  label="免打扰模式"
                  desc="在指定时间段内不发送通知"
                  right={
                    <Toggle
                      checked={!!settings.dndEnabled}
                      onChange={v => updateSettings({ dndEnabled: v })}
                      disabled={saving}
                    />
                  }
                />
                {settings.dndEnabled && (
                  <>
                    <SettingsRow
                      label="开始时间"
                      right={
                        <input
                          type="time"
                          value={settings.dndStart || '22:00'}
                          onChange={e => updateSettings({ dndStart: e.target.value })}
                        />
                      }
                    />
                    <SettingsRow
                      label="结束时间"
                      right={
                        <input
                          type="time"
                          value={settings.dndEnd || '08:00'}
                          onChange={e => updateSettings({ dndEnd: e.target.value })}
                        />
                      }
                    />
                    <SettingsRow
                      label="允许重要通知"
                      desc="免打扰时仍接收重要通知"
                      right={
                        <Toggle
                          checked={!!settings.dndAllowImportant}
                          onChange={v => updateSettings({ dndAllowImportant: v })}
                          disabled={saving}
                        />
                      }
                    />
                  </>
                )}
              </SettingsGroup>
            </div>
          )}

          {activeTab === 'triggers' && (
            <div>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-on-surface">触发任务</h2>
                  <p className="text-sm text-on-surface-variant mt-1 max-w-md">
                    请保持电脑开机并运行客户端，否则触发任务将无法自动执行
                  </p>
                </div>
                <button
                  onClick={handleCreateTask}
                  className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                >
                  <Plus size={14} />
                  创建任务
                </button>
              </div>

              {triggers.length > 0 ? (
                <div className="space-y-3">
                  {triggers.map(trigger => (
                    <div key={trigger.id} className="bg-surface rounded-xl border border-outline-variant p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-on-surface flex items-center gap-2">
                            {trigger.name}
                            {trigger.enabled ? (
                              <span className="text-xs px-2 py-0.5 bg-success-container text-success rounded-full">已启用</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 bg-surface-variant text-on-surface-variant rounded-full">已禁用</span>
                            )}
                          </div>
                          <div className="text-xs text-on-surface-variant mt-1">
                            {trigger.schedule === 'daily' && `每天 ${trigger.time} 执行`}
                            {trigger.schedule === 'weekly' && `每周 ${trigger.time} 执行`}
                            {trigger.schedule === 'monthly' && `每月 ${trigger.time} 执行`}
                            {trigger.schedule === 'interval' && `每 ${settings.intervalMinutes || 60} 分钟执行`}
                            {trigger.schedule === 'cron' && `Cron: ${trigger.cron}`}
                          </div>
                          {trigger.description && (
                            <div className="text-sm text-on-surface-variant mt-2">{trigger.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Toggle checked={trigger.enabled} onChange={() => handleToggleTrigger(trigger.id)} />
                          <button
                            onClick={() => handleDeleteTrigger(trigger.id)}
                            className="p-2 hover:bg-surface-variant rounded-lg text-on-surface-variant hover:text-error transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Clock size={40} className="empty-state-icon" />
                  <div className="empty-state-title">暂无触发任务</div>
                  <div className="empty-state-desc">
                    创建定时任务，让 OxygenClaw 自动帮你完成重复性工作
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'skills' && (
            <div>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-on-surface">技能管理</h2>
                  <p className="text-sm text-on-surface-variant mt-1 max-w-md">
                    技能是可复用的工作流，支持第三方 Skill，本地保存。开启后，OxygenClaw 会自动按需调用
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGoToMarketplace}
                    className="btn-secondary"
                  >
                    <ExternalLink size={14} />
                    水产市场
                  </button>
                  <button
                    onClick={() => showToast({ type: 'info', title: '功能开发中', description: '创建技能功能将在后续版本开放' })}
                    className="btn-primary"
                  >
                    <Plus size={14} />
                    创建技能
                  </button>
                </div>
              </div>

              <SettingsGroup title="已安装的技能">
                <div className="p-8 text-center">
                  <Puzzle size={32} className="mx-auto text-on-surface-variant opacity-50 mb-3" />
                  <div className="text-sm text-on-surface-variant">暂无已安装的技能</div>
                  <button
                    onClick={handleGoToMarketplace}
                    className="mt-4 text-primary text-sm hover:underline"
                  >
                    前往水产市场发现更多
                  </button>
                </div>
              </SettingsGroup>

              <SettingsGroup title="技能设置">
                <SettingsRow
                  label="自动更新技能"
                  desc="自动检查并更新已安装的技能"
                  right={
                    <Toggle
                      checked={settings.autoUpdateSkills !== false}
                      onChange={v => updateSettings({ autoUpdateSkills: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="允许第三方技能"
                  desc="允许安装和运行第三方开发的技能"
                  right={
                    <Toggle
                      checked={!!settings.allowThirdPartySkills}
                      onChange={v => updateSettings({ allowThirdPartySkills: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="技能沙盒模式"
                  desc="在隔离环境中运行技能，提高安全性"
                  right={
                    <Toggle
                      checked={settings.skillSandbox !== false}
                      onChange={v => updateSettings({ skillSandbox: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>
            </div>
          )}

          {activeTab === 'agents' && (
            <div>
              <h2 className="text-2xl font-semibold text-on-surface mb-6">Agent 管理</h2>

              <SettingsGroup title="我的 Agent">
                <div className="p-8 text-center">
                  <Crown size={32} className="mx-auto text-on-surface-variant opacity-50 mb-3" />
                  <div className="text-sm text-on-surface-variant">暂无 Agent 配置</div>
                  <button
                    onClick={() => showToast({ type: 'info', title: '功能开发中', description: 'Agent 管理功能将在后续版本开放' })}
                    className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    添加 Agent
                  </button>
                </div>
              </SettingsGroup>

              <SettingsGroup title="外部 Agent">
                <SettingsRow
                  label="外部 Agent 接入"
                  desc="允许外部 Agent 通过 MCP 接入"
                  right={
                    <Toggle
                      checked={!!settings.allowExternalAgents}
                      onChange={v => updateSettings({ allowExternalAgents: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="MCP 服务器"
                  desc="管理 MCP 服务器配置"
                  onClick={() => window.location.href = '/mcp'}
                  right={<span className="text-sm text-primary">前往管理</span>}
                />
              </SettingsGroup>

              <SettingsGroup title="协作设置">
                <SettingsRow
                  label="MoA 多智能体协作"
                  desc="启用多 Agent 协作模式"
                  right={
                    <Toggle
                      checked={!!settings.moaEnabled}
                      onChange={v => updateSettings({ moaEnabled: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="最大并行 Agent 数"
                  desc="MoA 模式下同时运行的 Agent 数量"
                  right={
                    <select
                      value={settings.maxParallelAgents || '3'}
                      onChange={e => updateSettings({ maxParallelAgents: e.target.value })}
                      style={{ minWidth: 100 }}
                    >
                      <option value="2">2 个</option>
                      <option value="3">3 个</option>
                      <option value="5">5 个</option>
                      <option value="10">10 个</option>
                    </select>
                  }
                />
              </SettingsGroup>
            </div>
          )}

          {activeTab === 'tools' && (
            <div>
              <h2 className="text-2xl font-semibold text-on-surface mb-6">工具箱</h2>

              <SettingsGroup title="已安装的工具">
                <div className="p-8 text-center">
                  <Wrench size={32} className="mx-auto text-on-surface-variant opacity-50 mb-3" />
                  <div className="text-sm text-on-surface-variant">暂无已安装的工具</div>
                  <button
                    onClick={() => showToast({ type: 'info', title: '功能开发中', description: '添加工具功能将在后续版本开放' })}
                    className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    添加工具
                  </button>
                </div>
              </SettingsGroup>

              <SettingsGroup title="MCP 客户端">
                <SettingsRow
                  label="MCP 工具"
                  desc="管理通过 MCP 接入的工具"
                  onClick={() => window.location.href = '/mcp'}
                  right={<span className="text-sm text-primary">前往管理</span>}
                />
              </SettingsGroup>

              <SettingsGroup title="工具设置">
                <SettingsRow
                  label="自动执行工具"
                  desc="AI 自动调用工具而无需确认"
                  right={
                    <Toggle
                      checked={!!settings.autoExecuteTools}
                      onChange={v => updateSettings({ autoExecuteTools: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="工具调用确认"
                  desc="敏感工具调用前需要确认"
                  right={
                    <Toggle
                      checked={settings.toolConfirm !== false}
                      onChange={v => updateSettings({ toolConfirm: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>
            </div>
          )}

          {activeTab === 'data' && (
            <div>
              <h2 className="text-2xl font-semibold text-on-surface mb-6">数据看板设置</h2>

              <SettingsGroup title="数据 API 配置">
                <SettingsRow
                  label="启用自定义数据 API"
                  desc="从外部 API 获取数据看板数据"
                  right={
                    <Toggle
                      checked={!!settings.dashboardApiEnabled}
                      onChange={v => updateSettings({ dashboardApiEnabled: v })}
                      disabled={saving}
                    />
                  }
                />
                {settings.dashboardApiEnabled && (
                  <>
                    <SettingsRow
                      label="API 地址"
                      desc="支持变量：${VARIABLE_NAME}"
                      right={
                        <input
                          type="url"
                          value={settings.dashboardApiUrl || ''}
                          onChange={e => updateSettings({ dashboardApiUrl: e.target.value })}
                          placeholder="https://api.example.com/${USER_ID}"
                          style={{ width: 280 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="请求方法"
                      right={
                        <select
                          value={settings.dashboardApiMethod || 'GET'}
                          onChange={e => updateSettings({ dashboardApiMethod: e.target.value as any })}
                          style={{ minWidth: 120 }}
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      }
                    />
                    <SettingsRow
                      label="鉴权方式"
                      right={
                        <select
                          value={settings.dashboardApiAuthType || 'none'}
                          onChange={e => updateSettings({ dashboardApiAuthType: e.target.value as any })}
                          style={{ minWidth: 140 }}
                        >
                          <option value="none">无</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="apikey">API Key</option>
                          <option value="custom">自定义头</option>
                        </select>
                      }
                    />
                    {(settings.dashboardApiAuthType === 'bearer' || settings.dashboardApiAuthType === 'apikey' || settings.dashboardApiAuthType === 'custom') && (
                      <>
                        {settings.dashboardApiAuthType === 'custom' && (
                          <SettingsRow
                            label="请求头名称"
                            right={
                              <input
                                type="text"
                                value={settings.dashboardApiAuthHeader || ''}
                                onChange={e => updateSettings({ dashboardApiAuthHeader: e.target.value })}
                                placeholder="Authorization"
                                style={{ width: 200 }}
                              />
                            }
                          />
                        )}
                        <SettingsRow
                          label={settings.dashboardApiAuthType === 'bearer' ? '令牌 Token' : settings.dashboardApiAuthType === 'apikey' ? 'API Key' : '请求头值'}
                          right={
                            <input
                              type="password"
                              value={settings.dashboardApiAuthToken || ''}
                              onChange={e => updateSettings({ dashboardApiAuthToken: e.target.value })}
                              placeholder="输入令牌/密钥"
                              style={{ width: 240 }}
                            />
                          }
                        />
                      </>
                    )}

                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-on-surface">自定义请求头</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={importHeadersFromJson}
                            className="px-2.5 py-1.5 text-xs bg-surface-variant text-on-surface-variant rounded-md hover:bg-outline-variant transition-colors flex items-center gap-1"
                          >
                            <Upload size={12} />
                            导入 JSON
                          </button>
                          <button
                            onClick={addHeader}
                            className="px-2.5 py-1.5 text-xs bg-primary text-on-primary rounded-md hover:opacity-90 transition-opacity flex items-center gap-1"
                          >
                            <Plus size={12} />
                            添加
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        {dashboardApiHeaders.length === 0 ? (
                          <div className="text-xs text-on-surface-variant text-center py-4 bg-surface-variant/50 rounded-lg">
                            暂无自定义请求头
                          </div>
                        ) : (
                          dashboardApiHeaders.map((header, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={header.key}
                                onChange={e => updateHeader(index, 'key', e.target.value)}
                                placeholder="Header Name"
                                className="flex-1 text-sm"
                                style={{ minWidth: 0 }}
                              />
                              <input
                                type="text"
                                value={header.value}
                                onChange={e => updateHeader(index, 'value', e.target.value)}
                                placeholder="Header Value"
                                className="flex-1 text-sm"
                                style={{ minWidth: 0 }}
                              />
                              <button
                                onClick={() => removeHeader(index)}
                                className="p-1.5 text-on-surface-variant hover:text-error hover:bg-surface-variant rounded-md transition-colors flex-shrink-0"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mb-3">
                        <div className="text-xs font-medium text-on-surface-variant mb-2">快速模板</div>
                        <div className="flex flex-wrap gap-2">
                          {headerTemplates.map(template => (
                            <button
                              key={template.name}
                              onClick={() => applyHeaderTemplate(template)}
                              className="px-2.5 py-1 text-xs bg-surface-variant text-on-surface-variant rounded-md hover:bg-outline-variant transition-colors"
                            >
                              {template.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {getAllHeaderVariables().length > 0 && (
                        <div className="mt-3 p-3 bg-surface-variant/50 rounded-lg">
                          <div className="text-xs font-medium text-on-surface-variant mb-2">
                            检测到的变量 ({getAllHeaderVariables().length})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {getAllHeaderVariables().map(v => (
                              <span
                                key={v}
                                className="px-2 py-0.5 text-xs bg-primary-container text-on-primary-container rounded-md font-mono"
                              >
                                $&#123;{v}&#125;
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-on-surface-variant mt-2">
                            变量从环境变量 (VITE_前缀) 或本地存储读取
                          </div>
                        </div>
                      )}
                    </div>

                    {(settings.dashboardApiMethod === 'POST' || settings.dashboardApiMethod === 'PUT') && (
                      <div className="px-4 py-3">
                        <div className="text-sm font-medium text-on-surface mb-2">请求体</div>
                        <textarea
                          value={settings.dashboardApiBody || ''}
                          onChange={e => updateSettings({ dashboardApiBody: e.target.value })}
                          placeholder='{"key": "value"}'
                          rows={6}
                          className="w-full text-sm font-mono resize-y"
                        />
                        <div className="text-xs text-on-surface-variant mt-1">
                          支持变量替换，格式：${'${VARIABLE_NAME}'}
                        </div>
                      </div>
                    )}

                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-on-surface">变量管理</span>
                        <button
                          onClick={addVariable}
                          className="px-2.5 py-1.5 text-xs bg-primary text-on-primary rounded-md hover:opacity-90 transition-opacity flex items-center gap-1"
                        >
                          <Plus size={12} />
                          添加变量
                        </button>
                      </div>

                      <div className="space-y-2">
                        {dashboardApiVariables.length === 0 ? (
                          <div className="text-xs text-on-surface-variant text-center py-4 bg-surface-variant/50 rounded-lg">
                            暂无自定义变量
                          </div>
                        ) : (
                          dashboardApiVariables.map((variable, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={variable.key}
                                onChange={e => updateVariable(index, 'key', e.target.value)}
                                placeholder="变量名"
                                className="flex-1 text-sm"
                                style={{ minWidth: 0 }}
                              />
                              <input
                                type="text"
                                value={variable.value}
                                onChange={e => updateVariable(index, 'value', e.target.value)}
                                placeholder="变量值"
                                className="flex-1 text-sm"
                                style={{ minWidth: 0 }}
                              />
                              <button
                                onClick={() => removeVariable(index)}
                                className="p-1.5 text-on-surface-variant hover:text-error hover:bg-surface-variant rounded-md transition-colors flex-shrink-0"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-outline-variant">
                      <button
                        onClick={() => setShowCurlImport(!showCurlImport)}
                        className="w-full px-3 py-2 bg-surface-variant text-on-surface-variant rounded-lg text-sm font-medium hover:bg-outline-variant transition-colors flex items-center justify-center gap-2"
                      >
                        <Download size={14} />
                        从 curl 命令导入
                      </button>

                      {showCurlImport && (
                        <div className="mt-3 space-y-3">
                          <textarea
                            value={curlCommand}
                            onChange={e => setCurlCommand(e.target.value)}
                            placeholder={`粘贴 curl 命令，例如：
curl -X POST https://api.example.com/data \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token' \\
  --data-raw '{"key": "value"}'`}
                            rows={6}
                            className="w-full text-sm font-mono resize-y"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={importFromCurl}
                              className="flex-1 px-3 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                            >
                              解析并导入
                            </button>
                            <button
                              onClick={() => {
                                setShowCurlImport(false);
                                setCurlCommand('');
                              }}
                              className="px-3 py-2 bg-surface-variant text-on-surface-variant rounded-lg text-sm font-medium hover:bg-outline-variant transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <SettingsRow
                      label="测试连接"
                      desc="验证 API 配置是否正确"
                      right={
                        <button
                          onClick={testApiConnection}
                          disabled={saving}
                          className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-medium flex items-center gap-1 hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={saving ? 'animate-spin' : ''} />
                          {saving ? '测试中' : '测试'}
                        </button>
                      }
                    />
                  </>
                )}
              </SettingsGroup>

              <SettingsGroup title="本地统计">
                <SettingsRow
                  label="启用本地统计"
                  desc="在本地收集和显示使用统计数据"
                  right={
                    <Toggle
                      checked={settings.localStatsEnabled !== false}
                      onChange={v => updateSettings({ localStatsEnabled: v })}
                      disabled={saving}
                    />
                  }
                />
                {settings.localStatsEnabled !== false && (
                  <div className="px-4 py-3">
                    <p className="text-xs text-on-surface-variant">
                      统计数据完全存储在本地浏览器中，不会上传到任何服务器。
                      包括对话次数、Token 使用量、常用模型等使用信息。
                      你可以随时在数据看板中查看详细统计。
                    </p>
                  </div>
                )}
              </SettingsGroup>

              <SettingsGroup title="数据隐私">
                <SettingsRow
                  label="本地数据存储"
                  desc="将使用数据保存在本地"
                  right={
                    <Toggle
                      checked={settings.localDataStorage !== false}
                      onChange={v => updateSettings({ localDataStorage: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="匿名使用统计"
                  desc="帮助我们改进产品（不包含个人信息）"
                  right={
                    <Toggle
                      checked={!!settings.anonymousAnalytics}
                      onChange={v => updateSettings({ anonymousAnalytics: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="崩溃报告"
                  desc="自动发送崩溃报告帮助改进"
                  right={
                    <Toggle
                      checked={!!settings.crashReports}
                      onChange={v => updateSettings({ crashReports: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="数据导出">
                <SettingsRow
                  label="导出所有数据"
                  desc="导出你的所有配置和历史数据"
                  onClick={() => showToast({ type: 'info', title: '功能开发中' })}
                  right={<Download size={16} />}
                />
                <SettingsRow
                  label="导入数据"
                  desc="从备份文件恢复数据"
                  onClick={() => showToast({ type: 'info', title: '功能开发中' })}
                  right={<Upload size={16} />}
                />
              </SettingsGroup>
            </div>
          )}

          {activeTab === 'system' && (
            <div>
              <h2 className="text-2xl font-semibold text-on-surface mb-6">系统设置</h2>

              <SettingsGroup title="启动">
                <SettingsRow
                  label="开机自启动"
                  desc="开机时自动启动 OxygenClaw"
                  right={
                    <Toggle
                      checked={!!settings.autoStart}
                      onChange={v => updateSettings({ autoStart: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="启动时最小化"
                  desc="启动时最小化到系统托盘"
                  right={
                    <Toggle
                      checked={!!settings.startMinimized}
                      onChange={v => updateSettings({ startMinimized: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="禁用 GPU 硬件加速"
                  desc="出现界面渲染异常时可开启，重启后生效"
                  right={
                    <Toggle
                      checked={!!settings.disableGpuAccel}
                      onChange={v => updateSettings({ disableGpuAccel: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="模型连接">
                <SettingsRow
                  label="前端直连模型 API"
                  desc="后端不可用时，直接从浏览器调用模型 API（最后手段）"
                  right={
                    <Toggle
                      checked={!!settings.directModelAccess}
                      onChange={v => updateSettings({ directModelAccess: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="快捷键">
                <SettingsRow
                  label="快速召唤"
                  desc={settings.hotkey || 'Ctrl+F12'}
                  right={
                    <button
                      onClick={() => showToast({ type: 'info', title: '功能开发中', description: '快捷键配置功能将在后续版本开放' })}
                      className="px-3 py-1 bg-surface-variant rounded-lg text-sm font-mono text-on-surface-variant hover:bg-outline-variant transition-colors"
                    >
                      {settings.hotkey || 'Ctrl+F12'}
                    </button>
                  }
                />
                <SettingsRow
                  label="新建对话"
                  desc="快速创建新对话"
                  right={
                    <span className="text-sm font-mono text-on-surface-variant">Ctrl+N</span>
                  }
                />
                <SettingsRow
                  label="搜索对话"
                  desc="搜索历史对话"
                  right={
                    <span className="text-sm font-mono text-on-surface-variant">Ctrl+F</span>
                  }
                />
                <SettingsRow
                  label="切换设置"
                  desc="打开/关闭设置面板"
                  right={
                    <span className="text-sm font-mono text-on-surface-variant">Ctrl+,</span>
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="文件与存储">
                <SettingsRow
                  label="文件存储目录"
                  desc={settings.workspaceDir || '未设置'}
                  right={
                    <button
                      onClick={() => showToast({ type: 'info', title: '功能开发中', description: '文件存储目录选择功能将在后续版本开放' })}
                      className="text-sm text-primary hover:opacity-80"
                    >
                      更改
                    </button>
                  }
                />
                <SettingsRow
                  label="最大缓存大小"
                  desc="本地缓存的最大空间"
                  right={
                    <select
                      value={settings.maxCacheSize || '1024'}
                      onChange={e => updateSettings({ maxCacheSize: e.target.value })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="512">512 MB</option>
                      <option value="1024">1 GB</option>
                      <option value="2048">2 GB</option>
                      <option value="5120">5 GB</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="清理缓存"
                  desc="清理临时缓存文件"
                  onClick={() => {
                    if (confirm('确定要清理所有缓存数据吗？')) {
                      localStorage.clear();
                      location.reload();
                    }
                  }}
                  right={<Trash2 size={16} className="text-on-surface-variant" />}
                />
              </SettingsGroup>

              <SettingsGroup title="网络">
                <SettingsRow
                  label="代理设置"
                  desc="配置网络代理"
                  right={
                    <select
                      value={settings.proxyMode || 'system'}
                      onChange={e => updateSettings({ proxyMode: e.target.value })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="system">系统代理</option>
                      <option value="direct">直连</option>
                      <option value="manual">手动配置</option>
                    </select>
                  }
                />
                {settings.proxyMode === 'manual' && (
                  <>
                    <SettingsRow
                      label="代理地址"
                      right={
                        <input
                          type="text"
                          value={settings.proxyHost || ''}
                          onChange={e => updateSettings({ proxyHost: e.target.value })}
                          placeholder="127.0.0.1"
                          style={{ width: 140 }}
                        />
                      }
                    />
                    <SettingsRow
                      label="代理端口"
                      right={
                        <input
                          type="number"
                          value={settings.proxyPort || ''}
                          onChange={e => updateSettings({ proxyPort: e.target.value })}
                          placeholder="7890"
                          style={{ width: 80 }}
                        />
                      }
                    />
                  </>
                )}
                <SettingsRow
                  label="超时时间"
                  desc="网络请求超时时间（秒）"
                  right={
                    <select
                      value={settings.timeout || '30'}
                      onChange={e => updateSettings({ timeout: e.target.value })}
                      style={{ minWidth: 100 }}
                    >
                      <option value="10">10 秒</option>
                      <option value="30">30 秒</option>
                      <option value="60">60 秒</option>
                      <option value="120">120 秒</option>
                      <option value="300">300 秒</option>
                    </select>
                  }
                />
              </SettingsGroup>

              <SettingsGroup title="更新">
                <SettingsRow
                  label="自动检查更新"
                  desc="自动检测并提示新版本"
                  right={
                    <Toggle
                      checked={settings.autoUpdateCheck !== false}
                      onChange={v => updateSettings({ autoUpdateCheck: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="更新通道"
                  desc="选择接收更新的渠道"
                  right={
                    <select
                      value={settings.updateChannel || 'stable'}
                      onChange={e => updateSettings({ updateChannel: e.target.value })}
                      style={{ minWidth: 120 }}
                    >
                      <option value="stable">稳定版</option>
                      <option value="beta">测试版</option>
                      <option value="dev">开发版</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="检查更新"
                  desc="当前版本 v26.0-Alpha 1"
                  onClick={() => showToast({ type: 'info', title: '检查更新', description: '已是最新版本' })}
                  right={<span className="text-sm text-primary">检查</span>}
                />
              </SettingsGroup>

              <SettingsGroup title="日志">
                <SettingsRow
                  label="启用日志"
                  desc="记录运行日志用于排查问题"
                  right={
                    <Toggle
                      checked={settings.enableLogging !== false}
                      onChange={v => updateSettings({ enableLogging: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="日志级别"
                  desc="记录日志的详细程度"
                  right={
                    <select
                      value={settings.logLevel || 'info'}
                      onChange={e => updateSettings({ logLevel: e.target.value })}
                      style={{ minWidth: 100 }}
                    >
                      <option value="error">错误</option>
                      <option value="warn">警告</option>
                      <option value="info">信息</option>
                      <option value="debug">调试</option>
                    </select>
                  }
                />
                <SettingsRow
                  label="打开日志目录"
                  desc="查看日志文件位置"
                  onClick={() => showToast({ type: 'info', title: '功能开发中' })}
                  right={<Folder size={16} className="text-on-surface-variant" />}
                />
              </SettingsGroup>

              <SettingsGroup title="高级">
                <SettingsRow
                  label="开发者模式"
                  desc="启用开发者工具和高级选项"
                  right={
                    <Toggle
                      checked={!!settings.devMode}
                      onChange={v => updateSettings({ devMode: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="实验性功能"
                  desc="启用尚未正式发布的功能"
                  right={
                    <Toggle
                      checked={!!settings.experimentalFeatures}
                      onChange={v => updateSettings({ experimentalFeatures: v })}
                      disabled={saving}
                    />
                  }
                />
                <SettingsRow
                  label="硬件加速"
                  desc="使用 GPU 加速界面渲染"
                  right={
                    <Toggle
                      checked={settings.hardwareAcceleration !== false}
                      onChange={v => updateSettings({ hardwareAcceleration: v })}
                      disabled={saving}
                    />
                  }
                />
              </SettingsGroup>
            </div>
          )}

          {activeTab === 'about' && (
            <div>
              <h2 className="text-2xl font-semibold text-on-surface mb-6">关于</h2>

              <div className="bg-surface rounded-xl border border-outline-variant p-6 text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={28} className="text-on-primary" />
                </div>
                <div className="text-xl font-semibold text-on-surface">OxygenClaw</div>
                <div className="text-sm text-on-surface-variant mt-1">v0.1.0 (Developer Preview)</div>
                <button
                  onClick={() => showToast({ type: 'info', title: '检查更新', description: '已是最新版本' })}
                  className="mt-4 px-4 py-2 bg-surface-variant text-on-surface-variant rounded-lg text-sm hover:bg-outline-variant transition-colors"
                >
                  检查更新
                </button>
              </div>

              <SettingsGroup title="法律">
                <SettingsRow
                  label="开源协议"
                  onClick={() => showToast({ type: 'info', title: '功能开发中' })}
                />
                <SettingsRow
                  label="隐私政策"
                  onClick={() => showToast({ type: 'info', title: '功能开发中' })}
                />
                <SettingsRow
                  label="服务条款"
                  onClick={() => showToast({ type: 'info', title: '功能开发中' })}
                />
                <SettingsRow
                  label="第三方许可"
                  onClick={() => showToast({ type: 'info', title: '功能开发中' })}
                />
              </SettingsGroup>

              <SettingsGroup title="联系">
                <SettingsRow
                  label="官方网站"
                  right={<ExternalLink size={14} className="text-on-surface-variant" />}
                  onClick={() => window.open('https://oxygenclaw.ai', '_blank')}
                />
                <SettingsRow
                  label="GitHub"
                  right={<ExternalLink size={14} className="text-on-surface-variant" />}
                  onClick={() => window.open('https://github.com/oxygenclaw', '_blank')}
                />
                <SettingsRow
                  label="反馈问题"
                  right={<ExternalLink size={14} className="text-on-surface-variant" />}
                  onClick={() => showToast({ type: 'info', title: '功能开发中' })}
                />
              </SettingsGroup>

              <div className="mt-8 text-center text-xs text-on-surface-variant">
                OxygenClaw — 由 Oxygen AI Lab 源氧智能实验室驱动
              </div>
            </div>
          )}
        </div>
      </div>

      {showEditProfile && (
        <div className="modal-overlay" onClick={() => setShowEditProfile(false)}>
          <div className="modal-content modal-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-outline-variant">
              <h3 className="text-lg font-semibold text-on-surface">编辑个人资料</h3>
              <button
                onClick={() => setShowEditProfile(false)}
                className="p-1 rounded-lg hover:bg-surface-variant text-on-surface-variant"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">用户名</label>
                <input
                  type="text"
                  value={editProfileData.username}
                  onChange={e => setEditProfileData(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">邮箱</label>
                <input
                  type="text"
                  value={editProfileData.email}
                  onChange={e => setEditProfileData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full"
                />
              </div>
            </div>
            <div className="p-4 border-t border-outline-variant flex justify-end gap-2">
              <button
                onClick={() => setShowEditProfile(false)}
                className="px-4 py-2 bg-surface-variant text-on-surface-variant rounded-lg text-sm font-medium hover:bg-outline-variant transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveProfile}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangePassword && (
        <div className="modal-overlay" onClick={() => setShowChangePassword(false)}>
          <div className="modal-content modal-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-outline-variant">
              <h3 className="text-lg font-semibold text-on-surface">修改密码</h3>
              <button
                onClick={() => setShowChangePassword(false)}
                className="p-1 rounded-lg hover:bg-surface-variant text-on-surface-variant"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {!useLocalMode && (
                <div>
                  <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">当前密码</label>
                  <input
                    type="password"
                    value={changePasswordData.oldPassword}
                    onChange={e => setChangePasswordData(prev => ({ ...prev, oldPassword: e.target.value }))}
                    className="w-full"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">新密码</label>
                <input
                  type="password"
                  value={changePasswordData.newPassword}
                  onChange={e => setChangePasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">确认新密码</label>
                <input
                  type="password"
                  value={changePasswordData.confirmPassword}
                  onChange={e => setChangePasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full"
                />
              </div>
            </div>
            <div className="p-4 border-t border-outline-variant flex justify-end gap-2">
              <button
                onClick={() => setShowChangePassword(false)}
                className="px-4 py-2 bg-surface-variant text-on-surface-variant rounded-lg text-sm font-medium hover:bg-outline-variant transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSavePassword}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateTask && (
        <div className="modal-overlay" onClick={() => setShowCreateTask(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-outline-variant">
              <h3 className="text-lg font-semibold text-on-surface">创建触发任务</h3>
              <button
                onClick={() => setShowCreateTask(false)}
                className="p-1 rounded-lg hover:bg-surface-variant text-on-surface-variant"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">任务名称</label>
                <input
                  type="text"
                  value={createTaskData.name}
                  onChange={e => setCreateTaskData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="输入任务名称"
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">任务描述</label>
                <textarea
                  value={createTaskData.description}
                  onChange={e => setCreateTaskData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="描述任务要做什么"
                  rows={3}
                  className="w-full resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">触发方式</label>
                <div className="flex gap-2 flex-wrap">
                  {(['daily', 'weekly', 'interval', 'cron'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setCreateTaskData(prev => ({ ...prev, schedule: s }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        createTaskData.schedule === s
                          ? 'bg-primary-container text-on-primary-container'
                          : 'bg-surface-variant text-on-surface-variant hover:bg-outline-variant'
                      }`}
                    >
                      {s === 'daily' ? '每天' : s === 'weekly' ? '每周' : s === 'interval' ? '间隔' : 'Cron'}
                    </button>
                  ))}
                </div>
              </div>
              {(createTaskData.schedule === 'daily' || createTaskData.schedule === 'weekly') && (
                <div>
                  <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">执行时间</label>
                  <input
                    type="time"
                    value={createTaskData.time}
                    onChange={e => setCreateTaskData(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full"
                  />
                </div>
              )}
              {createTaskData.schedule === 'weekly' && (
                <div>
                  <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">星期</label>
                  <div className="flex gap-1 flex-wrap">
                    {['1', '2', '3', '4', '5', '6', '0'].map(day => (
                      <button
                        key={day}
                        onClick={() => {
                          const days = createTaskData.daysOfWeek.includes(day)
                            ? createTaskData.daysOfWeek.filter(d => d !== day)
                            : [...createTaskData.daysOfWeek, day];
                          setCreateTaskData(prev => ({ ...prev, daysOfWeek: days }));
                        }}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          createTaskData.daysOfWeek.includes(day)
                            ? 'bg-primary-container text-on-primary-container'
                            : 'bg-surface-variant text-on-surface-variant hover:bg-outline-variant'
                        }`}
                      >
                        {day === '0' ? '日' : day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {createTaskData.schedule === 'interval' && (
                <div>
                  <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">间隔时间（分钟）</label>
                  <input
                    type="number"
                    value={createTaskData.intervalMinutes}
                    onChange={e => setCreateTaskData(prev => ({ ...prev, intervalMinutes: parseInt(e.target.value) || 60 }))}
                    min="1"
                    className="w-full"
                  />
                </div>
              )}
              {createTaskData.schedule === 'cron' && (
                <div>
                  <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">Cron 表达式</label>
                  <input
                    type="text"
                    value={createTaskData.cron}
                    onChange={e => setCreateTaskData(prev => ({ ...prev, cron: e.target.value }))}
                    placeholder="0 9 * * *"
                    className="w-full font-mono"
                  />
                </div>
              )}
            </div>
            <div className="p-4 border-t border-outline-variant flex justify-end gap-2">
              <button
                onClick={() => setShowCreateTask(false)}
                className="px-4 py-2 bg-surface-variant text-on-surface-variant rounded-lg text-sm font-medium hover:bg-outline-variant transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveTask}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
