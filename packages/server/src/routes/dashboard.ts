import { Router } from 'express';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth';
import { runQuery } from '../services/db';

const router = Router();

async function safeFetch(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'OxygenClaw/1.0',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        status: response.status
      };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return { success: true, data };
    } else {
      const text = await response.text();
      return { success: true, data: text, raw: true };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
      status: 0
    };
  }
}

router.get('/sync', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { url, token } = req.query as { url: string; token?: string };

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Data source URL is required'
      });
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const result = await safeFetch(url, { headers });

    if (!result.success) {
      return res.json({
        success: false,
        error: result.error,
        fallback: true,
        data: generateFallbackStats()
      });
    }

    const mappedData = mapDashboardData(result.data);

    res.json({
      success: true,
      data: mappedData
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message,
      fallback: true,
      data: generateFallbackStats()
    });
  }
});

router.get('/stats', optionalAuth, (req: AuthRequest, res) => {
  const userId = req.userId;

  if (!userId) {
    const emptyData = {
      account: { balance: 0, historicalUsage: [] },
      usage: { totalRequests: 0, todayRequests: 0, requestsByDay: [] },
      resources: { totalTokens: { input: 0, output: 0 }, todayTokens: { input: 0, output: 0 }, tokensByDay: [] },
      performance: { avgRPM: 0, avgTPM: 0, peakTPS: 0, peakConcurrency: 0 },
      tasks: { total: 0, completed: 0 },
      modelAnalysis: { consumptionByModel: [], callDistribution: [], callRanking: [] }
    };
    return res.json({
      success: true,
      data: {
        ...emptyData,
        totalRequests: 0, totalTokens: 0, balance: 0, todayCost: 0, monthCost: 0,
        avgRpm: 0, avgTpm: 0, peakTps: 0, peakConcurrency: 0, successCount: 0, failedCount: 0,
        modelStats: [], dailyStats: []
      }
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const todayStats = runQuery(
    'SELECT SUM(requests) as requests, SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens, SUM(cost) as cost FROM usage_stats WHERE user_id = ? AND date = ?',
    [userId, today]
  )[0] as any;

  const totalStats = runQuery(
    'SELECT SUM(requests) as requests, SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens, SUM(cost) as cost FROM usage_stats WHERE user_id = ? AND date >= ?',
    [userId, thirtyDaysAgo]
  )[0] as any;

  const dailyStats = runQuery(
    'SELECT date, SUM(requests) as requests, SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens, SUM(cost) as cost FROM usage_stats WHERE user_id = ? AND date >= ? GROUP BY date ORDER BY date',
    [userId, thirtyDaysAgo]
  ) as any[];

  const modelStats = runQuery(
    'SELECT model, SUM(requests) as requests, SUM(cost) as cost FROM usage_stats WHERE user_id = ? AND date >= ? GROUP BY model ORDER BY requests DESC',
    [userId, thirtyDaysAgo]
  ) as any[];

  const tasksCount = runQuery(
    'SELECT COUNT(*) as count FROM agent_tasks WHERE user_id = ?',
    [userId]
  )[0] as any;

  const completedTasks = runQuery(
    'SELECT COUNT(*) as count FROM agent_tasks WHERE user_id = ? AND status = ?',
    [userId, 'completed']
  )[0] as any;

  const nestedData = {
    account: {
      balance: 0,
      historicalUsage: dailyStats.map((d: any) => ({
        date: new Date(d.date).getTime(),
        cost: d.cost || 0
      }))
    },
    usage: {
      totalRequests: totalStats?.requests || 0,
      todayRequests: todayStats?.requests || 0,
      requestsByDay: dailyStats.map((d: any) => ({
        date: new Date(d.date).getTime(),
        count: d.requests || 0
      }))
    },
    resources: {
      totalTokens: {
        input: totalStats?.inputTokens || 0,
        output: totalStats?.outputTokens || 0
      },
      todayTokens: {
        input: todayStats?.inputTokens || 0,
        output: todayStats?.outputTokens || 0
      },
      tokensByDay: dailyStats.map((d: any) => ({
        date: new Date(d.date).getTime(),
        input: d.inputTokens || 0,
        output: d.outputTokens || 0
      }))
    },
    performance: {
      avgRPM: 0,
      avgTPM: 0,
      peakTPS: 0,
      peakConcurrency: 0
    },
    tasks: {
      total: tasksCount?.count || 0,
      completed: completedTasks?.count || 0
    },
    modelAnalysis: {
      consumptionByModel: modelStats.map((m: any) => ({
        model: m.model,
        cost: m.cost || 0
      })),
      callDistribution: modelStats.map((m: any) => ({
        model: m.model,
        percentage: totalStats?.requests ? (m.requests / totalStats.requests) * 100 : 0
      })),
      callRanking: modelStats.map((m: any) => ({
        model: m.model,
        calls: m.requests || 0
      }))
    }
  };

  res.json({
    success: true,
    data: {
      ...nestedData,
      // Flat compat layer for legacy frontend
      totalRequests: nestedData.usage.totalRequests,
      totalTokens: (nestedData.resources.totalTokens.input || 0) + (nestedData.resources.totalTokens.output || 0),
      balance: nestedData.account.balance,
      todayCost: todayStats?.cost || 0,
      monthCost: totalStats?.cost || 0,
      avgRpm: nestedData.performance.avgRPM,
      avgTpm: nestedData.performance.avgTPM,
      peakTps: nestedData.performance.peakTPS,
      peakConcurrency: nestedData.performance.peakConcurrency,
      successCount: nestedData.usage.totalRequests,
      failedCount: 0,
      modelStats: modelStats.map((m: any) => ({ model: m.model, requests: m.requests || 0, cost: m.cost || 0 })),
      dailyStats: dailyStats.map((d: any) => ({ date: d.date, requests: d.requests || 0, cost: d.cost || 0 }))
    }
  });
});

function generateFallbackStats() {
  const days = 30;
  const dailyData = [];
  const now = Date.now();

  for (let i = days - 1; i >= 0; i--) {
    const date = now - i * 24 * 60 * 60 * 1000;
    dailyData.push({
      date,
      requests: Math.floor(Math.random() * 100),
      inputTokens: Math.floor(Math.random() * 50000),
      outputTokens: Math.floor(Math.random() * 30000),
      cost: Math.random() * 2
    });
  }

  return {
    account: {
      balance: 0,
      historicalUsage: dailyData.map(d => ({ date: d.date, cost: d.cost }))
    },
    usage: {
      totalRequests: dailyData.reduce((sum, d) => sum + d.requests, 0),
      requestsByDay: dailyData.map(d => ({ date: d.date, count: d.requests }))
    },
    resources: {
      totalTokens: {
        input: dailyData.reduce((sum, d) => sum + d.inputTokens, 0),
        output: dailyData.reduce((sum, d) => sum + d.outputTokens, 0)
      },
      tokensByDay: dailyData.map(d => ({ date: d.date, input: d.inputTokens, output: d.outputTokens }))
    },
    performance: {
      avgRPM: 0,
      avgTPM: 0,
      peakTPS: 0,
      peakConcurrency: 0
    },
    modelAnalysis: {
      consumptionByModel: [],
      callTrendByModel: [],
      callDistribution: [],
      callRanking: []
    }
  };
}

function mapDashboardData(rawData: any): any {
  if (typeof rawData === 'string') {
    return generateFallbackStats();
  }

  return {
    account: {
      balance: rawData.balance || rawData.account?.balance || 0,
      historicalUsage: rawData.historicalUsage || rawData.costHistory || []
    },
    usage: {
      totalRequests: rawData.totalRequests || rawData.requestCount || 0,
      requestsByDay: rawData.requestsByDay || rawData.dailyRequests || []
    },
    resources: {
      totalTokens: {
        input: rawData.totalTokens?.input || rawData.inputTokens || 0,
        output: rawData.totalTokens?.output || rawData.outputTokens || 0
      },
      tokensByDay: rawData.tokensByDay || rawData.dailyTokens || []
    },
    performance: {
      avgRPM: rawData.avgRPM || rawData.rpm || 0,
      avgTPM: rawData.avgTPM || rawData.tpm || 0,
      peakTPS: rawData.peakTPS || 0,
      peakConcurrency: rawData.peakConcurrency || 0
    },
    modelAnalysis: {
      consumptionByModel: rawData.consumptionByModel || rawData.modelCosts || [],
      callDistribution: rawData.callDistribution || rawData.modelDistribution || [],
      callRanking: rawData.callRanking || rawData.modelRanking || []
    }
  };
}

export default router;
