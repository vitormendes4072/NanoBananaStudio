// @ts-check
import fs from 'fs';
import db from './db.js';
import {
  queueStatePath,
  cutoutStatePath,
  cropStatePath,
  productModelStatePath,
  imageTemplateStatePath,
  pricingTable,
} from './config.js';

/** @typedef {import('./types.js').Job} Job */
/** @typedef {import('./types.js').Cutout} Cutout */
/** @typedef {import('./types.js').Crop} Crop */
/** @typedef {import('./types.js').ProductModel} ProductModel */
/** @typedef {import('./types.js').ImageTemplate} ImageTemplate */
/** @typedef {import('./types.js').QueueState} QueueState */

export const state = {
  activeJobIds: new Set(),
  backgroundRemovalInFlight: false,
  backgroundRemovalSourceJobId: null,

  get concurrency() {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'concurrency'").get();
    return row ? Number(row.value) : Number(process.env.QUEUE_CONCURRENCY || 2);
  },
  set concurrency(val) {
    db.prepare(
      "INSERT INTO app_settings (key, value) VALUES ('concurrency', ?) ON CONFLICT(key) DO UPDATE SET value = ?"
    ).run(val, val);
  },

  get queueState() {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'queueState'").get();
    return row ? JSON.parse(row.value) : { lastJobId: 0, lastBatchId: 0 };
  },
  set queueState(val) {
    db.prepare(
      "INSERT INTO app_settings (key, value) VALUES ('queueState', ?) ON CONFLICT(key) DO UPDATE SET value = ?"
    ).run(JSON.stringify(val), JSON.stringify(val));
  },

  get jobs() {
    return db
      .prepare('SELECT data FROM jobs ORDER BY id DESC')
      .all()
      .map((row) => JSON.parse(row.data));
  },
  get cutouts() {
    return db
      .prepare('SELECT data FROM cutouts')
      .all()
      .map((row) => JSON.parse(row.data));
  },
  get crops() {
    return db
      .prepare('SELECT data FROM crops')
      .all()
      .map((row) => JSON.parse(row.data));
  },
  get productModels() {
    return db
      .prepare('SELECT data FROM product_models')
      .all()
      .map((row) => JSON.parse(row.data));
  },
  get imageTemplates() {
    return db
      .prepare('SELECT data FROM image_templates')
      .all()
      .map((row) => JSON.parse(row.data));
  },

  get jobsById() {
    const map = new Map();
    state.jobs.forEach((j) => map.set(j.id, j));
    return map;
  },
  get cutoutsById() {
    const map = new Map();
    state.cutouts.forEach((c) => map.set(c.id, c));
    return map;
  },
  get cropsById() {
    const map = new Map();
    state.crops.forEach((c) => map.set(c.id, c));
    return map;
  },
  get productModelsByAlias() {
    const map = new Map();
    state.productModels.forEach((m) => map.set(m.alias, m));
    return map;
  },
  get imageTemplatesByAlias() {
    const map = new Map();
    state.imageTemplates.forEach((t) => map.set(t.alias, t));
    return map;
  },
};

// --- DAO Functions ---

/**
 * @param {Job} job
 */
export function saveJob(job) {
  const blob = JSON.stringify(job);
  db.prepare(
    `
    INSERT INTO jobs (id, status, created_at, model, folder, batch_id, finished_at, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status      = excluded.status,
      model       = excluded.model,
      folder      = excluded.folder,
      batch_id    = excluded.batch_id,
      finished_at = excluded.finished_at,
      data        = excluded.data
  `
  ).run(
    job.id,
    job.status,
    job.createdAt,
    job.model ?? null,
    job.targetFolder ?? null,
    job.batchId ?? null,
    job.finishedAt ?? null,
    blob
  );

  // Persist completed job cost in the ledger — survives job trim
  if (job.status === 'completed') {
    const unitCost = pricingTable[job.model] ?? 0;
    db.prepare(
      `
      INSERT INTO usage_ledger (job_id, model, estimated_cost, completed_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET
        model          = excluded.model,
        estimated_cost = excluded.estimated_cost,
        completed_at   = excluded.completed_at
    `
    ).run(job.id, job.model ?? 'unknown', unitCost, job.finishedAt ?? new Date().toISOString());
  }
}

/** @param {number} id */
export function deleteJobFromDb(id) {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
}

/**
 * @param {Cutout} cutout
 */
export function saveCutout(cutout) {
  const blob = JSON.stringify(cutout);
  db.prepare(
    `
    INSERT INTO cutouts (id, folder, created_at, source_job_id, data)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      folder        = excluded.folder,
      source_job_id = excluded.source_job_id,
      data          = excluded.data
  `
  ).run(
    cutout.id,
    cutout.folder ?? null,
    cutout.createdAt ?? new Date().toISOString(),
    cutout.sourceJobId ?? null,
    blob
  );
}

/** @param {string} id */
export function deleteCutoutFromDb(id) {
  db.prepare('DELETE FROM cutouts WHERE id = ?').run(id);
}

/**
 * @param {Crop} crop
 */
export function saveCrop(crop) {
  const blob = JSON.stringify(crop);
  db.prepare(
    `
    INSERT INTO crops (id, folder, created_at, source_job_id, data)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      folder        = excluded.folder,
      source_job_id = excluded.source_job_id,
      data          = excluded.data
  `
  ).run(
    crop.id,
    crop.folder ?? null,
    crop.createdAt ?? new Date().toISOString(),
    crop.sourceJobId ?? null,
    blob
  );
}

/** @param {string} id */
export function deleteCropFromDb(id) {
  db.prepare('DELETE FROM crops WHERE id = ?').run(id);
}

/**
 * @param {ProductModel} model
 */
export function saveProductModel(model) {
  const blob = JSON.stringify(model);
  db.prepare(
    `
    INSERT INTO product_models (alias, name, created_at, updated_at, data)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(alias) DO UPDATE SET
      name       = excluded.name,
      updated_at = excluded.updated_at,
      data       = excluded.data
  `
  ).run(model.alias, model.name ?? null, model.createdAt ?? null, model.updatedAt ?? null, blob);
}

/** @param {string} alias */
export function deleteProductModelFromDb(alias) {
  db.prepare('DELETE FROM product_models WHERE alias = ?').run(alias);
}

/**
 * @param {ImageTemplate} template
 */
export function saveImageTemplate(template) {
  const blob = JSON.stringify(template);
  db.prepare(
    `
    INSERT INTO image_templates (alias, name, created_at, updated_at, data)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(alias) DO UPDATE SET
      name       = excluded.name,
      updated_at = excluded.updated_at,
      data       = excluded.data
  `
  ).run(
    template.alias,
    template.name ?? null,
    template.createdAt ?? null,
    template.updatedAt ?? null,
    blob
  );
}

/** @param {string} alias */
export function deleteImageTemplateFromDb(alias) {
  db.prepare('DELETE FROM image_templates WHERE alias = ?').run(alias);
}

// Dummy methods to satisfy imports that might still call them directly
export function persistQueueState() {}
export function persistCutoutState() {}
export function persistCropState() {}
export function persistProductModelState() {}
export function persistImageTemplateState() {}

export async function loadState() {
  migrateFromJsonToSqlite();

  // Reset jobs stuck in processing on last crash back to queued
  db.prepare(
    "UPDATE jobs SET status = 'queued', data = json_set(data, '$.status', 'queued') WHERE status = 'processing'"
  ).run();
}

function migrateFromJsonToSqlite() {
  const isMigrated = db.prepare("SELECT value FROM app_settings WHERE key = 'migrated_json'").get();
  if (isMigrated) return;

  console.log('Iniciando migração dos arquivos JSON para o SQLite...');

  db.transaction(() => {
    try {
      if (fs.existsSync(queueStatePath)) {
        const data = JSON.parse(fs.readFileSync(queueStatePath, 'utf8'));
        state.queueState = { lastJobId: data.lastJobId || 0, lastBatchId: data.lastBatchId || 0 };
        if (data.jobs && Array.isArray(data.jobs)) {
          data.jobs.forEach((job) => saveJob(job));
        }
      }

      if (fs.existsSync(cutoutStatePath)) {
        const data = JSON.parse(fs.readFileSync(cutoutStatePath, 'utf8'));
        if (data.cutouts && Array.isArray(data.cutouts)) {
          data.cutouts.forEach((c) => saveCutout(c));
        }
      }

      if (fs.existsSync(cropStatePath)) {
        const data = JSON.parse(fs.readFileSync(cropStatePath, 'utf8'));
        if (data.crops && Array.isArray(data.crops)) {
          data.crops.forEach((c) => saveCrop(c));
        }
      }

      if (fs.existsSync(productModelStatePath)) {
        const data = JSON.parse(fs.readFileSync(productModelStatePath, 'utf8'));
        if (data.productModels && Array.isArray(data.productModels)) {
          data.productModels.forEach((m) => saveProductModel(m));
        }
      }

      if (fs.existsSync(imageTemplateStatePath)) {
        const data = JSON.parse(fs.readFileSync(imageTemplateStatePath, 'utf8'));
        if (data.imageTemplates && Array.isArray(data.imageTemplates)) {
          data.imageTemplates.forEach((t) => saveImageTemplate(t));
        }
      }

      db.prepare("INSERT INTO app_settings (key, value) VALUES ('migrated_json', 'true')").run();
      console.log('Migração concluída com sucesso!');
    } catch (e) {
      console.error('Erro durante a migração:', e);
    }
  })();
}
