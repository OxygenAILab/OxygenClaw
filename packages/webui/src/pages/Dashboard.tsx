import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity, DollarSign, Zap, Clock, BarChart3, TrendingUp, PieChart, Trophy,
  AlertCircle, RefreshCw, X, Settings, Database, Eye, EyeOff, Code2,
  Upload, Download, Plus, Trash2, Check, Copy, Terminal, MessageSquare,
  Calculator
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import { dashboardApi, DashboardStats, AppSettings, proxyApi, replaceVariables } from '../services/api';
import { useToast } from '../components/Toast';

const CHART_COLORS = [
  'var(--md-primary)',
  'var(--md-tertiary)',
  'var(--md-secondary)',
  'var(--md-success)',
  'var(--md-warning)',
  'var(--md-error)',
];

const SETTINGS_KEY = 'oxygenclaw:settings';
const LOCAL_STATS_KEY = 'oxygenclaw:dashboard-stats';

interface DashboardVariable {
  name: string;
  value: string;
}

interface LocalDashboardStats {
  todayConversations: number;
  totalConversations: number;
  todayMessages: number;
  totalMessages: number;
  estimatedTokens: number;
  lastUpdated: string;
}

interface ParsedCurl {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  authType: 'none' | 'bearer' | 'apikey' | 'custom';
  authToken: string;
  authHeader: string;
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function extractVariables(text: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

function getNestedValue(obj: any, path: string): any {
  if (!path || obj === null || obj === undefined) return undefined;
  
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  return keys.reduce((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    if (Array.isArray(acc) && /^\d+$/.test(key)) {
      const index = parseInt(key, 10);
      return acc[index];
    }
    return acc[key] !== undefined ? acc[key] : undefined;
  }, obj);
}

function getAllPaths(obj: any, prefix = ''): string[] {
  const paths: string[] = [];
  if (obj === null || obj === undefined) return paths;

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const currentPath = prefix ? `${prefix}[${index}]` : `[${index}]`;
      if (typeof item === 'object' && item !== null) {
        paths.push(...getAllPaths(item, currentPath));
      } else if (typeof item === 'number' || typeof item === 'string' || typeof item === 'boolean') {
        paths.push(currentPath);
      }
    });
    return paths;
  }

  if (typeof obj !== 'object') return paths;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      paths.push(...getAllPaths(value, currentPath));
    } else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      paths.push(currentPath);
    }
  }
  return paths;
}

function getLocalStats(): LocalDashboardStats {
  try {
    const raw = localStorage.getItem(LOCAL_STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const today = new Date().toDateString();
      const lastUpdateDate = new Date(parsed.lastUpdated).toDateString();
      if (today !== lastUpdateDate) {
        return {
          todayConversations: 0,
          totalConversations: parsed.totalConversations || 0,
          todayMessages: 0,
          totalMessages: parsed.totalMessages || 0,
          estimatedTokens: parsed.estimatedTokens || 0,
          lastUpdated: new Date().toISOString(),
        };
      }
      return parsed;
    }
  } catch {
  }
  return {
    todayConversations: 0,
    totalConversations: 0,
    todayMessages: 0,
    totalMessages: 0,
    estimatedTokens: 0,
    lastUpdated: new Date().toISOString(),
  };
}

function saveLocalStats(stats: LocalDashboardStats): void {
  try {
    localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(stats));
  } catch {
  }
}

function estimateTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = text.replace(/[\u4e00-\u9fa5]/g, ' ').trim().split(/\s+/).filter(w => w.length > 0).length;
  return Math.round(chineseChars * 1.5 + englishWords * 0.8);
}

function detectUnit(path: string, value: number): string {
  const lowerPath = path.toLowerCase();
  
  if (lowerPath.includes('balance') || lowerPath.includes('credits') || lowerPath.includes('amount') || lowerPath.includes('money') || lowerPath.includes('cost') || lowerPath.includes('price') || lowerPath.includes('fee')) {
    return '';
  }
  if (lowerPath.includes('count') || lowerPath.includes('num') || lowerPath.includes('total') || lowerPath.includes('requests') || lowerPath.includes('calls') || lowerPath.includes('times')) {
    return '次';
  }
  if (lowerPath.includes('token')) {
    return '';
  }
  if (lowerPath.includes('time') || lowerPath.includes('duration') || lowerPath.includes('ms')) {
    if (value > 1000) return '秒';
    return '毫秒';
  }
  if (lowerPath.includes('percent') || lowerPath.includes('rate') || lowerPath.includes('ratio') || lowerPath.includes('%')) {
    return '%';
  }
  if (lowerPath.includes('size') || lowerPath.includes('bytes')) {
    if (value > 1073741824) return 'GB';
    if (value > 1048576) return 'MB';
    if (value > 1024) return 'KB';
    return 'B';
  }
  
  return '';
}

function formatValueWithUnit(value: number, path: string): string {
  const unit = detectUnit(path, value);
  const lowerPath = path.toLowerCase();
  
  if (lowerPath.includes('balance') || lowerPath.includes('credits') || lowerPath.includes('amount') || lowerPath.includes('money') || lowerPath.includes('cost') || lowerPath.includes('price') || lowerPath.includes('fee')) {
    return `$${value.toFixed(2)}`;
  }
  
  if (lowerPath.includes('time') || lowerPath.includes('duration') || lowerPath.includes('ms')) {
    if (value > 1000) return `${(value / 1000).toFixed(2)} 秒`;
    return `${value} 毫秒`;
  }
  
  if (lowerPath.includes('size') || lowerPath.includes('bytes')) {
    if (value > 1073741824) return `${(value / 1073741824).toFixed(2)} GB`;
    if (value > 1048576) return `${(value / 1048576).toFixed(2)} MB`;
    if (value > 1024) return `${(value / 1024).toFixed(2)} KB`;
    return `${value} B`;
  }
  
  if (unit) {
    return `${value.toLocaleString()} ${unit}`;
  }
  
  return value.toLocaleString();
}

function recalculateLocalStats(): LocalDashboardStats {
  let totalConversations = 0;
  let totalMessages = 0;
  let todayConversations = 0;
  let todayMessages = 0;
  let estimatedTokens = 0;
  const today = new Date().toDateString();

  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('oxygenclaw:conversation:')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const conv = JSON.parse(raw);
            totalConversations++;
            const convDate = conv.createdAt ? new Date(conv.createdAt).toDateString() : null;
            if (convDate === today) {
              todayConversations++;
            }
            const messages = conv.messages || [];
            totalMessages += messages.length;
            if (convDate === today) {
              todayMessages += messages.length;
            }
            for (const msg of messages) {
              if (msg.content) {
                estimatedTokens += estimateTokens(msg.content);
              }
            }
          }
        } catch {
        }
      }
    }
  } catch {
  }

  const stats: LocalDashboardStats = {
    todayConversations,
    totalConversations,
    todayMessages,
    totalMessages,
    estimatedTokens,
    lastUpdated: new Date().toISOString(),
  };
  saveLocalStats(stats);
  return stats;
}

function parseCurl(curlStr: string): ParsedCurl | null {
  if (!curlStr || !curlStr.trim()) return null;

  const result: ParsedCurl = {
    url: '',
    method: 'GET',
    headers: {},
    body: '',
    authType: 'none',
    authToken: '',
    authHeader: '',
  };

  try {
    const lines = curlStr.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    let combined = lines.join(' ');
    combined = combined.replace(/\\/g, ' ').replace(/\s+/g, ' ').trim();

    const urlMatch = combined.match(/curl\s+(-[XGLPUTDHSF]+\s+)*("([^"]+)"|'([^']+)'|(\S+))/);
    if (urlMatch) {
      result.url = urlMatch[3] || urlMatch[4] || urlMatch[5] || '';
      if (result.url.startsWith('-')) {
        result.url = '';
      }
    }

    const methodMatch = combined.match(/-X\s+(\w+)|--request\s+(\w+)/);
    if (methodMatch) {
      result.method = (methodMatch[1] || methodMatch[2] || 'GET').toUpperCase();
    }

    const headerRegex = /-H\s+"([^"]+)"|-H\s+'([^']+)'|--header\s+"([^"]+)"|--header\s+'([^']+)'/g;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(combined)) !== null) {
      const headerStr = headerMatch[1] || headerMatch[2] || headerMatch[3] || headerMatch[4];
      const colonIndex = headerStr.indexOf(':');
      if (colonIndex > 0) {
        const key = headerStr.slice(0, colonIndex).trim();
        const value = headerStr.slice(colonIndex + 1).trim();
        result.headers[key] = value;
      }
    }

    const bodyMatch = combined.match(/-d\s+"((?:[^"\\]|\\.)*)"|-d\s+'([^']+)'|--data\s+"((?:[^"\\]|\\.)*)"|--data\s+'([^']+)'/);
    if (bodyMatch) {
      result.body = bodyMatch[1] || bodyMatch[2] || bodyMatch[3] || bodyMatch[4] || '';
      result.body = result.body.replace(/\\"/g, '"');
      if (!methodMatch) {
        result.method = 'POST';
      }
    }

    const urlMatches = combined.match(/"(https?:\/\/[^"]+)"|'(https?:\/\/[^']+)'|(https?:\/\/\S+)/g);
    if (urlMatches && !result.url) {
      for (const m of urlMatches) {
        const cleanUrl = m.replace(/^["']|["']$/g, '');
        if (cleanUrl.startsWith('http')) {
          result.url = cleanUrl;
          break;
        }
      }
    }

    for (const [key, value] of Object.entries(result.headers)) {
      if (key.toLowerCase() === 'authorization') {
        if (value.toLowerCase().startsWith('bearer ')) {
          result.authType = 'bearer';
          result.authToken = value.slice(7);
        } else {
          result.authType = 'custom';
          result.authToken = value;
          result.authHeader = key;
        }
        delete result.headers[key];
        break;
      }
      if (key.toLowerCase() === 'x-api-key') {
        result.authType = 'apikey';
        result.authToken = value;
        delete result.headers[key];
        break;
      }
    }

    if (!result.url) return null;
    return result;
  } catch {
    return null;
  }
}

const Dashboard: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [localStats, setLocalStats] = useState<LocalDashboardStats | null>(null);
  const [showCurlImport, setShowCurlImport] = useState(false);
  const [curlInput, setCurlInput] = useState('');

  const [config, setConfig] = useState({
    enabled: false,
    url: '',
    method: 'GET' as 'GET' | 'POST' | 'PUT' | 'DELETE',
    authType: 'none' as 'none' | 'bearer' | 'apikey' | 'custom',
    authToken: '',
    authHeader: '',
    headersJson: '',
    bodyJson: '',
    useProxy: true,
  });

  const [variables, setVariables] = useState<DashboardVariable[]>([]);
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
  const [headersError, setHeadersError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);

  useEffect(() => {
    const settings = loadSettings();
    const method = settings.dashboardApiMethod || 'GET';
    const validMethods: Array<'GET' | 'POST' | 'PUT' | 'DELETE'> = ['GET', 'POST', 'PUT', 'DELETE'];
    const normalizedMethod = validMethods.includes(method as any) ? method as 'GET' | 'POST' | 'PUT' | 'DELETE' : 'GET';
    setConfig({
      enabled: !!settings.dashboardApiEnabled,
      url: settings.dashboardApiUrl || '',
      method: normalizedMethod,
      authType: (settings.dashboardApiAuthType as any) || 'none',
      authToken: settings.dashboardApiAuthToken || '',
      authHeader: settings.dashboardApiAuthHeader || '',
      headersJson: settings.dashboardApiHeaders || '',
      bodyJson: settings.dashboardApiBody || '',
      useProxy: settings.dashboardApiUseProxy !== false,
    });

    const savedVars = settings.dashboardApiVariables || {};
    const varList: DashboardVariable[] = Object.entries(savedVars).map(([name, value]) => ({
      name,
      value: value as string,
    }));
    setVariables(varList);

    setLocalStats(getLocalStats());
    
    setTimeout(() => {
      const freshStats = recalculateLocalStats();
      setLocalStats(freshStats);
    }, 0);
  }, []);

  useEffect(() => {
    const allText = config.url + config.headersJson + config.bodyJson + config.authToken;
    const detected = extractVariables(allText);
    setDetectedVariables(detected);

    setVariables(prev => {
      const existingNames = new Set(prev.map(v => v.name));
      const newVars = [...prev];
      for (const name of detected) {
        if (!existingNames.has(name)) {
          newVars.push({ name, value: '' });
        }
      }
      return newVars.filter(v => detected.includes(v.name));
    });
  }, [config.url, config.headersJson, config.bodyJson, config.authToken]);

  const validateJson = useCallback((json: string): boolean => {
    if (!json.trim()) return true;
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  }, []);

  const [fetchErrorType, setFetchErrorType] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);

  const extractDataFromResponse = (responseBody: any): any => {
    if (responseBody === null || responseBody === undefined) return null;
    
    if (typeof responseBody === 'object') {
      if ('data' in responseBody && responseBody.data !== null && responseBody.data !== undefined) {
        const data = responseBody.data;
        if (typeof data === 'object' || Array.isArray(data)) {
          return data;
        }
      }
      if ('result' in responseBody && responseBody.result !== null && responseBody.result !== undefined) {
        const result = responseBody.result;
        if (typeof result === 'object' || Array.isArray(result)) {
          return result;
        }
      }
    }
    
    return responseBody;
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFetchErrorType(null);
    setRawResponse(null);

    try {
      let result: any;

      const varMap: Record<string, string> = {};
      for (const v of variables) {
        varMap[v.name] = v.value;
      }

      if (config.enabled && config.url) {
        if (config.useProxy) {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          if (config.authType === 'bearer') {
            headers['Authorization'] = `Bearer ${replaceVariables(config.authToken, varMap)}`;
          } else if (config.authType === 'apikey') {
            headers['X-API-Key'] = replaceVariables(config.authToken, varMap);
          } else if (config.authType === 'custom' && config.authHeader) {
            headers[config.authHeader] = replaceVariables(config.authToken, varMap);
          }

          if (config.headersJson) {
            try {
              const parsedCustomHeaders = JSON.parse(config.headersJson);
              for (const [key, value] of Object.entries(parsedCustomHeaders)) {
                headers[key] = replaceVariables(String(value), varMap);
              }
            } catch {}
          }

          let body: string | undefined;
          if ((config.method === 'POST' || config.method === 'PUT' || config.method === 'DELETE') && config.bodyJson) {
            body = replaceVariables(config.bodyJson, varMap);
          }

          const proxyResult = await proxyApi.request({
            url: replaceVariables(config.url, varMap),
            method: config.method,
            headers,
            body,
          });

          if (proxyResult.success && proxyResult.data) {
            const { status, body: responseBody } = proxyResult.data;
            setRawResponse(responseBody);
            
            if (status >= 200 && status < 300) {
              const extractedData = extractDataFromResponse(responseBody);
              result = { success: true, data: extractedData, rawData: responseBody, error: null };
            } else {
              let errorMsg = `HTTP ${status}`;
              let errorType = 'http';
              try {
                if (typeof responseBody === 'object') {
                  errorMsg = responseBody?.error?.message || responseBody?.error || responseBody?.message || errorMsg;
                }
              } catch {}
              if (status === 401 || status === 403) {
                errorType = 'auth';
                errorMsg = `认证失败 (${status}): ${errorMsg}`;
              }
              result = { success: false, data: null, rawData: responseBody, error: errorMsg, errorType };
            }
          } else {
            result = {
              success: false,
              data: null,
              rawData: null,
              error: proxyResult.error || '代理请求失败',
              errorType: 'proxy'
            };
          }
        } else {
          const directResult = await dashboardApi.getCustomStats(
            config.url,
            config.method,
            config.authType,
            config.authToken,
            config.authHeader,
            config.headersJson,
            config.bodyJson,
            varMap
          );
          
          if (directResult.success && directResult.data) {
            setRawResponse(directResult.data);
            const extractedData = extractDataFromResponse(directResult.data);
            result = { ...directResult, data: extractedData, rawData: directResult.data };
          } else {
            result = directResult;
          }
        }
      } else {
        result = await dashboardApi.getStats();
      }

      if (result.success && result.data !== null && result.data !== undefined) {
        setStats(result.data as DashboardStats);
        setRawData(result.rawData || result.data);
        setLastUpdated(new Date().toISOString());
        setError(null);
      } else {
        setStats(null);
        setRawData(result.rawData || null);
        if (!config.enabled) {
          setError(null);
        } else {
          setError(result.error || '获取数据失败');
          setFetchErrorType(result.errorType || null);
          showToast({ type: 'error', title: '获取数据失败', description: result.error });
        }
      }
    } catch (e: any) {
      setStats(null);
      setRawData(null);
      if (!config.enabled) {
        setError(null);
      } else {
        setError(e?.message || '获取数据失败');
        setFetchErrorType('unknown');
        showToast({ type: 'error', title: '获取数据失败', description: e?.message });
      }
    } finally {
      setLoading(false);
    }
  }, [config, variables, showToast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatNumber = (num?: number, decimals = 0): string => {
    if (num === undefined || num === null) return '--';
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatCurrency = (num?: number): string => {
    if (num === undefined || num === null) return '--';
    return `$${num.toFixed(2)}`;
  };

  const hasApiData = stats !== null;
  const hasLocalData = localStats !== null && !config.enabled;
  const hasData = hasApiData || hasLocalData;

  const balance = hasApiData ? (getNestedValue(stats, 'account.balance') || getNestedValue(stats, 'balance') || 0) : 0;
  const totalRequests = hasApiData ? (getNestedValue(stats, 'usage.totalRequests') || getNestedValue(stats, 'totalRequests') || 0) : 0;
  const totalTokens = hasApiData ? (getNestedValue(stats, 'resources.totalTokens') || getNestedValue(stats, 'totalTokens') || { input: 0, output: 0 }) : 0;
  const avgRpm = hasApiData ? (getNestedValue(stats, 'performance.avgRPM') || getNestedValue(stats, 'avgRpm') || 0) : 0;
  const todayCost = hasApiData ? (getNestedValue(stats, 'usage.todayCost') || getNestedValue(stats, 'todayCost') || 0) : 0;
  const monthCost = hasApiData ? (getNestedValue(stats, 'usage.monthCost') || getNestedValue(stats, 'monthCost') || 0) : 0;
  const successCount = hasApiData ? (getNestedValue(stats, 'successCount') || 0) : 0;
  const failedCount = hasApiData ? (getNestedValue(stats, 'failedCount') || 0) : 0;
  const avgTpm = hasApiData ? (getNestedValue(stats, 'performance.avgTPM') || getNestedValue(stats, 'avgTpm') || 0) : 0;
  const peakTps = hasApiData ? (getNestedValue(stats, 'performance.peakTPS') || getNestedValue(stats, 'peakTps') || 0) : 0;
  const peakConcurrency = hasApiData ? (getNestedValue(stats, 'performance.peakConcurrency') || getNestedValue(stats, 'peakConcurrency') || 0) : 0;
  const modelStats = hasApiData ? (getNestedValue(stats, 'modelAnalysis.consumptionByModel') || getNestedValue(stats, 'modelStats') || []) : [];
  const dailyStats = hasApiData ? (getNestedValue(stats, 'usage.requestsByDay') || getNestedValue(stats, 'dailyStats') || []) : [];

  const modelChartData = useMemo(() => {
    if (!Array.isArray(modelStats)) return [];
    return modelStats
      .map((m: any) => ({
        name: m.model || m.name || m.modelName || '未知',
        requests: Number(m.requests ?? m.calls ?? m.count ?? 0),
        cost: Number(m.cost ?? m.consumption ?? m.amount ?? 0),
      }))
      .filter((m) => m.requests > 0 || m.cost > 0);
  }, [modelStats]);

  const dailyChartData = useMemo(() => {
    if (!Array.isArray(dailyStats)) return [];
    return dailyStats.map((d: any) => ({
      date: d.date || d.day || '',
      requests: Number(d.requests ?? d.calls ?? d.count ?? 0),
      cost: Number(d.cost ?? d.consumption ?? d.amount ?? 0),
    }));
  }, [dailyStats]);

  const topModelData = useMemo(() => {
    return [...modelChartData]
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);
  }, [modelChartData]);

  const allDataPaths = useMemo(() => {
    if (!rawData) return [];
    return getAllPaths(rawData);
  }, [rawData]);

  const numericPaths = useMemo(() => {
    return allDataPaths.filter(path => {
      const val = getNestedValue(rawData, path);
      return typeof val === 'number';
    });
  }, [allDataPaths, rawData]);

  const statCards = hasLocalData ? [
    { label: '今日对话', value: formatNumber(localStats?.todayConversations), unit: '个', icon: MessageSquare, color: 'var(--md-primary)' },
    { label: '总对话数', value: formatNumber(localStats?.totalConversations), unit: '个', icon: Activity, color: 'var(--md-secondary)' },
    { label: '今日消息', value: formatNumber(localStats?.todayMessages), unit: '条', icon: BarChart3, color: 'var(--md-tertiary)' },
    { label: '总消息数', value: formatNumber(localStats?.totalMessages), unit: '条', icon: Clock, color: 'var(--md-warning)' },
  ] : [
    { label: '当前余额', value: formatCurrency(balance), unit: '', icon: DollarSign, color: 'var(--md-success)' },
    { label: '请求次数', value: formatNumber(totalRequests), unit: '次', icon: Activity, color: 'var(--md-primary)' },
    { label: 'Tokens 消耗', value: formatNumber((totalTokens as any)?.input + (totalTokens as any)?.output || totalTokens), unit: '', icon: Zap, color: 'var(--md-tertiary)' },
    { label: '平均 RPM', value: formatNumber(avgRpm), unit: '', icon: Clock, color: 'var(--md-warning)' },
  ];

  const handleSaveConfig = () => {
    if (config.enabled && !config.url.trim()) {
      showToast({ type: 'error', title: '请输入 API URL' });
      return;
    }

    if (config.headersJson && !validateJson(config.headersJson)) {
      setHeadersError('请求头格式错误，必须是有效的 JSON');
      return;
    }

    if ((config.method === 'POST' || config.method === 'PUT' || config.method === 'DELETE') && config.bodyJson && !validateJson(config.bodyJson)) {
      setBodyError('请求体格式错误，必须是有效的 JSON');
      return;
    }

    const varMap: Record<string, string> = {};
    for (const v of variables) {
      varMap[v.name] = v.value;
    }

    const settings = loadSettings();
    const newSettings: AppSettings = {
      ...settings,
      dashboardApiEnabled: config.enabled,
      dashboardApiUrl: config.url,
      dashboardApiMethod: config.method,
      dashboardApiAuthType: config.authType,
      dashboardApiAuthToken: config.authToken,
      dashboardApiAuthHeader: config.authHeader,
      dashboardApiHeaders: config.headersJson,
      dashboardApiBody: config.bodyJson,
      dashboardApiVariables: varMap,
      dashboardApiUseProxy: config.useProxy,
    };
    saveSettings(newSettings);

    showToast({ type: 'success', title: '配置已保存' });
    setShowConfigModal(false);
  };

  const handleImportHeaders = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        JSON.parse(content);
        setConfig(prev => ({ ...prev, headersJson: content }));
        setHeadersError(null);
        showToast({ type: 'success', title: '导入成功' });
      } catch {
        showToast({ type: 'error', title: '导入失败', description: '文件格式错误，必须是有效的 JSON' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportHeaders = () => {
    const content = config.headersJson || '{}';
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-headers.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyHeaders = async () => {
    try {
      await navigator.clipboard.writeText(config.headersJson || '{}');
      showToast({ type: 'success', title: '已复制到剪贴板' });
    } catch {
      showToast({ type: 'error', title: '复制失败' });
    }
  };

  const handleVariableChange = (name: string, value: string) => {
    setVariables(prev => prev.map(v => v.name === name ? { ...v, value } : v));
  };

  const handleRefreshLocalStats = () => {
    const newStats = recalculateLocalStats();
    setLocalStats(newStats);
    showToast({ type: 'success', title: '统计已刷新' });
  };

  const handleCurlImport = () => {
    const parsed = parseCurl(curlInput);
    if (!parsed) {
      showToast({ type: 'error', title: '解析失败', description: '无法解析 curl 命令，请检查格式' });
      return;
    }

    const validMethods: Array<'GET' | 'POST' | 'PUT' | 'DELETE'> = ['GET', 'POST', 'PUT', 'DELETE'];
    const method = validMethods.includes(parsed.method as any)
      ? (parsed.method as 'GET' | 'POST' | 'PUT' | 'DELETE')
      : 'GET';

    let newHeaders: Record<string, string> = {};
    if (config.headersJson) {
      try {
        newHeaders = JSON.parse(config.headersJson);
      } catch {
      }
    }
    newHeaders = { ...newHeaders, ...parsed.headers };

    const detectedVars = extractVariables(parsed.url + JSON.stringify(parsed.headers) + parsed.body + parsed.authToken);

    const parsedFields: string[] = [];
    parsedFields.push(`URL: ${parsed.url}`);
    parsedFields.push(`方法: ${parsed.method}`);
    if (parsed.authType !== 'none') {
      const authTypeLabels: Record<string, string> = {
        bearer: 'Bearer Token',
        apikey: 'API Key',
        custom: '自定义 Header',
      };
      parsedFields.push(`认证: ${authTypeLabels[parsed.authType] || parsed.authType}`);
    }
    if (Object.keys(parsed.headers).length > 0) {
      parsedFields.push(`自定义头: ${Object.keys(parsed.headers).length} 个`);
    }
    if (parsed.body) {
      parsedFields.push('请求体: 已设置');
    }
    if (detectedVars.length > 0) {
      parsedFields.push(`检测到变量: ${detectedVars.join(', ')}`);
    }

    setConfig(prev => ({
      ...prev,
      enabled: true,
      url: parsed.url,
      method,
      authType: parsed.authType,
      authToken: parsed.authToken,
      authHeader: parsed.authHeader,
      headersJson: Object.keys(newHeaders).length > 0 ? JSON.stringify(newHeaders, null, 2) : '',
      bodyJson: parsed.body || '',
      useProxy: true,
    }));

    setHeadersError(null);
    setBodyError(null);
    setShowCurlImport(false);
    setCurlInput('');
    showToast({
      type: 'success',
      title: '导入成功',
      description: parsedFields.join('\n'),
    });
  };

  const addVariable = () => {
    const name = prompt('输入变量名：');
    if (!name) return;
    if (!/^\w+$/.test(name)) {
      showToast({ type: 'error', title: '变量名格式错误', description: '只能包含字母、数字和下划线' });
      return;
    }
    if (variables.find(v => v.name === name)) {
      showToast({ type: 'error', title: '变量已存在' });
      return;
    }
    setVariables(prev => [...prev, { name, value: '' }]);
  };

  const removeVariable = (name: string) => {
    setVariables(prev => prev.filter(v => v.name !== name));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">数据看板</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {hasApiData ? '实时监控你的 API 使用情况和模型分析' : hasLocalData ? '本地统计数据 - 基于你的对话历史' : config.enabled ? '暂无数据，点击刷新获取最新数据' : '请配置数据 API 以查看统计数据'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 bg-surface-variant text-on-surface rounded-lg hover:bg-outline-variant/50 transition-colors"
            title="配置数据 API"
          >
            <Settings size={16} />
          </button>
          {hasApiData && (
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="p-2 bg-surface-variant text-on-surface rounded-lg hover:bg-outline-variant/50 transition-colors"
              title={showRawJson ? '隐藏原始数据' : '查看原始数据'}
            >
              {showRawJson ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
          {hasLocalData ? (
            <button
              onClick={handleRefreshLocalStats}
              className="px-4 py-2 bg-surface-variant text-on-surface rounded-full text-sm font-medium flex items-center gap-1.5 hover:bg-outline-variant/50 transition-colors"
            >
              <RefreshCw size={14} />
              刷新统计
            </button>
          ) : (
            <button
              onClick={fetchStats}
              disabled={loading}
              className="px-4 py-2 bg-surface-variant text-on-surface rounded-full text-sm font-medium flex items-center gap-1.5 hover:bg-outline-variant/50 transition-colors"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {loading ? '加载中...' : '刷新'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner mb-4 animate-slide-down">
          <AlertCircle size={16} className="error-banner-icon flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">
              {fetchErrorType === 'cors' && 'CORS 跨域限制'}
              {fetchErrorType === 'auth' && '认证失败'}
              {fetchErrorType === 'network' && '网络错误'}
              {fetchErrorType === 'http' && 'HTTP 请求错误'}
              {fetchErrorType === 'proxy' && '代理服务器错误'}
              {fetchErrorType === 'timeout' && '请求超时'}
              {fetchErrorType === 'parse' && '数据解析错误'}
              {(!fetchErrorType || fetchErrorType === 'unknown') && '请求错误'}
            </div>
            <div className="text-sm mt-1">{error}</div>
            
            {fetchErrorType === 'cors' && (
              <div className="text-xs mt-2 opacity-90 space-y-1">
                <div className="font-medium">解决建议：</div>
                <div>1. 开启「使用后端代理」开关（推荐）</div>
                <div>2. 在 API 服务器端配置 CORS 允许跨域访问</div>
                <div>3. 检查 API URL 是否正确</div>
              </div>
            )}
            
            {fetchErrorType === 'auth' && (
              <div className="text-xs mt-2 opacity-90 space-y-1">
                <div className="font-medium">解决建议：</div>
                <div>1. 检查认证 Token/API Key 是否正确</div>
                <div>2. 确认认证方式是否匹配（Bearer Token / API Key / 自定义）</div>
                <div>3. 检查 Token 是否已过期</div>
              </div>
            )}
            
            {fetchErrorType === 'network' && (
              <div className="text-xs mt-2 opacity-90 space-y-1">
                <div className="font-medium">解决建议：</div>
                <div>1. 检查网络连接是否正常</div>
                <div>2. 确认 API URL 是否正确</div>
                <div>3. 检查服务器是否正常运行</div>
              </div>
            )}
            
            {fetchErrorType === 'proxy' && (
              <div className="text-xs mt-2 opacity-90 space-y-1">
                <div className="font-medium">解决建议：</div>
                <div>1. 确认后端服务是否正常运行</div>
                <div>2. 检查代理接口是否可用</div>
                <div>3. 可以尝试关闭后端代理，直接请求（注意 CORS 限制）</div>
              </div>
            )}
            
            {fetchErrorType === 'http' && (
              <div className="text-xs mt-2 opacity-90 space-y-1">
                <div className="font-medium">解决建议：</div>
                <div>1. 检查 API URL 是否正确</div>
                <div>2. 确认请求方法是否匹配（GET/POST 等）</div>
                <div>3. 检查请求参数是否正确</div>
              </div>
            )}
            
            {fetchErrorType === 'timeout' && (
              <div className="text-xs mt-2 opacity-90 space-y-1">
                <div className="font-medium">解决建议：</div>
                <div>1. 检查网络连接是否稳定</div>
                <div>2. 稍后重试</div>
                <div>3. 确认服务器是否正常响应</div>
              </div>
            )}
            
            {rawResponse && (
              <div className="mt-3">
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-xs underline opacity-80 hover:opacity-100"
                >
                  {showRawJson ? '隐藏原始响应' : '查看原始响应数据'}
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setError(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
      
      {error && showRawJson && rawResponse && (
        <div className="bg-surface rounded-xl p-5 border border-outline-variant mb-6 animate-slide-down">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium flex items-center gap-2">
              <Code2 size={18} className="text-error" />
              原始响应数据
            </h3>
            <button
              onClick={() => setShowRawJson(false)}
              className="p-1.5 hover:bg-surface-variant rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <pre className="bg-surface-variant p-4 rounded-lg overflow-x-auto text-xs font-mono text-on-surface-variant max-h-96">
            {typeof rawResponse === 'object' 
              ? JSON.stringify(rawResponse, null, 2) 
              : String(rawResponse)}
          </pre>
        </div>
      )}

      {!hasData && !loading && !error && (
        <div className="empty-state bg-surface rounded-xl border border-outline-variant mb-6 animate-fade-in">
          <Database size={48} className="empty-state-icon" />
          <div className="empty-state-title">暂无数据</div>
          <div className="empty-state-desc">
            {config.enabled
              ? '已配置第三方数据 API，请点击刷新按钮获取数据'
              : '配置数据 API 后即可查看统计数据。点击右上角设置按钮开始配置。'}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Settings size={14} />
              配置数据 API
            </button>
            {config.enabled && config.url && (
              <button
                onClick={fetchStats}
                className="px-4 py-2 bg-surface-variant text-on-surface rounded-full text-sm font-medium hover:bg-outline-variant/50 transition-colors flex items-center gap-2"
              >
                <RefreshCw size={14} />
                立即刷新
              </button>
            )}
          </div>
        </div>
      )}

      {showRawJson && rawData && (
        <div className="bg-surface rounded-xl p-5 border border-outline-variant mb-6 animate-slide-down">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium flex items-center gap-2">
              <Code2 size={18} className="text-primary" />
              原始 JSON 数据
            </h3>
            <button
              onClick={() => setShowRawJson(false)}
              className="p-1.5 hover:bg-surface-variant rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <pre className="bg-surface-variant p-4 rounded-lg overflow-x-auto text-xs font-mono text-on-surface-variant max-h-96">
            {JSON.stringify(rawData, null, 2)}
          </pre>
        </div>
      )}

      {hasData && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {statCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={i}
                  className="bg-surface rounded-xl p-5 border border-outline-variant card animate-smooth-appear"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
                    >
                      <Icon size={20} />
                    </div>
                  </div>
                  <div className="text-2xl font-semibold text-on-surface">
                    {stat.value}
                  </div>
                  <div className="text-sm text-on-surface-variant mt-1">
                    {stat.label}
                    {stat.unit && hasData && <span className="ml-1 text-xs">({stat.unit})</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {hasLocalData ? (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-surface rounded-xl p-5 border border-outline-variant card animate-smooth-appear animate-smooth-appear-delay-1">
                <h3 className="text-base font-medium mb-4 flex items-center gap-2">
                  <Calculator size={18} className="text-primary" />
                  估算 Token 消耗
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                    <span className="text-sm text-on-surface-variant">总估算 Tokens</span>
                    <span className="text-sm font-medium">{formatNumber(localStats?.estimatedTokens)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-on-surface-variant">数据来源</span>
                    <span className="text-sm font-medium">本地对话历史</span>
                  </div>
                </div>
              </div>

              <div className="bg-surface rounded-xl p-5 border border-outline-variant card animate-smooth-appear animate-smooth-appear-delay-2">
                <h3 className="text-base font-medium mb-4 flex items-center gap-2">
                  <Clock size={18} className="text-primary" />
                  统计信息
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                    <span className="text-sm text-on-surface-variant">统计更新时间</span>
                    <span className="text-sm font-medium">
                      {localStats?.lastUpdated ? new Date(localStats.lastUpdated).toLocaleString() : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-on-surface-variant">刷新方式</span>
                    <span className="text-sm font-medium">手动刷新</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface rounded-xl p-5 border border-outline-variant card animate-smooth-appear animate-smooth-appear-delay-1">
                  <h3 className="text-base font-medium mb-4 flex items-center gap-2">
                    <DollarSign size={18} className="text-primary" />
                    账户数据
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                      <span className="text-sm text-on-surface-variant">当前余额</span>
                      <span className="text-sm font-medium">{formatCurrency(balance)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                      <span className="text-sm text-on-surface-variant">今日消耗</span>
                      <span className="text-sm font-medium">{formatCurrency(todayCost)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-on-surface-variant">本月消耗</span>
                      <span className="text-sm font-medium">{formatCurrency(monthCost)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface rounded-xl p-5 border border-outline-variant card animate-smooth-appear animate-smooth-appear-delay-2">
                  <h3 className="text-base font-medium mb-4 flex items-center gap-2">
                    <Activity size={18} className="text-primary" />
                    使用统计
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                      <span className="text-sm text-on-surface-variant">请求次数</span>
                      <span className="text-sm font-medium">{formatNumber(totalRequests)} 次</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                      <span className="text-sm text-on-surface-variant">Token 用量</span>
                      <span className="text-sm font-medium">{formatNumber((totalTokens as any)?.input + (totalTokens as any)?.output || totalTokens)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-on-surface-variant">成功/失败</span>
                      <span className="text-sm font-medium">
                        {formatNumber(successCount)} / {formatNumber(failedCount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface rounded-xl p-5 border border-outline-variant card animate-smooth-appear animate-smooth-appear-delay-3">
                  <h3 className="text-base font-medium mb-4 flex items-center gap-2">
                    <Zap size={18} className="text-primary" />
                    资源消耗
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                      <span className="text-sm text-on-surface-variant">统计 Tokens</span>
                      <span className="text-sm font-medium">{formatNumber((totalTokens as any)?.input + (totalTokens as any)?.output || totalTokens)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-on-surface-variant">平均 TPM</span>
                      <span className="text-sm font-medium">{formatNumber(avgTpm)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface rounded-xl p-5 border border-outline-variant card animate-smooth-appear animate-smooth-appear-delay-4">
                  <h3 className="text-base font-medium mb-4 flex items-center gap-2">
                    <TrendingUp size={18} className="text-primary" />
                    性能指标
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                      <span className="text-sm text-on-surface-variant">平均 RPM</span>
                      <span className="text-sm font-medium">{formatNumber(avgRpm)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                      <span className="text-sm text-on-surface-variant">平均 TPM</span>
                      <span className="text-sm font-medium">{formatNumber(avgTpm)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                      <span className="text-sm text-on-surface-variant">峰值 TPS</span>
                      <span className="text-sm font-medium">{formatNumber(peakTps)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-on-surface-variant">峰值并发</span>
                      <span className="text-sm font-medium">{formatNumber(peakConcurrency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <ChartCard title="消耗分布" subtitle="按模型" icon={BarChart3} hasData={modelChartData.length > 0}>
                  <ResponsiveContainer width="100%" height={192}>
                    <BarChart data={modelChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--md-outline-variant)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--md-on-surface-variant)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--md-on-surface-variant)' }} tickLine={false} axisLine={false} />
                      <ReTooltip content={<ChartTooltip valuePrefix="$" valueKey="cost" />} cursor={{ fill: 'var(--md-surface-variant)', opacity: 0.4 }} />
                      <Bar dataKey="cost" radius={[6, 6, 0, 0]} fill="var(--md-primary)" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="调用趋势" subtitle="近 7 天" icon={TrendingUp} hasData={dailyChartData.length > 0}>
                  <ResponsiveContainer width="100%" height={192}>
                    <LineChart data={dailyChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--md-outline-variant)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--md-on-surface-variant)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--md-on-surface-variant)' }} tickLine={false} axisLine={false} />
                      <ReTooltip content={<ChartTooltip valueKey="requests" />} cursor={{ stroke: 'var(--md-outline-variant)' }} />
                      <Line type="monotone" dataKey="requests" stroke="var(--md-primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--md-primary)' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="调用次数分布" subtitle="按模型" icon={PieChart} hasData={modelChartData.length > 0}>
                  <ResponsiveContainer width="100%" height={192}>
                    <RePieChart>
                      <Pie data={modelChartData} dataKey="requests" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={2}>
                        {modelChartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip content={<ChartTooltip valueKey="requests" valueSuffix=" 次" />} />
                    </RePieChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="调用次数排行" subtitle="TOP 5" icon={Trophy} hasData={topModelData.length > 0}>
                  <ResponsiveContainer width="100%" height={192}>
                    <BarChart data={topModelData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--md-outline-variant)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--md-on-surface-variant)' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: 'var(--md-on-surface-variant)' }} tickLine={false} axisLine={false} />
                      <ReTooltip content={<ChartTooltip valueKey="requests" valueSuffix=" 次" />} cursor={{ fill: 'var(--md-surface-variant)', opacity: 0.4 }} />
                      <Bar dataKey="requests" radius={[0, 6, 6, 0]} fill="var(--md-tertiary)" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {numericPaths.length > 0 && (
                <div className="bg-surface rounded-xl p-5 border border-outline-variant card animate-smooth-appear">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-medium flex items-center gap-2">
                      <Database size={18} className="text-primary" />
                      自动提取的数值字段
                      <span className="text-xs text-on-surface-variant font-normal">
                        (共 {numericPaths.length} 个)
                      </span>
                    </h3>
                    {lastUpdated && (
                      <div className="text-xs text-on-surface-variant flex items-center gap-1">
                        <Clock size={12} />
                        最后更新: {new Date(lastUpdated).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {numericPaths.map((path, i) => {
                      const value = getNestedValue(rawData, path);
                      if (typeof value !== 'number') return null;
                      return (
                        <div key={i} className="bg-surface-variant rounded-lg p-4 hover:bg-outline-variant/30 transition-colors">
                          <div className="text-xs text-on-surface-variant mb-2 break-all font-mono" title={path}>
                            {path}
                          </div>
                          <div className="text-xl font-semibold text-on-surface">
                            {formatValueWithUnit(value, path)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {showConfigModal && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div
            className="modal-content modal-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-outline-variant flex items-center justify-between">
              <h2 className="text-lg font-semibold">配置数据 API</h2>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 hover:bg-surface-variant rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">启用第三方数据 API</label>
                  <div
                    className={`toggle-switch ${config.enabled ? 'active' : ''}`}
                    onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  >
                    <div className="toggle-switch-thumb" />
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant">
                  启用后将从你配置的 API 获取数据看板数据
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">使用后端代理</label>
                  <div
                    className={`toggle-switch ${config.useProxy ? 'active' : ''}`}
                    onClick={() => setConfig(prev => ({ ...prev, useProxy: !prev.useProxy }))}
                  >
                    <div className="toggle-switch-thumb" />
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant">
                  通过后端服务器转发请求，避免 CORS 跨域限制（推荐开启）
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">API URL</label>
                  <button
                    onClick={() => setShowCurlImport(!showCurlImport)}
                    className="text-xs text-primary hover:opacity-80 flex items-center gap-1"
                    disabled={!config.enabled}
                  >
                    <Terminal size={12} />
                    从 curl 导入
                  </button>
                </div>
                <input
                  type="text"
                  value={config.url}
                  onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://api.example.com/dashboard/stats"
                  disabled={!config.enabled}
                  className="w-full"
                />
              </div>

              {showCurlImport && (
                <div className="space-y-2 bg-surface-variant p-4 rounded-lg animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">粘贴 curl 命令</label>
                    <button
                      onClick={() => setShowCurlImport(false)}
                      className="p-1 hover:bg-surface rounded transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <textarea
                    value={curlInput}
                    onChange={e => setCurlInput(e.target.value)}
                    placeholder={`curl -X GET "https://api.xxx.xxx/***/***/***" \\\n  -H "Authorization: Bearer sk_xxxxxxxxxxxxxxxxxx" \\\n  -H "New-Api-User: 112233"`}
                    className="w-full font-mono text-xs"
                    rows={5}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleCurlImport}
                      className="btn-primary text-xs"
                      disabled={!curlInput.trim()}
                    >
                      解析并导入
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">请求方法</label>
                <div className="segmented-control">
                  {(['GET', 'POST', 'PUT', 'DELETE'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setConfig(prev => ({ ...prev, method: m }))}
                      className={`segmented-control-item ${config.method === m ? 'active' : ''}`}
                      disabled={!config.enabled}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">认证方式</label>
                <select
                  value={config.authType}
                  onChange={e => setConfig(prev => ({ ...prev, authType: e.target.value as any }))}
                  disabled={!config.enabled}
                  style={{ width: '100%' }}
                >
                  <option value="none">无认证</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="apikey">API Key</option>
                  <option value="custom">自定义 Header</option>
                </select>
              </div>

              {(config.authType === 'bearer' || config.authType === 'apikey' || config.authType === 'custom') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {config.authType === 'bearer' ? 'Token' : config.authType === 'apikey' ? 'API Key' : '认证值'}
                  </label>
                  <input
                    type="password"
                    value={config.authToken}
                    onChange={e => setConfig(prev => ({ ...prev, authToken: e.target.value }))}
                    placeholder="输入认证令牌"
                    disabled={!config.enabled}
                    className="w-full"
                  />
                </div>
              )}

              {config.authType === 'custom' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">自定义 Header 名称</label>
                  <input
                    type="text"
                    value={config.authHeader}
                    onChange={e => setConfig(prev => ({ ...prev, authHeader: e.target.value }))}
                    placeholder="X-Custom-Auth"
                    disabled={!config.enabled}
                    className="w-full"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">自定义请求头 (JSON)</label>
                  <div className="flex items-center gap-1">
                    <label className="p-1.5 hover:bg-surface-variant rounded-lg cursor-pointer transition-colors" title="导入">
                      <Upload size={14} />
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportHeaders}
                        className="hidden"
                        disabled={!config.enabled}
                      />
                    </label>
                    <button
                      onClick={handleExportHeaders}
                      className="p-1.5 hover:bg-surface-variant rounded-lg transition-colors"
                      title="导出"
                      disabled={!config.enabled}
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={handleCopyHeaders}
                      className="p-1.5 hover:bg-surface-variant rounded-lg transition-colors"
                      title="复制"
                      disabled={!config.enabled}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <textarea
                  value={config.headersJson}
                  onChange={e => {
                    setConfig(prev => ({ ...prev, headersJson: e.target.value }));
                    setHeadersError(null);
                  }}
                  placeholder='{{\n  "Authorization": "Bearer {{token}}",\n  "X-API-Key": "{{api_key}}"\n}}'
                  disabled={!config.enabled}
                  className="w-full font-mono text-xs"
                  rows={5}
                />
                {headersError && (
                  <p className="text-xs text-error">{headersError}</p>
                )}
                <p className="text-xs text-on-surface-variant">
                  支持变量替换，使用 {'{{变量名}}'} 格式
                </p>
              </div>

              {(config.method === 'POST' || config.method === 'PUT' || config.method === 'DELETE') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">请求体 (JSON)</label>
                  <textarea
                    value={config.bodyJson}
                    onChange={e => {
                      setConfig(prev => ({ ...prev, bodyJson: e.target.value }));
                      setBodyError(null);
                    }}
                    placeholder='{{\n  "date": "{{date}}",\n  "limit": 100\n}}'
                    disabled={!config.enabled}
                    className="w-full font-mono text-xs"
                    rows={4}
                  />
                  {bodyError && (
                    <p className="text-xs text-error">{bodyError}</p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">变量配置</label>
                  <button
                    onClick={addVariable}
                    className="text-xs text-primary hover:opacity-80 flex items-center gap-1"
                    disabled={!config.enabled}
                  >
                    <Plus size={12} />
                    添加变量
                  </button>
                </div>
                {detectedVariables.length > 0 && (
                  <p className="text-xs text-on-surface-variant">
                    检测到 {detectedVariables.length} 个变量：{detectedVariables.join(', ')}
                  </p>
                )}
                {variables.length === 0 ? (
                  <div className="text-center py-4 text-sm text-on-surface-variant bg-surface-variant rounded-lg">
                    暂无变量
                  </div>
                ) : (
                  <div className="space-y-2">
                    {variables.map(v => (
                      <div key={v.name} className="flex items-center gap-2">
                        <div className="bg-primary-container text-on-primary-container px-2 py-1 rounded text-xs font-mono flex-shrink-0">
                          {`{{${v.name}}}`}
                        </div>
                        <input
                          type="text"
                          value={v.value}
                          onChange={e => handleVariableChange(v.name, e.target.value)}
                          placeholder="输入变量值"
                          disabled={!config.enabled}
                          className="flex-1"
                        />
                        <button
                          onClick={() => removeVariable(v.name)}
                          className="p-1.5 hover:bg-error-container hover:text-error rounded-lg transition-colors"
                          disabled={!config.enabled}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-outline-variant flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-surface-variant text-on-surface rounded-full text-sm font-medium hover:bg-outline-variant/50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Check size={14} />
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function ChartCard({
  title, subtitle, icon: Icon, hasData, children,
}: {
  title: string;
  subtitle: string;
  icon: typeof BarChart3;
  hasData: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-xl p-5 border border-outline-variant card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-primary" />
          <h3 className="text-base font-medium">{title}</h3>
        </div>
        <span className="text-xs text-on-surface-variant">{subtitle}</span>
      </div>
      {hasData ? (
        <div className="h-48">
          {children}
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center">
          <EmptyState text="暂无数据" />
        </div>
      )}
    </div>
  );
}

function ChartTooltip({
  active, payload, label, valueKey, valuePrefix = '', valueSuffix = '',
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  valueKey: string;
  valuePrefix?: string;
  valueSuffix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const name = item?.payload?.name || item?.payload?.date || label || '';
  const raw = item?.payload?.[valueKey];
  const value = typeof raw === 'number' ? raw.toLocaleString() : raw;
  return (
    <div className="bg-surface border border-outline-variant rounded-lg px-3 py-2 shadow-lg">
      <div className="text-xs font-medium text-on-surface">{name}</div>
      <div className="text-sm font-semibold text-primary mt-0.5">
        {valuePrefix}{value}{valueSuffix}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center">
      <Activity size={24} className="mx-auto text-on-surface-variant opacity-40 mb-2" />
      <div className="text-sm text-on-surface-variant">{text}</div>
    </div>
  );
}

export default Dashboard;
