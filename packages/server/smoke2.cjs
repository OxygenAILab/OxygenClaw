// Runtime smoke test for the UNIQUE index migration on runtime_events(task_id, seq).
// Runs against a COPY of the real DB so the live DB is never touched.
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'data', 'oxygenclaw.db');
const work = path.join(process.cwd(), 'data', '_smoke2.db');

// Fresh copy each run.
for (const ext of ['', '-wal', '-shm']) {
  try { fs.unlinkSync(work + ext); } catch {}
}
fs.copyFileSync(src, work);

const db = new Database(work);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Replicate the migration logic from db.ts (ensureRuntimeEventsUniqueSeq) ---
function indexInfo(name) {
  return db.prepare(`PRAGMA index_list(runtime_events)`).all()
    .find(i => i.name === name);
}

const before = indexInfo('idx_runtime_events_task_seq');
console.log('before migration:', JSON.stringify(before));

// Dedup any existing (task_id, seq) collisions, keeping the earliest rowid.
const dupes = db.prepare(`
  SELECT task_id, seq, COUNT(*) c FROM runtime_events
  GROUP BY task_id, seq HAVING c > 1
`).all();
console.log('pre-existing duplicate (task_id,seq) groups:', dupes.length);

const migrate = db.transaction(() => {
  db.exec('DROP INDEX IF EXISTS idx_runtime_events_task_seq');
  db.exec(`
    DELETE FROM runtime_events
    WHERE rowid NOT IN (
      SELECT MIN(rowid) FROM runtime_events GROUP BY task_id, seq
    )
  `);
  db.exec('CREATE UNIQUE INDEX idx_runtime_events_task_seq ON runtime_events(task_id, seq)');
});
migrate();

const after = indexInfo('idx_runtime_events_task_seq');
console.log('after migration:', JSON.stringify(after));

// Now prove the unique constraint actually rejects a duplicate seq.
const row = db.prepare('SELECT task_id, seq FROM runtime_events LIMIT 1').get();
let rejected = false;
if (row) {
  try {
    db.prepare(`INSERT INTO runtime_events (id, task_id, seq, type, payload, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run('dup-test-id', row.task_id, row.seq, 'step', '{}', Date.now());
  } catch (e) {
    rejected = /UNIQUE/i.test(String(e.message));
  }
}

console.log('unique index in place:', after && after.unique === 1);
console.log('duplicate seq rejected:', rejected);

db.close();
for (const ext of ['', '-wal', '-shm']) {
  try { fs.unlinkSync(work + ext); } catch {}
}

if (after && after.unique === 1 && (row ? rejected : true)) {
  console.log('SMOKE2 OK');
} else {
  console.log('SMOKE2 FAIL');
  process.exit(1);
}
