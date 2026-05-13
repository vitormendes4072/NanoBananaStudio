import fs from "fs";
import db from "./db.js";
import { 
  queueStatePath, cutoutStatePath, cropStatePath, 
  productModelStatePath, imageTemplateStatePath 
} from "./config.js";

export const state = {
  activeJobIds: new Set(),
  backgroundRemovalInFlight: false,
  backgroundRemovalSourceJobId: null,
  
  get concurrency() {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'concurrency'").get();
    return row ? Number(row.value) : Number(process.env.QUEUE_CONCURRENCY || 2);
  },
  set concurrency(val) {
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('concurrency', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(val, val);
  },

  get queueState() {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'queueState'").get();
    return row ? JSON.parse(row.value) : { lastJobId: 0, lastBatchId: 0 };
  },
  set queueState(val) {
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('queueState', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(JSON.stringify(val), JSON.stringify(val));
  },

  get jobs() {
    return db.prepare("SELECT data FROM jobs ORDER BY id DESC").all().map(row => JSON.parse(row.data));
  },
  get cutouts() {
    return db.prepare("SELECT data FROM cutouts").all().map(row => JSON.parse(row.data));
  },
  get crops() {
    return db.prepare("SELECT data FROM crops").all().map(row => JSON.parse(row.data));
  },
  get productModels() {
    return db.prepare("SELECT data FROM product_models").all().map(row => JSON.parse(row.data));
  },
  get imageTemplates() {
    return db.prepare("SELECT data FROM image_templates").all().map(row => JSON.parse(row.data));
  },

  get jobsById() {
    const map = new Map();
    state.jobs.forEach(j => map.set(j.id, j));
    return map;
  },
  get cutoutsById() {
    const map = new Map();
    state.cutouts.forEach(c => map.set(c.id, c));
    return map;
  },
  get cropsById() {
    const map = new Map();
    state.crops.forEach(c => map.set(c.id, c));
    return map;
  },
  get productModelsByAlias() {
    const map = new Map();
    state.productModels.forEach(m => map.set(m.alias, m));
    return map;
  },
  get imageTemplatesByAlias() {
    const map = new Map();
    state.imageTemplates.forEach(t => map.set(t.alias, t));
    return map;
  }
};

// --- DAO Functions ---

export function saveJob(job) {
  db.prepare("INSERT INTO jobs (id, status, created_at, data) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = ?, data = ?").run(
    job.id, job.status, job.createdAt, JSON.stringify(job),
    job.status, JSON.stringify(job)
  );
}

export function deleteJobFromDb(id) {
  db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
}

export function saveCutout(cutout) {
  db.prepare("INSERT INTO cutouts (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = ?").run(cutout.id, JSON.stringify(cutout), JSON.stringify(cutout));
}

export function deleteCutoutFromDb(id) {
  db.prepare("DELETE FROM cutouts WHERE id = ?").run(id);
}

export function saveCrop(crop) {
  db.prepare("INSERT INTO crops (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = ?").run(crop.id, JSON.stringify(crop), JSON.stringify(crop));
}

export function deleteCropFromDb(id) {
  db.prepare("DELETE FROM crops WHERE id = ?").run(id);
}

export function saveProductModel(model) {
  db.prepare("INSERT INTO product_models (alias, data) VALUES (?, ?) ON CONFLICT(alias) DO UPDATE SET data = ?").run(model.alias, JSON.stringify(model), JSON.stringify(model));
}

export function deleteProductModelFromDb(alias) {
  db.prepare("DELETE FROM product_models WHERE alias = ?").run(alias);
}

export function saveImageTemplate(template) {
  db.prepare("INSERT INTO image_templates (alias, data) VALUES (?, ?) ON CONFLICT(alias) DO UPDATE SET data = ?").run(template.alias, JSON.stringify(template), JSON.stringify(template));
}

export function deleteImageTemplateFromDb(alias) {
  db.prepare("DELETE FROM image_templates WHERE alias = ?").run(alias);
}

// Dummy methods to satisfy imports that might still call them directly
export function persistQueueState() {}
export function persistCutoutState() {}
export function persistCropState() {}
export function persistProductModelState() {}
export function persistImageTemplateState() {}

export async function loadState() {
  migrateFromJsonToSqlite();
  
  // Revert any jobs left in "processing" to "pending"
  db.prepare("UPDATE jobs SET status = 'pending' WHERE status = 'processing' OR status = 'queued'").run();
}

function migrateFromJsonToSqlite() {
  const isMigrated = db.prepare("SELECT value FROM app_settings WHERE key = 'migrated_json'").get();
  if (isMigrated) return;

  console.log("Iniciando migração dos arquivos JSON para o SQLite...");

  db.transaction(() => {
    try {
      if (fs.existsSync(queueStatePath)) {
        const data = JSON.parse(fs.readFileSync(queueStatePath, "utf8"));
        state.queueState = { lastJobId: data.lastJobId || 0, lastBatchId: data.lastBatchId || 0 };
        if (data.jobs && Array.isArray(data.jobs)) {
          data.jobs.forEach(job => saveJob(job));
        }
      }

      if (fs.existsSync(cutoutStatePath)) {
        const data = JSON.parse(fs.readFileSync(cutoutStatePath, "utf8"));
        if (data.cutouts && Array.isArray(data.cutouts)) {
          data.cutouts.forEach(c => saveCutout(c));
        }
      }

      if (fs.existsSync(cropStatePath)) {
        const data = JSON.parse(fs.readFileSync(cropStatePath, "utf8"));
        if (data.crops && Array.isArray(data.crops)) {
          data.crops.forEach(c => saveCrop(c));
        }
      }

      if (fs.existsSync(productModelStatePath)) {
        const data = JSON.parse(fs.readFileSync(productModelStatePath, "utf8"));
        if (data.productModels && Array.isArray(data.productModels)) {
          data.productModels.forEach(m => saveProductModel(m));
        }
      }

      if (fs.existsSync(imageTemplateStatePath)) {
        const data = JSON.parse(fs.readFileSync(imageTemplateStatePath, "utf8"));
        if (data.imageTemplates && Array.isArray(data.imageTemplates)) {
          data.imageTemplates.forEach(t => saveImageTemplate(t));
        }
      }

      db.prepare("INSERT INTO app_settings (key, value) VALUES ('migrated_json', 'true')").run();
      console.log("Migração concluída com sucesso!");
    } catch (e) {
      console.error("Erro durante a migração:", e);
    }
  })();
}
