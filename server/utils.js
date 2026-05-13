import fs from "fs";
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
import { state, saveProductModel } from "./state.js";
export function buildImageName({ model, extension }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${model}.${extension}`;
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

export function normalizePromptOptions(value) {
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

export function normalizeJobError(error) {
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

export function buildJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildBatchId() {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

export function normalizeConcurrency(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 5);
}

export function normalizeQuantity(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(parsed), 1), 8);
}

export function normalizeReferenceImages(value) {
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

export function normalizeReferenceUploadForProcessing(value) {
  const [referenceImage] = normalizeReferenceImages([value]);
  return referenceImage;
}

export function normalizeBranchReference(value) {
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

export function normalizeCutoutSource(value) {
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

export function normalizeCropSource(value) {
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

export function normalizeIdList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim());
}

export function normalizeLibraryFolder(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = normalizeManagedRelativePath(String(value)).replace(/\.[^.]+$/, "");
  return normalized.slice(0, 120);
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

export function serializeReferenceImages(referenceImages = []) {
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

export function normalizeStoredReferenceImages(referenceImages = []) {
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

export function normalizeProductModelAlias(value) {
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

export function normalizeImageTemplateAlias(value) {
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

export function normalizeJobProductModels(value) {
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

export function normalizeJobImageTemplates(value) {
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

export function buildJobProductModelMeta(entry) {
  return {
    alias: normalizeProductModelAlias(entry.alias),
    name: String(entry.name || entry.alias || "Modelo").trim() || "Modelo",
    notes: String(entry.notes || "").trim().slice(0, 500),
  };
}

export function buildJobImageTemplateMeta(entry) {
  return {
    alias: normalizeImageTemplateAlias(entry.alias),
    name: String(entry.name || entry.alias || "Template").trim() || "Template",
    notes: String(entry.notes || "").trim().slice(0, 500),
    promptOptions: normalizePromptOptions(entry.promptOptions),
  };
}

export function serializeProductModel(productModel) {
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

export function serializeImageTemplate(imageTemplate) {
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

export function resolveProductModelsByAlias(value) {
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
    const productModel = state.productModelsByAlias.get(alias);
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

export function resolveImageTemplatesByAlias(value) {
  if (!Array.isArray(value) || !value.length) {
    return [];
  }

  const aliases = Array.from(new Set(value.map((entry) => normalizeImageTemplateAlias(entry)).filter(Boolean)));
  return aliases.map((alias) => {
    const imageTemplate = state.imageTemplatesByAlias.get(alias);
    if (!imageTemplate) {
    throw badRequestError(`O template visual #${alias} não foi encontrado.`);
    }
    return imageTemplate;
  });
}

export function normalizeProductModelEvaluation(value) {
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

export function normalizeStringList(value, limit = 4, maxLength = 140) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry || "").trim().replace(/\s+/g, " ").slice(0, maxLength))
    .filter(Boolean)
    .slice(0, limit);
}

export async function evaluateProductModelQuality(aliasValue, options = {}) {
  const alias = normalizeProductModelAlias(aliasValue);
  const productModel = state.productModelsByAlias.get(alias);
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
  saveProductModel(productModel);
  return productModel;
}

export async function evaluateProductModelWithGemini(productModel) {
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

export function buildHeuristicProductModelEvaluation(productModel) {
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

export function parseJsonObject(value) {
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

export function cleanupReferenceImageFiles(referenceImages = []) {
  for (const image of referenceImages) {
    const absolutePath = resolveReferenceAbsolutePath(image?.relativePath || "");
    removeFileIfPresent(absolutePath);
  }
}

export function buildUsageSummary() {
  const completedJobs = state.jobs.filter((job) => job.status === "completed" && job.result);
  const failedJobs = state.jobs.filter((job) => job.status === "failed");
  const queuedJobs = state.jobs.filter((job) => job.status === "queued");
  const processingJobs = state.jobs.filter((job) => job.status === "processing");
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

export function mimeTypeToExtension(mimeType) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

export function sanitizeFileName(value) {
  return String(value)
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "referencia";
}

export function classifyGeminiError(parsed, statusCode) {
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

export function extractQuotaModel(parsed) {
  const violations = parsed?.error?.details?.find(
    (item) => item?.["@type"] === "type.googleapis.com/google.rpc.QuotaFailure"
  )?.violations;

  return violations?.[0]?.quotaDimensions?.model || null;
}

export function extractRetrySeconds(parsed) {
  const retry = parsed?.error?.details?.find(
    (item) => item?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
  )?.retryDelay;

  if (!retry) {
    return null;
  }

  const match = String(retry).match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function pickAllowedValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
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

export function badRequestError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function notFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
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

export function hydrateLegacyReferenceFiles() {
  for (const job of state.jobs) {
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

  for (const productModel of state.productModels) {
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

  for (const imageTemplate of state.imageTemplates) {
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

export function inferAssetTypeFromBaseDir(baseDir) {
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

export function extractCustomFolderFromRelativePath(relativePath) {
  const normalized = normalizeManagedRelativePath(relativePath);
  const match = normalized.match(/^(.+)\/\d{4}\/\d{2}\/\d{2}\/[^/]+$/);
  return match ? normalizeLibraryFolder(match[1]) : "";
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

export function buildManagedAssetRelativePath({ prefix, extension, date = new Date() }) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const safePrefix = sanitizeFileName(prefix || "file").replace(/\.[^.]+$/, "") || "file";
  const safeExtension = String(extension || "bin").replace(/^\./, "") || "bin";
  return `${year}/${month}/${day}/${safePrefix}.${safeExtension}`;
}

export function normalizeManagedRelativePath(relativePath) {
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

export function sanitizePathSegment(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim();
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

