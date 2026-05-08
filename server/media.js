import fs from "fs";
import path from "path";
import { 
  state, saveJob, saveCutout, saveCrop, saveProductModel, saveImageTemplate,
  deleteCutoutFromDb, deleteCropFromDb, deleteProductModelFromDb, deleteImageTemplateFromDb
} from "./state.js";
import { 
  normalizeBranchReference, normalizeCutoutSource, normalizeCropSource,
  normalizeIdList, resolveImageSourcePath, badRequestError, buildManagedAssetRelativePath,
  resolveManagedAssetWritePath,
  normalizeManagedRelativePath, buildAssetUrl, notFoundError, removeFileIfPresent,
  moveMediaRecordToFolder, normalizeProductModelAlias, normalizeReferenceImages,
  storeReferenceImages, cleanupReferenceImageFiles, normalizeImageTemplateAlias, normalizePromptOptions
} from "./utils.js";
import { cutoutsDir, cropsDir, referencesDir, generatedDir, mimeTypes, allowedReferenceMimeTypes } from "./config.js";
import { runBackgroundRemoval } from "./backgroundRemoval.js";

export function createBranchReference(branchReference) {
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

export async function createCutout(source) {
  const inputPath = resolveImageSourcePath(source.imageUrl);
  if (!inputPath) {
    throw badRequestError("Não foi possível localizar a imagem para remover o fundo.");
  }

  if (state.backgroundRemovalInFlight) {
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
  state.backgroundRemovalInFlight = true;
  state.backgroundRemovalSourceJobId = source.sourceJobId;

  try {
    await runBackgroundRemoval(inputPath, outputPath);
  } finally {
    state.backgroundRemovalInFlight = false;
    state.backgroundRemovalSourceJobId = null;
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

  saveCutout(cutout);
  trimCutouts();
  return cutout;
}

export function createCrop(source) {
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

  saveCrop(crop);
  trimCrops();
  return crop;
}

export function trimCutouts() {
  const cutouts = state.cutouts;
  if (cutouts.length <= 50) {
    return;
  }

  const removed = cutouts.slice(50);
  for (const item of removed) {
    deleteCutoutFromDb(item.id);
    removeFileIfPresent(item.localPath);
  }
}

export function trimCrops() {
  const crops = state.crops;
  if (crops.length <= 50) {
    return;
  }

  const removed = crops.slice(50);
  for (const item of removed) {
    deleteCropFromDb(item.id);
    removeFileIfPresent(item.localPath);
  }
}

export function deleteCutout(cutoutId) {
  const cutout = state.cutoutsById.get(cutoutId);
  if (!cutout) {
    throw notFoundError("Recorte sem fundo não encontrado.");
  }

  deleteCutoutFromDb(cutout.id);
  removeFileIfPresent(cutout.localPath);
  return cutout;
}

export function deleteCrop(cropId) {
  const crop = state.cropsById.get(cropId);
  if (!crop) {
    throw notFoundError("Recorte não encontrado.");
  }

  deleteCropFromDb(crop.id);
  removeFileIfPresent(crop.localPath);
  return crop;
}

export function assignLibraryFolder({ folder = "", jobs = [], cutouts = [], crops = [] } = {}) {
  const updated = {
    gallery: 0,
    cutouts: 0,
    crops: 0,
    total: 0,
  };

  const allowedJobs = new Set(jobs);
  for (const job of state.jobs) {
    if (!allowedJobs.has(job.id)) continue;
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
    saveJob(job);
    updated.gallery += 1;
  }

  const allowedCutouts = new Set(cutouts);
  for (const item of state.cutouts) {
    if (!allowedCutouts.has(item.id)) continue;
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
    saveCutout(item);
    updated.cutouts += 1;
  }

  const allowedCrops = new Set(crops);
  for (const item of state.crops) {
    if (!allowedCrops.has(item.id)) continue;
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
    saveCrop(item);
    updated.crops += 1;
  }

  updated.total = updated.gallery + updated.cutouts + updated.crops;
  return updated;
}

export function upsertProductModel(body) {
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

  const previousModel = state.productModelsByAlias.get(alias);
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

  saveProductModel(nextProductModel);
  return nextProductModel;
}

export function upsertImageTemplate(body) {
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

  const previousTemplate = state.imageTemplatesByAlias.get(alias);
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

  saveImageTemplate(nextImageTemplate);
  return nextImageTemplate;
}

export function deleteProductModel(aliasValue) {
  const alias = normalizeProductModelAlias(aliasValue);
  const removedModel = state.productModelsByAlias.get(alias);
  if (!removedModel) {
    throw notFoundError("Modelo de produto não encontrado.");
  }

  deleteProductModelFromDb(alias);
  cleanupReferenceImageFiles(removedModel.referenceImages);
  return removedModel;
}

export function deleteImageTemplate(aliasValue) {
  const alias = normalizeImageTemplateAlias(aliasValue);
  const removedTemplate = state.imageTemplatesByAlias.get(alias);
  if (!removedTemplate) {
    throw notFoundError("Template visual não encontrado.");
  }

  deleteImageTemplateFromDb(alias);
  cleanupReferenceImageFiles(removedTemplate.referenceImages);
  return removedTemplate;
}
