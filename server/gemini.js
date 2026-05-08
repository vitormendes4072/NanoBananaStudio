import { GoogleGenAI } from "@google/genai";
import { apiKey } from "./config.js";
import { normalizePromptOptions, serializeReferenceImages, serializeProductModel, serializeImageTemplate } from "./utils.js";
export async function generateImage(job) {
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

