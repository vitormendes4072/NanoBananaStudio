import fs from "fs";
import path from "path";
import {
  generatedDir,
  referencesDir,
  cutoutsDir,
  cropsDir,
  legacyUploadsDir,
  publicDir,
  mimeTypes,
  maxJsonBodyBytes,
} from "../config.js";
import { state } from "../state.js";
import {
  normalizeManagedRelativePath,
  normalizeLibraryFolder,
  sanitizeFileName,
  badRequestError,
  notFoundError,
  normalizeProductModelAlias,
  normalizeImageTemplateAlias,
} from "./validation.js";

export function buildImageName({ model, extension }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${model}.${extension}`;
}

export function buildJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildBatchId() {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function mimeTypeToExtension(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

export function removeFileIfPresent(filePath) {
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

export function buildManagedAssetRelativePath({ prefix, extension, date = new Date() }) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const safePrefix = sanitizeFileName(prefix || "file").replace(/\.[^.]+$/, "") || "file";
  const safeExtension = String(extension || "bin").replace(/^\./, "") || "bin";
  return `${year}/${month}/${day}/${safePrefix}.${safeExtension}`;
}

export function resolveManagedAssetPath(baseDir, relativePath) {
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

export function resolveManagedAssetWritePath(baseDir, relativePath) {
  const absolutePath = resolveManagedAssetPath(baseDir, relativePath);
  if (!absolutePath) {
    throw badRequestError("Não foi possível preparar o caminho do arquivo.");
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  return absolutePath;
}

export function buildAssetUrl(assetType, relativePath) {
  const normalized = normalizeManagedRelativePath(relativePath);
  return normalized ? `/${assetType}/${normalized}` : null;
}

export function extractRelativeAssetPath(requestPath) {
  const decodedPath = decodeURIComponent(String(requestPath || ""));
  return normalizeManagedRelativePath(decodedPath.replace(/^\/[^/]+\//, ""));
}

export function resolveReferenceAbsolutePath(relativePath) {
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

export function resolveAssetPathFromRequest(baseDir, requestPath, assetType) {
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

export function resolveImageSourcePath(imageUrl) {
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

  if (pathname.startsWith("/state.cutouts/")) {
    return resolveAssetPathFromRequest(cutoutsDir, pathname, "cutouts");
  }

  if (pathname.startsWith("/state.crops/")) {
    return resolveAssetPathFromRequest(cropsDir, pathname, "crops");
  }

  return null;
}

export function storeReferenceImages(referenceImages, options = {}) {
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

export function cleanupReferenceFilesForJobs(removedJobs = []) {
  if (!removedJobs.length) {
    return;
  }

  const stillReferencedPaths = new Set(
    state.jobs
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

export function cleanupReferenceImageFiles(referenceImages = []) {
  for (const image of referenceImages) {
    const absolutePath = resolveReferenceAbsolutePath(image?.relativePath || "");
    removeFileIfPresent(absolutePath);
  }
}

export function buildReferenceParts(referenceImages = []) {
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

export function inferAssetTypeFromBaseDir(baseDir) {
  if (baseDir === cutoutsDir) return "cutouts";
  if (baseDir === cropsDir) return "crops";
  if (baseDir === referencesDir || baseDir === legacyUploadsDir) return "references";
  return "generated";
}

export function extractCustomFolderFromRelativePath(relativePath) {
  const normalized = normalizeManagedRelativePath(relativePath);
  const match = normalized.match(/^(.+)\/\d{4}\/\d{2}\/\d{2}\/[^/]+$/);
  return match ? normalizeLibraryFolder(match[1]) : "";
}

export function normalizeMediaRecordState(item, baseDir) {
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

export function hydrateLegacyReferenceFiles() {
  const allEntities = [
    ...state.jobs.map((job) => ({ referenceImages: job.referenceImages })),
    ...state.productModels,
    ...state.imageTemplates,
  ];

  for (const entity of allEntities) {
    if (!Array.isArray(entity.referenceImages)) {
      continue;
    }

    for (const referenceImage of entity.referenceImages) {
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

export function hydrateManagedMediaState() {
  for (const job of state.jobs) {
    if (job?.result && typeof job.result === "object") {
      normalizeMediaRecordState(job.result, generatedDir);
    }
  }

  for (const item of state.cutouts) {
    normalizeMediaRecordState(item, cutoutsDir);
  }

  for (const item of state.crops) {
    normalizeMediaRecordState(item, cropsDir);
  }
}

export function moveMediaRecordToFolder({ item, baseDir, assetType, folder = "", dateValue }) {
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

export function resolveProductModelsByAlias(value) {
  if (!Array.isArray(value) || !value.length) {
    return [];
  }

  const aliases = Array.from(
    new Set(value.map((entry) => normalizeProductModelAlias(entry)).filter(Boolean))
  );

  return aliases.map((alias) => {
    const productModel = state.productModelsByAlias.get(alias);
    if (!productModel) {
      throw badRequestError(`O modelo de produto @${alias} não foi encontrado.`);
    }
    const missingReferences = (productModel.referenceImages || []).filter(
      (image) => !resolveReferenceAbsolutePath(image.relativePath)
    );
    if (missingReferences.length) {
      throw badRequestError(
        `O modelo de produto @${alias} possui ${missingReferences.length} referência(s) ausente(s). Reenvie as imagens desse modelo antes de usar.`
      );
    }
    return productModel;
  });
}

export function resolveImageTemplatesByAlias(value) {
  if (!Array.isArray(value) || !value.length) {
    return [];
  }

  const aliases = Array.from(
    new Set(value.map((entry) => normalizeImageTemplateAlias(entry)).filter(Boolean))
  );

  return aliases.map((alias) => {
    const imageTemplate = state.imageTemplatesByAlias.get(alias);
    if (!imageTemplate) {
      throw badRequestError(`O template visual #${alias} não foi encontrado.`);
    }
    return imageTemplate;
  });
}

export function serveFile(res, filePath) {
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

export function serveAssetFromDir(res, baseDir, requestPath) {
  return serveFile(res, resolveAssetPathFromRequest(baseDir, requestPath));
}

export function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": mimeTypes[".json"] });
  res.end(JSON.stringify(body, null, 2));
}

export async function readJsonBody(req) {
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

export function loadDotEnv(envPath) {
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
