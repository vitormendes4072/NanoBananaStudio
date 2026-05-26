import {
  normalizePromptOptions,
  normalizeProductModelAlias,
  normalizeImageTemplateAlias,
  normalizeLibraryFolder,
  pickAllowedValue,
  normalizeStringList,
} from './validation.js';
import { resolveReferenceAbsolutePath, buildAssetUrl } from './files.js';

export function normalizeJobError(error) {
  if (error && typeof error === 'object' && 'error' in error) {
    return error;
  }

  return {
    errorType: 'generic',
    error: error instanceof Error ? error.message : 'Erro interno no job.',
    title: 'Falha ao gerar imagem',
    userMessage: error instanceof Error ? error.message : 'Erro interno no job.',
  };
}

export function normalizeProductModelEvaluation(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const status = pickAllowedValue(
    value.status,
    ['ready', 'improvable', 'insufficient'],
    'improvable'
  );
  const score = Math.min(Math.max(Number(value.score) || 0, 0), 100);
  const summary = String(value.summary || '')
    .trim()
    .slice(0, 240);
  const strengths = normalizeStringList(value.strengths, 4, 140);
  const missing = normalizeStringList(value.missing, 5, 160);
  const recommendedShots = normalizeStringList(value.recommendedShots, 5, 160);
  const method = pickAllowedValue(value.method, ['gemini', 'heuristic'], 'heuristic');
  const updatedAt = String(value.updatedAt || '').trim() || null;

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

export function normalizeJobProductModels(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const alias = normalizeProductModelAlias(entry.alias);
      if (!alias) {
        return null;
      }

      return {
        alias,
        name: String(entry.name || alias).trim() || alias,
        notes: String(entry.notes || '')
          .trim()
          .slice(0, 500),
      };
    })
    .filter(Boolean);
}

export function normalizeJobImageTemplates(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const alias = normalizeImageTemplateAlias(entry.alias);
      if (!alias) {
        return null;
      }

      return {
        alias,
        name: String(entry.name || alias).trim() || alias,
        notes: String(entry.notes || '')
          .trim()
          .slice(0, 500),
        promptOptions: normalizePromptOptions(entry.promptOptions),
      };
    })
    .filter(Boolean);
}

export function buildJobProductModelMeta(entry) {
  return {
    alias: normalizeProductModelAlias(entry.alias),
    name: String(entry.name || entry.alias || 'Modelo').trim() || 'Modelo',
    notes: String(entry.notes || '')
      .trim()
      .slice(0, 500),
  };
}

export function buildJobImageTemplateMeta(entry) {
  return {
    alias: normalizeImageTemplateAlias(entry.alias),
    name: String(entry.name || entry.alias || 'Template').trim() || 'Template',
    notes: String(entry.notes || '')
      .trim()
      .slice(0, 500),
    promptOptions: normalizePromptOptions(entry.promptOptions),
  };
}

export function serializeReferenceImages(referenceImages = []) {
  return referenceImages.map((image) => {
    const absolutePath = resolveReferenceAbsolutePath(image.relativePath);
    const isAvailable = Boolean(absolutePath);
    return {
      id: image.id,
      name: image.name,
      mimeType: image.mimeType,
      size: image.size,
      sourceJobId: image.sourceJobId || null,
      sourceKind: image.sourceKind || 'upload',
      isAvailable,
      url: isAvailable ? buildAssetUrl('references', image.relativePath) : null,
    };
  });
}

export function serializeJob(job) {
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

export function serializeProductModel(productModel) {
  return {
    id: productModel.id,
    alias: productModel.alias,
    mention: `@${productModel.alias}`,
    name: productModel.name,
    notes: productModel.notes || '',
    createdAt: productModel.createdAt,
    updatedAt: productModel.updatedAt || productModel.createdAt,
    referenceCount: Array.isArray(productModel.referenceImages)
      ? productModel.referenceImages.length
      : 0,
    referenceImages: serializeReferenceImages(productModel.referenceImages || []),
    evaluation: normalizeProductModelEvaluation(productModel.evaluation),
  };
}

export function serializeImageTemplate(imageTemplate) {
  return {
    id: imageTemplate.id,
    alias: imageTemplate.alias,
    mention: `#${imageTemplate.alias}`,
    name: imageTemplate.name,
    notes: imageTemplate.notes || '',
    promptOptions: normalizePromptOptions(imageTemplate.promptOptions),
    createdAt: imageTemplate.createdAt,
    updatedAt: imageTemplate.updatedAt || imageTemplate.createdAt,
    referenceCount: Array.isArray(imageTemplate.referenceImages)
      ? imageTemplate.referenceImages.length
      : 0,
    referenceImages: serializeReferenceImages(imageTemplate.referenceImages || []),
  };
}

export function parseJsonObject(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error('A avaliação do modelo retornou um JSON inválido.');
  }
}

export { normalizePromptOptions, normalizeStringList } from './validation.js';
