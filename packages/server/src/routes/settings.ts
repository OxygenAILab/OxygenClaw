import { Router } from 'express';
import crypto from 'crypto';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth';
import { runQuery, runExec } from '../services/db';

const router = Router();

const DEFAULT_SETTINGS = {
  theme: 'system',
  language: 'zh',
  fontSize: 'normal',
  sidebarDensity: 'normal',
  showMessageTime: 1,
  showAvatar: 1,
  animations: 1,
  reduceMotion: 0,
  showSidebar: 1,
  sidebarIconSize: 'medium',
  sidebarPosition: 'left',
  zoomLevel: '100',
  defaultModel: null,
  defaultMode: 'chat',
  defaultCapability: 'fast',
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  autoScroll: 1,
  autoSaveDraft: 1,
  streamOutput: 1,
  showThinking: 1,
  notificationsEnabled: 0,
  soundEnabled: 0,
  taskRemindersEnabled: 0,
  dndEnabled: 0,
  dndStart: '22:00',
  dndEnd: '08:00',
  workspaceDir: null,
  autoStart: 0,
  startMinimized: 0,
  disableGpuAccel: 0,
  hotkey: 'Ctrl+F12',
  maxCacheSize: 1024,
  dataSourceUrl: null,
  dataSourceEnabled: 0,
  visionApiKey: null,
  visionBaseUrl: 'https://api.stepfun.com/step_plan/v1',
  visionModel: 'step-3.7-flash',
  visionEnabled: 0,
  asrApiKey: null,
  asrBaseUrl: null,
  asrModel: 'stepaudio-2.5-asr',
  asrEnabled: 0,
  ttsApiKey: null,
  ttsBaseUrl: null,
  ttsModel: 'stepaudio-2.5-tts',
  ttsVoice: null,
  ttsSpeed: 1,
  ttsEnabled: 0,
  voiceInputEnabled: 0,
  voiceOutputEnabled: 0,
  imageGenApiKey: null,
  imageGenBaseUrl: null,
  imageGenModel: null,
  imageGenDefaultModel: null,
  imageGenDefaultSize: '1024x1024',
  imageGenDefaultQuality: 'standard',
  imageGenDefaultSteps: 20,
  imageGenDefaultCfgScale: 7.5,
  imageGenSaveHistory: 1,
  imageGenEnabled: 0,
  dashboardApiUrl: null,
  dashboardApiKey: null,
  dashboardApiEnabled: 0,
  dashboardApiUseProxy: 1,
  directModelAccess: 0,
};

const FIELD_MAP: Record<string, string> = {
  theme: 'theme',
  language: 'language',
  fontSize: 'font_size',
  sidebarDensity: 'sidebar_density',
  showMessageTime: 'show_message_time',
  showAvatar: 'show_avatar',
  animations: 'animations',
  reduceMotion: 'reduce_motion',
  showSidebar: 'show_sidebar',
  sidebarIconSize: 'sidebar_icon_size',
  sidebarPosition: 'sidebar_position',
  zoomLevel: 'zoom_level',
  defaultModel: 'default_model',
  defaultMode: 'default_mode',
  defaultCapability: 'default_capability',
  temperature: 'temperature',
  maxTokens: 'max_tokens',
  topP: 'top_p',
  autoScroll: 'auto_scroll',
  autoSaveDraft: 'auto_save_draft',
  streamOutput: 'stream_output',
  showThinking: 'show_thinking',
  notificationsEnabled: 'notifications_enabled',
  soundEnabled: 'sound_enabled',
  taskRemindersEnabled: 'task_reminders_enabled',
  dndEnabled: 'dnd_enabled',
  dndStart: 'dnd_start',
  dndEnd: 'dnd_end',
  workspaceDir: 'workspace_dir',
  autoStart: 'auto_start',
  startMinimized: 'start_minimized',
  disableGpuAccel: 'disable_gpu_accel',
  hotkey: 'hotkey',
  maxCacheSize: 'max_cache_size',
  dataSourceUrl: 'data_source_url',
  dataSourceEnabled: 'data_source_enabled',
  visionApiKey: 'vision_api_key',
  visionBaseUrl: 'vision_base_url',
  visionModel: 'vision_model',
  visionEnabled: 'vision_enabled',
  asrApiKey: 'asr_api_key',
  asrBaseUrl: 'asr_base_url',
  asrModel: 'asr_model',
  asrEnabled: 'asr_enabled',
  ttsApiKey: 'tts_api_key',
  ttsBaseUrl: 'tts_base_url',
  ttsModel: 'tts_model',
  ttsVoice: 'tts_voice',
  ttsSpeed: 'tts_speed',
  ttsEnabled: 'tts_enabled',
  voiceInputEnabled: 'voice_input_enabled',
  voiceOutputEnabled: 'voice_output_enabled',
  imageGenApiKey: 'image_gen_api_key',
  imageGenBaseUrl: 'image_gen_base_url',
  imageGenModel: 'image_gen_model',
  imageGenDefaultModel: 'image_gen_model',
  imageGenDefaultSize: 'image_gen_default_size',
  imageGenDefaultQuality: 'image_gen_default_quality',
  imageGenDefaultSteps: 'image_gen_default_steps',
  imageGenDefaultCfgScale: 'image_gen_default_cfg_scale',
  imageGenSaveHistory: 'image_gen_save_history',
  imageGenEnabled: 'image_gen_enabled',
  dashboardApiUrl: 'dashboard_api_url',
  dashboardApiKey: 'dashboard_api_key',
  dashboardApiEnabled: 'dashboard_api_enabled',
  dashboardApiUseProxy: 'dashboard_api_use_proxy',
  directModelAccess: 'direct_model_access',
};

const BOOLEAN_FIELDS = new Set([
  'notificationsEnabled',
  'soundEnabled',
  'taskRemindersEnabled',
  'showMessageTime',
  'showAvatar',
  'animations',
  'reduceMotion',
  'showSidebar',
  'autoScroll',
  'autoSaveDraft',
  'streamOutput',
  'showThinking',
  'dndEnabled',
  'autoStart',
  'startMinimized',
  'disableGpuAccel',
  'dataSourceEnabled',
  'visionEnabled',
  'asrEnabled',
  'ttsEnabled',
  'voiceInputEnabled',
  'voiceOutputEnabled',
  'imageGenEnabled',
  'imageGenSaveHistory',
  'dashboardApiEnabled',
  'dashboardApiUseProxy',
  'directModelAccess',
]);

const SENSITIVE_FIELDS = new Set(['visionApiKey', 'asrApiKey', 'ttsApiKey', 'imageGenApiKey', 'dashboardApiKey']);
const NUMBER_FIELDS = new Set(['temperature', 'maxTokens', 'topP', 'ttsSpeed', 'imageGenDefaultSteps', 'imageGenDefaultCfgScale', 'maxCacheSize']);
const EXTERNAL_FIELDS = new Set(['theme', 'uiTheme', 'materialSeed', 'language']);
const SELECT_OPTIONS: Record<string, any[]> = {
  fontSize: ['small', 'normal', 'large', 'xlarge'],
  sidebarDensity: ['compact', 'normal', 'comfortable'],
  sidebarIconSize: ['small', 'medium', 'large'],
  sidebarPosition: ['left', 'right'],
  zoomLevel: ['75', '90', '100', '110', '125', '150'],
  defaultMode: ['chat', 'task'],
  defaultCapability: ['fast', 'think', 'expert', 'research', 'moa'],
  imageGenDefaultSize: ['512x512', '1024x1024', '1024x1792', '1792x1024'],
  imageGenDefaultQuality: ['standard', 'hd'],
};
const NUMBER_RANGES: Record<string, { min: number; max: number }> = {
  temperature: { min: 0, max: 2 },
  maxTokens: { min: 1, max: 100000 },
  topP: { min: 0, max: 1 },
  ttsSpeed: { min: 0.5, max: 2 },
  imageGenDefaultSteps: { min: 1, max: 50 },
  imageGenDefaultCfgScale: { min: 1, max: 20 },
  maxCacheSize: { min: 128, max: 102400 },
};

function camelToSnake(camel: string): string {
  return FIELD_MAP[camel] || camel.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(snake: string): string {
  const reverseMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(FIELD_MAP)) {
    reverseMap[v] = k;
  }
  return reverseMap[snake] || snake.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    const normalizedValue = SENSITIVE_FIELDS.has(camelKey) ? decryptSettingValue(value) : value;
    result[camelKey] = BOOLEAN_FIELDS.has(camelKey) ? normalizedValue === 1 || normalizedValue === true : normalizedValue;
  }
  return result;
}

function normalizeSettings(settings: Record<string, any>) {
  const normalized = { ...settings };
  if (!normalized.imageGenModel && normalized.imageGenDefaultModel) {
    normalized.imageGenModel = normalized.imageGenDefaultModel;
  }
  if (!normalized.imageGenDefaultModel && normalized.imageGenModel) {
    normalized.imageGenDefaultModel = normalized.imageGenModel;
  }
  for (const field of BOOLEAN_FIELDS) {
    if (field in normalized) {
      normalized[field] = normalized[field] === 1 || normalized[field] === true;
    }
  }
  return normalized;
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(process.env.SETTINGS_ENCRYPTION_KEY || 'oxygen-claw-local-settings-key').digest();
}

function encryptSettingValue(value: any) {
  if (value === null || value === undefined || value === '' || typeof value !== 'string') return value;
  if (value.startsWith('encrypted:aes256-gcm:')) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `encrypted:aes256-gcm:${Buffer.concat([iv, tag, encrypted]).toString('base64')}`;
}

function decryptSettingValue(value: any) {
  if (typeof value !== 'string' || !value.startsWith('encrypted:aes256-gcm:')) return value;
  try {
    const payload = Buffer.from(value.replace('encrypted:aes256-gcm:', ''), 'base64');
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function maskSettingValue(value: any) {
  if (!value || typeof value !== 'string') return value;
  return value.length <= 4 ? '********' : `********${value.slice(-4)}`;
}

function maskSensitiveSettings(settings: Record<string, any>) {
  const masked = { ...settings };
  for (const field of SENSITIVE_FIELDS) {
    if (field in masked) {
      masked[field] = maskSettingValue(masked[field]);
    }
  }
  return masked;
}

function coerceAndValidateSetting(field: string, value: any) {
  if (EXTERNAL_FIELDS.has(field)) return { skip: true, value: undefined };
  if (!(field in FIELD_MAP)) throw new Error(`Unknown setting field: ${field}`);

  if (BOOLEAN_FIELDS.has(field)) {
    if (typeof value !== 'boolean') throw new Error(`${field} must be boolean`);
    return { skip: false, value: value ? 1 : 0 };
  }

  if (NUMBER_FIELDS.has(field)) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) throw new Error(`${field} must be number`);
    const range = NUMBER_RANGES[field];
    if (range && (numberValue < range.min || numberValue > range.max)) {
      throw new Error(`${field} must be between ${range.min} and ${range.max}`);
    }
    return { skip: false, value: numberValue };
  }

  if (SELECT_OPTIONS[field] && !SELECT_OPTIONS[field].includes(value)) {
    throw new Error(`${field} must be one of: ${SELECT_OPTIONS[field].join(', ')}`);
  }

  if ((field.endsWith('BaseUrl') || field === 'dashboardApiUrl') && value) {
    try {
      new URL(value);
    } catch {
      throw new Error(`${field} must be a valid URL`);
    }
  }

  if ((field === 'dndStart' || field === 'dndEnd') && value && !/^\d{2}:\d{2}$/.test(String(value))) {
    throw new Error(`${field} must be HH:mm`);
  }

  if (SENSITIVE_FIELDS.has(field)) {
    if (typeof value === 'string' && /^\*{8}/.test(value)) return { skip: true, value: undefined };
    return { skip: false, value: encryptSettingValue(value) };
  }

  return { skip: false, value };
}

function getSettings(userId?: string) {
  const defaults = { ...DEFAULT_SETTINGS };

  if (!userId) {
    return normalizeSettings(defaults);
  }

  const settings = runQuery('SELECT * FROM settings WHERE user_id = ?', [userId])[0] as Record<string, any>;

  if (!settings) {
    return normalizeSettings(defaults);
  }

  const camelSettings = toCamelCase(settings);
  return normalizeSettings({ ...defaults, ...camelSettings });
}

function ensureTableColumns() {
  const columns = Object.entries(FIELD_MAP)
    .filter(([field]) => !EXTERNAL_FIELDS.has(field))
    .map(([field, column]) => {
      const defaultValue = (DEFAULT_SETTINGS as any)[field];
      if (BOOLEAN_FIELDS.has(field)) return [column, `INTEGER DEFAULT ${defaultValue ? 1 : 0}`];
      if (NUMBER_FIELDS.has(field)) return [column, typeof defaultValue === 'number' ? `REAL DEFAULT ${defaultValue}` : 'REAL'];
      if (typeof defaultValue === 'string') return [column, `TEXT DEFAULT '${defaultValue.replace(/'/g, "''")}'`];
      return [column, 'TEXT'];
    });

  for (const [col, type] of columns) {
    try {
      runExec(`ALTER TABLE settings ADD COLUMN ${col} ${type}`);
    } catch {
    }
  }
}

router.get('/', optionalAuth, (req: AuthRequest, res) => {
  try {
    ensureTableColumns();
    const settings = getSettings(req.userId);

    res.json({
      success: true,
      data: maskSensitiveSettings(settings),
    });
  } catch (error: any) {
    console.error('[Settings] Get error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get settings',
    });
  }
});

router.get('/schema', optionalAuth, (_req: AuthRequest, res) => {
  res.json({
    success: true,
    data: {
      version: 1,
      fields: Object.keys(FIELD_MAP).filter(field => !EXTERNAL_FIELDS.has(field)),
      externalFields: Array.from(EXTERNAL_FIELDS),
      sensitiveFields: Array.from(SENSITIVE_FIELDS),
      booleanFields: Array.from(BOOLEAN_FIELDS),
      numberFields: Array.from(NUMBER_FIELDS),
      selectOptions: SELECT_OPTIONS,
      numberRanges: NUMBER_RANGES,
    },
  });
});

router.put('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    ensureTableColumns();
    const userId = req.userId || null;
    const updateData = req.body as Record<string, any>;

    const setClauses: string[] = [];
    const values: any[] = [];

    try {
      for (const camelField of Object.keys(updateData)) {
        if (EXTERNAL_FIELDS.has(camelField)) continue;
        const snakeField = camelToSnake(camelField);
        const coerced = coerceAndValidateSetting(camelField, updateData[camelField]);
        if (coerced.skip) continue;
        setClauses.push(`${snakeField} = ?`);
        values.push(coerced.value);
      }
    } catch (error: any) {
      return res.status(400).json({ success: false, error: `Validation failed: ${error.message}` });
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      });
    }

    let existing;
    if (userId) {
      existing = runQuery('SELECT user_id FROM settings WHERE user_id = ?', [userId])[0];
    } else {
      existing = runQuery('SELECT user_id FROM settings WHERE user_id IS NULL')[0];
    }

    if (existing) {
      if (userId) {
        values.push(userId);
        runExec(`UPDATE settings SET ${setClauses.join(', ')} WHERE user_id = ?`, values);
      } else {
        runExec(`UPDATE settings SET ${setClauses.join(', ')} WHERE user_id IS NULL`, values);
      }
    } else {
      const insertSnakeFields = setClauses.map(c => c.split(' = ')[0]);
      const insertValues = [...values];
      const placeholders = insertSnakeFields.map(() => '?').join(', ');
      runExec(
        `INSERT INTO settings (user_id, ${insertSnakeFields.join(', ')}) VALUES (?, ${placeholders})`,
        [userId, ...insertValues]
      );
    }

    const updatedSettings = getSettings(userId || undefined);

    res.json({
      success: true,
      data: maskSensitiveSettings(updatedSettings),
    });
  } catch (error: any) {
    console.error('[Settings] Update error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update settings',
    });
  }
});

export default router;
