// @ts-check
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.join(__dirname, '..');
export const publicDir = path.join(projectRoot, 'dist');
export const generatedDir = path.join(projectRoot, 'generated');
export const dataDir = path.join(projectRoot, 'data');

export const legacyUploadsDir = path.join(dataDir, 'uploads');
export const referencesDir = path.join(dataDir, 'references');
export const cutoutsDir = path.join(dataDir, 'cutouts');
export const cropsDir = path.join(dataDir, 'crops');
export const thumbsDir = path.join(dataDir, 'thumbs');

export const queueStatePath = path.join(dataDir, 'queue-state.json');
export const cutoutStatePath = path.join(dataDir, 'cutout-state.json');
export const cropStatePath = path.join(dataDir, 'crop-state.json');
export const productModelStatePath = path.join(dataDir, 'product-models-state.json');
export const imageTemplateStatePath = path.join(dataDir, 'image-templates-state.json');

/** @type {number} */
export const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

/** @type {string | undefined} */
export const apiKey = process.env.GEMINI_API_KEY;

/**
 * Cost in USD per generated image.
 * Image-gen models are env-var overridable (Google não expõe API de pricing
 * em tempo real — atualização sem deploy via .env).
 * @type {Record<string, number>}
 */
export const pricingTable = {
  'gemini-2.5-flash': 0.0000001,
  'gemini-2.5-pro': 0.000002,
  'gemini-2.0-flash-exp': 0.0,
  'gemini-2.0-pro-exp-02-05': 0.0,
  'gemini-2.0-flash-thinking-exp-01-21': 0.0,
  'imagen-3.0-generate-002': 0.03,
  'imagen-3.0-fast-generate-001': 0.03,
  'gemini-2.5-flash-image': Number(process.env.PRICE_GEMINI_FLASH_IMAGE) || 0.039,
  'gemini-3-pro-image-preview': Number(process.env.PRICE_GEMINI_PRO_IMAGE) || 0.134,
};

/** @type {string} ISO date (YYYY-MM-DD) shown to the user as "tabela atualizada em". */
export const pricingUpdatedAt = process.env.PRICING_UPDATED_AT || '2026-05-28';

/** @type {string[]} Models allowed for image generation */
export const allowedModels = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];

/** @type {string} Default image generation model */
export const defaultModel = 'gemini-2.5-flash-image';

/** @type {string} Model used for product quality evaluation (text/JSON) */
export const productEvalModel = 'gemini-2.5-flash';

/** @type {Set<string>} */
export const allowedReferenceMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** @type {number} Maximum jobs retained in the gallery (oldest deleted when exceeded) */
export const maxJobs = process.env.MAX_JOBS ? parseInt(process.env.MAX_JOBS, 10) : 200;

/** @type {number} Maximum cutouts retained (oldest deleted when exceeded) */
export const maxCutouts = process.env.MAX_CUTOUTS ? parseInt(process.env.MAX_CUTOUTS, 10) : 100;

/** @type {number} Maximum crops retained (oldest deleted when exceeded) */
export const maxCrops = process.env.MAX_CROPS ? parseInt(process.env.MAX_CROPS, 10) : 100;

/** @type {number} Maximum number of reference images per job */
export const maxReferenceImages = 4;

/** @type {number} Maximum size in bytes per reference image (15 MB) */
export const maxReferenceBytes = 15 * 1024 * 1024;

/** @type {number} Maximum JSON body size in bytes (60 MB) */
export const maxJsonBodyBytes = 60 * 1024 * 1024;

/** @type {Record<string, string>} */
export const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
