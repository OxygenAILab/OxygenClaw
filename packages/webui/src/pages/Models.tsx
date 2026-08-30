import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import {
  Search, ChevronDown, ChevronRight, RefreshCw,
  X, Loader2, Server, Copy, Bot,
  Upload, Download, FileJson, Plus, Save,
  Trash2, Settings, Image as ImageIcon, Eye, Paperclip,
  Cloud, CloudOff, Zap, MoreVertical
} from 'lucide-react';
import {
  loadProviders, saveProviders, getEnabledModels, generateId,
  ModelProvider, ModelInfo
} from '../store';
import { useToast } from '../components/Toast';
import { llmApi, newapiApi, ModelProviderData } from '../services/api';
import { 
  PageHeader, Button, Badge, Card, Grid, Dialog, Dropdown, Input,
  type DropdownItem 
} from '../components/ui';

interface ModelConfig {
  TokenName: string;
  ConnectInfo: {
    _type: string;
    key: string;
    url: string;
  };
  Models: string[];
  BillingMultiplier: string;
  ModelCapabilities: Record<string, {
    supportsVision: boolean;
    supportsFiles: boolean;
    supportsImageGeneration: boolean;
  }>;
}

const Models: React.FC = () => {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [useBackend, setUseBackend] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  const [deployMode, setDeployMode] = useState<'import' | 'paste' | 'form'>('form');
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [jsonPasteContent, setJsonPasteContent] = useState('');
  const [formConfig, setFormConfig] = useState<ModelConfig>({
    TokenName: '',
    ConnectInfo: {
      _type: 'newapi_channel_conn',
      key: '',
      url: 'https://api.stepfun.com/step_plan/v1'
    },
    Models: [],
    BillingMultiplier: '1x',
    ModelCapabilities: {},
  });
  const [importedConfigs, setImportedConfigs] = useState<ModelConfig[]>([]);
  const [activeImportIndex, setActiveImportIndex] = useState(0);
  const [newModelName, setNewModelName] = useState('');

  // 快速预设：点击后填充 url / TokenName / 常用模型并切到手动配置
  const DEPLOY_PRESETS: { name: string; url: string; models: string[] }[] = [
    { name: 'OpenAI', url: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini'] },
    { name: 'Anthropic', url: 'https://api.anthropic.com/v1', models: ['claude-sonnet-4-5'] },
    { name: 'Gemini', url: 'https://generativelanguage.googleapis.com/v1beta', models: ['gemini-2.0-flash'] },
    { name: 'NewAPI', url: '', models: [] },
    { name: '硅基流动', url: 'https://api.siliconflow.cn/v1', models: ['deepseek-ai/DeepSeek-V3'] },
    { name: '火山方舟', url: 'https://ark.cn-beijing.volces.com/api/v3', models: [] },
    { name: '阿里百炼', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-max', 'qwen-plus'] },
    { name: '无问芯穹', url: '', models: [] },
    { name: 'OpenCode Zen', url: '', models: [] },
  ];

  const applyDeployPreset = (preset: typeof DEPLOY_PRESETS[number]) => {
    setFormConfig(prev => ({
      ...prev,
      TokenName: preset.name,
      ConnectInfo: { ...prev.ConnectInfo, url: preset.url },
      Models: [...preset.models],
    }));
    setNewModelName('');
    setDeployMode('form');
    showToast({
      type: 'success',
      title: `已应用 ${preset.name} 预设`,
      description: preset.url ? '填写 API Key 后即可部署' : '该平台需手动填写 API 地址',
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const models = getEnabledModels(providers);

  const backendProvidersToLocal = (backendProviders: ModelProviderData[]): ModelProvider[] => {
    return backendProviders.map(bp => ({
      id: bp.id,
      name: bp.name,
      type: (bp.type as ModelProvider['type']) || 'openai-compatible',
      apiKey: bp.apiKey,
      baseUrl: bp.baseUrl,
      billingMultiplier: bp.billingMultiplier,
      createdAt: bp.createdAt,
      models: bp.models.map(bm => ({
        id: bm.name,
        name: bm.name,
        enabled: bm.enabled,
        supportsVision: bm.supportsVision,
        supportsFiles: bm.supportsFiles,
        supportsImageGeneration: (bm as any).supportsImageGeneration ?? false,
        contextWindow: bm.contextWindow,
        maxOutput: bm.maxOutput,
      }))
    }));
  };

  const fetchModels = async () => {
    setLoading(true);
    try {
      const result = await llmApi.getProviders();
      if (result.success && result.data && result.data.providers) {
        const localProviders = backendProvidersToLocal(result.data.providers);
        setProviders(localProviders);
        setBackendAvailable(true);
        setUseBackend(true);
      } else {
        const loadedProviders = loadProviders();
        setProviders(loadedProviders);
        setBackendAvailable(false);
        setUseBackend(false);
      }
    } catch (e: any) {
      const loadedProviders = loadProviders();
      setProviders(loadedProviders);
      setBackendAvailable(false);
      setUseBackend(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const filteredModels = models.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const config = JSON.parse(content);
        validateAndDeploy(config);
      } catch {
        showToast({ type: 'error', title: '无效的 JSON 文件' });
      }
    };
    reader.readAsText(file);
  };

  const validateSingleConfig = (config: any): ModelConfig | null => {
    if (!config.TokenName || !config.ConnectInfo || !config.Models) {
      return null;
    }
    let url = config.ConnectInfo?.url || '';
    url = url.replace(/`/g, '').trim();
    return {
      TokenName: config.TokenName,
      ConnectInfo: {
        _type: config.ConnectInfo._type || 'newapi_channel_conn',
        key: config.ConnectInfo.key || '',
        url: url
      },
      Models: Array.isArray(config.Models) ? config.Models : [],
      BillingMultiplier: config.BillingMultiplier || '1x',
      ModelCapabilities: config.ModelCapabilities || {}
    };
  };

  const validateAndDeploy = (config: any) => {
    if (Array.isArray(config)) {
      const validConfigs: ModelConfig[] = [];
      for (const item of config) {
        const validated = validateSingleConfig(item);
        if (validated) {
          validConfigs.push(validated);
        }
      }
      
      if (validConfigs.length === 0) {
        showToast({ type: 'error', title: '配置格式不正确', description: '数组中没有有效的模型配置' });
        return;
      }

      setImportedConfigs(validConfigs);
      setActiveImportIndex(0);
      setFormConfig(validConfigs[0]);
      setDeployMode('form');
      showToast({ type: 'success', title: `成功导入 ${validConfigs.length} 个模型配置` });
    } else {
      const validated = validateSingleConfig(config);
      if (!validated) {
        showToast({ type: 'error', title: '配置格式不正确', description: '请检查 TokenName、ConnectInfo 和 Models 字段' });
        return;
      }

      setImportedConfigs([validated]);
      setActiveImportIndex(0);
      setFormConfig(validated);
      setDeployMode('form');
      showToast({ type: 'success', title: '配置导入成功' });
    }
  };

  const handlePasteDeploy = () => {
    if (!jsonPasteContent.trim()) {
      showToast({ type: 'error', title: '请输入 JSON 配置' });
      return;
    }
    try {
      const config = JSON.parse(jsonPasteContent);
      validateAndDeploy(config);
    } catch {
      showToast({ type: 'error', title: '无效的 JSON 格式' });
    }
  };

  const handleAddModel = () => {
    if (!newModelName.trim()) {
      showToast({ type: 'error', title: '请输入模型名称' });
      return;
    }
    if (formConfig.Models.includes(newModelName)) {
      showToast({ type: 'error', title: '模型已存在' });
      return;
    }
    setFormConfig(prev => ({
      ...prev,
      Models: [...prev.Models, newModelName],
      ModelCapabilities: {
        ...prev.ModelCapabilities,
        [newModelName]: {
          supportsVision: false,
          supportsFiles: false,
          supportsImageGeneration: false,
        }
      }
    }));
    setNewModelName('');
    showToast({ type: 'success', title: '模型已添加' });
  };

  const handleRemoveModel = (modelName: string) => {
    setFormConfig(prev => {
      const newCapabilities = { ...prev.ModelCapabilities };
      delete newCapabilities[modelName];
      return {
        ...prev,
        Models: prev.Models.filter(m => m !== modelName),
        ModelCapabilities: newCapabilities,
      };
    });
  };

  // ── NewAPI 站点模型拉取（拥抱 NewAPI：一键导入站点可用模型） ──
  const [showNewapiPull, setShowNewapiPull] = useState(false);
  const [newapiPullUrl, setNewapiPullUrl] = useState('');
  const [newapiPullCred, setNewapiPullCred] = useState('');
  const [newapiPulling, setNewapiPulling] = useState(false);
  const [newapiFound, setNewapiFound] = useState<string[]>([]);
  const [newapiSelected, setNewapiSelected] = useState<Set<string>>(new Set());

  const openNewapiPull = () => {
    setNewapiPullUrl(formConfig.ConnectInfo.url || '');
    try {
      const saved = localStorage.getItem('oxygenclaw:newapi-conn');
      if (saved) {
        const conn = JSON.parse(saved);
        if (conn.credential) setNewapiPullCred(conn.credential);
        if (conn.url && !formConfig.ConnectInfo.url) setNewapiPullUrl(conn.url);
      }
    } catch {}
    setShowNewapiPull(true);
  };

  const pullNewapiModels = async () => {
    if (!newapiPullUrl.trim() || !newapiPullCred.trim()) {
      showToast({ type: 'error', title: '请填写站点地址和凭据' });
      return;
    }
    setNewapiPulling(true);
    try {
      const r = await newapiApi.listModels(newapiPullUrl.trim(), newapiPullCred.trim());
      if (r.success && r.models) {
        setNewapiFound(r.models);
        setNewapiSelected(new Set());
        try {
          localStorage.setItem('oxygenclaw:newapi-conn', JSON.stringify({ url: newapiPullUrl.trim(), credential: newapiPullCred.trim() }));
        } catch {}
        showToast({ type: 'success', title: `拉取到 ${r.models.length} 个模型` });
      } else {
        showToast({ type: 'error', title: '拉取失败', description: r.error });
      }
    } catch (e: any) {
      showToast({ type: 'error', title: '拉取失败', description: e?.message });
    } finally {
      setNewapiPulling(false);
    }
  };

  const importSelectedNewapiModels = () => {
    const toAdd = [...newapiSelected].filter(m => !formConfig.Models.includes(m));
    if (toAdd.length === 0) {
      showToast({ type: 'info', title: '未选择新模型' });
      return;
    }
    setFormConfig(prev => {
      const caps = { ...prev.ModelCapabilities };
      for (const m of toAdd) {
        caps[m] = { supportsVision: false, supportsFiles: false, supportsImageGeneration: false };
      }
      return { ...prev, Models: [...prev.Models, ...toAdd], ModelCapabilities: caps };
    });
    showToast({ type: 'success', title: `已导入 ${toAdd.length} 个模型` });
    setNewapiFound([]);
    setNewapiSelected(new Set());
  };

  const toggleModelCapability = (modelName: string, capability: 'supportsVision' | 'supportsFiles' | 'supportsImageGeneration') => {
    setFormConfig(prev => ({
      ...prev,
      ModelCapabilities: {
        ...prev.ModelCapabilities,
        [modelName]: {
          supportsVision: prev.ModelCapabilities[modelName]?.supportsVision || false,
          supportsFiles: prev.ModelCapabilities[modelName]?.supportsFiles || false,
          supportsImageGeneration: prev.ModelCapabilities[modelName]?.supportsImageGeneration || false,
          [capability]: !prev.ModelCapabilities[modelName]?.[capability],
        }
      }
    }));
  };

  const parseBillingMultiplier = (multiplier: string): number => {
    const match = multiplier.match(/([\d.]+)x?/i);
    if (match) {
      return parseFloat(match[1]);
    }
    return 1;
  };

  const deployConfig = (config: ModelConfig): ModelProvider => {
    const modelInfos: ModelInfo[] = config.Models.map(modelName => ({
      id: modelName,
      name: modelName,
      enabled: true,
      supportsVision: config.ModelCapabilities[modelName]?.supportsVision || false,
      supportsFiles: config.ModelCapabilities[modelName]?.supportsFiles || false,
      supportsImageGeneration: config.ModelCapabilities[modelName]?.supportsImageGeneration || false,
    }));

    return {
      id: generateId(),
      name: config.TokenName,
      type: 'openai-compatible',
      apiKey: config.ConnectInfo.key,
      baseUrl: config.ConnectInfo.url,
      models: modelInfos,
      billingMultiplier: parseBillingMultiplier(config.BillingMultiplier),
      createdAt: Date.now(),
    };
  };

  const validateConfig = (config: ModelConfig): string | null => {
    if (!config.TokenName.trim()) return '请输入 TokenName';
    if (!config.ConnectInfo.key.trim()) return '请输入 API Key';
    if (!config.ConnectInfo.url.trim()) return '请输入 URL';
    if (config.Models.length === 0) return '请至少添加一个模型';
    return null;
  };

  const handleDeploy = async () => {
    const error = validateConfig(formConfig);
    if (error) {
      showToast({ type: 'error', title: error });
      return;
    }

    const newProvider = deployConfig(formConfig);

    if (useBackend && backendAvailable) {
      try {
        const result = await llmApi.createProvider({
          name: newProvider.name,
          type: newProvider.type,
          apiKey: newProvider.apiKey,
          baseUrl: newProvider.baseUrl,
          billingMultiplier: newProvider.billingMultiplier,
          models: newProvider.models.map(m => ({
            id: m.id,
            name: m.name,
            displayName: m.name,
            enabled: m.enabled,
            supportsVision: m.supportsVision,
            supportsFiles: m.supportsFiles,
            supportsImageGeneration: m.supportsImageGeneration,
            supportsTools: false,
            contextWindow: m.contextWindow,
            maxOutput: m.maxOutput,
            costPer1KInput: 0,
            costPer1KOutput: 0,
          }))
        });

        if (result.success && result.data) {
          const createdProvider: ModelProvider = {
            id: result.data.id,
            name: result.data.name,
            type: result.data.type as ModelProvider['type'],
            apiKey: result.data.apiKey,
            baseUrl: result.data.baseUrl,
            billingMultiplier: result.data.billingMultiplier,
            createdAt: result.data.createdAt,
            models: result.data.models.map(bm => ({
              id: bm.name,
              name: bm.name,
              enabled: bm.enabled,
              supportsVision: bm.supportsVision,
              supportsFiles: bm.supportsFiles,
              supportsImageGeneration: (bm as any).supportsImageGeneration ?? false,
              contextWindow: bm.contextWindow,
              maxOutput: bm.maxOutput,
            }))
          };

          const updatedProviders = [...providers, createdProvider];
          setProviders(updatedProviders);
          saveProviders(updatedProviders);

          showToast({ type: 'success', title: '部署成功', description: `已添加 ${formConfig.Models.length} 个模型到后端` });
          closeDeployModal();
          return;
        }
      } catch (e: any) {
        showToast({ type: 'warning', title: '后端部署失败，使用本地存储', description: e?.message });
      }
    }

    const updatedProviders = [...providers, newProvider];
    setProviders(updatedProviders);
    saveProviders(updatedProviders);

    showToast({ type: 'success', title: '部署成功', description: `已添加 ${formConfig.Models.length} 个模型` });
    closeDeployModal();
  };

  const handleDeployAll = async () => {
    if (importedConfigs.length === 0) {
      handleDeploy();
      return;
    }

    let totalModels = 0;
    const newProviders: ModelProvider[] = [];
    const errors: string[] = [];

    for (let i = 0; i < importedConfigs.length; i++) {
      const config = importedConfigs[i];
      const error = validateConfig(config);
      if (error) {
        errors.push(`配置 ${i + 1} (${config.TokenName || '未知'}): ${error}`);
        continue;
      }
      newProviders.push(deployConfig(config));
      totalModels += config.Models.length;
    }

    if (newProviders.length === 0) {
      showToast({
        type: 'error',
        title: '部署失败',
        description: errors.join('\n'),
      });
      return;
    }

    if (useBackend && backendAvailable) {
      let backendSuccessCount = 0;
      const backendProviders: ModelProvider[] = [];

      for (const provider of newProviders) {
        try {
          const result = await llmApi.createProvider({
            name: provider.name,
            type: provider.type,
            apiKey: provider.apiKey,
            baseUrl: provider.baseUrl,
            billingMultiplier: provider.billingMultiplier,
            models: provider.models.map(m => ({
              id: m.id,
              name: m.name,
              displayName: m.name,
              enabled: m.enabled,
              supportsVision: m.supportsVision,
              supportsFiles: m.supportsFiles,
              supportsImageGeneration: m.supportsImageGeneration,
              supportsTools: false,
              contextWindow: m.contextWindow,
              maxOutput: m.maxOutput,
              costPer1KInput: 0,
              costPer1KOutput: 0,
            }))
          });

          if (result.success && result.data) {
            backendProviders.push({
              id: result.data.id,
              name: result.data.name,
              type: result.data.type as ModelProvider['type'],
              apiKey: result.data.apiKey,
              baseUrl: result.data.baseUrl,
              billingMultiplier: result.data.billingMultiplier,
              createdAt: result.data.createdAt,
              models: result.data.models.map(bm => ({
                id: bm.name,
                name: bm.name,
                enabled: bm.enabled,
                supportsVision: bm.supportsVision,
                supportsFiles: bm.supportsFiles,
                supportsImageGeneration: (bm as any).supportsImageGeneration ?? false,
                contextWindow: bm.contextWindow,
                maxOutput: bm.maxOutput,
              }))
            });
            backendSuccessCount++;
          }
        } catch (e: any) {
          errors.push(`${provider.name}: ${e.message}`);
        }
      }

      if (backendProviders.length > 0) {
        const updatedProviders = [...providers, ...backendProviders];
        setProviders(updatedProviders);
        saveProviders(updatedProviders);

        if (errors.length > 0) {
          showToast({
            type: 'success',
            title: `部分部署成功`,
            description: `成功添加 ${backendSuccessCount} 个提供商到后端，共 ${totalModels} 个模型。${errors.length} 个配置失败。`,
          });
        } else {
          showToast({
            type: 'success',
            title: '全部部署成功',
            description: `已添加 ${backendSuccessCount} 个提供商到后端，共 ${totalModels} 个模型`,
          });
        }
        closeDeployModal();
        return;
      }
    }

    const updatedProviders = [...providers, ...newProviders];
    setProviders(updatedProviders);
    saveProviders(updatedProviders);

    if (errors.length > 0) {
      showToast({
        type: 'success',
        title: `部分部署成功`,
        description: `成功添加 ${newProviders.length} 个提供商，共 ${totalModels} 个模型。${errors.length} 个配置失败。`,
      });
    } else {
      showToast({
        type: 'success',
        title: '全部部署成功',
        description: `已添加 ${newProviders.length} 个提供商，共 ${totalModels} 个模型`,
      });
    }
    closeDeployModal();
  };

  const closeDeployModal = () => {
    setShowDeployModal(false);
    setFormConfig({
      TokenName: '',
      ConnectInfo: {
        _type: 'newapi_channel_conn',
        key: '',
        url: 'https://api.stepfun.com/step_plan/v1'
      },
      Models: [],
      BillingMultiplier: '1x',
      ModelCapabilities: {},
    });
    setImportedConfigs([]);
    setActiveImportIndex(0);
    setJsonPasteContent('');
  };

  const handleExportConfig = () => {
    const config = {
      TokenName: formConfig.TokenName,
      ConnectInfo: formConfig.ConnectInfo,
      Models: formConfig.Models,
      BillingMultiplier: formConfig.BillingMultiplier
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formConfig.TokenName || 'model-config'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', title: '配置已导出' });
  };

  const handleCopyConfig = () => {
    const config = {
      TokenName: formConfig.TokenName,
      ConnectInfo: formConfig.ConnectInfo,
      Models: formConfig.Models,
      BillingMultiplier: formConfig.BillingMultiplier
    };
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    showToast({ type: 'success', title: '配置已复制到剪贴板' });
  };

  const toggleModelEnabled = async (providerId: string, modelId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return;

    const model = provider.models.find(m => m.id === modelId);
    if (!model) return;

    if (useBackend && backendAvailable) {
      const backendModelId = model.id;
      try {
        const result = await llmApi.toggleModel(backendModelId);
        if (result.success && result.data) {
          const updatedProviders = providers.map(p => {
            if (p.id === providerId) {
              return {
                ...p,
                models: p.models.map(m => {
                  if (m.id === modelId) {
                    return { ...m, enabled: result.data!.enabled };
                  }
                  return m;
                })
              };
            }
            return p;
          });
          setProviders(updatedProviders);
          saveProviders(updatedProviders);
          return;
        }
      } catch (e: any) {
        showToast({ type: 'warning', title: '后端更新失败，使用本地存储', description: e?.message });
      }
    }

    const updatedProviders = providers.map(p => {
      if (p.id === providerId) {
        return {
          ...p,
          models: p.models.map(m => {
            if (m.id === modelId) {
              return { ...m, enabled: !m.enabled };
            }
            return m;
          })
        };
      }
      return p;
    });
    setProviders(updatedProviders);
    saveProviders(updatedProviders);
  };

  const deleteProvider = async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return;

    if (useBackend && backendAvailable) {
      try {
        const result = await llmApi.deleteProvider(providerId);
        if (result.success) {
          const updatedProviders = providers.filter(p => p.id !== providerId);
          setProviders(updatedProviders);
          saveProviders(updatedProviders);
          showToast({ type: 'success', title: '已从后端删除模型提供商' });
          return;
        }
      } catch (e: any) {
        showToast({ type: 'warning', title: '后端删除失败，使用本地存储', description: e?.message });
      }
    }

    const updatedProviders = providers.filter(p => p.id !== providerId);
    setProviders(updatedProviders);
    saveProviders(updatedProviders);
    showToast({ type: 'success', title: '已删除模型提供商' });
  };

  const syncLocalToBackend = async () => {
    if (!backendAvailable) {
      showToast({ type: 'error', title: '后端不可用，无法同步' });
      return;
    }

    const localProviders = loadProviders();
    if (localProviders.length === 0) {
      showToast({ type: 'info', title: '本地没有可同步的配置' });
      return;
    }

    if (!confirm(`确定要将 ${localProviders.length} 个本地配置同步到后端吗？`)) {
      return;
    }

    setSyncLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const backendData = await llmApi.getProviders();
      const existingProviderNames = new Set(
        (backendData.data?.providers || []).map(p => p.name)
      );

      for (const lp of localProviders) {
        if (existingProviderNames.has(lp.name)) {
          failCount++;
          continue;
        }

        try {
          const result = await llmApi.createProvider({
            name: lp.name,
            type: lp.type,
            apiKey: lp.apiKey,
            baseUrl: lp.baseUrl,
            billingMultiplier: lp.billingMultiplier,
            models: lp.models.map(m => ({
              id: m.id,
              name: m.name,
              displayName: m.name,
              enabled: m.enabled,
              supportsVision: m.supportsVision,
              supportsFiles: m.supportsFiles,
              supportsTools: false,
              contextWindow: m.contextWindow,
              maxOutput: m.maxOutput,
              costPer1KInput: 0,
              costPer1KOutput: 0,
            }))
          });

          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        await fetchModels();
      }

      if (failCount > 0) {
        showToast({
          type: 'success',
          title: `同步完成`,
          description: `成功 ${successCount} 个，跳过/失败 ${failCount} 个（同名提供商已存在）`
        });
      } else {
        showToast({
          type: 'success',
          title: `同步完成`,
          description: `成功同步 ${successCount} 个提供商到后端`
        });
      }
    } catch (e: any) {
      showToast({ type: 'error', title: '同步失败', description: e?.message });
    } finally {
      setSyncLoading(false);
    }
  };

  const getProviderFromModelId = (modelFullId: string): ModelProvider | null => {
    const [providerId] = modelFullId.split(':');
    return providers.find(p => p.id === providerId) || null;
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={t.header.models}
        description="管理可用的 AI 模型，已启用的模型会显示在 Playgrounds"
        actions={
          <>
            {backendAvailable !== null && (
              <Badge 
                variant="tonal" 
                color={backendAvailable ? 'primary' : 'secondary'}
                leftIcon={backendAvailable ? <Cloud size={14} /> : <CloudOff size={14} />}
              >
                {backendAvailable ? '后端已连接' : '本地模式'}
              </Badge>
            )}
            {!backendAvailable && providers.length > 0 && (
              <Button
                variant="tonal"
                size="sm"
                leftIcon={syncLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                onClick={syncLocalToBackend}
                disabled={syncLoading}
              >
                {syncLoading ? '同步中...' : '同步到后端'}
              </Button>
            )}
            <Button
              variant="filled"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => setShowDeployModal(true)}
            >
              部署模型
            </Button>
            <Button
              variant="tonal"
              size="sm"
              leftIcon={loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              onClick={fetchModels}
              disabled={loading}
            >
              {loading ? '加载中...' : '刷新'}
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">

      <div className="mb-6">
        <Input
          placeholder="搜索模型..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          leftIcon={<Search size={16} />}
          fullWidth
        />
      </div>

      {providers.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-on-surface-variant mb-3 flex items-center gap-2">
            <Settings size={14} />
            模型提供商 ({providers.length})
          </h2>
          <Grid cols="auto-fit" minColWidth="340px" spacing={4}>
            {providers.map(provider => {
              const expanded = expandedProvider === provider.id;
              const enabledCount = provider.models.filter(m => m.enabled).length;

              const providerMenuItems: DropdownItem[] = [
                {
                  key: 'copy-url',
                  label: '复制 Base URL',
                  icon: <Copy size={14} />,
                  onClick: () => {
                    navigator.clipboard.writeText(provider.baseUrl);
                    showToast({ type: 'success', title: '已复制 Base URL' });
                  },
                },
                { key: 'div1', label: '', divider: true },
                {
                  key: 'delete',
                  label: '删除提供商',
                  icon: <Trash2 size={14} />,
                  danger: true,
                  onClick: () => {
                    if (confirm(`确定要删除提供商 "${provider.name}" 吗？`)) {
                      deleteProvider(provider.id);
                    }
                  },
                },
              ];

              return (
                <Card key={provider.id} variant="outlined" padding="none" className="overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-surface-variant/30 transition-colors"
                    onClick={() => setExpandedProvider(expanded ? null : provider.id)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary-container/50 flex items-center justify-center flex-shrink-0">
                      <Server size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-on-surface text-sm truncate">
                        {provider.name}
                      </div>
                      <div className="text-xs text-on-surface-variant">
                        {enabledCount}/{provider.models.length} 个模型已启用
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Dropdown
                        align="end"
                        trigger={
                          <Button variant="ghost" size="sm" className="!px-2">
                            <MoreVertical size={16} />
                          </Button>
                        }
                        items={providerMenuItems}
                      />
                      {expanded ? (
                        <ChevronDown size={18} className="text-on-surface-variant" />
                      ) : (
                        <ChevronRight size={18} className="text-on-surface-variant" />
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-outline-variant p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-on-surface-variant mb-1 block">
                            Base URL
                          </label>
                          <div className="text-xs font-mono text-on-surface bg-surface-variant px-2 py-1.5 rounded-lg truncate">
                            {provider.baseUrl}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-on-surface-variant mb-1 block">
                            API Key
                          </label>
                          <div className="text-xs font-mono text-on-surface bg-surface-variant px-2 py-1.5 rounded-lg truncate">
                            {provider.apiKey ? provider.apiKey.slice(0, 8) + '...' : '未设置'}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-on-surface-variant mb-2">
                          模型列表 ({provider.models.length})
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {provider.models.map(model => (
                            <div
                              key={model.id}
                              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-surface-variant/30"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Bot size={14} className="text-on-surface-variant flex-shrink-0" />
                                <span className="text-sm text-on-surface truncate">{model.name}</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                <input
                                  type="checkbox"
                                  checked={model.enabled}
                                  onChange={() => toggleModelEnabled(provider.id, model.id)}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </Grid>
        </div>
      )}

      {loading && models.length === 0 ? (
        <div className="empty-state">
          <Loader2 size={40} className="opacity-40 mb-3 animate-spin" />
          <div className="text-base font-medium text-on-surface mb-1">加载中...</div>
          <div className="text-sm text-on-surface-variant max-w-sm">
            正在获取可用模型列表
          </div>
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="empty-state">
          <Server size={40} className="opacity-40 mb-3" />
          <div className="text-base font-medium text-on-surface mb-1">
            {searchQuery ? '没有匹配的模型' : '暂无可用模型'}
          </div>
          <div className="text-sm text-on-surface-variant max-w-sm mb-4">
            {searchQuery ? '尝试使用其他关键词搜索' : '请部署模型配置以添加可用模型'}
          </div>
          <Button
            variant="filled"
            size="md"
            leftIcon={<Plus size={14} />}
            onClick={() => setShowDeployModal(true)}
          >
            部署模型
          </Button>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-medium text-on-surface-variant mb-3 flex items-center gap-2">
            <Bot size={14} />
            已启用模型 ({filteredModels.length})
          </h2>
          <div className="space-y-3">
            {filteredModels.map(model => {
              const expanded = expandedModel === model.id;
              const provider = getProviderFromModelId(model.id);

              return (
                <Card key={model.id} variant="outlined" padding="none" className="overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-surface-variant/30 transition-colors"
                    onClick={() => setExpandedModel(expanded ? null : model.id)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary-container/50 flex items-center justify-center flex-shrink-0">
                      <Bot size={20} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-on-surface flex items-center gap-2 flex-wrap">
                        <span className="truncate">{model.name}</span>
                        {provider && (
                          <Badge variant="tonal" color="secondary" size="sm">
                            {provider.name}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-on-surface-variant mt-0.5 truncate">
                        {model.id}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex gap-1 flex-wrap">
                        {model.supportsVision && (
                          <Badge variant="tonal" color="info" size="sm" leftIcon={<Eye size={12} />}>
                            视觉
                          </Badge>
                        )}
                        {model.supportsFiles && (
                          <Badge variant="tonal" color="info" size="sm" leftIcon={<Paperclip size={12} />}>
                            文件
                          </Badge>
                        )}
                        {model.supportsImageGeneration && (
                          <Badge variant="tonal" color="success" size="sm" leftIcon={<ImageIcon size={12} />}>
                            生图
                          </Badge>
                        )}
                      </div>
                      {expanded ? (
                        <ChevronDown size={18} className="text-on-surface-variant" />
                      ) : (
                        <ChevronRight size={18} className="text-on-surface-variant" />
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-outline-variant p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                            模型 ID
                          </label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-surface-variant rounded-lg text-xs font-mono text-on-surface-variant truncate">
                              {model.id}
                            </code>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(model.id);
                                showToast({ type: 'success', title: '已复制模型 ID' });
                              }}
                              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                            提供商
                          </label>
                          <div className="px-3 py-2 bg-surface-variant rounded-lg text-sm text-on-surface">
                            {provider?.name || '未知'}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                            能力支持
                          </label>
                          <div className="flex flex-wrap gap-1 px-3 py-2 bg-surface-variant rounded-lg">
                            {model.supportsVision && <span className="text-xs text-on-surface">视觉</span>}
                            {model.supportsFiles && <span className="text-xs text-on-surface">文件</span>}
                            {model.supportsImageGeneration && <span className="text-xs text-on-tertiary-container bg-tertiary-container px-1.5 py-0.5 rounded">生图</span>}
                            {!model.supportsVision && !model.supportsFiles && !model.supportsImageGeneration && (
                              <span className="text-xs text-on-surface-variant">基础文本</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Dialog
        open={showDeployModal}
        onClose={closeDeployModal}
        title="部署模型配置"
        size="xl"
        footer={
          <div className="flex justify-between items-center w-full">
            <div className="flex gap-2">
              <Button
                variant="tonal"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={handleExportConfig}
                disabled={!formConfig.TokenName}
              >
                导出 JSON
              </Button>
              <Button
                variant="tonal"
                size="sm"
                leftIcon={<Copy size={14} />}
                onClick={handleCopyConfig}
                disabled={!formConfig.TokenName}
              >
                复制配置
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="text" size="sm" onClick={closeDeployModal}>
                取消
              </Button>
              {importedConfigs.length > 1 && (
                <Button variant="tonal" size="sm" onClick={handleDeployAll}>
                  全部部署 ({importedConfigs.length})
                </Button>
              )}
              <Button
                variant="filled"
                size="sm"
                leftIcon={<Save size={14} />}
                onClick={handleDeploy}
              >
                {importedConfigs.length > 1 ? '部署当前' : '部署配置'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setDeployMode('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              deployMode === 'import'
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-variant text-on-surface-variant hover:bg-outline-variant/50'
            }`}
          >
            <Upload size={14} />
            导入 JSON
          </button>
          <button
            onClick={() => setDeployMode('paste')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              deployMode === 'paste'
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-variant text-on-surface-variant hover:bg-outline-variant/50'
            }`}
          >
            <FileJson size={14} />
            粘贴片段
          </button>
          <button
            onClick={() => setDeployMode('form')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              deployMode === 'form'
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-variant text-on-surface-variant hover:bg-outline-variant/50'
            }`}
          >
            <Plus size={14} />
            手动配置
          </button>
        </div>

        {/* 快速预设 */}
        <div className="flex flex-wrap items-center gap-1.5 pb-3">
          <span className="text-xs text-on-surface-variant mr-1">快速预设：</span>
          {DEPLOY_PRESETS.map(p => (
            <button
              key={p.name}
              onClick={() => applyDeployPreset(p)}
              className="px-2.5 py-1 rounded-full border border-outline-variant text-xs text-on-surface-variant hover:text-on-surface hover:border-primary/50 hover:bg-primary-container/20 transition-all"
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
              {deployMode === 'import' && (
                <div className="space-y-4">
                  <div className="p-8 border-2 border-dashed border-outline-variant rounded-xl text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={32} className="mx-auto mb-3 text-on-surface-variant" />
                    <div className="text-sm font-medium text-on-surface">点击或拖拽上传 JSON 文件</div>
                    <div className="text-xs text-on-surface-variant mt-1">支持 .json 格式</div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <div className="text-xs text-on-surface-variant bg-surface-variant p-3 rounded-lg">
                    <div className="font-medium mb-1">参考格式：</div>
                    <pre className="font-mono mt-1">{JSON.stringify({
                      TokenName: 'TokenName1',
                      ConnectInfo: {
                        _type: 'newapi_channel_conn',
                        key: 'sk-xxxxxxxx',
                        url: 'https://api.xxx.xyz'
                      },
                      Models: ['model1', 'model2'],
                      BillingMultiplier: '1x'
                    }, null, 2)}</pre>
                  </div>
                </div>
              )}

              {deployMode === 'paste' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                      JSON 配置片段
                    </label>
                    <textarea
                      value={jsonPasteContent}
                      onChange={e => setJsonPasteContent(e.target.value)}
                      placeholder={JSON.stringify({
                        TokenName: 'TokenName1',
                        ConnectInfo: {
                          _type: 'newapi_channel_conn',
                          key: 'sk-xxxxxxxx',
                          url: 'https://api.xxx.xyz'
                        },
                        Models: ['model1', 'model2'],
                        BillingMultiplier: '1x'
                      }, null, 2)}
                      rows={10}
                      className="w-full px-3 py-2 bg-surface-variant border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:outline-none font-mono resize-none"
                    />
                  </div>
                  <button
                    onClick={handlePasteDeploy}
                    className="w-full px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium"
                  >
                    解析配置
                  </button>
                </div>
              )}

              {deployMode === 'form' && (
                <div className="space-y-4">
                  {importedConfigs.length > 1 && (
                    <div>
                      <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                        已导入配置 ({importedConfigs.length} 个)
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {importedConfigs.map((cfg, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setActiveImportIndex(idx);
                              setFormConfig(cfg);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              activeImportIndex === idx
                                ? 'bg-primary-container text-on-primary-container'
                                : 'bg-surface-variant text-on-surface-variant hover:bg-outline-variant/50'
                            }`}
                          >
                            {cfg.TokenName || `配置 ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                        TokenName
                      </label>
                      <input
                        type="text"
                        value={formConfig.TokenName}
                        onChange={e => setFormConfig(prev => ({ ...prev, TokenName: e.target.value }))}
                        className="w-full px-3 py-2 bg-surface-variant border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                        Billing Multiplier
                      </label>
                      <input
                        type="text"
                        value={formConfig.BillingMultiplier}
                        onChange={e => setFormConfig(prev => ({ ...prev, BillingMultiplier: e.target.value }))}
                        placeholder="1x"
                        className="w-full px-3 py-2 bg-surface-variant border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">
                      ConnectInfo
                    </label>
                    <div className="bg-surface-variant rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs text-on-surface-variant mb-1 block">_type</label>
                          <input
                            type="text"
                            value={formConfig.ConnectInfo._type}
                            onChange={e => setFormConfig(prev => ({
                              ...prev,
                              ConnectInfo: { ...prev.ConnectInfo, _type: e.target.value }
                            }))}
                            className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-on-surface-variant mb-1 block">key</label>
                          <input
                            type="text"
                            value={formConfig.ConnectInfo.key}
                            onChange={e => setFormConfig(prev => ({
                              ...prev,
                              ConnectInfo: { ...prev.ConnectInfo, key: e.target.value }
                            }))}
                            placeholder="sk-xxxxxxxx"
                            className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-on-surface-variant mb-1 block">url</label>
                          <input
                            type="text"
                            value={formConfig.ConnectInfo.url}
                            onChange={e => setFormConfig(prev => ({
                              ...prev,
                              ConnectInfo: { ...prev.ConnectInfo, url: e.target.value }
                            }))}
                            placeholder="https://api.xxx.xyz"
                            className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-on-surface-variant">
                        Models ({formConfig.Models.length})
                      </label>
                      <button
                        onClick={openNewapiPull}
                        className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                      >
                        <Download size={12} />
                        从 NewAPI 站点拉取
                      </button>
                    </div>

                    {showNewapiPull && (
                      <div className="mb-3 p-3 bg-surface-variant rounded-lg border border-outline-variant space-y-2 animate-slide-down">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newapiPullUrl}
                            onChange={e => setNewapiPullUrl(e.target.value)}
                            placeholder="站点地址，如 https://api.example.com"
                            className="flex-1 px-2.5 py-1.5 bg-surface border border-outline-variant rounded-lg text-xs text-on-surface focus:border-primary focus:outline-none"
                          />
                          <input
                            type="password"
                            value={newapiPullCred}
                            onChange={e => setNewapiPullCred(e.target.value)}
                            placeholder="用户名:密码 或 令牌"
                            className="flex-1 px-2.5 py-1.5 bg-surface border border-outline-variant rounded-lg text-xs text-on-surface focus:border-primary focus:outline-none"
                          />
                          <button
                            onClick={pullNewapiModels}
                            disabled={newapiPulling || !newapiPullUrl.trim() || !newapiPullCred.trim()}
                            className="flex-none px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-medium disabled:opacity-40 flex items-center gap-1"
                          >
                            {newapiPulling ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            拉取
                          </button>
                        </div>
                        {newapiFound.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-on-surface-variant">找到 {newapiFound.length} 个模型，勾选导入：</span>
                              <button
                                onClick={importSelectedNewapiModels}
                                disabled={newapiSelected.size === 0}
                                className="text-xs text-primary font-medium hover:underline disabled:opacity-40"
                              >
                                导入所选 ({newapiSelected.size})
                              </button>
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {newapiFound.map(m => {
                                const checked = newapiSelected.has(m);
                                const already = formConfig.Models.includes(m);
                                return (
                                  <label
                                    key={m}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                      already ? 'opacity-40' : checked ? 'bg-primary-container/30 text-on-surface' : 'hover:bg-surface/60 text-on-surface-variant'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked || already}
                                      disabled={already}
                                      onChange={e => {
                                        setNewapiSelected(prev => {
                                          const next = new Set(prev);
                                          if (e.target.checked) next.add(m); else next.delete(m);
                                          return next;
                                        });
                                      }}
                                      className="flex-none"
                                    />
                                  <span className="font-mono truncate">{m}</span>
                                    {already && <span className="ml-auto text-[10px] flex-none">已添加</span>}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={newModelName}
                        onChange={e => setNewModelName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddModel()}
                        placeholder="输入模型名称"
                        className="flex-1 px-3 py-2 bg-surface-variant border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:outline-none"
                      />
                      <button
                        onClick={handleAddModel}
                        className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium"
                      >
                        添加
                      </button>
                    </div>
                    {formConfig.Models.length > 0 ? (
                      <div className="space-y-2">
                        {formConfig.Models.map(model => (
                          <div
                            key={model}
                            className="flex items-center justify-between px-3 py-2 bg-surface-variant rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-on-surface">{model}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => toggleModelCapability(model, 'supportsVision')}
                                className={`p-1.5 rounded-md transition-colors ${
                                  formConfig.ModelCapabilities[model]?.supportsVision
                                    ? 'bg-primary-container text-on-primary-container'
                                    : 'text-on-surface-variant hover:bg-surface hover:text-on-surface'
                                }`}
                                title="视觉模型"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => toggleModelCapability(model, 'supportsFiles')}
                                className={`p-1.5 rounded-md transition-colors ${
                                  formConfig.ModelCapabilities[model]?.supportsFiles
                                    ? 'bg-primary-container text-on-primary-container'
                                    : 'text-on-surface-variant hover:bg-surface hover:text-on-surface'
                                }`}
                                title="文件支持"
                              >
                                <Paperclip size={14} />
                              </button>
                              <button
                                onClick={() => toggleModelCapability(model, 'supportsImageGeneration')}
                                className={`p-1.5 rounded-md transition-colors ${
                                  formConfig.ModelCapabilities[model]?.supportsImageGeneration
                                    ? 'bg-tertiary-container text-on-tertiary-container'
                                    : 'text-on-surface-variant hover:bg-surface hover:text-on-surface'
                                }`}
                                title="生图模型"
                              >
                                <ImageIcon size={14} />
                              </button>
                              <button
                                onClick={() => handleRemoveModel(model)}
                                className="ml-1 p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded-md transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-on-surface-variant py-4 text-center border border-dashed border-outline-variant rounded-lg">
                        暂无模型，请添加
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Dialog>
        </div>
      </div>
    );
  };

export default Models;
