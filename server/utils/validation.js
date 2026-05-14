import path from "path";
import {
  allowedReferenceMimeTypes,
  maxReferenceImages,
  maxReferenceBytes,
} from "../config.js";

export function pickAllowedValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function sanitizeFileName(value) {
  return String(value)
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "referencia";
}

export function sanitizePathSegment(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim();
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

export function normalizeLibraryFolder(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = normalizeManagedRelativePath(String(value)).replace(/\.[^.]+$/, "");
  return normalized.slice(0, 120);
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

export function normalizeProductModelAlias(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
    .replace(/[̀-ͯ]/g, "")
    .replace(/^#+/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 40);
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

export function normalizeIdList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim());
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

export function normalizeStringList(value, limit = 4, maxLength = 140) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry || "").trim().replace(/\s+/g, " ").slice(0, maxLength))
    .filter(Boolean)
    .slice(0, limit);
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
