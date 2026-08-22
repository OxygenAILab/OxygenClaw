import { Router, Request } from 'express';
import { authMiddleware, AuthRequest, optionalAuth } from '../middleware/auth';
import { runQuery } from '../services/db';

const router = Router();

const OPENCLAWMP_BASE = 'https://openclawmp.stepfun.com';

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
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status
      };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return { success: true, data, contentType };
    } else {
      const text = await response.text();
      return { success: true, data: text, contentType };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
      status: 0
    };
  }
}

function getInstalledSkillIds(userId?: string): Set<string> {
  if (!userId) return new Set();
  const rows = runQuery('SELECT skill_id FROM installed_skills WHERE user_id = ?', [userId]) as any[];
  return new Set(rows.map(r => r.skill_id));
}

function normalizeSkills(data: any, installedIds: Set<string>): any[] {
  let skills: any[] = [];
  if (Array.isArray(data)) {
    skills = data;
  } else if (data && Array.isArray(data.skills)) {
    skills = data.skills;
  } else if (data && data.data && Array.isArray(data.data)) {
    skills = data.data;
  }
  return skills.map(s => ({ ...s, installed: installedIds.has(s.id) }));
}

router.get('/skills', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const category = req.query.category as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await safeFetch(
      `${OPENCLAWMP_BASE}/api/skills/search?q=&category=${encodeURIComponent(category || '')}&page=${page}&limit=${limit}`
    );

    if (!result.success) {
      return res.json({
        success: false,
        error: result.error,
        fallback: true,
        data: []
      });
    }

    const installedIds = getInstalledSkillIds(req.userId);
    const normalized = normalizeSkills(result.data, installedIds);

    res.json({
      success: true,
      data: normalized
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message,
      fallback: true,
      data: []
    });
  }
});

router.get('/search', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const query = req.query.q as string;
    const category = req.query.category as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await safeFetch(
      `${OPENCLAWMP_BASE}/api/skills/search?q=${encodeURIComponent(query || '')}&category=${encodeURIComponent(category || '')}&page=${page}&limit=${limit}`
    );

    if (!result.success) {
      return res.json({
        success: false,
        error: result.error,
        fallback: true,
        data: []
      });
    }

    const installedIds = getInstalledSkillIds(req.userId);
    const normalized = normalizeSkills(result.data, installedIds);

    res.json({
      success: true,
      data: normalized
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message,
      fallback: true,
      data: []
    });
  }
});

async function getSkillById(req: AuthRequest, res: any) {
  try {
    const skillId = req.params.id;
    const result = await safeFetch(`${OPENCLAWMP_BASE}/api/skills/${skillId}`);

    if (!result.success) {
      return res.json({
        success: false,
        error: result.error,
        fallback: true,
        data: null
      });
    }

    const installedIds = getInstalledSkillIds(req.userId);
    const skill = result.data as any;
    if (skill && skill.id) {
      skill.installed = installedIds.has(skill.id);
    }

    res.json({
      success: true,
      data: skill
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message,
      fallback: true,
      data: null
    });
  }
}

router.get('/skill/:id', optionalAuth, getSkillById);
router.get('/skills/:id', optionalAuth, getSkillById);

router.get('/asset/:id', async (req, res) => {
  try {
    const assetId = req.params.id;
    const result = await safeFetch(`${OPENCLAWMP_BASE}/asset/${assetId}`);

    if (!result.success) {
      return res.json({
        success: false,
        error: result.error,
        fallback: true
      });
    }

    res.json({
      success: true,
      data: result.data,
      contentType: result.contentType
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message,
      fallback: true
    });
  }
});

router.get('/categories', async (_req, res) => {
  try {
    const result = await safeFetch(`${OPENCLAWMP_BASE}/api/categories`);

    if (!result.success) {
      return res.json({
        success: false,
        error: result.error,
        fallback: true,
        data: {
          categories: [
            { id: 'all', name: '全部', icon: 'grid' },
            { id: 'productivity', name: '效率工具', icon: 'zap' },
            { id: 'research', name: '研究分析', icon: 'search' },
            { id: 'creative', name: '创意写作', icon: 'pen-tool' },
            { id: 'coding', name: '编程开发', icon: 'code' },
            { id: 'data', name: '数据处理', icon: 'bar-chart' }
          ]
        }
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message,
      fallback: true,
      data: { categories: [] }
    });
  }
});

router.post('/install', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { skillId } = req.body;
    const userId = req.userId;

    if (!skillId) {
      return res.status(400).json({
        success: false,
        error: 'Skill ID is required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const now = new Date().toISOString();
    runQuery(
      'INSERT OR IGNORE INTO installed_skills (user_id, skill_id, installed_at) VALUES (?, ?, ?)',
      [userId, skillId, now]
    );

    res.json({
      success: true,
      data: {
        message: 'Skill installed successfully',
        skillId,
        status: 'installed'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Installation failed'
    });
  }
});

router.get('/proxy', async (req: Request, res) => {
  try {
    const url = req.query.url as string;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required'
      });
    }

    let targetUrl: string;
    if (url.startsWith('/')) {
      targetUrl = `${OPENCLAWMP_BASE}${url}`;
    } else if (url.startsWith(OPENCLAWMP_BASE)) {
      targetUrl = url;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL'
      });
    }

    const result = await safeFetch(targetUrl);

    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Proxy request failed'
    });
  }
});

export default router;
