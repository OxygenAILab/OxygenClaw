/**
 * SettingsV2 — Schema 驱动的设置页面（演示版）
 * 
 * 本页面展示动态设置系统的核心能力：
 * - 从 settingsSchema 自动渲染所有控件
 * - 条件显隐（visibleWhen）
 * - External bindings（theme/language 走特殊 context）
 * - 后端 settingsApi 读写 + localStorage fallback
 */
import { useState, useEffect } from 'react';
import { settingsSchema } from '../settings/schema';
import { SettingsValues } from '../settings/types';
import { SchemaForm } from '../components/settings/SchemaForm';
import { useTheme } from '../contexts/ThemeContext';
import { useI18n } from '../i18n';
import { settingsApi } from '../services/api';

type SettingsTab = 'appearance' | 'chat' | 'multimodal' | 'notifications' | 'system';

const LOCAL_SETTINGS_KEY = 'oxygenclaw:settings-v2';

function loadLocalSettings(): SettingsValues {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalSettings(settings: SettingsValues): void {
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
}

export default function SettingsV2() {
  const { themeMode, setThemeMode, uiTheme, setUiTheme, materialSeed, setMaterialSeed } = useTheme();
  const { locale, setLocale } = useI18n();

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [settings, setSettings] = useState<SettingsValues>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // 初始加载
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const result = await settingsApi.get();
        if (result.success && result.data) {
          setSettings(result.data);
        } else {
          const local = loadLocalSettings();
          setSettings(local);
        }
      } catch {
        const local = loadLocalSettings();
        setSettings(local);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // 修改设置
  const handleChange = async (key: string, value: unknown) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // 立即保存到本地
    saveLocalSettings(newSettings);

    // 尝试同步到后端（静默失败）
    setSaving(true);
    try {
      await settingsApi.update(newSettings);
    } catch {
      // 后端不可用，已保存到本地即可
    } finally {
      setSaving(false);
    }
  };

  // External bindings（theme/language 走特殊 context）
  const externalBindings = {
    theme: {
      value: themeMode,
      onChange: (v: unknown) => setThemeMode(v as 'light' | 'dark' | 'system'),
    },
    uiTheme: {
      value: uiTheme,
      onChange: (v: unknown) => setUiTheme(v as 'apple' | 'material' | 'liquid-glass'),
    },
    materialSeed: {
      value: materialSeed,
      onChange: (v: unknown) => setMaterialSeed(v as string),
    },
    language: {
      value: locale,
      onChange: (v: unknown) => setLocale(v as 'zh' | 'en'),
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-on-surface-variant">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface">
      {/* 左侧标签栏 */}
      <div className="w-64 bg-surface-container border-r border-outline-variant p-4">
        <h1 className="text-xl font-semibold text-on-surface mb-4 px-2">设置（Schema 驱动）</h1>
        <div className="space-y-1">
          {settingsSchema.tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-container text-on-primary-container font-medium'
                  : 'text-on-surface hover:bg-surface-container-high'
              }`}
            >
              {/* i18n 在 SchemaForm 中处理，这里简化显示 id */}
              {tab.id}
            </button>
          ))}
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <SchemaForm
            schema={settingsSchema}
            activeTab={activeTab}
            values={settings}
            onChange={handleChange}
            saving={saving}
            externalBindings={externalBindings}
          />
        </div>
      </div>
    </div>
  );
}
