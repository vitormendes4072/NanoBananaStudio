import deps from './deps.js';
import {
  state,
  MAX_REFERENCE_IMAGES,
  CUSTOM_FOLDERS_STORAGE_KEY,
  COLLAPSED_SECTIONS_STORAGE_KEY,
  selectedGalleryIds,
  selectedCutoutIds,
  selectedCropIds,
} from './state.js';
import { normalizeFolderValue, escapeHtml, fileToBase64, showToast } from './utils.js';
import {
  CUSTOM_PRESETS_STORAGE_KEY,
  loadCustomPromptPresetsFromStorage,
} from './prompt-presets-store.js';
import {
  form,
  promptInput,
  negativePromptInput,
  promptAutocomplete,
  customPresetNameInput,
  saveCustomPresetButton,
  advancedPromptPanel,
  advancedPromptToggleButton,
  modelSelect,
  statusBox,
  submitButton,
  branchPreview,
  regionPreview,
  referenceInput,
  referencePreview,
  productModelImagesInput,
  imageTemplateImagesInput,
  searchInput,
  queueFilter,
  queueModelFilter,
  galleryFilter,
  viewModeSelect,
  folderFilterInput,
  galleryFolderFilter,
  cutoutFolderFilter,
  cropFolderFilter,
  createFolderButton,
  organizeSelectedButton,
  clearFiltersButton,
  selectAllMediaButton,
  downloadAllMediaButton,
  clearAllMediaButton,
  selectGalleryBulkButton,
  downloadGalleryBulkButton,
  clearGalleryBulkButton,
  selectCutoutsBulkButton,
  downloadCutoutsBulkButton,
  clearCutoutsBulkButton,
  selectCropsBulkButton,
  downloadCropsBulkButton,
  clearCropsBulkButton,
  concurrencySelect,
  quantitySelect,
  appLayout,
  composerPanel,
} from './dom.js';

import './selection.js';
import './render-usage.js';
import './render-analytics.js';
import './render-folders.js';
import './render-queue.js';
import './render-media.js';
import './prompt.js';
import './render-library.js';
import './dialogs.js';
import './composer.js';
import './events.js';
import './region-editor.js';
import {
  refreshJobs,
  refreshUsage,
  refreshCutouts,
  refreshCrops,
  refreshProductModels,
  refreshImageTemplates,
  connectSSE,
} from './api.js';
import { refreshAnalytics } from './render-analytics.js';

bootstrap();

function bootstrap() {
  state.customFolders = loadCustomFolders();
  state.collapsedSections = loadCollapsedSections();
  state.customPromptPresets = loadCustomPromptPresetsFromStorage(
    window.localStorage,
    CUSTOM_PRESETS_STORAGE_KEY
  );

  registerBootstrapDeps();
  bindStaticEvents();
  renderInitialState();
  refreshInitialData();
}

function registerBootstrapDeps() {
  deps.normalizeFolderValue = normalizeFolderValue;
  deps.getActiveCreationFolder = getActiveCreationFolder;
  deps.registerFolderName = registerFolderName;
  deps.buildReferencePayload = buildReferencePayload;
  deps.syncReferenceInputFiles = syncReferenceInputFiles;
  deps.renderReferencePreview = renderReferencePreview;
  deps.renderBranchPreview = renderBranchPreview;
  deps.renderRegionPreview = renderRegionPreview;
  deps.selectBranchFromJob = selectBranchFromJob;
  deps.organizeSelectedButton = organizeSelectedButton;
}

function bindStaticEvents() {
  bindPromptEvents();
  bindFilterEvents();
  bindBulkEvents();
  bindFolderEvents();
  bindUploadEvents();
  bindComposerEvents();
  bindCollapseEvents();
  bindFormEvents();
}

function renderInitialState() {
  renderBranchPreview();
  renderRegionPreview();
  renderReferencePreview();
  deps.renderProductModelUploadPreview();
  deps.renderImageTemplateUploadPreview();
  deps.renderCustomPromptPresets();
  syncAdvancedPromptCollapsedState();
  syncSectionCollapsedState();
  deps.requestComposerPanelPinning();
}

async function refreshInitialData() {
  await Promise.all([
    refreshJobs(),
    refreshUsage(),
    refreshAnalytics(),
    refreshCutouts(),
    refreshCrops(),
    refreshProductModels(),
    refreshImageTemplates(),
  ]);
  connectSSE();
}

function bindPromptEvents() {
  promptInput?.addEventListener('input', () => {
    deps.renderPromptProductModelMentions();
    deps.renderPromptImageTemplateMentions();
    deps.updatePromptAutocomplete();
  });
  promptInput?.addEventListener('click', () => deps.updatePromptAutocomplete());
  promptInput?.addEventListener('keyup', (event) => {
    if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
      return;
    }
    deps.updatePromptAutocomplete();
  });
  promptInput?.addEventListener('blur', () => {
    window.setTimeout(() => deps.hidePromptAutocomplete(), 120);
  });
  promptInput?.addEventListener('keydown', deps.handlePromptAutocompleteKeydown);

  for (const button of document.querySelectorAll('[data-prompt-preset]')) {
    button.addEventListener('click', () => deps.applyPromptPreset(button.dataset.promptPreset));
  }
  saveCustomPresetButton?.addEventListener('click', deps.saveCurrentPromptPreset);
  customPresetNameInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      deps.saveCurrentPromptPreset();
    }
  });
  promptAutocomplete?.addEventListener('mousedown', (event) => event.preventDefault());
}

function bindFilterEvents() {
  const rerenderAll = () => {
    deps.renderJobs(state.lastJobs);
    deps.renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
    deps.renderCrops(state.lastCrops);
    deps.renderFolderBoard();
  };

  searchInput?.addEventListener('input', () => deps.renderJobs(state.lastJobs));
  queueFilter?.addEventListener('change', () => deps.renderJobs(state.lastJobs));
  queueModelFilter?.addEventListener('change', () => deps.renderJobs(state.lastJobs));
  galleryFilter?.addEventListener('change', () => deps.renderJobs(state.lastJobs));
  galleryFolderFilter?.addEventListener('change', () => deps.renderJobs(state.lastJobs));
  cutoutFolderFilter?.addEventListener('change', () =>
    deps.renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId))
  );
  cropFolderFilter?.addEventListener('change', () => deps.renderCrops(state.lastCrops));
  viewModeSelect?.addEventListener('change', rerenderAll);
  folderFilterInput?.addEventListener('input', rerenderAll);

  clearFiltersButton?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (queueFilter) queueFilter.value = 'active';
    if (queueModelFilter) queueModelFilter.value = 'all';
    if (galleryFilter) galleryFilter.value = 'all';
    if (viewModeSelect) viewModeSelect.value = 'grid';
    if (folderFilterInput) folderFilterInput.value = '';
    if (galleryFolderFilter) galleryFolderFilter.value = 'all';
    if (cutoutFolderFilter) cutoutFolderFilter.value = 'all';
    if (cropFolderFilter) cropFolderFilter.value = 'all';
    rerenderAll();
  });
}

function bindBulkEvents() {
  selectGalleryBulkButton?.addEventListener('click', () => {
    deps.toggleSectionSelection(
      state.lastJobs.filter((job) => job.status === 'completed' && job.result).map((job) => job.id),
      selectedGalleryIds
    );
    deps.renderJobs(state.lastJobs);
  });
  selectCutoutsBulkButton?.addEventListener('click', () => {
    deps.toggleSectionSelection(
      state.lastCutouts.map((item) => item.id),
      selectedCutoutIds
    );
    deps.renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
  });
  selectCropsBulkButton?.addEventListener('click', () => {
    deps.toggleSectionSelection(
      state.lastCrops.map((item) => item.id),
      selectedCropIds
    );
    deps.renderCrops(state.lastCrops);
  });
  selectAllMediaButton?.addEventListener('click', toggleAllMediaSelection);

  downloadGalleryBulkButton?.addEventListener('click', () =>
    deps.exportSelectedItems(
      { jobs: Array.from(selectedGalleryIds) },
      'Selecione pelo menos uma imagem da Galeria para baixar.'
    )
  );
  downloadCutoutsBulkButton?.addEventListener('click', () =>
    deps.exportSelectedItems(
      { cutouts: Array.from(selectedCutoutIds) },
      'Selecione pelo menos um item em Remover fundo para baixar.'
    )
  );
  downloadCropsBulkButton?.addEventListener('click', () =>
    deps.exportSelectedItems(
      { crops: Array.from(selectedCropIds) },
      'Selecione pelo menos um recorte para baixar.'
    )
  );
  downloadAllMediaButton?.addEventListener('click', () =>
    deps.exportSelectedItems(
      {
        jobs: Array.from(selectedGalleryIds),
        cutouts: Array.from(selectedCutoutIds),
        crops: Array.from(selectedCropIds),
      },
      'Selecione pelo menos um item para baixar.'
    )
  );

  clearGalleryBulkButton?.addEventListener('click', () =>
    deps.handleBulkRemoval({
      button: clearGalleryBulkButton,
      endpoint: '/api/jobs/bulk',
      getPayload: () => ({ ids: Array.from(selectedGalleryIds) }),
      confirmMessage: `Remover ${selectedGalleryIds.size} imagem(ns) selecionada(s) da Galeria?`,
      loadingLabel: 'Removendo...',
      successMessage: 'Imagens selecionadas removidas da Galeria.',
      refreshers: [refreshJobs, refreshUsage],
    })
  );
  clearCutoutsBulkButton?.addEventListener('click', () =>
    deps.handleBulkRemoval({
      button: clearCutoutsBulkButton,
      endpoint: '/api/cutouts/bulk',
      getPayload: () => ({ ids: Array.from(selectedCutoutIds) }),
      confirmMessage: `Remover ${selectedCutoutIds.size} item(ns) selecionado(s) de Remover fundo?`,
      loadingLabel: 'Removendo...',
      successMessage: 'Itens selecionados de Remover fundo removidos.',
      refreshers: [refreshCutouts],
    })
  );
  clearCropsBulkButton?.addEventListener('click', () =>
    deps.handleBulkRemoval({
      button: clearCropsBulkButton,
      endpoint: '/api/crops/bulk',
      getPayload: () => ({ ids: Array.from(selectedCropIds) }),
      confirmMessage: `Remover ${selectedCropIds.size} recorte(s) selecionado(s)?`,
      loadingLabel: 'Removendo...',
      successMessage: 'Recortes selecionados removidos.',
      refreshers: [refreshCrops],
    })
  );
  clearAllMediaButton?.addEventListener('click', () =>
    deps.handleBulkRemoval({
      button: clearAllMediaButton,
      endpoint: '/api/library/bulk',
      getPayload: () => ({
        jobs: Array.from(selectedGalleryIds),
        cutouts: Array.from(selectedCutoutIds),
        crops: Array.from(selectedCropIds),
      }),
      confirmMessage: `Remover ${selectedGalleryIds.size + selectedCutoutIds.size + selectedCropIds.size} item(ns) selecionado(s) no total?`,
      loadingLabel: 'Limpando tudo...',
      successMessage: 'Itens selecionados removidos.',
      refreshers: [refreshJobs, refreshUsage, refreshCutouts, refreshCrops],
    })
  );
}

function bindFolderEvents() {
  organizeSelectedButton?.addEventListener('click', async () => {
    const nextFolder = await deps.requestFolderSelection({
      title: 'Organizar selecionados',
      message: 'Selecione uma pasta existente ou digite uma nova para os itens selecionados.',
      currentFolder: deps.getSharedSelectedFolder(),
    });
    if (nextFolder !== null) {
      await deps.handleFolderAssignment(nextFolder);
    }
  });

  createFolderButton?.addEventListener('click', async () => {
    const nextFolder = await deps.requestFolderSelection({
      title: 'Criar pasta',
      message: 'Digite o nome da nova pasta ou selecione uma existente para ativar esse filtro.',
      currentFolder: getActiveCreationFolder(),
    });
    if (nextFolder === null) return;
    const normalizedFolder = normalizeFolderValue(nextFolder);
    if (!normalizedFolder) {
      statusBox.textContent = 'Informe um nome de pasta para criar.';
      return;
    }
    registerFolderName(normalizedFolder);
    if (folderFilterInput) folderFilterInput.value = normalizedFolder;
    deps.renderJobs(state.lastJobs);
    deps.renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
    deps.renderCrops(state.lastCrops);
    deps.renderFolderBoard();
    statusBox.textContent = `Pasta ${normalizedFolder} pronta para uso.`;
  });
}

function bindUploadEvents() {
  referenceInput?.addEventListener('change', () => {
    const incomingFiles = Array.from(referenceInput.files || []);
    state.selectedReferenceFiles = incomingFiles.slice(0, MAX_REFERENCE_IMAGES);
    syncReferenceInputFiles();
    renderReferencePreview();
    if (incomingFiles.length > MAX_REFERENCE_IMAGES) {
      statusBox.textContent = `Use no máximo ${MAX_REFERENCE_IMAGES} imagens de referência por lote.`;
    }
  });
  productModelImagesInput?.addEventListener('change', () => {
    const incomingFiles = Array.from(productModelImagesInput.files || []);
    state.selectedProductModelFiles = incomingFiles.slice(0, MAX_REFERENCE_IMAGES);
    deps.syncProductModelInputFiles();
    deps.renderProductModelUploadPreview();
  });
  imageTemplateImagesInput?.addEventListener('change', () => {
    const incomingFiles = Array.from(imageTemplateImagesInput.files || []);
    state.selectedImageTemplateFiles = incomingFiles.slice(0, MAX_REFERENCE_IMAGES);
    deps.syncImageTemplateInputFiles();
    deps.renderImageTemplateUploadPreview();
  });

  document.querySelector('#save-product-model')?.addEventListener('click', deps.saveProductModel);
  document.querySelector('#save-image-template')?.addEventListener('click', deps.saveImageTemplate);
}

function bindComposerEvents() {
  window.addEventListener('scroll', deps.requestComposerPanelPinning, { passive: true });
  window.addEventListener('resize', deps.requestComposerPanelPinning);
  window.addEventListener('load', deps.requestComposerPanelPinning);
  if (typeof ResizeObserver !== 'undefined' && appLayout && composerPanel) {
    const composerResizeObserver = new ResizeObserver(() => deps.requestComposerPanelPinning());
    composerResizeObserver.observe(appLayout);
    composerResizeObserver.observe(composerPanel);
  }
  document
    .querySelector('#composer-expand-button')
    ?.addEventListener('click', deps.toggleComposerExpanded);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && deps.isComposerExpanded()) {
      deps.collapseComposer();
    }
  });
}

function bindCollapseEvents() {
  advancedPromptToggleButton?.addEventListener('click', () => {
    state.advancedPromptCollapsed = !state.advancedPromptCollapsed;
    syncAdvancedPromptCollapsedState();
  });

  for (const button of document.querySelectorAll('[data-toggle-section]')) {
    button.addEventListener('click', () => {
      const sectionKey = button.getAttribute('data-toggle-section');
      if (!sectionKey) return;
      state.collapsedSections = {
        ...state.collapsedSections,
        [sectionKey]: !state.collapsedSections[sectionKey],
      };
      persistCollapsedSections();
      syncSectionCollapsedState();
      deps.requestComposerPanelPinning();
    });
  }
}

function bindFormEvents() {
  concurrencySelect?.addEventListener('change', async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concurrency: concurrencySelect.value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao atualizar concorrência.');
      statusBox.textContent = `Concorrência atualizada para ${data.concurrency} worker(s).`;
      await refreshJobs();
    } catch (error) {
      statusBox.textContent =
        error instanceof Error ? error.message : 'Falha ao atualizar concorrência.';
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!promptInput?.value.trim()) {
      statusBox.textContent = 'Informe um prompt para gerar a imagem.';
      promptInput?.focus();
      return;
    }

    const activeTargetFolder = getActiveCreationFolder();
    if (activeTargetFolder) registerFolderName(activeTargetFolder);
    const promptResolution = deps.resolvePromptProductModels(promptInput.value);
    const templateResolution = deps.resolvePromptImageTemplates(promptResolution.cleanPrompt);
    const promptBase = templateResolution.cleanPrompt || promptInput.value.trim();
    const promptOptions = deps.collectPromptOptions();
    const regionReferenceImages = state.selectedRegionReference?.payload
      ? [state.selectedRegionReference.payload]
      : [];
    const referenceImages = await buildReferencePayload(state.selectedReferenceFiles);

    setLoading(true, 'Adicionando job na fila...');
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptBase,
          prompt: deps.buildLocalizedPrompt(
            promptBase,
            promptOptions,
            state.selectedRegionReference
          ),
          promptOptions,
          quantity: quantitySelect?.value || 1,
          model: modelSelect?.value || 'gemini-2.5-flash-image',
          folder: activeTargetFolder,
          referenceImages: [...regionReferenceImages, ...referenceImages],
          branchReference: state.selectedBranchReference,
          productModelAliases: promptResolution.aliases,
          imageTemplateAliases: templateResolution.aliases,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao criar job.');

      promptInput.value = '';
      if (negativePromptInput) negativePromptInput.value = '';
      state.selectedReferenceFiles = [];
      state.selectedBranchReference = null;
      state.selectedRegionReference = null;
      syncReferenceInputFiles();
      renderReferencePreview();
      renderBranchPreview();
      renderRegionPreview();
      statusBox.textContent = `${data.quantity || 1} job(s) adicionado(s) na fila.`;
      await refreshJobs();
      await refreshUsage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao adicionar job.';
      statusBox.textContent = message;
      showToast(message);
    } finally {
      setLoading(false);
    }
  });
}

function toggleAllMediaSelection() {
  const galleryIds = state.lastJobs
    .filter((job) => job.status === 'completed' && job.result)
    .map((job) => job.id);
  const cutoutIds = state.lastCutouts.map((item) => item.id);
  const cropIds = state.lastCrops.map((item) => item.id);
  const totalIds = galleryIds.length + cutoutIds.length + cropIds.length;
  const selectedTotal = selectedGalleryIds.size + selectedCutoutIds.size + selectedCropIds.size;
  const shouldSelectAll = totalIds > 0 && selectedTotal !== totalIds;

  deps.applySectionSelection(galleryIds, selectedGalleryIds, shouldSelectAll);
  deps.applySectionSelection(cutoutIds, selectedCutoutIds, shouldSelectAll);
  deps.applySectionSelection(cropIds, selectedCropIds, shouldSelectAll);
  deps.renderJobs(state.lastJobs);
  deps.renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
  deps.renderCrops(state.lastCrops);
}

function setLoading(isLoading, label = 'Adicionando job na fila...') {
  if (!submitButton) return;
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? 'Enfileirando...' : 'Adicionar na fila';
  statusBox.textContent = isLoading ? label : statusBox.textContent;
}

export function getActiveCreationFolder() {
  return normalizeFolderValue(folderFilterInput?.value);
}

function loadCustomFolders() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_FOLDERS_STORAGE_KEY) || '[]');
    return Array.from(
      new Set(parsed.map((entry) => normalizeFolderValue(entry)).filter(Boolean))
    ).sort((left, right) => left.localeCompare(right, 'pt-BR'));
  } catch {
    return [];
  }
}

export function registerFolderName(folder) {
  const normalizedFolder = normalizeFolderValue(folder);
  if (!normalizedFolder || state.customFolders.includes(normalizedFolder)) return;
  state.customFolders = [...state.customFolders, normalizedFolder].sort((left, right) =>
    left.localeCompare(right, 'pt-BR')
  );
  window.localStorage.setItem(CUSTOM_FOLDERS_STORAGE_KEY, JSON.stringify(state.customFolders));
}

function loadCollapsedSections() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COLLAPSED_SECTIONS_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistCollapsedSections() {
  window.localStorage.setItem(
    COLLAPSED_SECTIONS_STORAGE_KEY,
    JSON.stringify(state.collapsedSections)
  );
}

function syncAdvancedPromptCollapsedState() {
  if (!advancedPromptPanel || !advancedPromptToggleButton) return;
  advancedPromptPanel.classList.toggle('is-collapsed', state.advancedPromptCollapsed);
  advancedPromptToggleButton.setAttribute(
    'aria-expanded',
    state.advancedPromptCollapsed ? 'false' : 'true'
  );
  advancedPromptToggleButton.setAttribute(
    'aria-label',
    state.advancedPromptCollapsed ? 'Expandir controles avançados' : 'Minimizar controles avançados'
  );
}

function syncSectionCollapsedState() {
  for (const section of document.querySelectorAll('[data-collapsible-section]')) {
    const sectionKey = section.getAttribute('data-collapsible-section');
    const isCollapsed = Boolean(state.collapsedSections[sectionKey]);
    section.classList.toggle('is-collapsed', isCollapsed);
    const button = section.querySelector('[data-toggle-section]');
    if (!button) continue;
    button.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    button.classList.toggle('is-collapsed', isCollapsed);
  }
}

export async function buildReferencePayload(files) {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      mimeType: file.type,
      data: await fileToBase64(file),
    }))
  );
}

export function syncReferenceInputFiles() {
  if (!referenceInput) return;
  const dataTransfer = new DataTransfer();
  for (const file of state.selectedReferenceFiles) {
    dataTransfer.items.add(file);
  }
  referenceInput.files = dataTransfer.files;
}

export function renderReferencePreview() {
  if (!referencePreview) return;
  if (!state.selectedReferenceFiles.length) {
    referencePreview.innerHTML = `<p class="reference-empty">Nenhuma referência selecionada.</p>`;
    return;
  }

  referencePreview.innerHTML = '';
  state.selectedReferenceFiles.forEach((file, index) => {
    const imageUrl = URL.createObjectURL(file);
    const card = document.createElement('article');
    card.className = 'reference-card';
    card.innerHTML = `
      <img src="${imageUrl}" alt="${escapeHtml(file.name)}">
      <div class="reference-body">
        <p class="reference-name">${escapeHtml(file.name)}</p>
      </div>
      <div class="reference-actions">
        <button class="ghost-button" type="button" data-remove-reference-bg="${index}">Remover fundo</button>
        <button class="icon-action-button icon-action-button-danger" type="button" data-remove-reference="${index}" aria-label="Remover referência">
          <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true"><path d="M9 3h6"></path><path d="M4 6h16"></path><path d="M7 6l1 14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-14"></path></svg>
        </button>
      </div>
    `;
    referencePreview.appendChild(card);
  });
  deps.bindInteractiveActions();
}

export function renderBranchPreview() {
  if (!branchPreview) return;
  if (!state.selectedBranchReference) {
    branchPreview.innerHTML = `<p class="reference-empty">Nenhuma imagem base selecionada.</p>`;
    return;
  }
  branchPreview.innerHTML = `
    <article class="reference-card">
      <img src="${state.selectedBranchReference.imageUrl}" alt="${escapeHtml(state.selectedBranchReference.name || 'Imagem base')}">
      <div class="reference-body"><p class="reference-name">${escapeHtml(state.selectedBranchReference.name || 'Imagem base')}</p></div>
      <button class="ghost-button" type="button" data-clear-branch-reference>Limpar</button>
    </article>
  `;
  branchPreview.querySelector('[data-clear-branch-reference]')?.addEventListener('click', () => {
    state.selectedBranchReference = null;
    state.selectedRegionReference = null;
    renderBranchPreview();
    renderRegionPreview();
  });
}

export function renderRegionPreview() {
  if (!regionPreview) return;
  if (!state.selectedRegionReference) {
    regionPreview.innerHTML = `<p class="reference-empty">Nenhuma região marcada.</p>`;
    return;
  }
  regionPreview.innerHTML = `
    <article class="reference-card">
      <img src="${state.selectedRegionReference.previewUrl}" alt="Região selecionada">
      <div class="reference-body"><p class="reference-name">Região selecionada para edição</p></div>
      <button class="ghost-button" type="button" data-clear-region-reference>Limpar</button>
    </article>
  `;
  regionPreview.querySelector('[data-clear-region-reference]')?.addEventListener('click', () => {
    state.selectedRegionReference = null;
    renderRegionPreview();
  });
}

export function selectBranchFromJob(jobId, keepPrompt) {
  const job = state.lastJobs.find((entry) => entry.id === jobId);
  if (!job?.result?.imageUrl) {
    statusBox.textContent = 'Não foi possível selecionar essa imagem como base.';
    return;
  }

  state.selectedBranchReference = {
    jobId: job.id,
    imageUrl: job.result.imageUrl,
    filename: job.result.filename,
    name: deps.buildDisplayPrompt(job),
  };
  state.selectedRegionReference = null;
  if (keepPrompt && promptInput) {
    promptInput.value = deps.buildDisplayPrompt(job);
    deps.hydratePromptOptions(job.promptOptions || {});
  }
  renderBranchPreview();
  renderRegionPreview();
  statusBox.textContent = keepPrompt
    ? 'Imagem base e prompt carregados.'
    : 'Imagem base selecionada.';
  promptInput?.focus();
}
