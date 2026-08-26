/**
 * NewAPI (one-api/new-api) 数据源适配器
 *
 * 对接 NewAPI v1.0.0-rc.24 的 JWT Bearer 鉴权与统计端点，
 * 将其响应聚合为 DashboardStats 形状供 Dashboard 消费。
 *
 * 鉴权流程：POST /api/user/login → data.access_token → Authorization: Bearer
 * 凭据格式（authToken 字段）：`username:password` 自动登录，或直接填 access_token
 *
 * 所有请求经 proxyApi（后端转发）以规避浏览器 CORS。
 */

import { proxyApi, DashboardStats } from './api';

export interface NewApiCollectResult {
  success: boolean;
  stats?: DashboardStats;
  error?: string;
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

/** NewAPI quota 计数 → 美元（默认 500000 quota = $1，可在站点 options 配置） */
const QUOTA_PER_USD = 500000;

const todayStartTs = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
};

export const newapiApi = {
  /**
   * 凭据（authToken）支持三种格式：
   *   1. "username:password"      → 自动登录换取 JWT
   *   2. "userId:accessToken"     → 系统访问令牌 + New-Api-User 头（userId 为纯数字）
   *   3. 纯 token                 → 直接 Bearer（JWT 或系统令牌均可）
   * 容错：自动 trim、剥离 "Bearer " 前缀。
   */
  async collect(
    baseUrl: string,
    credential: string,
    varMap: Record<string, string> = {}
  ): Promise<NewApiCollectResult> {
    const base = baseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
    let token = (credential || '').trim();
    let apiUser: string | null = null;

    const proxyJson = async (
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

    // 剥离可能的 Bearer 前缀与空白
    token = token.replace(/^Bearer\s+/i, '').trim();

    if (token.includes(':')) {
      const first = token.indexOf(':');
      const left = token.slice(0, first).trim();
      const right = token.slice(first + 1).trim();
      if (/^\d+$/.test(left)) {
        // userId:accessToken —— 系统访问令牌模式
        apiUser = left;
        token = right;
      } else {
        // username:password —— 登录换取 JWT
        try {
          const r = await proxyJson('POST', '/api/user/login', { username: left, password: right });
          if (!r.json?.success || !r.json?.data?.access_token) {
            return { success: false, error: `NewAPI 登录失败 (HTTP ${r.status}): ${r.json?.message || '响应缺少 access_token'}` };
          }
          token = r.json.data.access_token;
        } catch (e: any) {
          return { success: false, error: `NewAPI 登录请求失败: ${e?.message || e}` };
        }
      }
    }
    token = token.replace(/\$\{([^}]+)\}/g, (_m, k) => varMap[k] ?? '');
    if (!token) {
      return { success: false, error: 'NewAPI 凭据为空' };
    }

    try {
      const [selfR, statR, logsR] = await Promise.all([
        proxyJson('GET', '/api/user/self', undefined, token).catch(e => ({ ok: false, status: 0, json: null, _e: e })),
        proxyJson('GET', '/api/log/self/stat', undefined, token).catch(e => ({ ok: false, status: 0, json: null, _e: e })),
        proxyJson('GET', '/api/log/self?type=2&page_size=300&p=1', undefined, token).catch(e => ({ ok: false, status: 0, json: null, _e: e })),
      ]);

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

      const logs = logsR.json;
      const items: NewApiLogItem[] = logs?.success ? logs.data?.items || [] : [];
      if (items.length > 0) {
        let prompt = 0;
        let completion = 0;
        let todayCount = 0;
        let todayCost = 0;
        const byModel = new Map<string, { requests: number; cost: number }>();
        const byDay = new Map<string, { requests: number; cost: number }>();

        for (const it of items) {
          prompt += it.prompt_tokens || 0;
          completion += it.completion_tokens || 0;
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

        stats.totalTokens = prompt + completion;
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

      return { success: true, stats };
    } catch (e: any) {
      return { success: false, error: `NewAPI 数据拉取失败: ${e?.message || e}` };
    }
  },
};
