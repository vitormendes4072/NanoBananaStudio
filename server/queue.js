import { state, saveJob, deleteJobFromDb, deleteCutoutFromDb, deleteCropFromDb } from './state.js';
import {
  buildJobId,
  normalizePromptOptions,
  serializeJob,
  normalizeJobError,
  notFoundError,
  badRequestError,
  removeFileIfPresent,
  cleanupReferenceFilesForJobs,
  normalizeJobProductModels,
  normalizeJobImageTemplates,
  normalizeLibraryFolder,
} from './utils.js';
import { generateImage } from './gemini.js';
import { broadcast } from './sse.js';
import { maxJobs } from './config.js';
import { isRetryable } from './utils/retry.js';

export function createJob({
  prompt,
  promptBase = '',
  promptOptions = {},
  model,
  referenceImages = [],
  productModels = [],
  imageTemplates = [],
  targetFolder = '',
  batchId = null,
  batchIndex = null,
  batchTotal = null,
  comparisonId = null,
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
    comparisonId,
    status: 'queued',
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    result: null,
    errorInfo: null,
  };

  saveJob(job);
  trimJobs();
  broadcast('jobs:update');
  return job;
}

export async function processQueue() {
  const jobs = state.jobs;
  while (state.activeJobIds.size < state.concurrency) {
    const nextJob = jobs.find((job) => job.status === 'queued');
    if (!nextJob) {
      return;
    }

    state.activeJobIds.add(nextJob.id);
    nextJob.status = 'processing';
    nextJob.startedAt = new Date().toISOString();
    saveJob(nextJob);
    broadcast('jobs:update');

    runJob(nextJob);
  }
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

/**
 * Tenta gerar a imagem até MAX_RETRIES vezes com backoff exponencial.
 * Erros de auth e quota falham na primeira tentativa.
 * @param {import('./types.js').Job} job
 */
async function generateWithRetry(job) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await generateImage(job);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === MAX_RETRIES) throw error;
      const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `[queue] job ${job.id} tentativa ${attempt}/${MAX_RETRIES} falhou — retry em ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function runJob(job) {
  try {
    const result = await generateWithRetry(job);
    job.status = 'completed';
    job.finishedAt = new Date().toISOString();
    job.result = result;
  } catch (error) {
    job.status = 'failed';
    job.finishedAt = new Date().toISOString();
    job.errorInfo = normalizeJobError(error);
  } finally {
    state.activeJobIds.delete(job.id);
    saveJob(job);
    broadcast('jobs:update');
    processQueue();
  }
}

export function deleteJob(jobId) {
  const job = state.jobsById.get(jobId);
  if (!job) {
    throw notFoundError('Imagem não encontrada.');
  }

  if (job.status === 'processing') {
    throw badRequestError('Aguarde a imagem terminar de processar antes de remover.');
  }

  deleteJobFromDb(job.id);
  state.activeJobIds.delete(job.id);
  removeFileIfPresent(job.result?.localPath);
  cleanupReferenceFilesForJobs([job]);
  return serializeJob(job);
}

export function trimJobs() {
  const jobs = state.jobs;
  if (jobs.length <= maxJobs) {
    return;
  }

  const removed = jobs.slice(maxJobs);
  for (const job of removed) {
    deleteJobFromDb(job.id);
    removeFileIfPresent(job.result?.localPath);
  }
  cleanupReferenceFilesForJobs(removed);

  broadcast('jobs:trim', { removed: removed.length, limit: maxJobs });
}

export function deleteGalleryJobsBulk(ids = []) {
  const allowedIds = new Set(ids);
  const jobs = state.jobs;
  const removableJobs = jobs.filter(
    (job) => allowedIds.has(job.id) && job.status !== 'processing' && job.result?.localPath
  );

  for (const job of removableJobs) {
    deleteJobFromDb(job.id);
    state.activeJobIds.delete(job.id);
    removeFileIfPresent(job.result?.localPath);
  }
  cleanupReferenceFilesForJobs(removableJobs);

  return { gallery: removableJobs.length };
}

export function deleteCutoutsBulk(ids = []) {
  const allowedIds = new Set(ids);
  const cutouts = state.cutouts;
  const removable = cutouts.filter((item) => allowedIds.has(item.id));

  for (const item of removable) {
    deleteCutoutFromDb(item.id);
    removeFileIfPresent(item.localPath);
  }

  return { cutouts: removable.length };
}

export function deleteCropsBulk(ids = []) {
  const allowedIds = new Set(ids);
  const crops = state.crops;
  const removable = crops.filter((item) => allowedIds.has(item.id));

  for (const item of removable) {
    deleteCropFromDb(item.id);
    removeFileIfPresent(item.localPath);
  }

  return { crops: removable.length };
}

export function deleteLibraryBulk({ jobs = [], cutouts = [], crops = [] } = {}) {
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
