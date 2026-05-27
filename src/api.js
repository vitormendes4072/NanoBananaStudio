import deps from './deps.js';
import { state } from './state.js';
import { showToast } from './utils.js';
import {
  queueSummary,
  concurrencySelect,
  cutoutSummary,
  cutoutFolderFilter,
  cropSummary,
  viewModeSelect,
  usageSummary,
  productModelList,
  imageTemplateList,
} from './dom.js';

let lastRenderedCutoutsKey = '';
let lastRenderedCropsKey = '';

export async function refreshJobs() {
  try {
    const response = await fetch('/api/jobs');
    const data = await response.json();
    if (!response.ok) return;
    deps.renderJobs(data.jobs || []);
    deps.renderFolderBoard();
    if (data.concurrency) concurrencySelect.value = String(data.concurrency);
  } catch {
    queueSummary.textContent = 'Não foi possível atualizar a fila agora.';
    showToast('Falha ao atualizar a fila. Verifique sua conexão.');
  }
}

export async function refreshUsage() {
  try {
    const response = await fetch('/api/usage');
    const data = await response.json();
    if (!response.ok) return;
    deps.renderUsage(data);
  } catch {
    usageSummary.textContent = 'Não foi possível carregar o uso estimado.';
  }
}

export async function refreshCutouts() {
  try {
    const response = await fetch('/api/cutouts');
    const data = await response.json();
    if (!response.ok) return;
    const nextProcessingJobId = data.processing ? data.processingJobId || null : null;
    const processingChanged = state.cutoutProcessingJobId !== nextProcessingJobId;
    state.cutoutProcessingJobId = nextProcessingJobId;
    const cutouts = data.cutouts || [];
    state.lastCutouts = cutouts;
    const nextCutoutsKey = JSON.stringify({
      processing: Boolean(data.processing),
      processingJobId: state.cutoutProcessingJobId,
      folderFilter: cutoutFolderFilter.value,
      viewMode: viewModeSelect.value,
      cutouts: cutouts.map((item) => [item.id, item.filename, item.createdAt, item.folder || '']),
    });
    if (nextCutoutsKey !== lastRenderedCutoutsKey) {
      lastRenderedCutoutsKey = nextCutoutsKey;
      deps.renderCutouts(cutouts, data.processing);
    }
    deps.renderFolderBoard();
    if (processingChanged) {
      deps.resetRenderedJobsKey();
      deps.renderJobs(state.lastJobs);
    }
  } catch {
    state.cutoutProcessingJobId = null;
    lastRenderedCutoutsKey = '';
    cutoutSummary.textContent = 'Não foi possível carregar os recortes agora.';
  }
}

export async function refreshCrops() {
  try {
    const response = await fetch('/api/crops');
    const data = await response.json();
    if (!response.ok) return;
    const crops = data.crops || [];
    state.lastCrops = crops;
    const nextCropsKey = JSON.stringify({
      folderFilter: viewModeSelect.value,
      viewMode: viewModeSelect.value,
      crops: crops.map((item) => [item.id, item.filename, item.createdAt, item.folder || '']),
    });
    if (nextCropsKey !== lastRenderedCropsKey) {
      lastRenderedCropsKey = nextCropsKey;
      deps.renderCrops(crops);
    }
    deps.renderFolderBoard();
  } catch {
    lastRenderedCropsKey = '';
    cropSummary.textContent = 'Não foi possível carregar os recortes agora.';
  }
}

export async function refreshProductModels() {
  if (!productModelList) return;
  try {
    const response = await fetch('/api/product-models');
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || 'Não foi possível carregar os modelos de produto.');
    state.productModels = Array.isArray(data.productModels) ? data.productModels : [];
  } catch {
    state.productModels = [];
  }
  deps.renderProductModelList();
  deps.renderPromptProductModelMentions();
  deps.updatePromptAutocomplete();
}

export async function refreshImageTemplates() {
  if (!imageTemplateList) return;
  try {
    const response = await fetch('/api/image-templates');
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || 'Não foi possível carregar os templates visuais.');
    state.imageTemplates = Array.isArray(data.imageTemplates) ? data.imageTemplates : [];
  } catch {
    state.imageTemplates = [];
  }
  deps.renderImageTemplateList();
  deps.renderPromptImageTemplateMentions();
  deps.updatePromptAutocomplete();
}

export function connectSSE() {
  const source = new EventSource('/api/jobs/stream');

  source.addEventListener('jobs:update', () => {
    refreshJobs();
    refreshUsage();
  });

  source.addEventListener('jobs:trim', (e) => {
    const { removed, limit } = JSON.parse(e.data);
    showToast(
      `${removed} imagem(ns) antiga(s) removida(s) automaticamente. Limite da galeria: ${limit}.`,
      'warning'
    );
    refreshJobs();
  });

  source.addEventListener('cutouts:trim', (e) => {
    const { removed, limit } = JSON.parse(e.data);
    showToast(
      `${removed} recorte(s) antigo(s) removido(s) automaticamente. Limite: ${limit}.`,
      'warning'
    );
    refreshCutouts();
  });

  source.addEventListener('crops:trim', (e) => {
    const { removed, limit } = JSON.parse(e.data);
    showToast(
      `${removed} crop(s) antigo(s) removido(s) automaticamente. Limite: ${limit}.`,
      'warning'
    );
    refreshCrops();
  });

  source.onerror = () => {
    // EventSource reconnects automatically via the retry interval set by the server
  };
}

deps.refreshJobs = refreshJobs;
deps.refreshUsage = refreshUsage;
deps.refreshCutouts = refreshCutouts;
deps.refreshCrops = refreshCrops;
deps.refreshProductModels = refreshProductModels;
deps.refreshImageTemplates = refreshImageTemplates;
deps.connectSSE = connectSSE;
