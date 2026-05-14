import { pricingTable, apiKey } from "../config.js";
import { state, saveProductModel } from "../state.js";
import {
  normalizeProductModelAlias,
  notFoundError,
  pickAllowedValue,
  badRequestError,
} from "./validation.js";
import { normalizeProductModelEvaluation, normalizeStringList, parseJsonObject } from "./serialization.js";
import { buildReferenceParts } from "./files.js";

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
      technical: { statusCode, model, rawMessage },
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
      links: { keys: "https://aistudio.google.com/app/apikey" },
      technical: { statusCode, rawMessage },
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
    technical: { statusCode, rawMessage },
    details: parsed,
  };
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
  if (score >= 78) status = "ready";
  else if (score >= 52) status = "improvable";

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

export async function evaluateProductModelWithGemini(productModel) {
  const payload = {
    contents: [
      {
        parts: [
          {
            text: [
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

  const apiResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    }
  );

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

  const textPart =
    parsed?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === "string")?.text || "";
  const evaluation = parseJsonObject(textPart);
  return normalizeProductModelEvaluation({
    ...evaluation,
    method: "gemini",
  });
}

export function buildAnalytics(db) {
  const PERIOD_DAYS = 30;

  const dailyRows = db.prepare(`
    SELECT substr(finished_at, 1, 10) AS date, model, COUNT(*) AS count
    FROM jobs
    WHERE status = 'completed'
      AND finished_at IS NOT NULL
      AND finished_at >= date('now', '-${PERIOD_DAYS} days')
    GROUP BY date, model
    ORDER BY date
  `).all();

  const modelRows = db.prepare(`
    SELECT model, COUNT(*) AS count
    FROM jobs
    WHERE status = 'completed'
      AND model IS NOT NULL
    GROUP BY model
    ORDER BY count DESC
  `).all();

  const dailyByDate = {};
  for (const row of dailyRows) {
    if (!dailyByDate[row.date]) {
      dailyByDate[row.date] = { date: row.date, count: 0, cost: 0 };
    }
    const unitCost = pricingTable[row.model] ?? 0;
    dailyByDate[row.date].count += row.count;
    dailyByDate[row.date].cost += unitCost * row.count;
  }
  const dailyCosts = Object.values(dailyByDate).sort((a, b) => a.date.localeCompare(b.date));

  const byModel = modelRows.map((row) => {
    const unitCost = pricingTable[row.model] ?? 0;
    return {
      model: row.model,
      label: row.model,
      count: row.count,
      cost: unitCost * row.count,
      unitCost,
    };
  });

  const periodCost = byModel.reduce((s, m) => s + m.cost, 0);
  const periodCount = byModel.reduce((s, m) => s + m.count, 0);

  return {
    ok: true,
    periodDays: PERIOD_DAYS,
    periodCost,
    periodCount,
    dailyCosts,
    byModel,
  };
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
    evaluation =
      (await evaluateProductModelWithGemini(productModel).catch(() => null)) ||
      buildHeuristicProductModelEvaluation(productModel);
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
