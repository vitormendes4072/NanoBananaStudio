import { pricingTable } from './config.js';

function getVersion(db) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'schema_version'").get();
  return row ? Number(row.value) : 0;
}

function setVersion(db, v) {
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(String(v));
}

function addColumnIfMissing(db, table, column, type) {
  const exists = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
  if (!exists) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  }
}

function migration_v1(db) {
  db.transaction(() => {
    addColumnIfMissing(db, 'jobs', 'model', 'TEXT');
    addColumnIfMissing(db, 'jobs', 'folder', 'TEXT');
    addColumnIfMissing(db, 'jobs', 'batch_id', 'TEXT');
    addColumnIfMissing(db, 'jobs', 'finished_at', 'TEXT');

    addColumnIfMissing(db, 'cutouts', 'folder', 'TEXT');
    addColumnIfMissing(db, 'cutouts', 'created_at', 'TEXT');
    addColumnIfMissing(db, 'cutouts', 'source_job_id', 'TEXT');

    addColumnIfMissing(db, 'crops', 'folder', 'TEXT');
    addColumnIfMissing(db, 'crops', 'created_at', 'TEXT');
    addColumnIfMissing(db, 'crops', 'source_job_id', 'TEXT');

    addColumnIfMissing(db, 'product_models', 'name', 'TEXT');
    addColumnIfMissing(db, 'product_models', 'created_at', 'TEXT');
    addColumnIfMissing(db, 'product_models', 'updated_at', 'TEXT');

    addColumnIfMissing(db, 'image_templates', 'name', 'TEXT');
    addColumnIfMissing(db, 'image_templates', 'created_at', 'TEXT');
    addColumnIfMissing(db, 'image_templates', 'updated_at', 'TEXT');

    // Backfill existing rows from JSON blobs
    db.prepare(
      `
      UPDATE jobs SET
        model       = json_extract(data, '$.model'),
        folder      = json_extract(data, '$.targetFolder'),
        batch_id    = json_extract(data, '$.batchId'),
        finished_at = json_extract(data, '$.finishedAt')
      WHERE model IS NULL
    `
    ).run();

    db.prepare(
      `
      UPDATE cutouts SET
        folder        = json_extract(data, '$.folder'),
        source_job_id = json_extract(data, '$.sourceJobId')
      WHERE folder IS NULL
    `
    ).run();

    db.prepare(
      `
      UPDATE crops SET
        folder        = json_extract(data, '$.folder'),
        source_job_id = json_extract(data, '$.sourceJobId')
      WHERE folder IS NULL
    `
    ).run();

    db.prepare(
      `
      UPDATE product_models SET
        name       = json_extract(data, '$.name'),
        created_at = json_extract(data, '$.createdAt'),
        updated_at = json_extract(data, '$.updatedAt')
      WHERE name IS NULL
    `
    ).run();

    db.prepare(
      `
      UPDATE image_templates SET
        name       = json_extract(data, '$.name'),
        created_at = json_extract(data, '$.createdAt'),
        updated_at = json_extract(data, '$.updatedAt')
      WHERE name IS NULL
    `
    ).run();

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_model       ON jobs(model);
      CREATE INDEX IF NOT EXISTS idx_jobs_folder      ON jobs(folder);
      CREATE INDEX IF NOT EXISTS idx_jobs_finished_at ON jobs(finished_at);
      CREATE INDEX IF NOT EXISTS idx_cutouts_folder   ON cutouts(folder);
      CREATE INDEX IF NOT EXISTS idx_crops_folder     ON crops(folder);
      CREATE INDEX IF NOT EXISTS idx_product_models_name    ON product_models(name);
      CREATE INDEX IF NOT EXISTS idx_image_templates_name   ON image_templates(name);
    `);

    setVersion(db, 1);
  })();
}

function migration_v2(db) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS usage_ledger (
        job_id      TEXT PRIMARY KEY,
        model       TEXT NOT NULL,
        estimated_cost REAL NOT NULL DEFAULT 0,
        completed_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_usage_ledger_completed_at ON usage_ledger(completed_at);
    `);

    // Backfill from completed jobs still present in the jobs table
    const completedJobs = db
      .prepare("SELECT id, model, finished_at, created_at FROM jobs WHERE status = 'completed'")
      .all();

    const insert = db.prepare(`
      INSERT OR IGNORE INTO usage_ledger (job_id, model, estimated_cost, completed_at)
      VALUES (?, ?, ?, ?)
    `);

    for (const row of completedJobs) {
      const unitCost = pricingTable[row.model] ?? 0;
      const completedAt = row.finished_at || row.created_at || new Date().toISOString();
      insert.run(row.id, row.model || 'unknown', unitCost, completedAt);
    }

    setVersion(db, 2);
  })();
}

function migration_v3(db) {
  db.transaction(() => {
    addColumnIfMissing(db, 'jobs', 'comparison_id', 'TEXT');

    // Backfill from JSON blob (will be null for jobs created before this feature)
    db.prepare(
      `
      UPDATE jobs SET
        comparison_id = json_extract(data, '$.comparisonId')
      WHERE comparison_id IS NULL
    `
    ).run();

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_comparison_id ON jobs(comparison_id);
    `);

    setVersion(db, 3);
  })();
}

export function runMigrations(db) {
  const version = getVersion(db);
  if (version < 1) migration_v1(db);
  if (version < 2) migration_v2(db);
  if (version < 3) migration_v3(db);
}
