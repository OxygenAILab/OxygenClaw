/**
 * NewAPI (one-api/new-api) 数据源适配器
 *
 * 对接 NewAPI v1.0.0-rc.24 的 JWT Bearer 鉴权与统计端点。
 * 所有请求经 proxyApi（后端转发）以规避浏览器 CORS。
 *
 * 凭据（credential）支持三种格式：
 *   1. "username:password"      → 自动登录换取 JWT
 *   2. "userId:accessToken"     → 系统访问令牌 + New-Api-User 头（userId 为纯数字）
 *   3. 纯 token                 → 直接 Bearer（JWT 或系统令牌均可）
 *
 * 已知限制：
 * - 格式 1 的密码不能含冒号（首个冒号视为分隔符）；含冒号的密码请使用系统令牌
 * - quota→美元换算系数硬编码 500000（NewAPI 站点可在 options 中自定义）
 * - 凭据以明文存于 localStorage（oxygenclaw:newapi-conn）——本地单机工具可接受，
 *   若未来多用户/远程部署必须迁移到服务端加密存储
 */

import { proxyApi, DashboardStats } from './api';

export interface NewApiCollectResult {
  success: boolean;
  stats?: DashboardStats;
  error?: string;
}

export interface NewApiModelsResult {
  success: boolean;
  models?: string[];
  error?: string;
}

interface ResolvedCredential {
  token: string;
  apiUser: string | null;
}

interface NewApiLogItem {
  created_at: number;
  type: number;
  model_name: string;
  quota: number;
  prompt_tokens: number;
  completion_tokens: number;
  use_time?: number;
  is_stream?: boolean;
}

/** /api/data/self 聚合行（按 模型×天 预聚合，全历史精确值） */
interface NewApiQuotaDataItem {
  model_name: string;
  created_at: number; // 天粒度时间戳
  count: number;      // 请求数
  quota: number;      // 消耗
  token_used?: number;
}

/** NewAPI quota 计数 → 美元（默认 500000 quota = $1） */
const QUOTA_PER_USD = 500000;

const todayStartTs = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
};

function normalizeBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
}

/** 经 proxyJson 的 JSON 请求器工厂 */
function makeRequester(base: string, apiUser: string | null) {
  return async (
    method: 'GET' | 'POST',
    ep: string,
    body?: any,
    auth?: string
  ): Promise<{ ok: boolean; status: number; json: any }> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth) {
      headers['Authorization'] = `Bearer ${auth}`;
      if (apiUser) headers['New-Api-User'] = apiUser;
    }
    const res = await proxyApi.request({
      url: `${base}${ep}`,
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.success || !res.data) {
      throw new Error(res.error || '代理请求失败');
    }
    let json: any = null;
    const rawBody: any = res.data.body;
    if (typeof rawBody === 'string') {
      try { json = JSON.parse(rawBody); } catch { json = null; }
    } else if (rawBody && typeof rawBody === 'object') {
      json = rawBody; // proxy 服务端已解析过 JSON
    }
    return { ok: res.data.status >= 200 && res.data.status < 300, status: res.data.status, json };
  };
}

/** 解析凭据 → 可用的 token（纯 token 直接返回；user:pass 走登录） */
async function resolveCredential(base: string, credential: string): Promise<ResolvedCredential> {
  // 中文输入法容错：全角冒号→半角、全角空格→半角、去首尾空白
  let token = (credential || '')
    .replace(/：/g, ':')
    .replace(/\u3000/g, ' ')
    .trim();
  token = token.replace(/^Bearer\s+/i, '').trim();

  if (!token.includes(':')) {
    return { token, apiUser: null };
  }

  const first = token.indexOf(':');
  const left = token.slice(0, first).trim();
  const right = token.slice(first + 1).trim();

  if (/^\d+$/.test(left)) {
    // userId:accessToken —— 系统访问令牌
    return { token: right, apiUser: left };
  }

  // username:password —— 登录换 JWT
  const post = makeRequester(base, null);
  const r = await post('POST', '/api/user/login', { username: left, password: right });
  if (!r.json?.success || !r.json?.data?.access_token) {
    throw new Error(`NewAPI 登录失败 (HTTP ${r.status}): ${r.json?.message || '响应缺少 access_token'}`);
  }
  return { token: r.json.data.access_token, apiUser: null };
}

export const newapiApi = {
  resolveCredential,

  /** 拉取当前账号可用的模型列表（/api/user/models） */
  async listModels(baseUrl: string, credential: string): Promise<NewApiModelsResult> {
    const base = normalizeBase(baseUrl);
    try {
      const { token, apiUser } = await resolveCredential(base, credential);
      const get = makeRequester(base, apiUser);
      const r = await get('GET', '/api/user/models', undefined, token);
      if (!r.json?.success || !Array.isArray(r.json.data)) {
        return { success: false, error: `拉取模型失败 (HTTP ${r.status}): ${r.json?.message || '响应格式异常'}` };
      }
      return { success: true, models: r.json.data as string[] };
    } catch (e: any) {
      return { success: false, error: `NewAPI 请求失败: ${e?.message || e}` };
    }
  },

  /** 聚合统计 → DashboardStats */
  async collect(
    baseUrl: string,
    credential: string,
    varMap: Record<string, string> = {}
  ): Promise<NewApiCollectResult> {
    const base = normalizeBase(baseUrl);
    try {
      const { token: rawToken, apiUser } = await resolveCredential(base, credential);
      const token = rawToken.replace(/\$\{([^}]+)\}/g, (_m, k) => varMap[k] ?? '');
      if (!token) return { success: false, error: 'NewAPI 凭据为空' };

      const get = makeRequester(base, apiUser);
      const endpointFailures: string[] = [];
      const safeGet = async (ep: string) => {
        try {
          const r = await get('GET', ep, undefined, token);
          // 业务失败（HTTP 错误或 success:false）同样计入失败——
          // 401/令牌失效等若不在此暴露，会伪装成"成功但无数据"
          if (!r.ok || r.json?.success === false) {
            const reason = r.json?.message || `HTTP ${r.status}`;
            endpointFailures.push(`${ep}: ${reason}`);
            console.warn(`[newapi] endpoint business-failed: ${ep}`, reason);
            return { ok: false, status: r.status, json: null };
          }
          return r;
        } catch (e: any) {
          endpointFailures.push(`${ep}: ${e?.message || e}`);
          console.warn(`[newapi] endpoint failed: ${ep}`, e?.message || e);
          return { ok: false, status: 0, json: null };
        }
      };

      const [selfR, statR, logsR, quotaDataR] = await Promise.all([
        safeGet('/api/user/self'),
        safeGet('/api/log/self/stat'),
        safeGet('/api/log/self?type=2&page_size=300&p=1'),
        // 预聚合的每日配额（全历史精确值；窗口上限 30 天，取最近 30 天）
        safeGet(`/api/data/self?start_timestamp=${Math.floor(Date.now() / 1000) - 30 * 86400}&end_timestamp=${Math.floor(Date.now() / 1000)}`),
      ]);

      // 三个核心端点失败 → 视为整体失败，而非返回空数据假装成功
      // （quota_data 是增强端点，失败不致命）
      if (endpointFailures.length >= 3 && !quotaDataR.json?.success) {
        return { success: false, error: `NewAPI 全部端点失败: ${endpointFailures.join('; ')}` };
      }

      const stats: DashboardStats = {};
      const today = todayStartTs();

      const self = selfR.json;
      if (self?.success && self.data) {
        stats.balance = (self.data.quota || 0) / QUOTA_PER_USD;
        stats.totalRequests = self.data.request_count || undefined;
      }

      const stat = statR.json;
      if (stat?.success && stat.data) {
        stats.avgRpm = stat.data.rpm ?? 0;
        stats.avgTpm = stat.data.tpm ?? 0;
        if (!stats.balance) stats.balance = (stat.data.quota || 0) / QUOTA_PER_USD;
      }

      // ── 优先使用预聚合的 quota_data（全历史精确值，按 模型×天）──
      const qd = quotaDataR.json;
      const qdItems: NewApiQuotaDataItem[] = qd?.success ? (Array.isArray(qd.data) ? qd.data : qd.data?.items || []) : [];
      if (qdItems.length > 0) {
        let totalCost = 0;
        let totalReq = 0;
        const byModel = new Map<string, { requests: number; cost: number }>();
        const byDay = new Map<string, { requests: number; cost: number }>();
        for (const it of qdItems) {
          const cost = (it.quota || 0) / QUOTA_PER_USD;
          totalCost += cost;
          totalReq += it.count || 0;
          const mn = it.model_name || 'unknown';
          const bm = byModel.get(mn) || { requests: 0, cost: 0 };
          bm.requests += it.count || 0;
          bm.cost += cost;
          byModel.set(mn, bm);
          const day = new Date(it.created_at * 1000).toISOString().slice(0, 10);
          const bd = byDay.get(day) || { requests: 0, cost: 0 };
          bd.requests += it.count || 0;
          bd.cost += cost;
          byDay.set(day, bd);
        }
        stats.monthCost = totalCost;
        stats.modelStats = [...byModel.entries()]
          .map(([model, v]) => ({ model, requests: v.requests, cost: v.cost }))
          .sort((a, b) => b.requests - a.requests)
          .slice(0, 10);
        stats.dailyStats = [...byDay.entries()]
          .map(([date, v]) => ({ date, requests: v.requests, cost: v.cost }))
          .sort((a, b) => a.date.localeCompare(b.date));
        // today 指标也用聚合数据（当日行存在时）
        const todayKey = new Date().toISOString().slice(0, 10);
        const todayRow = stats.dailyStats?.find(d => d.date === todayKey);
        if (todayRow) {
          stats.todayCost = todayRow.cost;
          stats.todayRequests = todayRow.requests;
        }
      }

      // ── 日志端点补充 token 数（quota_data 不含 token 拆分）与兜底 ──
      const logs = logsR.json;
      const items: NewApiLogItem[] = logs?.success ? logs.data?.items || [] : [];
      if (items.length > 0) {
        let prompt = 0;
        let completion = 0;
        for (const it of items) {
          prompt += it.prompt_tokens || 0;
          completion += it.completion_tokens || 0;
        }
        if (!stats.totalTokens) stats.totalTokens = prompt + completion;
        // 若 quota_data 不可用，退回日志估算（原逻辑）
        if (qdItems.length === 0) {
          let todayCount = 0;
          let todayCost = 0;
          const byModel = new Map<string, { requests: number; cost: number }>();
          const byDay = new Map<string, { requests: number; cost: number }>();
          for (const it of items) {
            const cost = (it.quota || 0) / QUOTA_PER_USD;
            if (it.created_at >= today) {
              todayCount += 1;
              todayCost += cost;
            }
            const mn = it.model_name || 'unknown';
            const bm = byModel.get(mn) || { requests: 0, cost: 0 };
            bm.requests += 1;
            bm.cost += cost;
            byModel.set(mn, bm);
            const day = new Date(it.created_at * 1000).toISOString().slice(0, 10);
            const bd = byDay.get(day) || { requests: 0, cost: 0 };
            bd.requests += 1;
            bd.cost += cost;
            byDay.set(day, bd);
          }
          stats.todayCost = todayCost;
          stats.todayRequests = todayCount;
          stats.modelStats = [...byModel.entries()]
            .map(([model, v]) => ({ model, requests: v.requests, cost: v.cost }))
            .sort((a, b) => b.requests - a.requests)
            .slice(0, 10);
          stats.dailyStats = [...byDay.entries()]
            .map(([date, v]) => ({ date, requests: v.requests, cost: v.cost }))
            .sort((a, b) => a.date.localeCompare(b.date));
        }
      }

      return { success: true, stats };
    } catch (e: any) {
      return { success: false, error: `NewAPI 数据拉取失败: ${e?.message || e}` };
    }
  },
};
