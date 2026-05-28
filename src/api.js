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
import { renderJobs, resetRenderedJobsKey } from './render-queue.js';
import { renderFolderBoard } from './render-folders.js';
import { renderUsage } from './render-usage.js';
import { renderCutouts, renderCrops } from './render-media.js';
import {
  renderProductModelList,
  renderPromptProductModelMentions,
  renderImageTemplateList,
  renderPromptImageTemplateMentions,
} from './render-library.js';
import { updatePromptAutocomplete } from './prompt.js';

let lastRenderedCutoutsKey = '';
let lastRenderedCropsKey = '';

export async function refreshHealth() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    if (!response.ok) return;
    if (data.limits && typeof data.limits === 'object') {
      state.limits = { ...state.limits, ...data.limits };
    }
  } catch {
    // non-critical — keeps default limits from state.js
  }
}

export async function refreshPricing() {
  try {
    const response = await fetch('/api/pricing');
    const data = await response.json();
    if (!response.ok) return;
    state.pricing = {
      models: data.models || {},
      currency: data.currency || 'USD',
      updatedAt: data.updatedAt || null,
    };
  } catch {
    // non-critical — cost estimate will show "indisponível"
  }
}

export async function refreshJobs() {
  try {
    const response = await fetch('/api/jobs');
    const data = await response.json();
    if (!response.ok) return;
    renderJobs(data.jobs || []);
    renderFolderBoard();
    if (data.concurrency) concurrencySelect.value = String(data.concurrency);
  } catch {
    queueSummary.textContent = 'Não foi possível atualizar a fila agora.';
  }
}

export async function refreshUsage() {
  try {
    const response = await fetch('/api/usage');
    const data = await response.json();
    if (!response.ok) return;
    renderUsage(data);
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
      renderCutouts(cutouts, data.processing);
    }
    renderFolderBoard();
    if (processingChanged) {
      resetRenderedJobsKey();
      renderJobs(state.lastJobs);
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
      renderCrops(crops);
    }
    renderFolderBoard();
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
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[api] refreshProductModels falhou:', e);
    state.productModels = [];
  }
  renderProductModelList();
  renderPromptProductModelMentions();
  updatePromptAutocomplete();
}

export async function refreshImageTemplates() {
  if (!imageTemplateList) return;
  try {
    const response = await fetch('/api/image-templates');
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || 'Não foi possível carregar os templates visuais.');
    state.imageTemplates = Array.isArray(data.imageTemplates) ? data.imageTemplates : [];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[api] refreshImageTemplates falhou:', e);
    state.imageTemplates = [];
  }
  renderImageTemplateList();
  renderPromptImageTemplateMentions();
  updatePromptAutocomplete();
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
