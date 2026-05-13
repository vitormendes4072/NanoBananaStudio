import Database from 'better-sqlite3';
import path from 'path';
import { dataDir } from './config.js';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'database.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

// Ativa Write-Ahead Logging para melhor performance de concorrência
const journalMode = process.env.DATABASE_JOURNAL_MODE || 'WAL';
db.pragma(`journal_mode = ${journalMode}`);

// Esquema de tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    status TEXT,
    created_at TEXT,
    data TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

  CREATE TABLE IF NOT EXISTS cutouts (
    id TEXT PRIMARY KEY,
    data TEXT
  );

  CREATE TABLE IF NOT EXISTS crops (
    id TEXT PRIMARY KEY,
    data TEXT
  );

  CREATE TABLE IF NOT EXISTS product_models (
    alias TEXT PRIMARY KEY,
    data TEXT
  );

  CREATE TABLE IF NOT EXISTS image_templates (
    alias TEXT PRIMARY KEY,
    data TEXT
  );
`);

export default db;

export function closeDb() {
  db.close();
}
