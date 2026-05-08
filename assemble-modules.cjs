const fs = require('fs');

const imports = {
  utils: `import fs from "fs";
import path from "path";
import crypto from "crypto";
import url from "url";
import { 
  projectRoot, publicDir, generatedDir, dataDir, legacyUploadsDir, 
  referencesDir, cutoutsDir, cropsDir, queueStatePath, cutoutStatePath, 
  cropStatePath, productModelStatePath, imageTemplateStatePath, 
  port, apiKey, pricingTable, allowedReferenceMimeTypes, 
  maxReferenceImages, maxReferenceBytes, maxJsonBodyBytes, mimeTypes 
} from "./config.js";
import { state } from "./state.js";
`,

  gemini: `import { GoogleGenAI } from "@google/genai";
import { apiKey } from "./config.js";
import { normalizePromptOptions, serializeReferenceImages, serializeProductModel, serializeImageTemplate } from "./utils.js";
`,

  queue: `import { state, persistQueueState } from "./state.js";
import { 
  buildJobId, normalizePromptOptions, serializeJob, buildBatchId, 
  normalizeConcurrency, normalizeQuantity, normalizeJobError, buildImageName 
} from "./utils.js";
import { generateImage } from "./gemini.js";
`,

  backgroundRemoval: `import fs from "fs";
import path from "path";
import { removeBackground } from "@imgly/background-removal-node";
import { state, persistCutoutState } from "./state.js";
import { buildImageName } from "./utils.js";
import { cutoutsDir } from "./config.js";
`,

  media: `import fs from "fs";
import path from "path";
import { state, persistCutoutState, persistCropState, persistProductModelState, persistImageTemplateState } from "./state.js";
import { 
  normalizeBranchReference, normalizeCutoutSource, normalizeCropSource,
  normalizeIdList, assignLibraryFolder, upsertProductModel, upsertImageTemplate,
  deleteProductModel, deleteImageTemplate, trimCutouts, trimCrops
} from "./utils.js";
`,

  routes: `import fs from "fs";
import path from "path";
import url from "url";
import express from "express";
import { state, persistQueueState } from "./state.js";
import { 
  publicDir, generatedDir, dataDir, cutoutsDir, cropsDir, referencesDir, legacyUploadsDir, maxJsonBodyBytes 
} from "./config.js";
import { 
  createJob, trimJobs, deleteJob, deleteGalleryJobsBulk, deleteCutoutsBulk, deleteCropsBulk, deleteLibraryBulk 
} from "./queue.js";
import { 
  createBranchReference, createCutout, createCrop, assignLibraryFolder 
} from "./media.js";
import { runBackgroundRemoval } from "./backgroundRemoval.js";
import * as utils from "./utils.js";

const router = express.Router();

router.all("/*", async (req, res, next) => {
  try {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // We bind old helper functions to express res for compatibility
    res.sendJson = (statusCode, body) => {
      res.status(statusCode).json(body);
    };

    req.readJsonBody = async () => {
      // Express json middleware handles this, so req.body is already parsed
      return req.body || {};
    };

    // INJECT BODY HERE
  } catch (error) {
    console.error("Unhandled Route Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
`
};

for (const module of ['utils', 'gemini', 'queue', 'backgroundRemoval', 'media']) {
  if (fs.existsSync('server/' + module + '.raw.js')) {
    const code = fs.readFileSync('server/' + module + '.raw.js', 'utf8');
    const exportsFixed = code.replace(/\nfunction /g, '\nexport function ');
    fs.writeFileSync('server/' + module + '.js', imports[module] + exportsFixed);
    fs.unlinkSync('server/' + module + '.raw.js');
  }
}

if (fs.existsSync('server/routes.raw.js')) {
  let routeBody = fs.readFileSync('server/routes.raw.js', 'utf8');
  // Replace old sendJson with res.sendJson
  routeBody = routeBody.replace(/sendJson\(res,/g, 'res.sendJson(');
  // Replace await readJsonBody(req) with await req.readJsonBody()
  routeBody = routeBody.replace(/await readJsonBody\(req\)/g, 'await req.readJsonBody()');
  // Replace old serveFile/serveAsset
  routeBody = routeBody.replace(/return serveFile\(res,([^)]+)\);/g, 'return res.sendFile($1);');
  
  const finalRoutes = imports.routes.replace('// INJECT BODY HERE', routeBody);
  fs.writeFileSync('server/routes.js', finalRoutes);
  fs.unlinkSync('server/routes.raw.js');
}

console.log('Módulos montados com sucesso.');
