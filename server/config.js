import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.join(__dirname, "..");
export const publicDir = path.join(projectRoot, "dist");
export const generatedDir = path.join(projectRoot, "generated");
export const dataDir = path.join(projectRoot, "data");

export const legacyUploadsDir = path.join(dataDir, "uploads");
export const referencesDir = path.join(dataDir, "references");
export const cutoutsDir = path.join(dataDir, "cutouts");
export const cropsDir = path.join(dataDir, "crops");

export const queueStatePath = path.join(dataDir, "queue-state.json");
export const cutoutStatePath = path.join(dataDir, "cutout-state.json");
export const cropStatePath = path.join(dataDir, "crop-state.json");
export const productModelStatePath = path.join(dataDir, "product-models-state.json");
export const imageTemplateStatePath = path.join(dataDir, "image-templates-state.json");

export const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
export const apiKey = process.env.GEMINI_API_KEY;

export const pricingTable = {
  "gemini-2.5-flash": 0.0000001,
  "gemini-2.5-pro": 0.000002,
  "gemini-2.0-flash-exp": 0.0,
  "gemini-2.0-pro-exp-02-05": 0.0,
  "gemini-2.0-flash-thinking-exp-01-21": 0.0,
  "imagen-3.0-generate-002": 0.03,
  "imagen-3.0-fast-generate-001": 0.03,
};

export const allowedReferenceMimeTypes = ["image/jpeg", "image/png", "image/webp"];
export const maxReferenceImages = 4;
export const maxReferenceBytes = 15 * 1024 * 1024;
export const maxJsonBodyBytes = 60 * 1024 * 1024;

export const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};