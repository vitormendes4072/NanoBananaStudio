import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import http from "node:http";
import { removeBackground } from "@imgly/background-removal-node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "dist");
const generatedDir = path.join(__dirname, "generated");
const dataDir = path.join(__dirname, "data");
const legacyUploadsDir = path.join(dataDir, "uploads");
const referencesDir = path.join(__dirname, "references");
const cutoutsDir = path.join(__dirname, "cutouts");
const cropsDir = path.join(__dirname, "crops");
const queueStatePath = path.join(dataDir, "queue-state.json");
const cutoutStatePath = path.join(dataDir, "cutouts-state.json");
const cropStatePath = path.join(dataDir, "crops-state.json");
const productModelStatePath = path.join(dataDir, "product-models.json");
const imageTemplateStatePath = path.join(dataDir, "image-templates.json");

loadDotEnv(path.join(__dirname, ".env"));
fs.mkdirSync(generatedDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(legacyUploadsDir, { recursive: true });
fs.mkdirSync(referencesDir, { recursive: true });
fs.mkdirSync(cutoutsDir, { recursive: true });
fs.mkdirSync(cropsDir, { recursive: true });

const port = Number(process.env.PORT || 3000);
const apiKey = process.env.GEMINI_API_KEY;
const queueState = loadQueueState();
const jobs = queueState.jobs;
const cutouts = loadCutoutState();
const crops = loadCropState();
const productModels = loadProductModelState();
const imageTemplates = loadImageTemplateState();
const jobsById = new Map(jobs.map((job) => [job.id, job]));
const cutoutsById = new Map(cutouts.map((item) => [item.id, item]));
const cropsById = new Map(crops.map((item) => [item.id, item]));
const productModelsByAlias = new Map(productModels.map((entry) => [entry.alias, entry]));
const imageTemplatesByAlias = new Map(imageTemplates.map((entry) => [entry.alias, entry]));
const activeJobIds = new Set();
let backgroundRemovalInFlight = false;
let backgroundRemovalSourceJobId = null;
let concurrency = normalizeConcurrency(process.env.QUEUE_CONCURRENCY || queueState.concurrency || 1);
hydrateLegacyReferenceFiles();
hydrateManagedMediaState();
const pricingTable = {
  "gemini-2.5-flash-image": {
    currency: "USD",
    unitCost: 0.039,
    label: "Nano Banana",
  },
  "gemini-3-pro-image-preview": {
    currency: "USD",
    unitCost: 0.134,
    label: "Nano Banana Pro 1K/2K",
  },
};
const allowedReferenceMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxReferenceImages = 4;
const maxReferenceBytes = 10 * 1024 * 1024;
const maxJsonBodyBytes = 60 * 1024 * 1024;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (req.method === "GET" && pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        hasApiKey: Boolean(apiKey),
        model: "gemini-2.5-flash-image",
        activeJobIds: Array.from(activeJobIds),
        queueSize: jobs.filter((job) => job.status === "queued").length,
        concurrency,
      });
    }

    if (req.method === "GET" && pathname === "/api/jobs") {
      return sendJson(res, 200, {
        ok: true,
        activeJobIds: Array.from(activeJobIds),
        concurrency,
        jobs: jobs.map(serializeJob),
      });
    }

    if (req.method === "GET" && pathname === "/api/usage") {
      return sendJson(res, 200, buildUsageSummary());
    }

    if (req.method === "GET" && pathname === "/api/cutouts") {
      return sendJson(res, 200, {
        ok: true,
        processing: backgroundRemovalInFlight,
        processingJobId: backgroundRemovalSourceJobId,
        cutouts,
      });
    }

    if (req.method === "GET" && pathname === "/api/crops") {
      return sendJson(res, 200, {
        ok: true,
        crops,
      });
    }

    if (req.method === "GET" && pathname === "/api/product-models") {
      return sendJson(res, 200, {
        ok: true,
        productModels: productModels.map(serializeProductModel),
      });
    }

    if (req.method === "GET" && pathname === "/api/image-templates") {
      return sendJson(res, 200, {
        ok: true,
        imageTemplates: imageTemplates.map(serializeImageTemplate),
      });
    }

    if (req.method === "POST" && pathname === "/api/settings") {
      const body = await readJsonBody(req);
      concurrency = normalizeConcurrency(body.concurrency || concurrency);
      persistQueueState();
      processQueue();

      return sendJson(res, 200, {
        ok: true,
        concurrency,
      });
    }

    if (req.method === "POST" && pathname === "/api/jobs") {
      const body = await readJsonBody(req);
      const prompt = String(body.prompt || "").trim();
      const promptBase = String(body.promptBase || prompt).trim();
      const promptOptions = normalizePromptOptions(body.promptOptions);
      const quantity = normalizeQuantity(body.quantity || 1);
      const targetFolder = normalizeLibraryFolder(body.folder);
      const resolvedProductModels = resolveProductModelsByAlias(body.productModelAliases);
      const resolvedImageTemplates = resolveImageTemplatesByAlias(body.imageTemplateAliases);

      if (!apiKey) {
        return sendJson(res, 400, {
          error: "Configure a GEMINI_API_KEY no arquivo .env antes de gerar imagens.",
        });
      }

      if (!prompt) {
        return sendJson(res, 400, {
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

      return sendJson(res, 202, {
        ok: true,
        quantity,
        jobs: createdJobs.map(serializeJob),
      });
    }

    if (req.method === "POST" && pathname === "/api/cutouts") {
      const body = await readJsonBody(req);
      const source = normalizeCutoutSource(body);
      const createdCutout = await createCutout(source);

      return sendJson(res, 201, {
        ok: true,
        cutout: createdCutout,
      });
    }

    if (req.method === "POST" && pathname === "/api/reference-images/remove-background") {
      const body = await readJsonBody(req);
      const processedReference = await removeBackgroundFromReferenceImage(normalizeReferenceUploadForProcessing(body));

      return sendJson(res, 200, {
        ok: true,
        referenceImage: processedReference,
      });
    }

    if (req.method === "POST" && pathname === "/api/crops") {
      const body = await readJsonBody(req);
      const crop = createCrop(normalizeCropSource(body));

      return sendJson(res, 201, {
        ok: true,
        crop,
      });
    }

    if (req.method === "POST" && pathname === "/api/product-models") {
      const body = await readJsonBody(req);
      const productModel = upsertProductModel(body);

      return sendJson(res, 201, {
        ok: true,
        productModel: serializeProductModel(productModel),
      });
    }

    if (req.method === "POST" && pathname === "/api/image-templates") {
      const body = await readJsonBody(req);
      const imageTemplate = upsertImageTemplate(body);

      return sendJson(res, 201, {
        ok: true,
        imageTemplate: serializeImageTemplate(imageTemplate),
      });
    }

    const evaluateProductModelMatch = pathname.match(/^\/api\/product-models\/([^/]+)\/evaluate$/);
    if (req.method === "POST" && evaluateProductModelMatch) {
      const body = await readJsonBody(req).catch(() => ({}));
      const productModel = await evaluateProductModelQuality(evaluateProductModelMatch[1], body);
      return sendJson(res, 200, {
        ok: true,
        productModel: serializeProductModel(productModel),
        evaluation: productModel.evaluation,
      });
    }

    if (req.method === "POST" && pathname === "/api/library/folders/assign") {
      const body = await readJsonBody(req).catch(() => ({}));
      const folder = normalizeLibraryFolder(body.folder);
      const updated = assignLibraryFolder({
        folder,
        jobs: normalizeIdList(body.jobs),
        cutouts: normalizeIdList(body.cutouts),
        crops: normalizeIdList(body.crops),
      });

      return sendJson(res, 200, {
        ok: true,
        folder,
        updated,
      });
    }

    if (req.method === "DELETE" && pathname === "/api/jobs/bulk") {
      const body = await readJsonBody(req).catch(() => ({}));
      const removed = deleteGalleryJobsBulk(normalizeIdList(body.ids));
      return sendJson(res, 200, {
        ok: true,
        removed,
      });
    }

    if (req.method === "DELETE" && pathname === "/api/cutouts/bulk") {
      const body = await readJsonBody(req).catch(() => ({}));
      const removed = deleteCutoutsBulk(normalizeIdList(body.ids));
      return sendJson(res, 200, {
        ok: true,
        removed,
      });
    }

    if (req.method === "DELETE" && pathname === "/api/crops/bulk") {
      const body = await readJsonBody(req).catch(() => ({}));
      const removed = deleteCropsBulk(normalizeIdList(body.ids));
      return sendJson(res, 200, {
        ok: true,
        removed,
      });
    }

    if (req.method === "DELETE" && pathname === "/api/library/bulk") {
      const body = await readJsonBody(req).catch(() => ({}));
      const removed = deleteLibraryBulk({
        jobs: normalizeIdList(body.jobs),
        cutouts: normalizeIdList(body.cutouts),
        crops: normalizeIdList(body.crops),
      });
      return sendJson(res, 200, {
        ok: true,
        removed,
      });
    }

    const deleteJobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (req.method === "DELETE" && deleteJobMatch) {
      const removedJob = deleteJob(deleteJobMatch[1]);
      return sendJson(res, 200, {
        ok: true,
        job: serializeJob(removedJob),
      });
    }

    const deleteCutoutMatch = pathname.match(/^\/api\/cutouts\/([^/]+)$/);
    if (req.method === "DELETE" && deleteCutoutMatch) {
      const removedCutout = deleteCutout(deleteCutoutMatch[1]);
      return sendJson(res, 200, {
        ok: true,
        cutout: removedCutout,
      });
    }

    const deleteCropMatch = pathname.match(/^\/api\/crops\/([^/]+)$/);
    if (req.method === "DELETE" && deleteCropMatch) {
      const removedCrop = deleteCrop(deleteCropMatch[1]);
      return sendJson(res, 200, {
        ok: true,
        crop: removedCrop,
      });
    }

    const deleteProductModelMatch = pathname.match(/^\/api\/product-models\/([^/]+)$/);
    if (req.method === "DELETE" && deleteProductModelMatch) {
      const removedProductModel = deleteProductModel(deleteProductModelMatch[1]);
      return sendJson(res, 200, {
        ok: true,
        productModel: serializeProductModel(removedProductModel),
      });
    }

    const deleteImageTemplateMatch = pathname.match(/^\/api\/image-templates\/([^/]+)$/);
    if (req.method === "DELETE" && deleteImageTemplateMatch) {
      const removedImageTemplate = deleteImageTemplate(deleteImageTemplateMatch[1]);
      return sendJson(res, 200, {
        ok: true,
        imageTemplate: serializeImageTemplate(removedImageTemplate),
      });
    }

    const cancelMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelMatch) {
      const job = jobsById.get(cancelMatch[1]);

      if (!job) {
      return sendJson(res, 404, { error: "Job não encontrado." });
      }

      if (job.status !== "queued") {
        return sendJson(res, 409, {
          error: "Apenas jobs na fila podem ser cancelados.",
          job: serializeJob(job),
        });
      }

      job.status = "cancelled";
      job.finishedAt = new Date().toISOString();
      persistQueueState();

      return sendJson(res, 200, {
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

    sendJson(res, 404, { error: "Rota não encontrada." });
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error && Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;

    sendJson(res, statusCode, {
      error: error instanceof Error ? error.message : "Erro interno no servidor.",
    });
  }
});

let serverStarted = false;

function startServer() {
  if (serverStarted) {
    return Promise.resolve(server);
  }

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      serverStarted = true;
      console.log(`Nano Banana Studio em http://localhost:${port}`);
      processQueue();
      resolve(server);
    });
  });
}

function stopServer() {
  if (!serverStarted) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      serverStarted = false;
      resolve();
    });

    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
  });
}

function buildImageName({ model, extension }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${model}.${extension}`;
}

function createJob({
  prompt,
  promptBase = "",
  promptOptions = {},
  model,
  referenceImages = [],
  productModels = [],
  imageTemplates = [],
  targetFolder = "",
  batchId = null,
  batchIndex = null,
  batchTotal = null,
}) {
  const job = {
    id: buildJobId(),
    prompt,
    promptBase: promptBase || prompt,
    promptOptions: normalizePromptOptions(promptOptions),
    model,
    referenceImages,
    productModels: normalizeJobProductModels(productModels),
    imageTemplates: normalizeJobImageTemplates(imageTemplates),
    targetFolder: normalizeLibraryFolder(targetFolder),
    batchId,
    batchIndex,
    batchTotal,
    status: "queued",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    result: null,
    errorInfo: null,
  };

  jobs.unshift(job);
  jobsById.set(job.id, job);
  trimJobs();
  persistQueueState();
  return job;
}

async function processQueue() {
  while (activeJobIds.size < concurrency) {
    const nextJob = jobs.find((job) => job.status === "queued");
    if (!nextJob) {
      return;
    }

    activeJobIds.add(nextJob.id);
    nextJob.status = "processing";
    nextJob.startedAt = new Date().toISOString();
    persistQueueState();

    runJob(nextJob);
  }
}

async function runJob(job) {
  try {
    const result = await generateImage(job);
    job.status = "completed";
    job.finishedAt = new Date().toISOString();
    job.result = result;
  } catch (error) {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    job.errorInfo = normalizeJobError(error);
  } finally {
    activeJobIds.delete(job.id);
    persistQueueState();
    processQueue();
  }
}

async function generateImage(job) {
  const parts = [{ text: job.prompt }, ...buildReferenceParts(job.referenceImages)];
  const payload = {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: normalizePromptOptions(job.promptOptions).aspectRatio,
      },
    },
  };

  const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${job.model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await apiResponse.text();
  let parsed;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = { raw: responseText };
  }

  if (!apiResponse.ok) {
    throw classifyGeminiError(parsed, apiResponse.status);
  }

  const candidateParts = parsed?.candidates?.[0]?.content?.parts || [];
  const imagePart = candidateParts.find((part) => part?.inlineData?.data);
  const textPart = candidateParts.find((part) => part?.text);
  const imageBase64 = imagePart?.inlineData?.data;
  if (!imageBase64) {
    throw {
      errorType: "generic",
      error: "A API respondeu sem imagem em base64.",
      title: "Resposta incompleta da API",
      userMessage: "A geração terminou, mas a API não devolveu uma imagem válida.",
      details: parsed,
    };
  }

  const mimeType = imagePart?.inlineData?.mimeType || "image/png";
  const extension = mimeTypeToExtension(mimeType);
  const generatedName = buildImageName({ model: job.model, extension });
  const datedRelativePath = buildManagedAssetRelativePath({
    extension,
    prefix: generatedName.replace(/\.[^.]+$/, ""),
  });
  const filename = normalizeManagedRelativePath(
    job.targetFolder ? `${job.targetFolder}/${datedRelativePath}` : datedRelativePath
  );
  const absoluteFile = resolveManagedAssetWritePath(generatedDir, filename);

  fs.writeFileSync(absoluteFile, Buffer.from(imageBase64, "base64"));

  return {
    ok: true,
    prompt: job.prompt,
    model: job.model,
    mimeType,
    textResponse: textPart?.text || "",
    filename,
    relativePath: filename,
    imageUrl: buildAssetUrl("generated", filename),
    localPath: absoluteFile,
    folder: job.targetFolder || "",
  };
}

function serializeJob(job) {
  return {
    id: job.id,
    prompt: job.prompt,
    promptBase: job.promptBase || job.prompt,
    promptOptions: normalizePromptOptions(job.promptOptions),
    model: job.model,
    productModels: normalizeJobProductModels(job.productModels),
    imageTemplates: normalizeJobImageTemplates(job.imageTemplates),
    targetFolder: normalizeLibraryFolder(job.targetFolder),
    batchId: job.batchId,
    batchIndex: job.batchIndex,
    batchTotal: job.batchTotal,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    referenceImages: serializeReferenceImages(job.referenceImages),
    result: job.result,
    error: job.errorInfo,
  };
}

function normalizePromptOptions(value) {
  if (!value || typeof value !== "object") {
    return {
      negativePrompt: "",
      promptStrength: "balanced",
      renderFocus: "",
      aspectRatio: "1:1",
      styleDirection: "",
      preserveDetails: "",
      extraInstructions: "",
    };
  }

  return {
    negativePrompt: String(value.negativePrompt || "").trim().slice(0, 600),
    promptStrength: pickAllowedValue(value.promptStrength, ["balanced", "strong", "soft"], "balanced"),
    renderFocus: pickAllowedValue(value.renderFocus, ["", "photoreal", "product", "editorial", "lifestyle", "advertising", "closeup"], ""),
    aspectRatio: pickAllowedValue(value.aspectRatio, ["1:1", "4:5", "5:4", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9", "21:9"], "1:1"),
    styleDirection: String(value.styleDirection || "").trim().slice(0, 300),
    preserveDetails: String(value.preserveDetails || "").trim().slice(0, 300),
    extraInstructions: String(value.extraInstructions || "").trim().slice(0, 600),
  };
}

function normalizeJobError(error) {
  if (error && typeof error === "object" && "error" in error) {
    return error;
  }

  return {
    errorType: "generic",
    error: error instanceof Error ? error.message : "Erro interno no job.",
    title: "Falha ao gerar imagem",
    userMessage: error instanceof Error ? error.message : "Erro interno no job.",
  };
}

function buildJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildBatchId() {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function trimJobs() {
  if (jobs.length <= 50) {
    return;
  }

  const removed = jobs.splice(50);
  for (const job of removed) {
    jobsById.delete(job.id);
    removeFileIfPresent(job.result?.localPath);
  }
  cleanupReferenceFilesForJobs(removed);

  persistQueueState();
}

function loadQueueState() {
  if (!fs.existsSync(queueStatePath)) {
    return { jobs: [], concurrency: 1 };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(queueStatePath, "utf8"));
    const loadedJobs = Array.isArray(parsed?.jobs) ? parsed.jobs : [];

    for (const job of loadedJobs) {
      if (job.status === "processing") {
        job.status = "queued";
        job.startedAt = null;
        job.errorInfo = null;
      }

      job.targetFolder = normalizeLibraryFolder(job.targetFolder);
      job.productModels = normalizeJobProductModels(job.productModels);
      job.imageTemplates = normalizeJobImageTemplates(job.imageTemplates);

      if (job.result && typeof job.result === "object") {
        normalizeMediaRecordState(job.result, generatedDir);
      }
    }

    return {
      jobs: loadedJobs,
      concurrency: normalizeConcurrency(parsed?.concurrency || 1),
    };
  } catch {
    return { jobs: [], concurrency: 1 };
  }
}

function persistQueueState() {
  const state = {
    concurrency,
    jobs,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(queueStatePath, JSON.stringify(state, null, 2));
}

function cleanupReferenceFilesForJobs(removedJobs = []) {
  if (!removedJobs.length) {
    return;
  }

  const stillReferencedPaths = new Set(
    jobs
      .flatMap((job) => (Array.isArray(job.referenceImages) ? job.referenceImages : []))
      .map((image) => normalizeManagedRelativePath(image?.relativePath || ""))
      .filter(Boolean)
  );

  const removablePaths = new Set(
    removedJobs
      .flatMap((job) => (Array.isArray(job.referenceImages) ? job.referenceImages : []))
      .map((image) => normalizeManagedRelativePath(image?.relativePath || ""))
      .filter(Boolean)
  );

  for (const relativePath of removablePaths) {
    if (stillReferencedPaths.has(relativePath)) {
      continue;
    }

    removeFileIfPresent(resolveManagedAssetPath(referencesDir, relativePath));
    removeFileIfPresent(resolveManagedAssetPath(legacyUploadsDir, relativePath));
  }
}

function loadCutoutState() {
  if (!fs.existsSync(cutoutStatePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(cutoutStatePath, "utf8"));
    const loadedCutouts = Array.isArray(parsed?.cutouts) ? parsed.cutouts : [];
    for (const item of loadedCutouts) {
      normalizeMediaRecordState(item, cutoutsDir);
    }
    return loadedCutouts;
  } catch {
    return [];
  }
}

function loadCropState() {
  if (!fs.existsSync(cropStatePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(cropStatePath, "utf8"));
    const loadedCrops = Array.isArray(parsed?.crops) ? parsed.crops : [];
    for (const item of loadedCrops) {
      normalizeMediaRecordState(item, cropsDir);
    }
    return loadedCrops;
  } catch {
    return [];
  }
}

function loadProductModelState() {
  if (!fs.existsSync(productModelStatePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(productModelStatePath, "utf8"));
    const loadedModels = Array.isArray(parsed?.productModels) ? parsed.productModels : [];

    for (const model of loadedModels) {
      model.alias = normalizeProductModelAlias(model.alias || model.name);
      model.name = String(model.name || model.alias || "Modelo").trim() || "Modelo";
      model.notes = String(model.notes || "").trim().slice(0, 500);
      model.referenceImages = normalizeStoredReferenceImages(model.referenceImages);
      model.evaluation = normalizeProductModelEvaluation(model.evaluation);
    }

    return loadedModels.filter((entry) => entry.alias && entry.referenceImages.length);
  } catch {
    return [];
  }
}

function loadImageTemplateState() {
  if (!fs.existsSync(imageTemplateStatePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(imageTemplateStatePath, "utf8"));
    const loadedTemplates = Array.isArray(parsed?.imageTemplates) ? parsed.imageTemplates : [];

    for (const template of loadedTemplates) {
      template.alias = normalizeImageTemplateAlias(template.alias || template.name);
      template.name = String(template.name || template.alias || "Template").trim() || "Template";
      template.notes = String(template.notes || "").trim().slice(0, 500);
      template.promptOptions = normalizePromptOptions(template.promptOptions);
      template.referenceImages = normalizeStoredReferenceImages(template.referenceImages);
    }

    return loadedTemplates.filter((entry) => entry.alias);
  } catch {
    return [];
  }
}

function persistCutoutState() {
  const state = {
    cutouts,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(cutoutStatePath, JSON.stringify(state, null, 2));
}

function persistCropState() {
  const state = {
    crops,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(cropStatePath, JSON.stringify(state, null, 2));
}

function persistProductModelState() {
  const state = {
    productModels,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(productModelStatePath, JSON.stringify(state, null, 2));
}

function persistImageTemplateState() {
  const state = {
    imageTemplates,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(imageTemplateStatePath, JSON.stringify(state, null, 2));
}

function normalizeConcurrency(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 5);
}

function normalizeQuantity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 8);
}

function normalizeReferenceImages(value) {
  if (!Array.isArray(value) || !value.length) {
    return [];
  }

  if (value.length > maxReferenceImages) {
    throw badRequestError(`Envie no máximo ${maxReferenceImages} imagens de referência por lote.`);
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw badRequestError(`A referência ${index + 1} não está em um formato válido.`);
    }

    const name = sanitizeFileName(entry.name || `referencia-${index + 1}`);
    const mimeType = String(entry.mimeType || "").toLowerCase();
    const data = String(entry.data || "").trim();

    if (!allowedReferenceMimeTypes.has(mimeType)) {
      throw badRequestError("Use imagens PNG, JPG ou WEBP como referência.");
    }

    if (!data) {
      throw badRequestError(`A referência ${name} foi enviada sem conteúdo.`);
    }

    const buffer = Buffer.from(data, "base64");
    if (!buffer.length) {
      throw badRequestError(`Não foi possível ler a referência ${name}.`);
    }

    if (buffer.length > maxReferenceBytes) {
      throw badRequestError(`A referência ${name} passou do limite de 10 MB.`);
    }

    return {
      id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      mimeType,
      size: buffer.length,
      buffer,
    };
  });
}

function normalizeReferenceUploadForProcessing(value) {
  const [referenceImage] = normalizeReferenceImages([value]);
  return referenceImage;
}

function normalizeBranchReference(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const imageUrl = String(value.imageUrl || "").trim();
  const filename = sanitizeFileName(value.filename || path.basename(imageUrl));
  const sourceJobId = String(value.jobId || "").trim() || null;

  if (!imageUrl || !filename) {
    throw badRequestError("A imagem base selecionada não está em um formato válido.");
  }

  return {
    imageUrl,
    filename,
    sourceJobId,
    name: sanitizeFileName(value.name || `base-${filename}`),
  };
}

function normalizeCutoutSource(value) {
  if (!value || typeof value !== "object") {
    throw badRequestError("Selecione uma imagem para remover o fundo.");
  }

  const imageUrl = String(value.imageUrl || "").trim();
  const filename = sanitizeFileName(value.filename || path.basename(imageUrl));
  const sourceJobId = String(value.jobId || "").trim() || null;
  const label = String(value.label || "").trim() || filename;

  if (!imageUrl || !filename) {
    throw badRequestError("A imagem escolhida para remover fundo não é válida.");
  }

  return {
    imageUrl,
    filename,
    sourceJobId,
    label,
    folder: normalizeLibraryFolder(value.folder),
  };
}

function normalizeCropSource(value) {
  if (!value || typeof value !== "object") {
    throw badRequestError("Selecione uma região para salvar o recorte.");
  }

  const label = String(value.label || "").trim() || "Recorte";
  const sourceImageUrl = String(value.sourceImageUrl || "").trim();
  const sourceJobId = String(value.jobId || "").trim() || null;
  const mimeType = String(value.mimeType || "image/png").toLowerCase();
  const data = String(value.data || "").trim();

  if (mimeType !== "image/png") {
    throw badRequestError("O recorte precisa ser salvo em PNG.");
  }

  if (!data) {
    throw badRequestError("Não foi possível ler a área recortada.");
  }

  const buffer = Buffer.from(data, "base64");
  if (!buffer.length) {
    throw badRequestError("O recorte enviado está vazio.");
  }

  if (buffer.length > maxReferenceBytes) {
    throw badRequestError("O recorte passou do limite de 10 MB.");
  }

  return {
    label,
    sourceImageUrl,
    sourceJobId,
    mimeType,
    buffer,
    folder: normalizeLibraryFolder(value.folder),
  };
}

function storeReferenceImages(referenceImages, options = {}) {
  if (!referenceImages.length) {
    return [];
  }

  const folderPrefix = normalizeManagedRelativePath(options.folderPrefix || "");

  return referenceImages.map((image, index) => {
    const extension = mimeTypeToExtension(image.mimeType);
    const datedFilename = buildManagedAssetRelativePath({
      extension,
      prefix: `${Date.now()}-${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
    });
    const filename = folderPrefix ? normalizeManagedRelativePath(`${folderPrefix}/${datedFilename}`) : datedFilename;
    const absolutePath = resolveManagedAssetWritePath(referencesDir, filename);
    fs.writeFileSync(absolutePath, image.buffer);

    return {
      id: image.id,
      name: image.name,
      mimeType: image.mimeType,
      size: image.size,
      relativePath: filename,
    };
  });
}

function createBranchReference(branchReference) {
  if (!branchReference) {
    return null;
  }

  const sourcePath = resolveImageSourcePath(branchReference.imageUrl);
  if (!sourcePath) {
    throw badRequestError("Não foi possível localizar a imagem base selecionada.");
  }

  const extension = path.extname(sourcePath).toLowerCase();
  const mimeType = mimeTypes[extension];
  if (!allowedReferenceMimeTypes.has(mimeType)) {
    throw badRequestError("A imagem base precisa estar em PNG, JPG ou WEBP.");
  }

  const filename = buildManagedAssetRelativePath({
    extension: extension.replace(/^\./, ""),
    prefix: `branch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const absolutePath = resolveManagedAssetWritePath(referencesDir, filename);
  fs.copyFileSync(sourcePath, absolutePath);

  return {
    id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: branchReference.name || `base-${branchReference.filename}`,
    mimeType,
    size: fs.statSync(absolutePath).size,
    relativePath: filename,
    sourceJobId: branchReference.sourceJobId,
    sourceKind: "branch",
  };
}

async function createCutout(source) {
  const inputPath = resolveImageSourcePath(source.imageUrl);
  if (!inputPath) {
    throw badRequestError("Não foi possível localizar a imagem para remover o fundo.");
  }

  if (backgroundRemovalInFlight) {
    throw badRequestError("Já existe um recorte em processamento. Aguarde terminar e tente de novo.");
  }

  const outputFilename = buildManagedAssetRelativePath({
    extension: "png",
    prefix: `cutout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const relativeFilename = normalizeManagedRelativePath(
    source.folder ? `${source.folder}/${outputFilename}` : outputFilename
  );
  const outputPath = resolveManagedAssetWritePath(cutoutsDir, relativeFilename);
  backgroundRemovalInFlight = true;
  backgroundRemovalSourceJobId = source.sourceJobId;

  try {
    await runBackgroundRemoval(inputPath, outputPath);
  } finally {
    backgroundRemovalInFlight = false;
    backgroundRemovalSourceJobId = null;
  }

  const cutout = {
    id: `cutout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    filename: relativeFilename,
    relativePath: relativeFilename,
    imageUrl: buildAssetUrl("cutouts", relativeFilename),
    localPath: outputPath,
    folder: source.folder || "",
    sourceImageUrl: source.imageUrl,
    sourceJobId: source.sourceJobId,
    label: source.label,
  };

  cutouts.unshift(cutout);
  cutoutsById.set(cutout.id, cutout);
  trimCutouts();
  persistCutoutState();
  return cutout;
}

function createCrop(source) {
  const outputFilename = buildManagedAssetRelativePath({
    extension: "png",
    prefix: `crop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const relativeFilename = normalizeManagedRelativePath(
    source.folder ? `${source.folder}/${outputFilename}` : outputFilename
  );
  const outputPath = resolveManagedAssetWritePath(cropsDir, relativeFilename);
  fs.writeFileSync(outputPath, source.buffer);

  const crop = {
    id: `crop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    filename: relativeFilename,
    relativePath: relativeFilename,
    imageUrl: buildAssetUrl("crops", relativeFilename),
    localPath: outputPath,
    folder: source.folder || "",
    sourceImageUrl: source.sourceImageUrl || null,
    sourceJobId: source.sourceJobId,
    label: source.label,
  };

  crops.unshift(crop);
  cropsById.set(crop.id, crop);
  trimCrops();
  persistCropState();
  return crop;
}

async function runBackgroundRemoval(inputPath, outputPath) {
  const inputUrl = pathToFileURL(inputPath).href;
  const blob = await removeBackground(inputUrl, {
    output: {
      format: "image/png",
    },
  });
  const bytes = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(outputPath, bytes);

  if (!fs.existsSync(outputPath)) {
    throw new Error("O removedor de fundo terminou sem gerar arquivo de saida.");
  }
}

async function removeBackgroundFromReferenceImage(referenceImage) {
  const inputExtension = mimeTypeToExtension(referenceImage.mimeType);
  const tempDir = path.join(dataDir, "tmp");
  fs.mkdirSync(tempDir, { recursive: true });

  const inputPath = path.join(
    tempDir,
    `reference-input-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${inputExtension}`
  );
  const outputPath = path.join(
    tempDir,
    `reference-output-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  );

  try {
    fs.writeFileSync(inputPath, referenceImage.buffer);
    await runBackgroundRemoval(inputPath, outputPath);

    const outputBuffer = fs.readFileSync(outputPath);
    return {
      name: `${path.basename(referenceImage.name, path.extname(referenceImage.name || "")) || "referencia"}-sem-fundo.png`,
      mimeType: "image/png",
      data: outputBuffer.toString("base64"),
      size: outputBuffer.length,
    };
  } finally {
    removeFileIfPresent(inputPath);
    removeFileIfPresent(outputPath);
  }
}

function trimCutouts() {
  if (cutouts.length <= 50) {
    return;
  }

  const removed = cutouts.splice(50);
  for (const item of removed) {
    cutoutsById.delete(item.id);
    removeFileIfPresent(item.localPath);
  }
}

function trimCrops() {
  if (crops.length <= 50) {
    return;
  }

  const removed = crops.splice(50);
  for (const item of removed) {
    cropsById.delete(item.id);
    removeFileIfPresent(item.localPath);
  }
}

function deleteJob(jobId) {
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) {
    throw notFoundError("Imagem não encontrada.");
  }

  const job = jobs[index];
  if (job.status === "processing") {
    throw badRequestError("Aguarde a imagem terminar de processar antes de remover.");
  }

  jobs.splice(index, 1);
  jobsById.delete(job.id);
  activeJobIds.delete(job.id);
  removeFileIfPresent(job.result?.localPath);
  cleanupReferenceFilesForJobs([job]);
  persistQueueState();
  return serializeJob(job);
}

function deleteCutout(cutoutId) {
  const index = cutouts.findIndex((item) => item.id === cutoutId);
  if (index === -1) {
    throw notFoundError("Recorte sem fundo não encontrado.");
  }

  const [cutout] = cutouts.splice(index, 1);
  cutoutsById.delete(cutout.id);
  removeFileIfPresent(cutout.localPath);
  persistCutoutState();
  return cutout;
}

function deleteCrop(cropId) {
  const index = crops.findIndex((item) => item.id === cropId);
  if (index === -1) {
    throw notFoundError("Recorte não encontrado.");
  }

  const [crop] = crops.splice(index, 1);
  cropsById.delete(crop.id);
  removeFileIfPresent(crop.localPath);
  persistCropState();
  return crop;
}

function deleteGalleryJobsBulk(ids = []) {
  const allowedIds = new Set(ids);
  const removableJobs = jobs.filter((job) => allowedIds.has(job.id) && job.status !== "processing" && job.result?.localPath);
  for (const job of removableJobs) {
    const index = jobs.findIndex((entry) => entry.id === job.id);
    if (index !== -1) {
      jobs.splice(index, 1);
    }
    jobsById.delete(job.id);
    activeJobIds.delete(job.id);
    removeFileIfPresent(job.result?.localPath);
  }
  cleanupReferenceFilesForJobs(removableJobs);

  persistQueueState();
  return { gallery: removableJobs.length };
}

function deleteCutoutsBulk(ids = []) {
  const allowedIds = new Set(ids);
  const removable = cutouts.filter((item) => allowedIds.has(item.id));
  for (const item of removable) {
    cutoutsById.delete(item.id);
    removeFileIfPresent(item.localPath);
  }

  const removableIds = new Set(removable.map((item) => item.id));
  for (let index = cutouts.length - 1; index >= 0; index -= 1) {
    if (removableIds.has(cutouts[index].id)) {
      cutouts.splice(index, 1);
    }
  }

  persistCutoutState();
  return { cutouts: removable.length };
}

function deleteCropsBulk(ids = []) {
  const allowedIds = new Set(ids);
  const removable = crops.filter((item) => allowedIds.has(item.id));
  for (const item of removable) {
    cropsById.delete(item.id);
    removeFileIfPresent(item.localPath);
  }

  const removableIds = new Set(removable.map((item) => item.id));
  for (let index = crops.length - 1; index >= 0; index -= 1) {
    if (removableIds.has(crops[index].id)) {
      crops.splice(index, 1);
    }
  }

  persistCropState();
  return { crops: removable.length };
}

function deleteLibraryBulk({ jobs = [], cutouts = [], crops = [] } = {}) {
  const jobsResult = deleteGalleryJobsBulk(jobs);
  const cutoutsResult = deleteCutoutsBulk(cutouts);
  const cropsResult = deleteCropsBulk(crops);

  return {
    gallery: jobsResult.gallery,
    cutouts: cutoutsResult.cutouts,
    crops: cropsResult.crops,
    total: jobsResult.gallery + cutoutsResult.cutouts + cropsResult.crops,
  };
}

function assignLibraryFolder({ folder = "", jobs = [], cutouts = [], crops = [] } = {}) {
  const updated = {
    gallery: 0,
    cutouts: 0,
    crops: 0,
    total: 0,
  };

  for (const jobId of jobs) {
    const job = jobsById.get(jobId);
    if (!job?.result?.localPath || job.status !== "completed") {
      continue;
    }

    moveMediaRecordToFolder({
      item: job.result,
      baseDir: generatedDir,
      assetType: "generated",
      folder,
      dateValue: job.finishedAt || job.createdAt,
    });
    updated.gallery += 1;
  }

  for (const cutoutId of cutouts) {
    const item = cutoutsById.get(cutoutId);
    if (!item?.localPath) {
      continue;
    }

    moveMediaRecordToFolder({
      item,
      baseDir: cutoutsDir,
      assetType: "cutouts",
      folder,
      dateValue: item.createdAt,
    });
    updated.cutouts += 1;
  }

  for (const cropId of crops) {
    const item = cropsById.get(cropId);
    if (!item?.localPath) {
      continue;
    }

    moveMediaRecordToFolder({
      item,
      baseDir: cropsDir,
      assetType: "crops",
      folder,
      dateValue: item.createdAt,
    });
    updated.crops += 1;
  }

  updated.total = updated.gallery + updated.cutouts + updated.crops;

  if (updated.gallery) {
    persistQueueState();
  }
  if (updated.cutouts) {
    persistCutoutState();
  }
  if (updated.crops) {
    persistCropState();
  }

  return updated;
}

function normalizeIdList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim());
}

function normalizeLibraryFolder(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = normalizeManagedRelativePath(String(value)).replace(/\.[^.]+$/, "");
  return normalized.slice(0, 120);
}

function removeFileIfPresent(filePath) {
  if (!filePath || typeof filePath !== "string") {
    return;
  }

  try {
    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup failures so the state removal can still succeed.
  }
}

function buildReferenceParts(referenceImages = []) {
  return referenceImages.map((image) => {
    const absolutePath = resolveReferenceAbsolutePath(image.relativePath || "");
    if (!image.relativePath || !absolutePath) {
    throw new Error(`A imagem de referência ${image.name || "selecionada"} não foi encontrada no servidor.`);
    }

    return {
      inlineData: {
        mimeType: image.mimeType || "image/png",
        data: fs.readFileSync(absolutePath, "base64"),
      },
    };
  });
}

function serializeReferenceImages(referenceImages = []) {
  return referenceImages.map((image) => {
    const absolutePath = resolveReferenceAbsolutePath(image.relativePath);
    const isAvailable = Boolean(absolutePath && fs.existsSync(absolutePath));
    return {
      id: image.id,
      name: image.name,
      mimeType: image.mimeType,
      size: image.size,
      sourceJobId: image.sourceJobId || null,
      sourceKind: image.sourceKind || "upload",
      isAvailable,
      url: isAvailable ? buildAssetUrl("references", image.relativePath) : null,
    };
  });
}

function normalizeStoredReferenceImages(referenceImages = []) {
  if (!Array.isArray(referenceImages)) {
    return [];
  }

  return referenceImages
    .map((image) => {
      if (!image || typeof image !== "object") {
        return null;
      }

      const relativePath = normalizeManagedRelativePath(image.relativePath || "");
      if (!relativePath) {
        return null;
      }

      return {
        id: String(image.id || `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
        name: sanitizeFileName(image.name || path.basename(relativePath)),
        mimeType: String(image.mimeType || "image/png").toLowerCase(),
        size: Number(image.size || 0),
        relativePath,
        sourceKind: String(image.sourceKind || "upload"),
      };
    })
    .filter(Boolean);
}

function normalizeProductModelAlias(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 40);
}

function normalizeImageTemplateAlias(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^#+/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 40);
}

function normalizeJobProductModels(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const alias = normalizeProductModelAlias(entry.alias);
      if (!alias) {
        return null;
      }

      return {
        alias,
        name: String(entry.name || alias).trim() || alias,
        notes: String(entry.notes || "").trim().slice(0, 500),
      };
    })
    .filter(Boolean);
}

function normalizeJobImageTemplates(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const alias = normalizeImageTemplateAlias(entry.alias);
      if (!alias) {
        return null;
      }

      return {
        alias,
        name: String(entry.name || alias).trim() || alias,
        notes: String(entry.notes || "").trim().slice(0, 500),
        promptOptions: normalizePromptOptions(entry.promptOptions),
      };
    })
    .filter(Boolean);
}

function buildJobProductModelMeta(entry) {
  return {
    alias: normalizeProductModelAlias(entry.alias),
    name: String(entry.name || entry.alias || "Modelo").trim() || "Modelo",
    notes: String(entry.notes || "").trim().slice(0, 500),
  };
}

function buildJobImageTemplateMeta(entry) {
  return {
    alias: normalizeImageTemplateAlias(entry.alias),
    name: String(entry.name || entry.alias || "Template").trim() || "Template",
    notes: String(entry.notes || "").trim().slice(0, 500),
    promptOptions: normalizePromptOptions(entry.promptOptions),
  };
}

function serializeProductModel(productModel) {
  return {
    id: productModel.id,
    alias: productModel.alias,
    mention: `@${productModel.alias}`,
    name: productModel.name,
    notes: productModel.notes || "",
    createdAt: productModel.createdAt,
    updatedAt: productModel.updatedAt || productModel.createdAt,
    referenceCount: Array.isArray(productModel.referenceImages) ? productModel.referenceImages.length : 0,
    referenceImages: serializeReferenceImages(productModel.referenceImages || []),
    evaluation: normalizeProductModelEvaluation(productModel.evaluation),
  };
}

function serializeImageTemplate(imageTemplate) {
  return {
    id: imageTemplate.id,
    alias: imageTemplate.alias,
    mention: `#${imageTemplate.alias}`,
    name: imageTemplate.name,
    notes: imageTemplate.notes || "",
    promptOptions: normalizePromptOptions(imageTemplate.promptOptions),
    createdAt: imageTemplate.createdAt,
    updatedAt: imageTemplate.updatedAt || imageTemplate.createdAt,
    referenceCount: Array.isArray(imageTemplate.referenceImages) ? imageTemplate.referenceImages.length : 0,
    referenceImages: serializeReferenceImages(imageTemplate.referenceImages || []),
  };
}

function resolveProductModelsByAlias(value) {
  if (!Array.isArray(value) || !value.length) {
    return [];
  }

  const aliases = Array.from(
    new Set(
      value
        .map((entry) => normalizeProductModelAlias(entry))
        .filter(Boolean)
    )
  );

  return aliases.map((alias) => {
    const productModel = productModelsByAlias.get(alias);
    if (!productModel) {
    throw badRequestError(`O modelo de produto @${alias} não foi encontrado.`);
    }
    const missingReferences = (productModel.referenceImages || []).filter((image) => !resolveReferenceAbsolutePath(image.relativePath));
    if (missingReferences.length) {
    throw badRequestError(`O modelo de produto @${alias} possui ${missingReferences.length} referência(s) ausente(s). Reenvie as imagens desse modelo antes de usar.`);
    }
    return productModel;
  });
}

function resolveImageTemplatesByAlias(value) {
  if (!Array.isArray(value) || !value.length) {
    return [];
  }

  const aliases = Array.from(new Set(value.map((entry) => normalizeImageTemplateAlias(entry)).filter(Boolean)));
  return aliases.map((alias) => {
    const imageTemplate = imageTemplatesByAlias.get(alias);
    if (!imageTemplate) {
    throw badRequestError(`O template visual #${alias} não foi encontrado.`);
    }
    return imageTemplate;
  });
}

function normalizeProductModelEvaluation(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const status = pickAllowedValue(value.status, ["ready", "improvable", "insufficient"], "improvable");
  const score = Math.min(Math.max(Number(value.score) || 0, 0), 100);
  const summary = String(value.summary || "").trim().slice(0, 240);
  const strengths = normalizeStringList(value.strengths, 4, 140);
  const missing = normalizeStringList(value.missing, 5, 160);
  const recommendedShots = normalizeStringList(value.recommendedShots, 5, 160);
  const method = pickAllowedValue(value.method, ["gemini", "heuristic"], "heuristic");
  const updatedAt = String(value.updatedAt || "").trim() || null;

  if (!summary && !strengths.length && !missing.length && !recommendedShots.length) {
    return null;
  }

  return {
    status,
    score,
    summary,
    strengths,
    missing,
    recommendedShots,
    method,
    updatedAt,
  };
}

function normalizeStringList(value, limit = 4, maxLength = 140) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry || "").trim().replace(/\s+/g, " ").slice(0, maxLength))
    .filter(Boolean)
    .slice(0, limit);
}

async function evaluateProductModelQuality(aliasValue, options = {}) {
  const alias = normalizeProductModelAlias(aliasValue);
  const productModel = productModelsByAlias.get(alias);
  if (!productModel) {
    throw notFoundError(`O modelo de produto @${alias} não foi encontrado.`);
  }

  const mode = pickAllowedValue(options?.mode, ["heuristic", "gemini"], "heuristic");
  let evaluation;

  if (mode === "gemini") {
    if (!apiKey) {
      throw badRequestError("A avaliacao com IA precisa de GEMINI_API_KEY configurada no servidor.");
    }
    evaluation = (await evaluateProductModelWithGemini(productModel).catch(() => null)) || buildHeuristicProductModelEvaluation(productModel);
  } else {
    evaluation = buildHeuristicProductModelEvaluation(productModel);
  }

  productModel.evaluation = normalizeProductModelEvaluation({
    ...evaluation,
    updatedAt: new Date().toISOString(),
  });
  productModel.updatedAt = new Date().toISOString();
  persistProductModelState();
  return productModel;
}

async function evaluateProductModelWithGemini(productModel) {
  const payload = {
    contents: [
      {
        parts: [
          {
            text:
              [
    "Avalie a qualidade de um modelo visual de produto para reutilização em geração de imagens.",
                "Responda apenas com JSON valido.",
                "Campos obrigatorios: status (ready|improvable|insufficient), score (0-100), summary, strengths (array), missing (array), recommendedShots (array).",
    "Considere: fidelidade do produto, cobertura de ângulos, presença de close de material/detalhe, consistência do conjunto e chance de o item ser reproduzido fielmente.",
                `Nome: ${productModel.name}.`,
                `Alias: @${productModel.alias}.`,
                `Notas: ${productModel.notes || "sem notas"}.`,
    `Quantidade de referências: ${(productModel.referenceImages || []).length}.`,
    "Se as referências estiverem fortes o bastante para reutilização fiel, marque ready.",
                "Se forem usaveis mas ainda houver risco de variar forma/material/acabamento, marque improvable.",
    "Se faltarem referências fundamentais, marque insufficient.",
    "No campo missing, cite o que está faltando.",
                "No campo recommendedShots, recomende fotos objetivas para melhorar o cadastro.",
    "Mantenha summary curta e prática em português.",
              ].join(" "),
          },
          ...buildReferenceParts(productModel.referenceImages || []),
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };

  const apiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await apiResponse.text();
  let parsed;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = { raw: responseText };
  }

  if (!apiResponse.ok) {
    throw classifyGeminiError(parsed, apiResponse.status);
  }

  const textPart = parsed?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === "string")?.text || "";
  const evaluation = parseJsonObject(textPart);
  return normalizeProductModelEvaluation({
    ...evaluation,
    method: "gemini",
  });
}

function buildHeuristicProductModelEvaluation(productModel) {
  const referenceCount = Array.isArray(productModel.referenceImages) ? productModel.referenceImages.length : 0;
  const notesLength = String(productModel.notes || "").trim().length;
  const hasNotes = notesLength >= 18;
  const hasStrongNotes = notesLength >= 60;

  let score = 30;
  if (referenceCount >= 1) score += 15;
  if (referenceCount >= 2) score += 15;
  if (referenceCount >= 3) score += 12;
  if (referenceCount >= 4) score += 8;
  if (hasNotes) score += 10;
  if (hasStrongNotes) score += 10;
  score = Math.min(score, 100);

  let status = "insufficient";
  if (score >= 78) {
    status = "ready";
  } else if (score >= 52) {
    status = "improvable";
  }

  const strengths = [];
  const missing = [];
  const recommendedShots = [];

  if (referenceCount >= 3) {
    strengths.push("Conjunto com variedade inicial de referências para reduzir variação na geração.");
  } else if (referenceCount >= 1) {
    strengths.push("Ja existe uma base visual do produto cadastrada.");
  }

  if (hasNotes) {
    strengths.push("As notas ajudam a preservar detalhes importantes do produto.");
  }

  if (referenceCount < 2) {
    missing.push("Faltam mais ângulos do produto para reduzir ambiguidade de forma e volume.");
    recommendedShots.push("Adicione uma foto lateral ou em tres quartos.");
  }

  if (referenceCount < 3) {
    missing.push("Ainda não há cobertura suficiente para reproduções mais fiéis em cenas variadas.");
    recommendedShots.push("Adicione uma foto frontal limpa com o produto inteiro.");
  }

  if (referenceCount < 4) {
    missing.push("Seria ideal incluir um close de material, textura, costura ou etiqueta.");
    recommendedShots.push("Adicione um close dos detalhes que não podem mudar.");
  }

  if (!hasNotes) {
    missing.push("As notas de fidelidade estao fracas ou ausentes.");
    recommendedShots.push("Descreva forma, tecido, costura, etiqueta e o que nunca pode mudar.");
  }

  const summary =
    status === "ready"
      ? "Modelo bem coberto para reutilizacao, com baixo risco de variar o produto principal."
      : status === "improvable"
    ? "Modelo utilizável, mas ainda vale reforçar alguns ângulos e detalhes para ganhar fidelidade."
    : "Modelo ainda fraco para reprodução fiel; adicione mais referências antes de depender dele em produção.";

  return normalizeProductModelEvaluation({
    status,
    score,
    summary,
    strengths,
    missing,
    recommendedShots,
    method: "heuristic",
  });
}

function parseJsonObject(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("A avaliação do modelo retornou um JSON inválido.");
  }
}

function upsertProductModel(body) {
  const name = String(body?.name || "").trim().slice(0, 120);
  const alias = normalizeProductModelAlias(body?.alias || name);
  const notes = String(body?.notes || "").trim().slice(0, 500);
  const normalizedReferenceImages = normalizeReferenceImages(body?.referenceImages);

  if (!name) {
    throw badRequestError("Informe o nome do modelo de produto.");
  }

  if (!alias) {
    throw badRequestError("Informe um alias valido para o modelo de produto.");
  }

  if (!normalizedReferenceImages.length) {
    throw badRequestError("Envie pelo menos uma imagem de referência para o modelo de produto.");
  }

  const storedReferenceImages = storeReferenceImages(normalizedReferenceImages, {
    folderPrefix: `product-models/${alias}`,
  }).map((image) => ({
    ...image,
    sourceKind: "product-model",
  }));

  const existingIndex = productModels.findIndex((entry) => entry.alias === alias);
  const previousModel = existingIndex >= 0 ? productModels[existingIndex] : null;
  if (previousModel) {
    cleanupReferenceImageFiles(previousModel.referenceImages);
  }

  const nextProductModel = {
    id: previousModel?.id || `product_model_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    alias,
    name,
    notes,
    createdAt: previousModel?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    referenceImages: storedReferenceImages,
    evaluation: null,
  };

  if (existingIndex >= 0) {
    productModels.splice(existingIndex, 1, nextProductModel);
  } else {
    productModels.unshift(nextProductModel);
  }

  productModelsByAlias.set(alias, nextProductModel);
  persistProductModelState();
  return nextProductModel;
}

function upsertImageTemplate(body) {
  const name = String(body?.name || "").trim().slice(0, 120);
  const alias = normalizeImageTemplateAlias(body?.alias || name);
  const notes = String(body?.notes || "").trim().slice(0, 500);
  const promptOptions = normalizePromptOptions(body?.promptOptions);
  const normalizedReferenceImages = normalizeReferenceImages(body?.referenceImages || []);

  if (!name) {
    throw badRequestError("Informe o nome do template visual.");
  }

  if (!alias) {
    throw badRequestError("Informe um alias valido para o template visual.");
  }

  const storedReferenceImages = storeReferenceImages(normalizedReferenceImages, {
    folderPrefix: `image-templates/${alias}`,
  }).map((image) => ({
    ...image,
    sourceKind: "image-template",
  }));

  const existingIndex = imageTemplates.findIndex((entry) => entry.alias === alias);
  const previousTemplate = existingIndex >= 0 ? imageTemplates[existingIndex] : null;
  if (previousTemplate) {
    cleanupReferenceImageFiles(previousTemplate.referenceImages);
  }

  const nextImageTemplate = {
    id: previousTemplate?.id || `image_template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    alias,
    name,
    notes,
    promptOptions,
    createdAt: previousTemplate?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    referenceImages: storedReferenceImages,
  };

  if (existingIndex >= 0) {
    imageTemplates.splice(existingIndex, 1, nextImageTemplate);
  } else {
    imageTemplates.unshift(nextImageTemplate);
  }

  imageTemplatesByAlias.set(alias, nextImageTemplate);
  persistImageTemplateState();
  return nextImageTemplate;
}

function deleteProductModel(aliasValue) {
  const alias = normalizeProductModelAlias(aliasValue);
  const index = productModels.findIndex((entry) => entry.alias === alias);
  if (index === -1) {
    throw notFoundError("Modelo de produto não encontrado.");
  }

  const [removedModel] = productModels.splice(index, 1);
  productModelsByAlias.delete(alias);
  cleanupReferenceImageFiles(removedModel.referenceImages);
  persistProductModelState();
  return removedModel;
}

function deleteImageTemplate(aliasValue) {
  const alias = normalizeImageTemplateAlias(aliasValue);
  const index = imageTemplates.findIndex((entry) => entry.alias === alias);
  if (index === -1) {
    throw notFoundError("Template visual não encontrado.");
  }

  const [removedTemplate] = imageTemplates.splice(index, 1);
  imageTemplatesByAlias.delete(alias);
  cleanupReferenceImageFiles(removedTemplate.referenceImages);
  persistImageTemplateState();
  return removedTemplate;
}

function cleanupReferenceImageFiles(referenceImages = []) {
  for (const image of referenceImages) {
    const absolutePath = resolveReferenceAbsolutePath(image?.relativePath || "");
    removeFileIfPresent(absolutePath);
  }
}

function buildUsageSummary() {
  const completedJobs = jobs.filter((job) => job.status === "completed" && job.result);
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const queuedJobs = jobs.filter((job) => job.status === "queued");
  const processingJobs = jobs.filter((job) => job.status === "processing");
  const todayPrefix = new Date().toISOString().slice(0, 10);

  let totalEstimatedCost = 0;
  let todayEstimatedCost = 0;
  let todayCompleted = 0;
  const byModel = {};

  for (const job of completedJobs) {
    const priceInfo = pricingTable[job.model];
    const unitCost = priceInfo?.unitCost || 0;
    const currency = priceInfo?.currency || "USD";

    totalEstimatedCost += unitCost;
    if (job.finishedAt?.startsWith(todayPrefix)) {
      todayEstimatedCost += unitCost;
      todayCompleted += 1;
    }

    if (!byModel[job.model]) {
      byModel[job.model] = {
        model: job.model,
        label: priceInfo?.label || job.model,
        currency,
        unitCost,
        completed: 0,
        estimatedCost: 0,
      };
    }

    byModel[job.model].completed += 1;
    byModel[job.model].estimatedCost += unitCost;
  }

  return {
    ok: true,
    currency: "USD",
    completedJobs: completedJobs.length,
    failedJobs: failedJobs.length,
    queuedJobs: queuedJobs.length,
    processingJobs: processingJobs.length,
    todayCompleted,
    totalEstimatedCost,
    todayEstimatedCost,
    byModel: Object.values(byModel),
    pricingTable,
    links: {
      billing: "https://ai.google.dev/gemini-api/docs/billing",
      rateLimits: "https://ai.google.dev/gemini-api/docs/rate-limits",
      usage: "https://ai.dev/rate-limit",
      apiKeys: "https://aistudio.google.com/app/apikey",
    },
  };
}

function mimeTypeToExtension(mimeType) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

function sanitizeFileName(value) {
  return String(value)
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "referencia";
}

function classifyGeminiError(parsed, statusCode) {
  const rawMessage = parsed?.error?.message || "Falha ao gerar a imagem na API do Gemini.";
  const normalized = rawMessage.toLowerCase();
  const model = extractQuotaModel(parsed);
  const retrySeconds = extractRetrySeconds(parsed);

  if (
    statusCode === 429 ||
    normalized.includes("quota exceeded") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("billing")
  ) {
    return {
      errorType: "quota",
      error: "Sua chave do Gemini não tem cota liberada para gerar imagens neste projeto.",
      title: "Quota ou billing indisponivel",
      userMessage:
        "A requisição chegou na API, mas o projeto da sua chave não tem quota ativa para este modelo de imagem.",
      guidance: [
        "Confirme se a chave foi criada no projeto correto do Google AI Studio.",
        "Ative o billing desse projeto, se ele ainda estiver no free tier sem cota para image generation.",
        "Revise os limites e uso atuais nos painéis oficiais do Gemini.",
        retrySeconds ? `A API sugeriu tentar de novo em cerca de ${retrySeconds} segundos.` : null,
      ].filter(Boolean),
      links: {
        billing: "https://ai.google.dev/gemini-api/docs/billing",
        rateLimits: "https://ai.google.dev/gemini-api/docs/rate-limits",
        usage: "https://ai.dev/rate-limit",
      },
      technical: {
        statusCode,
        model,
        rawMessage,
      },
      details: parsed,
    };
  }

  if (statusCode === 401 || normalized.includes("api key")) {
    return {
      errorType: "auth",
      error: "A chave Gemini parece inválida ou não autorizada.",
      title: "Chave invalida ou sem permissao",
      userMessage: "Verifique se a GEMINI_API_KEY está correta e pertence ao projeto esperado.",
      guidance: [
        "Confirme a chave no Google AI Studio.",
        "Se trocou a chave recentemente, reinicie o servidor local.",
      ],
      links: {
        keys: "https://aistudio.google.com/app/apikey",
      },
      technical: {
        statusCode,
        rawMessage,
      },
      details: parsed,
    };
  }

  return {
    errorType: "generic",
    error: rawMessage,
    title: "Falha ao gerar imagem",
    userMessage: "A API do Gemini retornou um erro que precisa de revisao.",
    guidance: [
      "Revise a mensagem tecnica abaixo.",
      "Se o problema persistir, teste novamente com um prompt mais simples.",
    ],
    technical: {
      statusCode,
      rawMessage,
    },
    details: parsed,
  };
}

function extractQuotaModel(parsed) {
  const violations = parsed?.error?.details?.find(
    (item) => item?.["@type"] === "type.googleapis.com/google.rpc.QuotaFailure"
  )?.violations;

  return violations?.[0]?.quotaDimensions?.model || null;
}

function extractRetrySeconds(parsed) {
  const retry = parsed?.error?.details?.find(
    (item) => item?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
  )?.retryDelay;

  if (!retry) {
    return null;
  }

  const match = String(retry).match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function pickAllowedValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": mimeTypes[".json"] });
  res.end(JSON.stringify(body, null, 2));
}

async function readJsonBody(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxJsonBodyBytes) {
    throw badRequestError("O corpo da requisição passou do limite permitido.");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw badRequestError("O corpo da requisição não está em JSON válido.");
  }
}

function serveFile(res, filePath) {
  if (!filePath || typeof filePath !== "string") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  if (
    !filePath.startsWith(publicDir) &&
    !filePath.startsWith(generatedDir) &&
    !filePath.startsWith(cutoutsDir) &&
    !filePath.startsWith(cropsDir) &&
    !filePath.startsWith(referencesDir) &&
    !filePath.startsWith(legacyUploadsDir)
  ) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
}

function serveAssetFromDir(res, baseDir, requestPath) {
  return serveFile(res, resolveAssetPathFromRequest(baseDir, requestPath));
}

function loadDotEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function badRequestError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function resolveReferenceAbsolutePath(relativePath) {
  if (!relativePath) {
    return null;
  }

  const normalized = normalizeManagedRelativePath(relativePath);
  const fallbackName = path.basename(normalized);
  const candidates = [
    resolveManagedAssetPath(referencesDir, normalized),
    resolveManagedAssetPath(legacyUploadsDir, normalized),
    fallbackName ? resolveManagedAssetPath(referencesDir, fallbackName) : null,
    fallbackName ? resolveManagedAssetPath(legacyUploadsDir, fallbackName) : null,
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function resolveImageSourcePath(imageUrl) {
  if (!imageUrl) {
    return null;
  }

  const pathname = new URL(imageUrl, "http://localhost").pathname;
  if (pathname.startsWith("/generated/")) {
    return resolveAssetPathFromRequest(generatedDir, pathname, "generated");
  }

  if (pathname.startsWith("/references/") || pathname.startsWith("/uploads/")) {
    const relativePath = extractRelativeAssetPath(pathname);
    return resolveReferenceAbsolutePath(relativePath);
  }

  if (pathname.startsWith("/cutouts/")) {
    return resolveAssetPathFromRequest(cutoutsDir, pathname, "cutouts");
  }

  if (pathname.startsWith("/crops/")) {
    return resolveAssetPathFromRequest(cropsDir, pathname, "crops");
  }

  return null;
}

function hydrateLegacyReferenceFiles() {
  for (const job of jobs) {
    if (!Array.isArray(job.referenceImages)) {
      continue;
    }

    for (const referenceImage of job.referenceImages) {
      const filename = referenceImage?.relativePath ? normalizeManagedRelativePath(referenceImage.relativePath) : null;
      if (!filename) {
        continue;
      }

      const nextPath = resolveManagedAssetPath(referencesDir, filename);
      const legacyPath = resolveManagedAssetPath(legacyUploadsDir, filename);
      if (!fs.existsSync(nextPath) && fs.existsSync(legacyPath)) {
        fs.mkdirSync(path.dirname(nextPath), { recursive: true });
        fs.copyFileSync(legacyPath, nextPath);
      }

      referenceImage.relativePath = filename;
    }
  }

  for (const productModel of productModels) {
    if (!Array.isArray(productModel.referenceImages)) {
      continue;
    }

    for (const referenceImage of productModel.referenceImages) {
      const filename = referenceImage?.relativePath ? normalizeManagedRelativePath(referenceImage.relativePath) : null;
      if (!filename) {
        continue;
      }

      const nextPath = resolveManagedAssetPath(referencesDir, filename);
      const legacyPath = resolveManagedAssetPath(legacyUploadsDir, filename);
      if (!fs.existsSync(nextPath) && fs.existsSync(legacyPath)) {
        fs.mkdirSync(path.dirname(nextPath), { recursive: true });
        fs.copyFileSync(legacyPath, nextPath);
      }

      referenceImage.relativePath = filename;
    }
  }

  for (const imageTemplate of imageTemplates) {
    if (!Array.isArray(imageTemplate.referenceImages)) {
      continue;
    }

    for (const referenceImage of imageTemplate.referenceImages) {
      const filename = referenceImage?.relativePath ? normalizeManagedRelativePath(referenceImage.relativePath) : null;
      if (!filename) {
        continue;
      }

      const nextPath = resolveManagedAssetPath(referencesDir, filename);
      const legacyPath = resolveManagedAssetPath(legacyUploadsDir, filename);
      if (!fs.existsSync(nextPath) && fs.existsSync(legacyPath)) {
        fs.mkdirSync(path.dirname(nextPath), { recursive: true });
        fs.copyFileSync(legacyPath, nextPath);
      }

      referenceImage.relativePath = filename;
    }
  }
}

function hydrateManagedMediaState() {
  for (const job of jobs) {
    if (job?.result && typeof job.result === "object") {
      normalizeMediaRecordState(job.result, generatedDir);
    }
  }

  for (const item of cutouts) {
    normalizeMediaRecordState(item, cutoutsDir);
  }

  for (const item of crops) {
    normalizeMediaRecordState(item, cropsDir);
  }
}

function normalizeMediaRecordState(item, baseDir) {
  if (!item || typeof item !== "object") {
    return item;
  }

  const assetType = inferAssetTypeFromBaseDir(baseDir);
  const relativePath = normalizeManagedRelativePath(
    item.relativePath || item.filename || extractRelativeAssetPath(item.imageUrl || "")
  );

  if (!relativePath) {
    return item;
  }

  item.relativePath = relativePath;
  item.filename = relativePath;
  const resolvedPath = resolveManagedAssetPath(baseDir, relativePath);
  item.localPath = resolvedPath && fs.existsSync(resolvedPath) ? resolvedPath : item.localPath;
  item.imageUrl = buildAssetUrl(assetType, relativePath);
  item.folder = normalizeLibraryFolder(item.folder || extractCustomFolderFromRelativePath(relativePath));
  return item;
}

function inferAssetTypeFromBaseDir(baseDir) {
  if (baseDir === cutoutsDir) {
    return "cutouts";
  }

  if (baseDir === cropsDir) {
    return "crops";
  }

  if (baseDir === referencesDir || baseDir === legacyUploadsDir) {
    return "references";
  }

  return "generated";
}

function extractCustomFolderFromRelativePath(relativePath) {
  const normalized = normalizeManagedRelativePath(relativePath);
  const match = normalized.match(/^(.+)\/\d{4}\/\d{2}\/\d{2}\/[^/]+$/);
  return match ? normalizeLibraryFolder(match[1]) : "";
}

function moveMediaRecordToFolder({ item, baseDir, assetType, folder = "", dateValue }) {
  normalizeMediaRecordState(item, baseDir);

  const currentRelativePath = normalizeManagedRelativePath(item.relativePath || item.filename);
  const currentAbsolutePath =
    item.localPath ||
    resolveManagedAssetPath(baseDir, currentRelativePath) ||
    resolveAssetPathFromRequest(baseDir, item.imageUrl || "");

  if (!currentRelativePath || !currentAbsolutePath || !fs.existsSync(currentAbsolutePath)) {
    throw notFoundError("Não foi possível localizar o arquivo para reorganizar.");
  }

  const extension = path.extname(currentRelativePath).replace(/^\./, "") || "png";
  const prefix = path.basename(currentRelativePath, path.extname(currentRelativePath));
  const datedRelativePath = buildManagedAssetRelativePath({
    prefix,
    extension,
    date: dateValue ? new Date(dateValue) : new Date(),
  });
  const nextRelativePath = folder ? `${folder}/${datedRelativePath}` : datedRelativePath;
  const normalizedNextRelativePath = normalizeManagedRelativePath(nextRelativePath);

  if (normalizedNextRelativePath === currentRelativePath) {
    item.folder = folder;
    item.imageUrl = buildAssetUrl(assetType, currentRelativePath);
    item.localPath = currentAbsolutePath;
    return item;
  }

  const nextAbsolutePath = resolveManagedAssetWritePath(baseDir, normalizedNextRelativePath);
  fs.renameSync(currentAbsolutePath, nextAbsolutePath);

  item.folder = folder;
  item.relativePath = normalizedNextRelativePath;
  item.filename = normalizedNextRelativePath;
  item.localPath = nextAbsolutePath;
  item.imageUrl = buildAssetUrl(assetType, normalizedNextRelativePath);
  return item;
}

function buildManagedAssetRelativePath({ prefix, extension, date = new Date() }) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const safePrefix = sanitizeFileName(prefix || "file").replace(/\.[^.]+$/, "") || "file";
  const safeExtension = String(extension || "bin").replace(/^\./, "") || "bin";
  return `${year}/${month}/${day}/${safePrefix}.${safeExtension}`;
}

function normalizeManagedRelativePath(relativePath) {
  if (!relativePath || typeof relativePath !== "string") {
    return "";
  }

  const rawSegments = relativePath.replace(/\\/g, "/").split("/");
  const safeSegments = rawSegments
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .map((segment, index, array) =>
      index === array.length - 1 ? sanitizeFileName(segment) : sanitizePathSegment(segment)
    )
    .filter(Boolean);

  return safeSegments.join("/");
}

function sanitizePathSegment(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim();
}

function resolveManagedAssetPath(baseDir, relativePath) {
  const normalized = normalizeManagedRelativePath(relativePath);
  if (!normalized) {
    return null;
  }

  const absolutePath = path.resolve(baseDir, normalized);
  const normalizedBase = `${path.resolve(baseDir)}${path.sep}`;
  if (absolutePath !== path.resolve(baseDir) && !absolutePath.startsWith(normalizedBase)) {
    return null;
  }

  return absolutePath;
}

function resolveManagedAssetWritePath(baseDir, relativePath) {
  const absolutePath = resolveManagedAssetPath(baseDir, relativePath);
  if (!absolutePath) {
    throw badRequestError("Não foi possível preparar o caminho do arquivo.");
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  return absolutePath;
}

function buildAssetUrl(assetType, relativePath) {
  const normalized = normalizeManagedRelativePath(relativePath);
  return normalized ? `/${assetType}/${normalized}` : null;
}

function extractRelativeAssetPath(requestPath) {
  const decodedPath = decodeURIComponent(String(requestPath || ""));
  return normalizeManagedRelativePath(decodedPath.replace(/^\/[^/]+\//, ""));
}

function resolveAssetPathFromRequest(baseDir, requestPath, assetType) {
  const relativePath = extractRelativeAssetPath(requestPath);
  const directMatch = resolveManagedAssetPath(baseDir, relativePath);
  if (directMatch && fs.existsSync(directMatch)) {
    return directMatch;
  }

  const fallbackName = path.basename(relativePath);
  if (fallbackName && fallbackName !== relativePath) {
    const fallbackPath = resolveManagedAssetPath(baseDir, fallbackName);
    if (fallbackPath && fs.existsSync(fallbackPath)) {
      return fallbackPath;
    }
  }

  if (assetType === "references") {
    return resolveReferenceAbsolutePath(relativePath);
  }

  return null;
}

const isMainModule = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isMainModule) {
  startServer();
}

export const __testUtils = {
  jobs,
  cutouts,
  crops,
  productModels,
  imageTemplates,
  createJob,
  createCrop,
  deleteJob,
  serializeJob,
  persistQueueState,
  persistCutoutState,
  persistCropState,
  persistProductModelState,
  persistImageTemplateState,
  generatedDir,
  referencesDir,
  cutoutsDir,
  cropsDir,
  productModelStatePath,
  imageTemplateStatePath,
};

export { server, startServer, stopServer };
