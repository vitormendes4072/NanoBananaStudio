import fs from "fs";
import path from "path";
import url from "url";
import express from "express";
import { state, persistQueueState, saveJob } from "./state.js";
import db from "./db.js";
import {
  publicDir, generatedDir, dataDir, cutoutsDir, cropsDir, referencesDir, legacyUploadsDir, thumbsDir, maxJsonBodyBytes
} from "./config.js";
import { 
  createJob, trimJobs, deleteJob, deleteGalleryJobsBulk, deleteCutoutsBulk, deleteCropsBulk, deleteLibraryBulk 
} from "./queue.js";
import { processQueue } from "./queue.js";
import { 
  createBranchReference, createCutout, createCrop, assignLibraryFolder,
  upsertProductModel, upsertImageTemplate, deleteCutout, deleteCrop,
  deleteProductModel, deleteImageTemplate
} from "./media.js";
import { removeBackgroundFromReferenceImage } from "./backgroundRemoval.js";
import { addClient, removeClient } from "./sse.js";
import { generationLimiter, heavyComputeLimiter, libraryLimiter } from "./rateLimits.js";
import * as utils from "./utils.js";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const sharpPath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'node_modules', '@imgly', 'background-removal-node', 'node_modules', 'sharp');
let sharp = null;

function getSharp() {
  if (!sharp) {
    sharp = _require(sharpPath);
  }

  return sharp;
}

const {
  serializeJob, serializeProductModel, serializeImageTemplate,
  normalizeConcurrency, normalizeQuantity, normalizePromptOptions,
  normalizeReferenceImages, normalizeBranchReference,
  normalizeReferenceUploadForProcessing, normalizeCutoutSource,
  normalizeCropSource, normalizeIdList, normalizeLibraryFolder,
  resolveProductModelsByAlias, resolveImageTemplatesByAlias,
  buildBatchId, pickAllowedValue, buildUsageSummary, buildAnalytics,
  storeReferenceImages, evaluateProductModelQuality,
  serveFile, serveAssetFromDir, resolveReferenceAbsolutePath,
  extractRelativeAssetPath,
} = utils;

const apiKey = process.env.GEMINI_API_KEY || "";

const router = express.Router();

router.post("/api/jobs", generationLimiter);
router.post("/api/cutouts", heavyComputeLimiter);
router.post("/api/reference-images/remove-background", heavyComputeLimiter);
router.post("/api/crops", libraryLimiter);
router.post("/api/product-models", libraryLimiter);
router.post("/api/image-templates", libraryLimiter);
router.post(/^\/api\/product-models\/[^/]+\/evaluate$/, libraryLimiter);

router.use(async (req, res, next) => {
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

    
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (req.method === "GET" && pathname === "/api/health") {
      return res.sendJson( 200, {
        ok: true,
        hasApiKey: Boolean(apiKey),
        model: "gemini-2.5-flash-image",
        activeJobIds: Array.from(state.activeJobIds),
        queueSize: state.jobs.filter((job) => job.status === "queued").length,
        concurrency: state.concurrency,
      });
    }

    if (req.method === "GET" && pathname === "/api/thumb") {
      const src = parsedUrl.query.src || requestUrl.searchParams.get("src");
      if (!src || typeof src !== "string" || src.includes("..")) {
        return res.sendJson(400, { error: "Invalid src parameter" });
      }

      let targetPath = null;
      if (src.startsWith("/generated/")) targetPath = path.join(generatedDir, src.replace("/generated/", ""));
      else if (src.startsWith("/cutouts/")) targetPath = path.join(cutoutsDir, src.replace("/cutouts/", ""));
      else if (src.startsWith("/crops/")) targetPath = path.join(cropsDir, src.replace("/crops/", ""));
      else if (src.startsWith("/references/")) targetPath = path.join(referencesDir, src.replace("/references/", ""));
      else if (src.startsWith("/uploads/")) targetPath = path.join(legacyUploadsDir, src.replace("/uploads/", ""));

      if (!targetPath || !fs.existsSync(targetPath)) {
        res.status(404).send("Not found");
        return;
      }

      const cacheKey = require("crypto").createHash("sha256").update(`${src}:256:256`).digest("hex");
      const cachePath = path.join(thumbsDir, `${cacheKey}.webp`);

      if (fs.existsSync(cachePath)) {
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("X-Thumb-Cache", "HIT");
        return fs.createReadStream(cachePath).pipe(res);
      }

      try {
        const thumbBuffer = await getSharp()(targetPath)
          .resize({ width: 256, height: 256, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();

        fs.mkdirSync(thumbsDir, { recursive: true });
        fs.writeFileSync(cachePath, thumbBuffer);

        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("X-Thumb-Cache", "MISS");
        return res.status(200).send(thumbBuffer);
      } catch (err) {
        console.error("Thumbnail generation error:", err);
        return res.sendJson(500, { error: "Failed to generate thumbnail" });
      }
    }

    if (req.method === "GET" && pathname === "/api/jobs/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.write("retry: 3000\n\n");
      addClient(res);
      req.on("close", () => removeClient(res));
      return;
    }

    if (req.method === "GET" && pathname === "/api/jobs") {
      return res.sendJson( 200, {
        ok: true,
        activeJobIds: Array.from(state.activeJobIds),
        concurrency: state.concurrency,
        jobs: state.jobs.map(serializeJob),
      });
    }

    if (req.method === "GET" && pathname === "/api/usage") {
      return res.sendJson( 200, buildUsageSummary());
    }

    if (req.method === "GET" && pathname === "/api/analytics") {
      return res.sendJson(200, buildAnalytics(db));
    }

    if (req.method === "GET" && pathname === "/api/cutouts") {
      return res.sendJson( 200, {
        ok: true,
        processing: state.backgroundRemovalInFlight,
        processingJobId: state.backgroundRemovalSourceJobId,
        cutouts: state.cutouts,
      });
    }

    if (req.method === "GET" && pathname === "/api/crops") {
      return res.sendJson( 200, {
        ok: true,
        crops: state.crops,
      });
    }

    if (req.method === "GET" && pathname === "/api/product-models") {
      return res.sendJson( 200, {
        ok: true,
        productModels: state.productModels.map(serializeProductModel),
      });
    }

    if (req.method === "GET" && pathname === "/api/image-templates") {
      return res.sendJson( 200, {
        ok: true,
        imageTemplates: state.imageTemplates.map(serializeImageTemplate),
      });
    }

    if (req.method === "POST" && pathname === "/api/settings") {
      const body = await req.readJsonBody();
      state.concurrency = normalizeConcurrency(body.concurrency || state.concurrency);
      persistQueueState();
      processQueue();

      return res.sendJson( 200, {
        ok: true,
        concurrency: state.concurrency,
      });
    }

    if (req.method === "POST" && pathname === "/api/jobs") {
      const body = await req.readJsonBody();
      const prompt = String(body.prompt || "").trim();
      const promptBase = String(body.promptBase || prompt).trim();
      const promptOptions = normalizePromptOptions(body.promptOptions);
      const quantity = normalizeQuantity(body.quantity || 1);
      const targetFolder = normalizeLibraryFolder(body.folder);
      const resolvedProductModels = resolveProductModelsByAlias(body.productModelAliases);
      const resolvedImageTemplates = resolveImageTemplatesByAlias(body.imageTemplateAliases);

      if (!apiKey) {
        return res.sendJson( 400, {
          error: "Configure a GEMINI_API_KEY no arquivo .env antes de gerar imagens.",
        });
      }

      if (!prompt) {
        return res.sendJson( 400, {
          error: "Informe um prompt para gerar a imagem.",
        });
      }

      const uploadedReferenceImages = storeReferenceImages(normalizeReferenceImages(body.referenceImages));
      const branchReferenceImage = createBranchReference(normalizeBranchReference(body.branchReference));
      const referenceImages = branchReferenceImage
        ? [branchReferenceImage, ...uploadedReferenceImages]
        : uploadedReferenceImages;
      const productModelReferences = resolvedProductModels.flatMap((entry) => entry.referenceImages || []);
      const imageTemplateReferences = resolvedImageTemplates.flatMap((entry) => entry.referenceImages || []);
      const mergedReferenceImages = [...productModelReferences, ...imageTemplateReferences, ...referenceImages];

      const model = pickAllowedValue(
        body.model,
        ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"],
        "gemini-2.5-flash-image"
      );
      const batchId = quantity > 1 ? buildBatchId() : null;
      const createdJobs = [];
      for (let index = 0; index < quantity; index += 1) {
        createdJobs.push(
          createJob({
            prompt,
            promptBase,
            promptOptions,
            model,
            referenceImages: mergedReferenceImages,
            productModels: resolvedProductModels.map(buildJobProductModelMeta),
            imageTemplates: resolvedImageTemplates.map(buildJobImageTemplateMeta),
            targetFolder,
            batchId,
            batchIndex: quantity > 1 ? index + 1 : null,
            batchTotal: quantity > 1 ? quantity : null,
          })
        );
      }
      processQueue();

      return res.sendJson( 202, {
        ok: true,
        quantity,
        jobs: createdJobs.map(serializeJob),
      });
    }

    if (req.method === "POST" && pathname === "/api/cutouts") {
      const body = await req.readJsonBody();
      const source = normalizeCutoutSource(body);
      const createdCutout = await createCutout(source);

      return res.sendJson( 201, {
        ok: true,
        cutout: createdCutout,
      });
    }

    if (req.method === "POST" && pathname === "/api/reference-images/remove-background") {
      const body = await req.readJsonBody();
      const processedReference = await removeBackgroundFromReferenceImage(normalizeReferenceUploadForProcessing(body));

      return res.sendJson( 200, {
        ok: true,
        referenceImage: processedReference,
      });
    }

    if (req.method === "POST" && pathname === "/api/crops") {
      const body = await req.readJsonBody();
      const crop = createCrop(normalizeCropSource(body));

      return res.sendJson( 201, {
        ok: true,
        crop,
      });
    }

    if (req.method === "POST" && pathname === "/api/product-models") {
      const body = await req.readJsonBody();
      const productModel = upsertProductModel(body);

      return res.sendJson( 201, {
        ok: true,
        productModel: serializeProductModel(productModel),
      });
    }

    if (req.method === "POST" && pathname === "/api/image-templates") {
      const body = await req.readJsonBody();
      const imageTemplate = upsertImageTemplate(body);

      return res.sendJson( 201, {
        ok: true,
        imageTemplate: serializeImageTemplate(imageTemplate),
      });
    }

    const evaluateProductModelMatch = pathname.match(/^\/api\/product-models\/([^/]+)\/evaluate$/);
    if (req.method === "POST" && evaluateProductModelMatch) {
      const body = await req.readJsonBody().catch(() => ({}));
      const productModel = await evaluateProductModelQuality(evaluateProductModelMatch[1], body);
      return res.sendJson( 200, {
        ok: true,
        productModel: serializeProductModel(productModel),
        evaluation: productModel.evaluation,
      });
    }

    if (req.method === "POST" && pathname === "/api/library/folders/assign") {
      const body = await req.readJsonBody().catch(() => ({}));
      const folder = normalizeLibraryFolder(body.folder);
      const updated = assignLibraryFolder({
        folder,
        jobs: normalizeIdList(body.jobs),
        cutouts: normalizeIdList(body.cutouts),
        crops: normalizeIdList(body.crops),
      });

      return res.sendJson( 200, {
        ok: true,
        folder,
        updated,
      });
    }

    if (req.method === "DELETE" && pathname === "/api/jobs/bulk") {
      const body = await req.readJsonBody().catch(() => ({}));
      const removed = deleteGalleryJobsBulk(normalizeIdList(body.ids));
      return res.sendJson( 200, {
        ok: true,
        removed,
      });
    }

    if (req.method === "DELETE" && pathname === "/api/cutouts/bulk") {
      const body = await req.readJsonBody().catch(() => ({}));
      const removed = deleteCutoutsBulk(normalizeIdList(body.ids));
      return res.sendJson( 200, {
        ok: true,
        removed,
      });
    }

    if (req.method === "DELETE" && pathname === "/api/crops/bulk") {
      const body = await req.readJsonBody().catch(() => ({}));
      const removed = deleteCropsBulk(normalizeIdList(body.ids));
      return res.sendJson( 200, {
        ok: true,
        removed,
      });
    }

    if (req.method === "DELETE" && pathname === "/api/library/bulk") {
      const body = await req.readJsonBody().catch(() => ({}));
      const removed = deleteLibraryBulk({
        jobs: normalizeIdList(body.jobs),
        cutouts: normalizeIdList(body.cutouts),
        crops: normalizeIdList(body.crops),
      });
      return res.sendJson( 200, {
        ok: true,
        removed,
      });
    }

    const deleteJobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (req.method === "DELETE" && deleteJobMatch) {
      const removedJob = deleteJob(deleteJobMatch[1]);
      return res.sendJson( 200, {
        ok: true,
        job: serializeJob(removedJob),
      });
    }

    const deleteCutoutMatch = pathname.match(/^\/api\/cutouts\/([^/]+)$/);
    if (req.method === "DELETE" && deleteCutoutMatch) {
      const removedCutout = deleteCutout(deleteCutoutMatch[1]);
      return res.sendJson( 200, {
        ok: true,
        cutout: removedCutout,
      });
    }

    const deleteCropMatch = pathname.match(/^\/api\/crops\/([^/]+)$/);
    if (req.method === "DELETE" && deleteCropMatch) {
      const removedCrop = deleteCrop(deleteCropMatch[1]);
      return res.sendJson( 200, {
        ok: true,
        crop: removedCrop,
      });
    }

    const deleteProductModelMatch = pathname.match(/^\/api\/product-models\/([^/]+)$/);
    if (req.method === "DELETE" && deleteProductModelMatch) {
      const removedProductModel = deleteProductModel(deleteProductModelMatch[1]);
      return res.sendJson( 200, {
        ok: true,
        productModel: serializeProductModel(removedProductModel),
      });
    }

    const deleteImageTemplateMatch = pathname.match(/^\/api\/image-templates\/([^/]+)$/);
    if (req.method === "DELETE" && deleteImageTemplateMatch) {
      const removedImageTemplate = deleteImageTemplate(deleteImageTemplateMatch[1]);
      return res.sendJson( 200, {
        ok: true,
        imageTemplate: serializeImageTemplate(removedImageTemplate),
      });
    }

    const cancelMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelMatch) {
      const job = state.jobsById.get(cancelMatch[1]);

      if (!job) {
      return res.sendJson( 404, { error: "Job não encontrado." });
      }

      if (job.status !== "queued") {
        return res.sendJson( 409, {
          error: "Apenas jobs na fila podem ser cancelados.",
          job: serializeJob(job),
        });
      }

      job.status = "cancelled";
      job.finishedAt = new Date().toISOString();
      saveJob(job);

      return res.sendJson( 200, {
        ok: true,
        job: serializeJob(job),
      });
    }

    if (req.method === "GET") {
      const requestPath = pathname === "/" ? "/index.html" : pathname;
      if (requestPath.startsWith("/generated/")) {
        return serveAssetFromDir(res, generatedDir, requestPath);
      }

      if (requestPath.startsWith("/references/")) {
        return serveFile(res, resolveReferenceAbsolutePath(extractRelativeAssetPath(requestPath)));
      }

      if (requestPath.startsWith("/uploads/")) {
        return serveFile(res, resolveReferenceAbsolutePath(extractRelativeAssetPath(requestPath)));
      }

      if (requestPath.startsWith("/cutouts/")) {
        return serveAssetFromDir(res, cutoutsDir, requestPath);
      }

      if (requestPath.startsWith("/crops/")) {
        return serveAssetFromDir(res, cropsDir, requestPath);
      }

      return serveFile(res, path.join(publicDir, requestPath));
    }

    res.sendJson( 404, { error: "Rota não encontrada." });
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error && Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    res.sendJson( statusCode, {
      error: error instanceof Error ? error.message : "Erro interno no servidor.",
    });
  }

  } catch (error) {
    console.error("Unhandled Route Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
