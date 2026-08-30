import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Plus, ExternalLink, Upload, X, Trash2, Play, Pause,
  RefreshCw, Download, Check, Terminal, Package,
  Loader2, Zap, Code, BarChart3, PenTool,
  Grid, Sparkles, AlertCircle, Store
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { MarketplaceSkill, cliApi, marketplaceApi, proxyApi } from '../services/api';
import { loadMarketSources, saveMarketSources, MarketSource } from '../store';

/** 带来源标记的技能项 */
export interface SourcedSkill extends MarketplaceSkill {
  __sourceName: string;
  __sourceType: MarketSource['type'];
  /** json 源技能的原始内容（可直接导入本地） */
  __importable?: { content: string };
}
import { PageHeader, Button, Badge, Card, Dialog, EmptyState, Input } from '../components/ui';

const LOCAL_SKILLS_KEY = 'oxygenclaw:local-skills';
const CLI_STATUS_KEY = 'oxygenclaw:cli-status';

interface LocalSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  version: string;
  createdAt: string;
  enabled: boolean;
}

interface InstalledSkill {
  id: string;
  name: string;
  version: string;
  installedAt: string;
  localPath?: string;
  enabled: boolean;
  description?: string;
}

interface CliStatus {
  available: boolean;
  version?: string;
  lastChecked?: string;
}

interface MarketplaceApiResponse {
  skills?: MarketplaceSkill[];
  total?: number;
  message?: string;
}

type TabType = 'local' | 'marketplace' | 'installed';

const CATEGORIES = [
  { id: 'all', name: '全部', icon: Grid },
  { id: 'productivity', name: '效率工具', icon: Zap },
  { id: 'research', name: '研究分析', icon: Search },
  { id: 'creative', name: '创意写作', icon: PenTool },
  { id: 'coding', name: '编程开发', icon: Code },
  { id: 'data', name: '数据处理', icon: BarChart3 },
];

function getLocalSkills(): LocalSkill[] {
  try {
    const data = localStorage.getItem(LOCAL_SKILLS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalSkills(skills: LocalSkill[]): void {
  localStorage.setItem(LOCAL_SKILLS_KEY, JSON.stringify(skills));
}

function getCliStatus(): CliStatus {
  try {
    const data = localStorage.getItem(CLI_STATUS_KEY);
    return data ? JSON.parse(data) : { available: false };
  } catch {
    return { available: false };
  }
}

function saveCliStatus(status: CliStatus): void {
  localStorage.setItem(CLI_STATUS_KEY, JSON.stringify(status));
}

const Marketplace: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('local');
  const [localSkills, setLocalSkills] = useState<LocalSkill[]>(getLocalSkills());
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [marketplaceSkills, setMarketplaceSkills] = useState<SourcedSkill[]>([]);
  const [marketSources, setMarketSources] = useState<MarketSource[]>(loadMarketSources());
  const [showSourceManager, setShowSourceManager] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', url: '', type: 'json' as MarketSource['type'] });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cliStatus, setCliStatus] = useState<CliStatus>(getCliStatus());
  const [isCheckingCli, setIsCheckingCli] = useState(false);
  const [isInstallingCli, setIsInstallingCli] = useState(false);
  const [isLoadingMarketplace, setIsLoadingMarketplace] = useState(false);
  const [isLoadingInstalled, setIsLoadingInstalled] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [installedError, setInstalledError] = useState<string | null>(null);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [uninstallingIds, setUninstallingIds] = useState<Set<string>>(new Set());
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [showCommandPanel, setShowCommandPanel] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [commandOutput, setCommandOutput] = useState<string[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadSkill, setUploadSkill] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    content: '',
  });
  const [showInstallLog, setShowInstallLog] = useState(false);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const commandOutputRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (commandOutputRef.current) {
      commandOutputRef.current.scrollTop = commandOutputRef.current.scrollHeight;
    }
  }, [commandOutput]);

  const loadInstalledSkills = useCallback(async () => {
    if (!cliStatus.available) {
      setInstalledSkills([]);
      return;
    }
    setIsLoadingInstalled(true);
    setInstalledError(null);
    try {
      const result = await cliApi.listSkills();
      if (result.success && result.data?.skills) {
        const skills = result.data.skills.map(s => ({
          id: s.id,
          name: s.name,
          version: s.version,
          installedAt: s.installedAt || new Date().toISOString(),
          enabled: s.enabled !== false,
          description: s.description,
        }));
        setInstalledSkills(skills);
      } else {
        setInstalledError(result.error || '获取已安装技能失败');
        setInstalledSkills([]);
      }
    } catch (e: any) {
      setInstalledError(e?.message || '获取已安装技能失败');
      setInstalledSkills([]);
    } finally {
      setIsLoadingInstalled(false);
    }
  }, [cliStatus.available]);

  const loadMarketplaceSkills = useCallback(async () => {
    setIsLoadingMarketplace(true);
    setMarketplaceError(null);

    const enabledSources = marketSources.filter(s => s.enabled);
    const aggregated: SourcedSkill[] = [];
    const errors: string[] = [];

    await Promise.all(enabledSources.map(async (src) => {
      try {
        if (src.type === 'openclawmp') {
          const result = await marketplaceApi.getSkills();
          if (result.success && result.data) {
            const resp = result.data as unknown as MarketplaceApiResponse;
            const skills = resp.skills || (Array.isArray(result.data) ? result.data as MarketplaceSkill[] : []);
            for (const s of skills) {
              aggregated.push({ ...s, __sourceName: src.name, __sourceType: src.type });
            }
          } else {
            errors.push(`${src.name}: ${result.error || '拉取失败'}`);
          }
        } else if (src.type === 'json') {
          // 约定形状：{skills: [...]} 或直接数组；字段兼容 name/description/version/content
          const res = await proxyApi.request({ url: src.url, method: 'GET' });
          if (!res.success || !res.data) throw new Error(res.error || '代理请求失败');
          let payload: any = res.data.body;
          if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch { throw new Error('响应不是有效 JSON'); }
          }
          const list: any[] = Array.isArray(payload) ? payload : (Array.isArray(payload?.skills) ? payload.skills : []);
          for (const s of list) {
            if (!s?.name) continue;
            aggregated.push({
              id: s.id || `json-${src.id}-${s.name}`,
              name: s.name,
              description: s.description || '',
              version: s.version || '1.0.0',
              author: s.author,
              category: s.category,
              tags: s.tags,
              __sourceName: src.name,
              __sourceType: src.type,
              __importable: s.content ? { content: s.content } : undefined,
            });
          }
        }
      } catch (e: any) {
        errors.push(`${src.name}: ${e?.message || e}`);
      }
    }));

    setMarketplaceSkills(aggregated);
    if (errors.length > 0) {
      setMarketplaceError(errors.length === enabledSources.length ? errors.join('；') : null);
      if (errors.length < enabledSources.length && aggregated.length > 0) {
        showToast({ type: 'warning', title: '部分源拉取失败', description: errors.join('；').slice(0, 120) });
      }
    }
    setIsLoadingMarketplace(false);
  }, [marketSources]);

  // ── 源管理 ──
  const persistSources = (next: MarketSource[]) => {
    setMarketSources(next);
    saveMarketSources(next);
  };

  const addSource = () => {
    if (!newSource.name.trim() || !newSource.url.trim()) {
      showToast({ type: 'error', title: '请填写源名称和地址' });
      return;
    }
    const src: MarketSource = {
      id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newSource.name.trim(),
      type: newSource.type,
      url: newSource.url.trim(),
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    persistSources([...marketSources, src]);
    setNewSource({ name: '', url: '', type: 'json' });
    showToast({ type: 'success', title: '源已添加' });
  };

  const toggleSource = (id: string) => {
    persistSources(marketSources.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const removeSource = (id: string) => {
    if (!confirm('确定删除这个源吗？')) return;
    persistSources(marketSources.filter(s => s.id !== id));
  };

  /** json 源技能 → 直接导入本地技能库（无需 CLI） */
  const handleImportFromSource = (skill: SourcedSkill) => {
    if (!skill.__importable?.content) {
      showToast({ type: 'error', title: '该技能缺少 content 字段，无法直接导入', description: '请到源仓库获取完整技能包' });
      return;
    }
    const newSkill: LocalSkill = {
      id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: skill.name,
      description: skill.description || '',
      content: skill.__importable.content,
      version: skill.version || '1.0.0',
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    const updated = [newSkill, ...localSkills];
    setLocalSkills(updated);
    saveLocalSkills(updated);
    showToast({ type: 'success', title: '已导入本地', description: skill.name });
  };

  const searchMarketplaceSkills = useCallback(async (query: string, category: string) => {
    setIsLoadingMarketplace(true);
    setMarketplaceError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (category && category !== 'all') params.set('category', category);
      params.set('page', '1');
      params.set('limit', '50');

      const response = await fetch(`/api/marketplace/search?${params.toString()}`);
      const result = await response.json();

      if (result.success && result.data) {
        const skills = result.data.skills || (Array.isArray(result.data) ? result.data : []);
        setMarketplaceSkills(skills);
      } else {
        setMarketplaceError(result.error || '搜索失败');
        setMarketplaceSkills([]);
      }
    } catch (e: any) {
      setMarketplaceError(e?.message || '搜索失败');
      setMarketplaceSkills([]);
    } finally {
      setIsLoadingMarketplace(false);
    }
  }, []);

  useEffect(() => {
    const checkCliOnLoad = async () => {
      const result = await cliApi.check();
      if (result.success && result.data) {
        const newStatus: CliStatus = {
          available: result.data.installed,
          version: result.data.version,
          lastChecked: new Date().toISOString(),
        };
        setCliStatus(newStatus);
        saveCliStatus(newStatus);
      }
    };
    checkCliOnLoad();
  }, []);

  useEffect(() => {
    if (cliStatus.available) {
      loadInstalledSkills();
    }
  }, [cliStatus.available, loadInstalledSkills]);

  useEffect(() => {
    if (activeTab === 'marketplace') {
      loadMarketplaceSkills();
    }
  }, [activeTab, loadMarketplaceSkills]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (activeTab === 'marketplace') {
      searchTimeoutRef.current = setTimeout(() => {
        searchMarketplaceSkills(searchQuery, selectedCategory);
      }, 300);
    }
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedCategory, activeTab, searchMarketplaceSkills]);

  const isInstalled = (skillId: string) => {
    return installedSkills.some(s => s.id === skillId || s.name === skillId);
  };

  const filteredLocalSkills = localSkills.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMarketplaceSkills = marketplaceSkills;

  const filteredInstalledSkills = installedSkills.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCheckCli = async () => {
    setIsCheckingCli(true);
    const result = await cliApi.check();
    if (result.success && result.data) {
      const newStatus: CliStatus = {
        available: result.data.installed,
        version: result.data.version,
        lastChecked: new Date().toISOString(),
      };
      setCliStatus(newStatus);
      saveCliStatus(newStatus);
      showToast({
        type: result.data.installed ? 'success' : 'info',
        title: 'CLI 检测完成',
        description: result.data.installed
          ? `检测到 openclawmp CLI v${result.data.version}`
          : '未检测到 openclawmp CLI，如需使用请先安装',
      });
    } else {
      showToast({
        type: 'error',
        title: '检测失败',
        description: result.error || '无法连接到后端服务',
      });
    }
    setIsCheckingCli(false);
  };

  const handleInstallCli = async () => {
    if (isInstallingCli) return;
    setIsInstallingCli(true);
    setShowInstallLog(true);
    setInstallLog(['$ npm install -g openclawmp', '正在安装 openclawmp CLI...']);

    try {
      await cliApi.install(
        (_chunk, data) => {
          if (data?.type === 'stdout' || data?.type === 'stderr') {
            const lines = data.content.split('\n').filter((l: string) => l.trim());
            setInstallLog(prev => [...prev, ...lines]);
          }
        },
        async () => {
          const checkResult = await cliApi.check();
          if (checkResult.success && checkResult.data?.installed) {
            const newStatus: CliStatus = {
              available: true,
              version: checkResult.data.version,
              lastChecked: new Date().toISOString(),
            };
            setCliStatus(newStatus);
            saveCliStatus(newStatus);
            setInstallLog(prev => [...prev, '', '✓ openclawmp CLI 安装成功！']);
            showToast({ type: 'success', title: '安装成功', description: 'openclawmp CLI 已安装' });
          } else {
            setInstallLog(prev => [...prev, '', '⚠ 安装完成但检测失败，请手动验证']);
          }
          setIsInstallingCli(false);
        },
        (error) => {
          setInstallLog(prev => [...prev, '', `✗ 安装失败: ${error}`]);
          setIsInstallingCli(false);
          showToast({ type: 'error', title: '安装失败', description: error });
        }
      );
    } catch (e: any) {
      setInstallLog(prev => [...prev, '', `✗ 安装失败: ${e?.message || '未知错误'}`]);
      setIsInstallingCli(false);
      showToast({ type: 'error', title: '安装失败', description: e?.message || '未知错误' });
    }
  };

  const handleRefreshMarketplace = () => {
    searchMarketplaceSkills(searchQuery, selectedCategory);
  };

  const handleRefreshInstalled = () => {
    loadInstalledSkills();
  };

  const handleInstallSkill = async (skill: MarketplaceSkill) => {
    if (installingIds.has(skill.id)) return;
    if (!cliStatus.available) {
      showToast({
        type: 'warning',
        title: 'CLI 未安装',
        description: '请先安装 openclawmp CLI 后再安装技能',
      });
      return;
    }

    setInstallingIds(prev => new Set(prev).add(skill.id));

    try {
      const result = await cliApi.exec('install', [skill.id]);
      if (result.success) {
        showToast({
          type: 'success',
          title: '安装成功',
          description: `${skill.name} v${skill.version} 已安装`,
        });
        await loadInstalledSkills();
      } else {
        showToast({
          type: 'error',
          title: '安装失败',
          description: result.error || '未知错误',
        });
      }
    } catch (e: any) {
      showToast({
        type: 'error',
        title: '安装失败',
        description: e?.message || '未知错误',
      });
    }

    setInstallingIds(prev => {
      const next = new Set(prev);
      next.delete(skill.id);
      return next;
    });
  };

  const handleUninstallSkill = async (skillId: string) => {
    if (!confirm('确定要卸载这个技能吗？')) return;
    if (!cliStatus.available) {
      showToast({
        type: 'warning',
        title: 'CLI 未安装',
        description: '请先安装 openclawmp CLI',
      });
      return;
    }

    const skill = installedSkills.find(s => s.id === skillId || s.name === skillId);
    setUninstallingIds(prev => new Set(prev).add(skillId));

    try {
      const result = await cliApi.exec('uninstall', [skillId]);
      if (result.success) {
        showToast({
          type: 'success',
          title: '卸载成功',
          description: skill ? `${skill.name} 已卸载` : '技能已卸载',
        });
        await loadInstalledSkills();
      } else {
        showToast({
          type: 'error',
          title: '卸载失败',
          description: result.error || '未知错误',
        });
      }
    } catch (e: any) {
      showToast({
        type: 'error',
        title: '卸载失败',
        description: e?.message || '未知错误',
      });
    }

    setUninstallingIds(prev => {
      const next = new Set(prev);
      next.delete(skillId);
      return next;
    });
  };

  const handleUpdateSkill = async (skillId: string) => {
    if (updatingIds.has(skillId)) return;
    if (!cliStatus.available) {
      showToast({
        type: 'warning',
        title: 'CLI 未安装',
        description: '请先安装 openclawmp CLI',
      });
      return;
    }

    setUpdatingIds(prev => new Set(prev).add(skillId));

    try {
      const result = await cliApi.exec('update', [skillId]);
      if (result.success) {
        showToast({
          type: 'success',
          title: '更新成功',
          description: '技能已更新到最新版本',
        });
        await loadInstalledSkills();
      } else {
        showToast({
          type: 'error',
          title: '更新失败',
          description: result.error || '未知错误',
        });
      }
    } catch (e: any) {
      showToast({
        type: 'error',
        title: '更新失败',
        description: e?.message || '未知错误',
      });
    }

    setUpdatingIds(prev => {
      const next = new Set(prev);
      next.delete(skillId);
      return next;
    });
  };

  const handleToggleInstalledSkill = async (skillId: string) => {
    const skill = installedSkills.find(s => s.id === skillId || s.name === skillId);
    if (!skill) return;

    const newEnabled = !skill.enabled;
    setInstalledSkills(prev =>
      prev.map(s =>
        (s.id === skillId || s.name === skillId) ? { ...s, enabled: newEnabled } : s
      )
    );
  };

  const executeCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const outputLines: string[] = [];
    outputLines.push(`$ openclawmp ${cmd}`);

    if (!cliStatus.available) {
      outputLines.push('错误：openclawmp CLI 未安装');
      outputLines.push('请先安装 CLI 后再使用命令行功能');
      outputLines.push('');
      outputLines.push('安装命令：');
      outputLines.push('  npm install -g openclawmp');
      setCommandOutput(prev => [...prev, ...outputLines]);
      return;
    }

    const parts = trimmed.split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    try {
      const result = await cliApi.exec(command, args);
      if (result.success && result.data) {
        const output = result.data.output || result.data.stdout || '';
        const lines = output.split('\n').filter(l => l.trim());
        outputLines.push(...lines);

        if (command === 'list') {
          await loadInstalledSkills();
        }

        if (command === 'install' && args.length > 0) {
          await loadInstalledSkills();
        }

        if (command === 'uninstall' && args.length > 0) {
          await loadInstalledSkills();
        }
      } else {
        outputLines.push(`错误：${result.error || '命令执行失败'}`);
        if (result.data?.stderr) {
          const errLines = result.data.stderr.split('\n').filter((l: string) => l.trim());
          outputLines.push(...errLines);
        }
      }
    } catch (e: any) {
      outputLines.push(`错误：${e?.message || '命令执行失败'}`);
    }

    outputLines.push('');
    setCommandOutput(prev => [...prev, ...outputLines]);
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    await executeCommand(commandInput);
    setCommandInput('');
  };

  const handleGoToMarketplace = () => {
    window.open('https://openclawmp.stepfun.com', '_blank');
  };

  const handleCreateSkill = () => {
    setUploadSkill({ name: '', description: '', version: '1.0.0', content: '' });
    setShowUpload(true);
  };

  const handleSaveSkill = () => {
    if (!uploadSkill.name.trim()) {
      showToast({ type: 'error', title: '请输入技能名称' });
      return;
    }
    const newSkill: LocalSkill = {
      id: `skill-${Date.now()}`,
      name: uploadSkill.name,
      description: uploadSkill.description,
      content: uploadSkill.content,
      version: uploadSkill.version || '1.0.0',
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    const updated = [newSkill, ...localSkills];
    setLocalSkills(updated);
    saveLocalSkills(updated);
    setShowUpload(false);
    showToast({ type: 'success', title: '技能已创建' });
  };

  const handleToggleLocalSkill = (id: string) => {
    const updated = localSkills.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    setLocalSkills(updated);
    saveLocalSkills(updated);
  };

  const handleDeleteLocalSkill = (id: string) => {
    if (!confirm('确定要删除这个技能吗？')) return;
    const updated = localSkills.filter(s => s.id !== id);
    setLocalSkills(updated);
    saveLocalSkills(updated);
    showToast({ type: 'success', title: '技能已删除' });
  };

  const handleImportSkill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // .zip 技能包：解压并自动分析（SKILL.md frontmatter / manifest.json / 兜底）
    if (file.name.toLowerCase().endsWith('.zip')) {
      try {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(file);
        const importSkills: LocalSkill[] = [];

        // 路径 1：SKILL.md（Agent Skills 标准格式，解析 YAML frontmatter）
        const skillMdEntry = Object.keys(zip.files).find(n => n.endsWith('/SKILL.md') || n === 'SKILL.md');
        if (skillMdEntry) {
          const md = await zip.files[skillMdEntry].async('string');
          const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
          const meta: Record<string, string> = {};
          if (fmMatch) {
            for (const line of fmMatch[1].split(/\r?\n/)) {
              const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
              if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^['"]|['"]$/g, '');
            }
          }
          importSkills.push({
            id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: meta.name || file.name.replace(/\.zip$/i, ''),
            description: meta.description || '',
            content: fmMatch ? (fmMatch[2] || '').trim() : md,
            version: meta.version || '1.0.0',
            createdAt: new Date().toISOString(),
            enabled: true,
          });
        }

        // 路径 2：manifest.json / package.json
        if (importSkills.length === 0) {
          const manifestEntry = Object.keys(zip.files).find(n =>
            n === 'manifest.json' || n.endsWith('/manifest.json') || n === 'package.json'
          );
          if (manifestEntry) {
            try {
              const data = JSON.parse(await zip.files[manifestEntry].async('string'));
              if (data.name && (data.content || data.description || data.instructions)) {
                importSkills.push({
                  id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  name: data.name,
                  description: data.description || '',
                  content: data.content || data.instructions || data.description || '',
                  version: data.version || '1.0.0',
                  createdAt: new Date().toISOString(),
                  enabled: true,
                });
              }
            } catch { /* manifest 解析失败继续兜底 */ }
          }
        }

        // 路径 3：兜底——用包内文本文件聚合
        if (importSkills.length === 0) {
          const textEntries = Object.keys(zip.files).filter(n =>
            !n.endsWith('/') && /\.(md|txt|json)$/i.test(n)
          ).slice(0, 20);
          if (textEntries.length > 0) {
            const parts: string[] = [];
            for (const n of textEntries) {
              parts.push(`### ${n}\n\n${(await zip.files[n].async('string')).slice(0, 5000)}`);
            }
            importSkills.push({
              id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: file.name.replace(/\.zip$/i, ''),
              description: `从技能包导入，包含 ${textEntries.length} 个文件`,
              content: parts.join('\n\n---\n\n'),
              version: '1.0.0',
              createdAt: new Date().toISOString(),
              enabled: true,
            });
          }
        }

        if (importSkills.length === 0) {
          showToast({ type: 'error', title: '导入失败', description: '压缩包中未找到 SKILL.md、manifest 或文本文件' });
          return;
        }
        const updatedZip = [...importSkills, ...localSkills];
        setLocalSkills(updatedZip);
        saveLocalSkills(updatedZip);
        showToast({ type: 'success', title: `成功导入技能包`, description: `已分析 ${file.name}` });
      } catch (err: any) {
        showToast({ type: 'error', title: '导入失败', description: `无法读取 zip: ${err?.message || err}` });
      }
      return;
    }

    // .json：原有逻辑
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        const importSkills: LocalSkill[] = [];
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.name && item.content) {
              importSkills.push({
                id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: item.name,
                description: item.description || '',
                content: item.content || item.prompt || '',
                version: item.version || '1.0.0',
                createdAt: new Date().toISOString(),
                enabled: true,
              });
            }
          }
        } else if (data.name && (data.content || data.prompt)) {
          importSkills.push({
            id: `skill-${Date.now()}`,
            name: data.name,
            description: data.description || '',
            content: data.content || data.prompt || '',
            version: data.version || '1.0.0',
            createdAt: new Date().toISOString(),
            enabled: true,
          });
        }
        if (importSkills.length === 0) {
          showToast({ type: 'error', title: '导入失败', description: '未找到有效的技能数据' });
          return;
        }
        const updated = [...importSkills, ...localSkills];
        setLocalSkills(updated);
        saveLocalSkills(updated);
        showToast({ type: 'success', title: `成功导入 ${importSkills.length} 个技能` });
      } catch {
        showToast({ type: 'error', title: '导入失败', description: '无效的 JSON 文件' });
      }
    };
    reader.readAsText(file);
  };

  const renderTabs = () => (
    <div className="segmented-control mb-6">
      <div
        className={`segmented-control-item ${activeTab === 'local' ? 'active' : ''}`}
        onClick={() => setActiveTab('local')}
      >
        本地技能
      </div>
      <div
        className={`segmented-control-item ${activeTab === 'marketplace' ? 'active' : ''}`}
        onClick={() => setActiveTab('marketplace')}
      >
        水产市场
      </div>
      <div
        className={`segmented-control-item ${activeTab === 'installed' ? 'active' : ''}`}
        onClick={() => setActiveTab('installed')}
      >
        已安装 ({installedSkills.length})
      </div>
    </div>
  );

  const renderCliStatus = () => (
    <div className={`mb-6 p-4 rounded-xl border ${
      cliStatus.available
        ? 'bg-success-container/50 border-success/30'
        : 'bg-warning-container/50 border-warning/30'
    }`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${cliStatus.available ? 'bg-success pulse-dot' : 'bg-warning'}`} />
          <div>
            <div className="text-sm font-medium text-on-surface flex items-center gap-2">
              openclawmp CLI {cliStatus.available ? '可用' : '未检测到'}
              {cliStatus.available && (
                <span className="text-xs px-2 py-0.5 bg-success-container text-success rounded-full flex items-center gap-1">
                  <Check size={10} />
                  真实数据
                </span>
              )}
            </div>
            <div className="text-xs text-on-surface-variant">
              {cliStatus.available
                ? `版本 ${cliStatus.version}  `
                : '安装 CLI 以获得完整的技能管理能力'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckCli}
            disabled={isCheckingCli}
            className="px-3 py-1.5 bg-surface text-on-surface-variant rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-surface-variant transition-colors"
          >
            {isCheckingCli ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            检查 CLI
          </button>
          {!cliStatus.available && (
            <button
              onClick={handleInstallCli}
              disabled={isInstallingCli}
              className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isInstallingCli ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              一键安装
            </button>
          )}
          <button
            onClick={() => setShowCommandPanel(true)}
            className="px-3 py-1.5 bg-surface text-on-surface-variant rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-surface-variant transition-colors"
          >
            <Terminal size={12} />
            命令行
          </button>
        </div>
      </div>
      {!cliStatus.available && (
        <div className="mt-3 pt-3 border-t border-outline-variant">
          <div className="text-xs text-on-surface-variant mb-2">安装命令：</div>
          <code className="text-xs bg-surface px-3 py-2 rounded-lg font-mono block text-on-surface">
            npm install -g openclawmp
          </code>
        </div>
      )}
      {showInstallLog && (
        <div className="mt-3 pt-3 border-t border-outline-variant">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-on-surface">安装日志</div>
            <button
              onClick={() => setShowInstallLog(false)}
              className="text-xs text-on-surface-variant hover:text-on-surface"
            >
              <X size={14} />
            </button>
          </div>
          <div className="bg-black/90 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs">
            {installLog.map((line, idx) => (
              <div
                key={idx}
                className={
                  line.startsWith('$') ? 'text-blue-400' :
                  line.startsWith('错误') || line.startsWith('✗') ? 'text-red-400' :
                  line.startsWith('✓') ? 'text-green-400' :
                  'text-gray-300'
                }
              >
                {line || '\u00A0'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderLocalSkills = () => {
    if (filteredLocalSkills.length === 0) {
      return (
        <Card variant="outlined">
          <EmptyState
            icon={Search}
            title={searchQuery ? '没有匹配的技能' : '暂无本地技能'}
            description={searchQuery ? '尝试使用其他关键词搜索' : '创建你的第一个技能，或前往水产市场发现更多'}
            action={
              <div className="flex gap-2 justify-center">
                <Button variant="filled" size="md" leftIcon={<Plus size={14} />} onClick={handleCreateSkill}>
                  创建技能
                </Button>
                <Button variant="tonal" size="md" leftIcon={<ExternalLink size={14} />} onClick={() => setActiveTab('marketplace')}>
                  水产市场
                </Button>
              </div>
            }
          />
        </Card>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLocalSkills.map(skill => (
          <Card key={skill.id} variant="outlined" className="flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-on-surface flex items-center gap-2">
                  {skill.name}
                  <Badge variant="tonal" color="secondary">v{skill.version}</Badge>
                </div>
                <div className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                  {skill.description || '无描述'}
                </div>
              </div>
            </div>
            <div className="flex-1 mb-3">
              <div className="text-xs text-on-surface-variant mb-1">技能内容</div>
              <pre className="text-xs text-on-surface-variant bg-surface-variant rounded-lg p-2 max-h-24 overflow-auto font-mono">
                {skill.content.slice(0, 200)}{skill.content.length > 200 ? '...' : ''}
              </pre>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-outline-variant mt-auto">
              <span className="text-xs text-on-surface-variant">
                {new Date(skill.createdAt).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleLocalSkill(skill.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    skill.enabled
                      ? 'bg-success-container text-success'
                      : 'bg-surface-variant text-on-surface-variant'
                  }`}
                  title={skill.enabled ? '禁用' : '启用'}
                >
                  {skill.enabled ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  onClick={() => handleDeleteLocalSkill(skill.id)}
                  className="p-1.5 rounded-lg hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-colors"
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderMarketplace = () => (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-variant text-on-surface-variant hover:bg-outline-variant/50'
                }`}
              >
                <Icon size={12} />
                {cat.name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSourceManager(true)}
            className="px-4 py-2 bg-surface-variant text-on-surface-variant rounded-full text-sm font-medium flex items-center gap-1.5 hover:bg-outline-variant/50 transition-colors"
          >
            <Store size={14} />
            管理源 ({marketSources.filter(s => s.enabled).length})
          </button>
          <button
            onClick={handleRefreshMarketplace}
            disabled={isLoadingMarketplace}
            className="px-4 py-2 bg-surface-variant text-on-surface-variant rounded-full text-sm font-medium flex items-center gap-1.5 hover:bg-outline-variant/50 transition-colors"
          >
            {isLoadingMarketplace ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            刷新
          </button>
        </div>
      </div>

      {isLoadingMarketplace && (
        <div className="mb-4 p-4 bg-surface-variant rounded-xl flex items-center justify-center gap-3">
          <Loader2 size={18} className="animate-spin text-primary" />
          <span className="text-sm text-on-surface-variant">正在加载水产市场技能...</span>
        </div>
      )}

      {marketplaceError && !isLoadingMarketplace && (
        <div className="mb-4 p-4 bg-error-container/30 border border-error/30 rounded-xl flex items-start gap-3">
          <AlertCircle size={18} className="text-error flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium text-error mb-1">加载失败</div>
            <div className="text-xs text-on-surface-variant">{marketplaceError}</div>
          </div>
          <button
            onClick={handleRefreshMarketplace}
            className="px-3 py-1 bg-surface text-on-surface-variant rounded-lg text-xs font-medium hover:bg-surface-variant transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {!isLoadingMarketplace && !marketplaceError && filteredMarketplaceSkills.length === 0 && (
        <div className="text-center py-16 bg-surface rounded-xl border border-outline-variant">
          <div className="w-16 h-16 mx-auto mb-4 bg-surface-variant rounded-full flex items-center justify-center">
            <Search size={24} className="text-on-surface-variant opacity-50" />
          </div>
          <div className="text-base font-medium text-on-surface mb-1">
            没有找到相关技能
          </div>
          <div className="text-sm text-on-surface-variant max-w-sm mx-auto">
            尝试使用其他关键词或分类
          </div>
        </div>
      )}

      {!isLoadingMarketplace && !marketplaceError && filteredMarketplaceSkills.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMarketplaceSkills.map(skill => {
            const installed = isInstalled(skill.id) || isInstalled(skill.name);
            const installing = installingIds.has(skill.id);
            return (
              <div key={skill.id} className="card flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-on-surface flex items-center gap-2 flex-wrap">
                      {skill.name}
                      <span className="text-xs px-2 py-0.5 bg-surface-variant text-on-surface-variant rounded-full">
                        v{skill.version}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full border border-outline-variant text-on-surface-variant"
                        title={`来源: ${skill.__sourceName}`}
                      >
                        {skill.__sourceName}
                      </span>
                      {installed && (
                        <span className="text-xs px-2 py-0.5 bg-success-container text-success rounded-full flex items-center gap-1">
                          <Check size={10} />
                          已安装
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-on-surface-variant mt-1">
                      {skill.author || 'unknown'}
                    </div>
                  </div>
                </div>
                <div className="flex-1 mb-3">
                  <div className="text-xs text-on-surface-variant line-clamp-3">
                    {skill.description}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {skill.tags?.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 bg-surface-variant text-on-surface-variant rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-outline-variant mt-auto">
                  <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <Download size={12} />
                      {skill.downloads?.toLocaleString() || 0}
                    </span>
                    {skill.rating && (
                      <span>⭐ {skill.rating}</span>
                    )}
                  </div>
                  {installed ? (
                    <button
                      onClick={() => handleUninstallSkill(skill.id)}
                      disabled={uninstallingIds.has(skill.id)}
                      className="px-3 py-1.5 bg-surface-variant text-error rounded-lg text-xs font-medium hover:bg-error-container/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {uninstallingIds.has(skill.id) ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          卸载中
                        </>
                      ) : (
                        '卸载'
                      )}
                    </button>
                  ) : skill.__sourceType === 'json' ? (
                    <button
                      onClick={() => handleImportFromSource(skill)}
                      className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                    >
                      <Download size={12} />
                      导入本地
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstallSkill(skill)}
                      disabled={installing || !cliStatus.available}
                      className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {installing ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          安装中
                        </>
                      ) : (
                        <>
                          <Download size={12} />
                          安装
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderInstalled = () => {
    if (!cliStatus.available) {
      return (
        <div className="text-center py-16 bg-surface rounded-xl border border-outline-variant">
          <div className="w-16 h-16 mx-auto mb-4 bg-surface-variant rounded-full flex items-center justify-center">
            <Terminal size={24} className="text-on-surface-variant opacity-50" />
          </div>
          <div className="text-base font-medium text-on-surface mb-1">
            CLI 未安装
          </div>
          <div className="text-sm text-on-surface-variant max-w-sm mx-auto mb-4">
            请先安装 openclawmp CLI 以管理已安装的技能
          </div>
          <button
            onClick={handleInstallCli}
            disabled={isInstallingCli}
            className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity mx-auto"
          >
            {isInstallingCli ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            安装 CLI
          </button>
        </div>
      );
    }

    if (isLoadingInstalled) {
      return (
        <div className="text-center py-16 bg-surface rounded-xl border border-outline-variant">
          <Loader2 size={24} className="animate-spin text-primary mx-auto mb-4" />
          <div className="text-sm text-on-surface-variant">正在加载已安装技能...</div>
        </div>
      );
    }

    if (installedError) {
      return (
        <div className="text-center py-16 bg-surface rounded-xl border border-outline-variant">
          <AlertCircle size={24} className="text-error mx-auto mb-4" />
          <div className="text-base font-medium text-on-surface mb-1">
            加载失败
          </div>
          <div className="text-sm text-on-surface-variant max-w-sm mx-auto mb-4">
            {installedError}
          </div>
          <button
            onClick={handleRefreshInstalled}
            className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity mx-auto"
          >
            <RefreshCw size={14} />
            重试
          </button>
        </div>
      );
    }

    if (filteredInstalledSkills.length === 0) {
      return (
        <div className="text-center py-16 bg-surface rounded-xl border border-outline-variant">
          <div className="w-16 h-16 mx-auto mb-4 bg-surface-variant rounded-full flex items-center justify-center">
            <Package size={24} className="text-on-surface-variant opacity-50" />
          </div>
          <div className="text-base font-medium text-on-surface mb-1">
            {searchQuery ? '没有匹配的已安装技能' : '暂无已安装的技能'}
          </div>
          <div className="text-sm text-on-surface-variant max-w-sm mx-auto mb-4">
            {searchQuery ? '尝试使用其他关键词搜索' : '前往水产市场发现并安装有用的技能'}
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleRefreshInstalled}
              className="px-4 py-2 bg-surface-variant text-on-surface-variant rounded-full text-sm font-medium flex items-center gap-1.5 hover:bg-outline-variant/50 transition-colors"
            >
              <RefreshCw size={14} />
              刷新
            </button>
            <button
              onClick={() => setActiveTab('marketplace')}
              className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <Sparkles size={14} />
              发现技能
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="flex justify-end mb-4">
          <button
            onClick={handleRefreshInstalled}
            disabled={isLoadingInstalled}
            className="px-4 py-2 bg-surface-variant text-on-surface-variant rounded-full text-sm font-medium flex items-center gap-1.5 hover:bg-outline-variant/50 transition-colors"
          >
            {isLoadingInstalled ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            刷新
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInstalledSkills.map(skill => {
            const updating = updatingIds.has(skill.id) || updatingIds.has(skill.name);
            const uninstalling = uninstallingIds.has(skill.id) || uninstallingIds.has(skill.name);
            return (
              <div key={skill.id} className="card flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-on-surface flex items-center gap-2 flex-wrap">
                      {skill.name}
                      <span className="text-xs px-2 py-0.5 bg-surface-variant text-on-surface-variant rounded-full">
                        v{skill.version}
                      </span>
                    </div>
                    <div className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                      {skill.description || '无描述'}
                    </div>
                  </div>
                </div>
                <div className="flex-1 mb-3">
                  <div className="text-xs text-on-surface-variant">
                    安装时间：{new Date(skill.installedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-outline-variant mt-auto">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleInstalledSkill(skill.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        skill.enabled
                          ? 'bg-success-container text-success'
                          : 'bg-surface-variant text-on-surface-variant'
                      }`}
                      title={skill.enabled ? '禁用' : '启用'}
                    >
                      {skill.enabled ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => handleUpdateSkill(skill.id)}
                      disabled={updating}
                      className="p-1.5 rounded-lg bg-surface-variant text-on-surface-variant hover:bg-outline-variant/50 transition-colors disabled:opacity-50"
                      title="更新"
                    >
                      {updating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                    </button>
                  </div>
                  <button
                    onClick={() => handleUninstallSkill(skill.id)}
                    disabled={uninstalling}
                    className="px-3 py-1.5 bg-surface-variant text-error rounded-lg text-xs font-medium hover:bg-error-container/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {uninstalling ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        卸载中
                      </>
                    ) : (
                      '卸载'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="技能管理"
        description="管理本地技能，从水产市场发现和安装更多技能"
        actions={
          <>
            {activeTab === 'local' && (
              <>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-secondary-container text-on-secondary-container hover:opacity-90 transition-opacity cursor-pointer">
                  <Upload size={14} />
              导入
              <input type="file" accept=".zip,.json" className="hidden" onChange={handleImportSkill} />
                </label>
                <Button variant="filled" size="sm" leftIcon={<Plus size={14} />} onClick={handleCreateSkill}>
                  创建技能
                </Button>
              </>
            )}
            {activeTab === 'marketplace' && (
              <Button variant="tonal" size="sm" leftIcon={<ExternalLink size={14} />} onClick={handleGoToMarketplace}>
                水产市场
              </Button>
            )}
            <Button variant="tonal" size="sm" leftIcon={<Terminal size={14} />} onClick={() => setShowCommandPanel(true)}>
              命令行
            </Button>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full">

      {renderCliStatus()}
      {renderTabs()}

      <div className="mb-6">
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={
            activeTab === 'local' ? '搜索本地技能...' :
            activeTab === 'marketplace' ? '搜索水产市场技能...' :
            '搜索已安装技能...'
          }
          leftIcon={<Search size={16} />}
          fullWidth
        />
      </div>

      {activeTab === 'local' && renderLocalSkills()}
      {activeTab === 'marketplace' && renderMarketplace()}
      {activeTab === 'installed' && renderInstalled()}

      <Dialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        title="创建技能"
        size="md"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="text" size="sm" onClick={() => setShowUpload(false)}>
              取消
            </Button>
            <Button variant="filled" size="sm" onClick={handleSaveSkill}>
              创建
            </Button>
          </div>
        }
      >
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">技能名称</label>
                  <input
                    type="text"
                    value={uploadSkill.name}
                    onChange={e => setUploadSkill(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入技能名称"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">版本</label>
                  <input
                    type="text"
                    value={uploadSkill.version}
                    onChange={e => setUploadSkill(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="1.0.0"
                    className="w-full"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">技能描述</label>
                <input
                  type="text"
                  value={uploadSkill.description}
                  onChange={e => setUploadSkill(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="简短描述这个技能的作用"
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">技能内容 / 提示词</label>
                <textarea
                  value={uploadSkill.content}
                  onChange={e => setUploadSkill(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="帮我创建一个Agent技能，按照已有的技能创建指引技能或一般格式使技能达成以下要求："
                  rows={12}
                  className="w-full resize-none font-mono text-sm"
                />
              </div>
            </div>
      </Dialog>

      <Dialog
        open={showCommandPanel}
        onClose={() => setShowCommandPanel(false)}
        title={
          <span className="flex items-center gap-2">
            <Terminal size={18} />
            CLI 命令面板
          </span>
        }
        description="openclawmp 命令行工具"
        size="lg"
      >
            <div
              ref={commandOutputRef}
              className="p-4 bg-black/90 rounded-t-none max-h-80 overflow-y-auto font-mono text-sm"
              style={{ fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace" }}
            >
              {commandOutput.length === 0 ? (
                <div className="text-green-400 text-xs">
                  <p>欢迎使用 openclawmp CLI</p>
                  <p className="mt-1">输入 <span className="text-yellow-400">help</span> 查看可用命令</p>
                  {!cliStatus.available && (
                    <p className="text-red-400 mt-2">警告：CLI 未安装，请先安装后使用</p>
                  )}
                  <p className="text-gray-500 mt-2">$</p>
                </div>
              ) : (
                <div className="text-green-400 text-xs space-y-0.5">
                  {commandOutput.map((line, idx) => (
                    <div
                      key={idx}
                      className={
                        line.startsWith('$') ? 'text-blue-400' :
                        line.startsWith('错误') ? 'text-red-400' :
                        line.startsWith('✓') ? 'text-green-400' :
                        line.match(/^\s*•/) ? 'text-cyan-300' :
                        'text-gray-300'
                      }
                    >
                      {line || '\u00A0'}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <form onSubmit={handleCommandSubmit} className="pt-4 border-t border-outline-variant flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-mono text-sm">$</span>
                <input
                  type="text"
                  value={commandInput}
                  onChange={e => setCommandInput(e.target.value)}
                  placeholder="输入命令，如：help, install, list, search..."
                  className="w-full pl-8 pr-4 py-2.5 bg-surface-variant border border-outline-variant rounded-lg text-sm font-mono text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                执行
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {['help', 'list', 'search code', 'install 代码审查专家', 'update'].map(cmd => (
                <button
                  key={cmd}
                  onClick={() => {
                    setCommandInput(cmd);
                  }}
                  className="px-3 py-1 bg-surface-variant text-on-surface-variant rounded-full text-xs hover:bg-outline-variant/50 transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
      </Dialog>

      {/* 源管理弹窗 */}
      <Dialog
        open={showSourceManager}
        onClose={() => setShowSourceManager(false)}
        title="管理市场源"
        description="技能可来自多个市场。JSON 源需返回 {skills:[{name, description, version, content?}]} 形状。"
        size="lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="text" size="sm" onClick={() => setShowSourceManager(false)}>
              完成
            </Button>
            <Button variant="filled" size="sm" leftIcon={<RefreshCw size={14} />} onClick={loadMarketplaceSkills}>
              重新聚合
            </Button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            {marketSources.map(src => (
              <div key={src.id} className="flex items-center gap-3 p-3 bg-surface-variant rounded-lg">
                <div className={`toggle-switch ${src.enabled ? 'active' : ''}`} onClick={() => toggleSource(src.id)}>
                  <div className="toggle-switch-thumb" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-on-surface flex items-center gap-2">
                    {src.name}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-outline-variant text-on-surface-variant">
                      {src.type}
                    </span>
                    {!src.enabled && <span className="text-xs text-on-surface-variant">已停用</span>}
                  </div>
                  <div className="text-xs text-on-surface-variant truncate font-mono">{src.url}</div>
                </div>
                {src.id !== 'src-openclawmp' && (
                  <button
                    onClick={() => removeSource(src.id)}
                    className="p-1.5 rounded-lg text-error hover:bg-error-container/30 transition-colors flex-none"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-outline-variant pt-4">
            <div className="text-xs font-medium text-on-surface-variant mb-2">添加新源</div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSource.name}
                  onChange={e => setNewSource(p => ({ ...p, name: e.target.value }))}
                  placeholder="源名称"
                  className="flex-1"
                />
                <select
                  value={newSource.type}
                  onChange={e => setNewSource(p => ({ ...p, type: e.target.value as MarketSource['type'] }))}
                  style={{ minWidth: 120 }}
                >
                  <option value="json">JSON 端点</option>
                  <option value="openclawmp">OpenClawMP</option>
                </select>
              </div>
              <input
                type="text"
                value={newSource.url}
                onChange={e => setNewSource(p => ({ ...p, url: e.target.value }))}
                placeholder="源地址（JSON 端点 URL）"
                className="w-full"
              />
              <button
                onClick={addSource}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                <Plus size={14} />
                添加源
              </button>
            </div>
          </div>
        </div>
      </Dialog>
      </div>
    </div>
  );
};

export default Marketplace;
