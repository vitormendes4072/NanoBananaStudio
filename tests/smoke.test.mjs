import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CUSTOM_PRESETS_STORAGE_KEY,
  loadCustomPromptPresetsFromStorage,
  persistCustomPromptPresetsToStorage,
  sanitizePromptOptions,
} from "../src/prompt-presets-store.js";

const projectRoot = path.resolve(process.cwd());
const queueStatePath = path.join(projectRoot, "data", "queue-state.json");
const cropStatePath = path.join(projectRoot, "data", "crops-state.json");
const cutoutStatePath = path.join(projectRoot, "data", "cutouts-state.json");
const productModelStatePath = path.join(projectRoot, "data", "product-models.json");
const imageTemplateStatePath = path.join(projectRoot, "data", "image-templates.json");
const testDatabasePath = path.join(projectRoot, "data", `smoke-test-${process.pid}.sqlite`);
const originalQueueState = fs.existsSync(queueStatePath) ? fs.readFileSync(queueStatePath, "utf8") : null;
const originalCropState = fs.existsSync(cropStatePath) ? fs.readFileSync(cropStatePath, "utf8") : null;
const originalCutoutState = fs.existsSync(cutoutStatePath) ? fs.readFileSync(cutoutStatePath, "utf8") : null;
const originalProductModelState = fs.existsSync(productModelStatePath) ? fs.readFileSync(productModelStatePath, "utf8") : null;
const originalImageTemplateState = fs.existsSync(imageTemplateStatePath) ? fs.readFileSync(imageTemplateStatePath, "utf8") : null;

const port = 3217;
const baseUrl = `http://127.0.0.1:${port}`;
const createdFiles = new Set();
const smokeReportPath = path.join(projectRoot, "tests", "smoke-results.json");

async function main() {
  process.env.PORT = String(port);
  process.env.GEMINI_API_KEY = "";
  process.env.QUEUE_CONCURRENCY = "1";
  process.env.DATABASE_PATH = testDatabasePath;
  process.env.DATABASE_JOURNAL_MODE = "MEMORY";
  cleanupTestDatabase();

  const serverModule = await import("../server.js");
  await serverModule.startServer();

  const results = [];

  try {
    await runTest(results, "GET /api/health retorna status basico", async () => {
      const response = await fetchJson("/api/health");
      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(typeof response.body.hasApiKey, "boolean");
      assert.equal(typeof response.body.queueSize, "number");
      assert.equal(response.body.concurrency, 1);
    });

    await runTest(results, "GET /api/jobs retorna fila serializada", async () => {
      const response = await fetchJson("/api/jobs");
      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.ok(Array.isArray(response.body.jobs));
      assert.equal(typeof response.body.concurrency, "number");
    });

    await runTest(results, "GET /api/usage retorna resumo de uso", async () => {
      const response = await fetchJson("/api/usage");
      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(typeof response.body.completedJobs, "number");
      assert.ok(Array.isArray(response.body.byModel));
    });

    await runTest(results, "GET /api/cutouts e /api/crops retornam colecoes", async () => {
      const cutouts = await fetchJson("/api/cutouts");
      const crops = await fetchJson("/api/crops");

      assert.equal(cutouts.status, 200);
      assert.equal(cutouts.body.ok, true);
      assert.ok(Array.isArray(cutouts.body.cutouts));

      assert.equal(crops.status, 200);
      assert.equal(crops.body.ok, true);
      assert.ok(Array.isArray(crops.body.crops));
    });

    await runTest(results, "CRUD basico de modelos de produto persiste referencias", async () => {
      const createResponse = await fetchJson("/api/product-models", {
        method: "POST",
        body: JSON.stringify({
          name: "Travesseiro Adjust",
          alias: "adjust",
          notes: "manter formato e tecido original",
          referenceImages: [
            {
              name: "adjust-base.png",
              mimeType: "image/png",
              data: ONE_PIXEL_PNG_BASE64,
            },
          ],
        }),
      });

      assert.equal(createResponse.status, 201);
      assert.equal(createResponse.body.ok, true);
      assert.equal(createResponse.body.productModel.alias, "adjust");
      assert.equal(createResponse.body.productModel.referenceCount, 1);

      const imageUrl = createResponse.body.productModel.referenceImages[0]?.url || "";
      const imagePath = path.join(
        serverModule.__testUtils.referencesDir,
        imageUrl.replace(/^\/references\//, "")
      );
      createdFiles.add(imagePath);
      assert.ok(fs.existsSync(imagePath));

      const listResponse = await fetchJson("/api/product-models");
      assert.equal(listResponse.status, 200);
      assert.ok(listResponse.body.productModels.some((entry) => entry.alias === "adjust"));

      const deleteResponse = await fetchJson("/api/product-models/adjust", {
        method: "DELETE",
      });
      assert.equal(deleteResponse.status, 200);
      assert.equal(deleteResponse.body.ok, true);
      await assertFileMissing(imagePath);
    });

    await runTest(results, "avaliacao de modelo de produto usa modo gratis por padrao", async () => {
      const createResponse = await fetchJson("/api/product-models", {
        method: "POST",
        body: JSON.stringify({
          name: "Travesseiro Base",
          alias: "base-eval",
          notes: "manter formato principal",
          referenceImages: [
            {
              name: "base-eval.png",
              mimeType: "image/png",
              data: ONE_PIXEL_PNG_BASE64,
            },
          ],
        }),
      });

      assert.equal(createResponse.status, 201);

      const evaluateResponse = await fetchJson("/api/product-models/base-eval/evaluate", {
        method: "POST",
        body: JSON.stringify({}),
      });

      assert.equal(evaluateResponse.status, 200);
      assert.equal(evaluateResponse.body.ok, true);
      assert.equal(evaluateResponse.body.productModel.alias, "base-eval");
      assert.equal(evaluateResponse.body.evaluation.method, "heuristic");
      assert.equal(typeof evaluateResponse.body.evaluation.score, "number");
      assert.ok(Array.isArray(evaluateResponse.body.evaluation.recommendedShots));
      assert.ok(evaluateResponse.body.evaluation.recommendedShots.length >= 1);

      const aiEvaluateResponse = await fetchJson("/api/product-models/base-eval/evaluate", {
        method: "POST",
        body: JSON.stringify({ mode: "gemini" }),
      });
      assert.equal(aiEvaluateResponse.status, 400);
      assert.match(aiEvaluateResponse.body.error, /GEMINI_API_KEY/i);

      await fetchJson("/api/product-models/base-eval", {
        method: "DELETE",
      });
    });

    await runTest(results, "CRUD basico de templates visuais persiste configuracao e referencias", async () => {
      const createResponse = await fetchJson("/api/image-templates", {
        method: "POST",
        body: JSON.stringify({
          name: "Hero clean",
          alias: "hero-clean",
          notes: "composicao central limpa e look premium",
          promptOptions: {
            aspectRatio: "4:5",
            renderFocus: "advertising",
            styleDirection: "hero minimalista",
          },
          referenceImages: [
            {
              name: "hero-clean.png",
              mimeType: "image/png",
              data: ONE_PIXEL_PNG_BASE64,
            },
          ],
        }),
      });

      assert.equal(createResponse.status, 201);
      assert.equal(createResponse.body.ok, true);
      assert.equal(createResponse.body.imageTemplate.alias, "hero-clean");
      assert.equal(createResponse.body.imageTemplate.promptOptions.aspectRatio, "4:5");

      const imageUrl = createResponse.body.imageTemplate.referenceImages[0]?.url || "";
      const imagePath = path.join(
        serverModule.__testUtils.referencesDir,
        imageUrl.replace(/^\/references\//, "")
      );
      createdFiles.add(imagePath);
      assert.ok(fs.existsSync(imagePath));

      const listResponse = await fetchJson("/api/image-templates");
      assert.equal(listResponse.status, 200);
      assert.ok(listResponse.body.imageTemplates.some((entry) => entry.alias === "hero-clean"));

      const deleteResponse = await fetchJson("/api/image-templates/hero-clean", {
        method: "DELETE",
      });
      assert.equal(deleteResponse.status, 200);
      assert.equal(deleteResponse.body.ok, true);
      await assertFileMissing(imagePath);
    });

    await runTest(results, "POST /api/settings atualiza concorrencia", async () => {
      const response = await fetchJson("/api/settings", {
        method: "POST",
        body: JSON.stringify({ concurrency: 3 }),
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.concurrency, 3);

      const jobsResponse = await fetchJson("/api/jobs");
      assert.equal(jobsResponse.body.concurrency, 3);
    });

    await runTest(results, "POST /api/jobs sem chave configurada falha de forma amigavel", async () => {
      const response = await fetchJson("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          promptBase: "teste smoke",
          prompt: "teste smoke",
          quantity: 1,
          model: "gemini-2.5-flash-image",
          promptOptions: {
            aspectRatio: "1:1",
          },
        }),
      });

      assert.equal(response.status, 400);
      assert.match(response.body.error, /GEMINI_API_KEY/i);
    });

    await runTest(results, "DELETE em lote com selecao vazia responde sem erro", async () => {
      const jobs = await fetchJson("/api/jobs/bulk", {
        method: "DELETE",
        body: JSON.stringify({ ids: [] }),
      });
      const cutouts = await fetchJson("/api/cutouts/bulk", {
        method: "DELETE",
        body: JSON.stringify({ ids: [] }),
      });
      const crops = await fetchJson("/api/crops/bulk", {
        method: "DELETE",
        body: JSON.stringify({ ids: [] }),
      });
      const library = await fetchJson("/api/library/bulk", {
        method: "DELETE",
        body: JSON.stringify({ jobs: [], cutouts: [], crops: [] }),
      });

      assert.equal(jobs.status, 200);
      assert.equal(jobs.body.ok, true);
      assert.equal(jobs.body.removed.gallery, 0);

      assert.equal(cutouts.status, 200);
      assert.equal(cutouts.body.ok, true);
      assert.equal(cutouts.body.removed.cutouts, 0);

      assert.equal(crops.status, 200);
      assert.equal(crops.body.ok, true);
      assert.equal(crops.body.removed.crops, 0);

      assert.equal(library.status, 200);
      assert.equal(library.body.ok, true);
      assert.equal(library.body.removed.total, 0);
    });

    await runTest(results, "fluxo: criar job mockado concluido e listar na fila", async () => {
      const mock = createMockCompletedJob(serverModule, {
        promptBase: "smoke fluxo produto",
        promptOptions: {
          aspectRatio: "4:5",
          renderFocus: "product",
        },
      });

      const response = await fetchJson("/api/jobs");
      const job = response.body.jobs.find((entry) => entry.id === mock.job.id);

      assert.equal(response.status, 200);
      assert.ok(job);
      assert.equal(job.status, "completed");
      assert.equal(job.promptBase, "smoke fluxo produto");
      assert.equal(job.promptOptions.aspectRatio, "4:5");
    });

    await runTest(results, "fluxo: remover job individual limpa referencia associada", async () => {
      const mock = createMockCompletedJob(serverModule, {
        promptBase: "smoke remover job",
        withReference: true,
      });

      assert.ok(fs.existsSync(mock.generatedPath));
      assert.ok(fs.existsSync(mock.referencePath));

      const response = await fetchJson(`/api/jobs/${mock.job.id}`, {
        method: "DELETE",
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      await assertFileMissing(mock.generatedPath);
      await assertFileMissing(mock.referencePath);
    });

    await runTest(results, "fluxo: salvar crop por endpoint cria item persistido", async () => {
      const mock = createMockCompletedJob(serverModule, {
        promptBase: "smoke crop",
      });

      const cropPayload = {
        label: "Crop smoke",
        sourceImageUrl: mock.job.result.imageUrl,
        jobId: mock.job.id,
        mimeType: "image/png",
        data: ONE_PIXEL_PNG_BASE64,
      };

      const createResponse = await fetchJson("/api/crops", {
        method: "POST",
        body: JSON.stringify(cropPayload),
      });

      assert.equal(createResponse.status, 201);
      assert.equal(createResponse.body.ok, true);
      assert.equal(createResponse.body.crop.label, "Crop smoke");

      const cropPath = path.join(serverModule.__testUtils.cropsDir, createResponse.body.crop.filename);
      createdFiles.add(cropPath);
      assert.ok(fs.existsSync(cropPath));

      const listResponse = await fetchJson("/api/crops");
      assert.equal(listResponse.status, 200);
      assert.ok(listResponse.body.crops.some((entry) => entry.id === createResponse.body.crop.id));
    });

    await runTest(results, "fluxo: salvar crop em pasta ativa persiste caminho aninhado", async () => {
      const mock = createMockCompletedJob(serverModule, {
        promptBase: "smoke crop pasta",
      });

      const response = await fetchJson("/api/crops", {
        method: "POST",
        body: JSON.stringify({
          label: "Crop em pasta",
          sourceImageUrl: mock.job.result.imageUrl,
          jobId: mock.job.id,
          mimeType: "image/png",
          data: ONE_PIXEL_PNG_BASE64,
          folder: "campanhas/inverno",
        }),
      });

      assert.equal(response.status, 201);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.crop.folder, "campanhas/inverno");
      assert.match(response.body.crop.imageUrl, /\/crops\/campanhas\/inverno\//i);

      const cropPath = path.join(serverModule.__testUtils.cropsDir, response.body.crop.filename);
      createdFiles.add(cropPath);
      assert.ok(fs.existsSync(cropPath));
    });

    await runTest(results, "createJob preserva pasta de destino para geracoes futuras", async () => {
      const job = serverModule.__testUtils.createJob({
        prompt: "smoke pasta destino",
        promptBase: "smoke pasta destino",
        promptOptions: {
          aspectRatio: "1:1",
        },
        model: "gemini-2.5-flash-image",
        referenceImages: [],
        targetFolder: "campanhas/teste",
      });

      assert.equal(job.targetFolder, "campanhas/teste");

      const serializedJob = serverModule.__testUtils.serializeJob(job);
      assert.equal(serializedJob.targetFolder, "campanhas/teste");
    });

    await runTest(results, "fluxo: mover itens selecionados para uma pasta atualiza caminhos", async () => {
      const mock = createMockCompletedJob(serverModule, {
        promptBase: "smoke pasta",
      });

      const response = await fetchJson("/api/library/folders/assign", {
        method: "POST",
        body: JSON.stringify({
          folder: "campanhas/verao",
          jobs: [mock.job.id],
          cutouts: [],
          crops: [],
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.updated.gallery, 1);

      const jobsResponse = await fetchJson("/api/jobs");
      const movedJob = jobsResponse.body.jobs.find((entry) => entry.id === mock.job.id);
      assert.ok(movedJob);
      assert.equal(movedJob.result.folder, "campanhas/verao");
      assert.match(movedJob.result.imageUrl, /\/generated\/campanhas\/verao\//i);

      const movedPath = path.join(serverModule.__testUtils.generatedDir, movedJob.result.filename);
      createdFiles.add(movedPath);
      await assertFileMissing(mock.generatedPath);
      assert.ok(fs.existsSync(movedPath));
    });

    await runTest(results, "fluxo: bulk delete com itens reais remove job e crop", async () => {
      const mock = createMockCompletedJob(serverModule, {
        promptBase: "smoke bulk delete",
        withReference: true,
      });

      const cropPayload = {
        label: "Crop bulk",
        sourceImageUrl: mock.job.result.imageUrl,
        jobId: mock.job.id,
        mimeType: "image/png",
        data: ONE_PIXEL_PNG_BASE64,
      };

      const cropResponse = await fetchJson("/api/crops", {
        method: "POST",
        body: JSON.stringify(cropPayload),
      });

      const cropPath = path.join(serverModule.__testUtils.cropsDir, cropResponse.body.crop.filename);
      createdFiles.add(cropPath);
      assert.ok(fs.existsSync(mock.generatedPath));
      assert.ok(fs.existsSync(mock.referencePath));
      assert.ok(fs.existsSync(cropPath));

      const response = await fetchJson("/api/library/bulk", {
        method: "DELETE",
        body: JSON.stringify({
          jobs: [mock.job.id],
          cutouts: [],
          crops: [cropResponse.body.crop.id],
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.ok, true);
      assert.equal(response.body.removed.gallery, 1);
      assert.equal(response.body.removed.crops, 1);
      assert.equal(response.body.removed.total, 2);
      await assertFileMissing(mock.generatedPath);
      await assertFileMissing(mock.referencePath);
      await assertFileMissing(cropPath);
    });

    await runTest(results, "persistencia de presets no front carrega e salva corretamente", async () => {
      const storage = createMemoryStorage();
      const presets = [
        {
          id: "preset_1",
          name: "Meu preset",
          options: sanitizePromptOptions({
            promptStrength: "strong",
            renderFocus: "editorial",
            aspectRatio: "4:5",
            styleDirection: "editorial clean",
          }),
        },
      ];

      persistCustomPromptPresetsToStorage(storage, presets, CUSTOM_PRESETS_STORAGE_KEY);
      const loaded = loadCustomPromptPresetsFromStorage(storage, CUSTOM_PRESETS_STORAGE_KEY);

      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].name, "Meu preset");
      assert.equal(loaded[0].options.promptStrength, "strong");
      assert.equal(loaded[0].options.aspectRatio, "4:5");
    });

    await runTest(results, "limite de payload grande responde com erro controlado", async () => {
      const hugePayload = {
        promptBase: "teste grande",
        prompt: "teste grande",
        quantity: 1,
        model: "gemini-2.5-flash-image",
        promptOptions: {
          extraInstructions: "x".repeat(61 * 1024 * 1024),
        },
      };

      const response = await fetchJson("/api/jobs", {
        method: "POST",
        body: JSON.stringify(hugePayload),
      });

      assert.equal(response.status, 400);
      assert.match(response.body.error, /limite permitido/i);
    });

    await runTest(results, "falha controlada para remover fundo com source invalido", async () => {
      const response = await fetchJson("/api/cutouts", {
        method: "POST",
        body: JSON.stringify({
          imageUrl: "",
          filename: "",
        }),
      });

      assert.equal(response.status, 400);
      assert.match(response.body.error, /não é válida|selecione uma imagem/i);
    });

    await runTest(results, "falha controlada para crop com source invalido", async () => {
      const response = await fetchJson("/api/crops", {
        method: "POST",
        body: JSON.stringify({
          label: "Crop invalido",
          sourceImageUrl: "",
          jobId: "",
          mimeType: "image/png",
          data: "",
        }),
      });

      assert.equal(response.status, 400);
      assert.match(response.body.error, /não foi possível ler|selecione uma região/i);
    });
  } finally {
    await serverModule.stopServer();
    cleanupTestDatabase();
    restoreStateFile(queueStatePath, originalQueueState);
    restoreStateFile(cropStatePath, originalCropState);
    restoreStateFile(cutoutStatePath, originalCutoutState);
    restoreStateFile(productModelStatePath, originalProductModelState);
    restoreStateFile(imageTemplateStatePath, originalImageTemplateState);
    cleanupCreatedFiles();
  }

  const failed = results.filter((result) => !result.ok);
  fs.writeFileSync(
    smokeReportPath,
    JSON.stringify(
      {
        total: results.length,
        failed: failed.length,
        results: results.map((result) => ({
          name: result.name,
          ok: result.ok,
          error: result.ok ? null : String(result.error?.message || result.error || "Erro desconhecido"),
        })),
      },
      null,
      2
    )
  );

  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
    if (!result.ok) {
      console.error(result.error);
    }
  }

  if (failed.length) {
    process.exitCode = 1;
    return;
  }

  console.log(`Smoke tests concluidos: ${results.length} cenarios ok.`);
}

async function runTest(results, name, fn) {
  console.log(`RUN ${name}`);
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`FAIL ${name}`);
  }
}

async function fetchJson(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

function restoreQueueState() {
  restoreStateFile(queueStatePath, originalQueueState);
}

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function restoreStateFile(filePath, originalContent) {
  if (originalContent === null) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }

  fs.writeFileSync(filePath, originalContent);
}

async function assertFileMissing(filePath) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!fs.existsSync(filePath)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.equal(fs.existsSync(filePath), false);
}

function cleanupCreatedFiles() {
  for (const filePath of createdFiles) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Windows can keep image files locked briefly after response streams finish.
      }
    }
  }
}

function cleanupTestDatabase() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const filePath = `${testDatabasePath}${suffix}`;
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // The database can remain locked after an import-time failure on Windows.
      }
    }
  }
}

function createMockCompletedJob(serverModule, { promptBase, promptOptions = {}, withReference = false }) {
  const today = new Date();
  const nestedFolder = [
    String(today.getFullYear()),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("/");
  const filename = `${nestedFolder}/smoke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;
  const generatedPath = path.join(serverModule.__testUtils.generatedDir, filename);
  fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
  fs.writeFileSync(generatedPath, Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"));
  createdFiles.add(generatedPath);

  const referenceImages = [];
  let referencePath = null;
  if (withReference) {
    const referenceFilename = `${nestedFolder}/ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;
    referencePath = path.join(serverModule.__testUtils.referencesDir, referenceFilename);
    fs.mkdirSync(path.dirname(referencePath), { recursive: true });
    fs.writeFileSync(referencePath, Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"));
    createdFiles.add(referencePath);

    referenceImages.push({
      id: `ref_${Date.now()}`,
      name: "referencia-smoke",
      mimeType: "image/png",
      size: Buffer.from(ONE_PIXEL_PNG_BASE64, "base64").length,
      relativePath: referenceFilename,
      sourceJobId: null,
      sourceKind: "upload",
    });
  }

  const job = serverModule.__testUtils.createJob({
    prompt: promptBase,
    promptBase,
    promptOptions,
    model: "gemini-2.5-flash-image",
    referenceImages,
  });

  job.status = "completed";
  job.finishedAt = new Date().toISOString();
  job.result = {
    ok: true,
    prompt: promptBase,
    model: "gemini-2.5-flash-image",
    mimeType: "image/png",
    textResponse: "",
    filename,
    relativePath: filename,
    imageUrl: `/generated/${filename}`,
    localPath: generatedPath,
  };
  serverModule.__testUtils.saveJob(job);

  return { job, generatedPath, referencePath };
}

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sX6v1sAAAAASUVORK5CYII=";

try {
  await main();
} catch (error) {
  console.error(error);
  restoreStateFile(queueStatePath, originalQueueState);
  restoreStateFile(cropStatePath, originalCropState);
  restoreStateFile(cutoutStatePath, originalCutoutState);
  restoreStateFile(productModelStatePath, originalProductModelState);
  restoreStateFile(imageTemplateStatePath, originalImageTemplateState);
  cleanupTestDatabase();
  cleanupCreatedFiles();
  process.exitCode = 1;
}
