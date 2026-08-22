import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;
let dbPath: string = '';

/**
 * Normalize JS parameter values for better-sqlite3 binding.
 *
 * better-sqlite3 is stricter than sql.js: it throws on JS booleans and
 * `undefined`. sql.js used to silently coerce these. To keep every existing
 * call site working without edits, we coerce here at the single choke point:
 *   - boolean            -> 1 / 0
 *   - undefined          -> null
 *   - Date               -> epoch millis
 * Everything else (number, string, bigint, null, Buffer) passes through.
 */
function normalizeParams(params: any[]): any[] {
  return params.map((value) => {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === undefined) return null;
    if (value instanceof Date) return value.getTime();
    return value;
  });
}

export async function initDB(): Promise<void> {
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbPath = path.join(dataDir, 'oxygenclaw.db');

  // better-sqlite3 opens (and creates if missing) a real on-disk SQLite file.
  // Existing sql.js-written databases are standard SQLite format and load as-is.
  db = new Database(dbPath);

  // Real WAL now (sql.js ignored this PRAGMA because it was pure in-memory).
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // Reasonable durability/perf tradeoff for a local desktop app.
  db.pragma('synchronous = NORMAL');

  createTables();
  console.log('✅ Database initialized at', dbPath);
}

function createTables(): void {
  if (!db) return;

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      oxygen_id TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS model_providers (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      api_key TEXT NOT NULL,
      base_url TEXT NOT NULL,
      billing_multiplier REAL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      name TEXT NOT NULL,
      display_name TEXT,
      enabled INTEGER DEFAULT 1,
      supports_vision INTEGER DEFAULT 0,
      supports_files INTEGER DEFAULT 0,
      supports_tools INTEGER DEFAULT 0,
      supports_image_generation INTEGER DEFAULT 0,
      capabilities TEXT,
      modality TEXT DEFAULT 'text',
      context_window INTEGER,
      max_output INTEGER,
      cost_per_1k_input REAL DEFAULT 0,
      cost_per_1k_output REAL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (provider_id) REFERENCES model_providers(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      mode TEXT NOT NULL,
      capability TEXT NOT NULL,
      model_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS agent_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      conversation_id TEXT,
      prompt TEXT NOT NULL,
      mode TEXT NOT NULL,
      capability TEXT NOT NULL,
      model_id TEXT,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      steps TEXT,
      tokens_used INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS runtime_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      conversation_id TEXT,
      kind TEXT NOT NULL,
      prompt TEXT NOT NULL,
      mode TEXT NOT NULL,
      capability TEXT NOT NULL,
      model_id TEXT,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      cancelled_at INTEGER,
      metadata TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS runtime_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES runtime_tasks(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS worker_runs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      worker_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      heartbeat_at INTEGER,
      completed_at INTEGER,
      exit_reason TEXT,
      metadata TEXT,
      FOREIGN KEY (task_id) REFERENCES runtime_tasks(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS usage_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      date TEXT NOT NULL,
      requests INTEGER DEFAULT 0,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      model TEXT,
      operation_type TEXT DEFAULT 'chat',
      provider_id TEXT,
      image_count INTEGER DEFAULT 0,
      resolution TEXT,
      latency_ms INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT PRIMARY KEY,
      theme TEXT DEFAULT 'system',
      default_model TEXT,
      default_mode TEXT DEFAULT 'chat',
      default_capability TEXT DEFAULT 'fast',
      workspace_dir TEXT,
      auto_start INTEGER DEFAULT 0,
      disable_gpu_accel INTEGER DEFAULT 0,
      hotkey TEXT DEFAULT 'Ctrl+F12',
      data_source_url TEXT,
      data_source_enabled INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS mcp_agents (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      agent_type TEXT NOT NULL DEFAULT 'sub-agent',
      main_agent_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      config TEXT,
      last_seen_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS mcp_tasks (
      id TEXT PRIMARY KEY,
      main_agent_id TEXT NOT NULL,
      sub_agent_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      input_data TEXT,
      output_data TEXT,
      result_path TEXT,
      deliverable_note TEXT,
      assigned_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      conversation_id TEXT,
      task_id TEXT,
      message_id TEXT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER DEFAULT 0,
      url TEXT,
      storage_path TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
      FOREIGN KEY (task_id) REFERENCES runtime_tasks(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS installed_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      skill_id TEXT NOT NULL,
      installed_at TEXT NOT NULL,
      UNIQUE(user_id, skill_id)
    )`,
  ];

  for (const table of tables) {
    db.exec(table);
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON agent_tasks(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_runtime_tasks_user ON runtime_tasks(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_runtime_tasks_status ON runtime_tasks(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_worker_runs_task ON worker_runs(task_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_usage_stats_date ON usage_stats(date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_artifacts_task ON artifacts(task_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_artifacts_conversation ON artifacts(conversation_id)');

  ensureUniqueRuntimeEventSeqIndex();
  migrateSettingsTable();
  migrateModelsTable();
  migrateUsageStatsTable();
}

/**
 * Ensure runtime_events has a UNIQUE index on (task_id, seq).
 *
 * The old sql.js schema created this index as NON-unique. A plain
 * `CREATE UNIQUE INDEX IF NOT EXISTS` with the same name is silently skipped
 * when a same-named index already exists, so the uniqueness backstop never
 * took effect on migrated databases. Here we detect the existing index, drop
 * it if it isn't unique, de-duplicate any offending rows, then rebuild it as
 * UNIQUE. Idempotent: on a fresh db it just creates the unique index.
 */
function ensureUniqueRuntimeEventSeqIndex(): void {
  if (!db) return;

  const indexes = db.prepare(`PRAGMA index_list(runtime_events)`).all() as Array<{
    name: string;
    unique: number;
  }>;
  const existing = indexes.find((idx) => idx.name === 'idx_runtime_events_task_seq');

  if (existing && existing.unique === 1) {
    return; // already correct
  }

  if (existing) {
    db.exec('DROP INDEX idx_runtime_events_task_seq');
  }

  // De-duplicate any pre-existing (task_id, seq) collisions before enforcing
  // uniqueness, otherwise the CREATE UNIQUE INDEX would fail. Keep the earliest
  // row (min rowid) for each pair and drop the rest.
  const dupes = db.prepare(
    `SELECT COUNT(*) as n FROM (
       SELECT task_id, seq FROM runtime_events GROUP BY task_id, seq HAVING COUNT(*) > 1
     )`
  ).get() as { n: number };

  if (dupes.n > 0) {
    db.exec(
      `DELETE FROM runtime_events
       WHERE rowid NOT IN (
         SELECT MIN(rowid) FROM runtime_events GROUP BY task_id, seq
       )`
    );
    console.log(`Deduplicated runtime_events: removed ${dupes.n} colliding (task_id, seq) group(s)`);
  }

  db.exec('CREATE UNIQUE INDEX idx_runtime_events_task_seq ON runtime_events(task_id, seq)');
  console.log('Rebuilt idx_runtime_events_task_seq as UNIQUE');
}

function addColumns(table: string, columns: Array<{ name: string; type: string }>): void {
  if (!db) return;
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const columnNames = existing.map((col) => col.name);
  for (const col of columns) {
    if (!columnNames.includes(col.name)) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`);
        console.log(`Added column ${col.name} to ${table} table`);
      } catch (err) {
        console.error(`Failed to add column ${col.name} to ${table}:`, err);
      }
    }
  }
}

function migrateSettingsTable(): void {
  if (!db) return;

  const newColumns = [
    { name: 'language', type: "TEXT DEFAULT 'zh'" },
    { name: 'font_size', type: "TEXT DEFAULT 'normal'" },
    { name: 'temperature', type: 'REAL DEFAULT 0.7' },
    { name: 'max_tokens', type: 'INTEGER DEFAULT 4096' },
    { name: 'notifications_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'sound_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'task_reminders_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'vision_api_key', type: 'TEXT' },
    { name: 'vision_base_url', type: "TEXT DEFAULT 'https://api.stepfun.com/step_plan/v1'" },
    { name: 'vision_model', type: "TEXT DEFAULT 'step-3.7-flash'" },
    { name: 'vision_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'asr_api_key', type: 'TEXT' },
    { name: 'asr_base_url', type: 'TEXT' },
    { name: 'asr_model', type: "TEXT DEFAULT 'stepaudio-2.5-asr'" },
    { name: 'asr_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'tts_api_key', type: 'TEXT' },
    { name: 'tts_base_url', type: 'TEXT' },
    { name: 'tts_model', type: "TEXT DEFAULT 'stepaudio-2.5-tts'" },
    { name: 'tts_voice', type: 'TEXT' },
    { name: 'tts_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'voice_input_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'voice_output_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'sidebar_density', type: "TEXT DEFAULT 'normal'" },
    { name: 'show_message_time', type: 'INTEGER DEFAULT 1' },
    { name: 'show_avatar', type: 'INTEGER DEFAULT 1' },
    { name: 'animations', type: 'INTEGER DEFAULT 1' },
    { name: 'reduce_motion', type: 'INTEGER DEFAULT 0' },
    { name: 'show_sidebar', type: 'INTEGER DEFAULT 1' },
    { name: 'sidebar_icon_size', type: "TEXT DEFAULT 'medium'" },
    { name: 'sidebar_position', type: "TEXT DEFAULT 'left'" },
    { name: 'zoom_level', type: "TEXT DEFAULT '100'" },
    { name: 'top_p', type: 'REAL DEFAULT 1' },
    { name: 'auto_scroll', type: 'INTEGER DEFAULT 1' },
    { name: 'auto_save_draft', type: 'INTEGER DEFAULT 1' },
    { name: 'stream_output', type: 'INTEGER DEFAULT 1' },
    { name: 'show_thinking', type: 'INTEGER DEFAULT 1' },
    { name: 'dnd_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'dnd_start', type: "TEXT DEFAULT '22:00'" },
    { name: 'dnd_end', type: "TEXT DEFAULT '08:00'" },
    { name: 'start_minimized', type: 'INTEGER DEFAULT 0' },
    { name: 'max_cache_size', type: 'REAL DEFAULT 1024' },
    { name: 'tts_speed', type: 'REAL DEFAULT 1' },
    { name: 'image_gen_api_key', type: 'TEXT' },
    { name: 'image_gen_base_url', type: 'TEXT' },
    { name: 'image_gen_model', type: 'TEXT' },
    { name: 'image_gen_default_size', type: "TEXT DEFAULT '1024x1024'" },
    { name: 'image_gen_default_quality', type: "TEXT DEFAULT 'standard'" },
    { name: 'image_gen_default_steps', type: 'REAL DEFAULT 20' },
    { name: 'image_gen_default_cfg_scale', type: 'REAL DEFAULT 7.5' },
    { name: 'image_gen_save_history', type: 'INTEGER DEFAULT 1' },
    { name: 'image_gen_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'dashboard_api_url', type: 'TEXT' },
    { name: 'dashboard_api_key', type: 'TEXT' },
    { name: 'dashboard_api_enabled', type: 'INTEGER DEFAULT 0' },
    { name: 'dashboard_api_use_proxy', type: 'INTEGER DEFAULT 1' },
    { name: 'direct_model_access', type: 'INTEGER DEFAULT 0' },
  ];

  addColumns('settings', newColumns);
}

function migrateModelsTable(): void {
  addColumns('models', [
    { name: 'supports_image_generation', type: 'INTEGER DEFAULT 0' },
    { name: 'capabilities', type: 'TEXT' },
    { name: 'modality', type: "TEXT DEFAULT 'text'" },
  ]);
}

function migrateUsageStatsTable(): void {
  addColumns('usage_stats', [
    { name: 'operation_type', type: "TEXT DEFAULT 'chat'" },
    { name: 'provider_id', type: 'TEXT' },
    { name: 'image_count', type: 'INTEGER DEFAULT 0' },
    { name: 'resolution', type: 'TEXT' },
    { name: 'latency_ms', type: 'INTEGER' },
    { name: 'audio_seconds', type: 'REAL DEFAULT 0' },
    { name: 'video_frames', type: 'INTEGER DEFAULT 0' },
    { name: 'character_count', type: 'INTEGER DEFAULT 0' },
  ]);
}

export function getDB(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
}

/**
 * Run a SELECT query and return all rows as plain objects.
 * Signature-compatible with the previous sql.js implementation.
 */
export function runQuery(sql: string, params: any[] = []): any[] {
  const database = getDB();
  const stmt = database.prepare(sql);
  return stmt.all(...normalizeParams(params));
}

/**
 * Run a write statement (INSERT/UPDATE/DELETE/DDL).
 * Signature-compatible with the previous sql.js implementation.
 * Unlike sql.js, better-sqlite3 writes straight to disk — no manual flush.
 */
export function runExec(sql: string, params: any[] = []): void {
  const database = getDB();
  database.prepare(sql).run(...normalizeParams(params));
}

/**
 * Run an INSERT and return the last inserted rowid.
 * Signature-compatible with the previous sql.js implementation.
 */
export function runInsert(sql: string, params: any[] = []): number {
  const database = getDB();
  const info = database.prepare(sql).run(...normalizeParams(params));
  return Number(info.lastInsertRowid) || 0;
}

/**
 * Run a function inside a synchronous transaction. All writes commit
 * atomically, or roll back together on throw. Used to make multi-statement
 * operations (e.g. event seq allocation) race-free.
 */
export function runTransaction<T>(fn: () => T): T {
  const database = getDB();
  return database.transaction(fn)();
}

/**
 * Kept for API compatibility. better-sqlite3 persists on every write, so this
 * is a no-op. A checkpoint is issued to flush the WAL to the main db file.
 */
export function persistDB(): void {
  if (!db) return;
  try {
    db.pragma('wal_checkpoint(PASSIVE)');
  } catch (err) {
    console.error('Failed to checkpoint database:', err);
  }
}

export function closeDB(): void {
  if (db) {
    db.close();
    db = null;
  }
}
