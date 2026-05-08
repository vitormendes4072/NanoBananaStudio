
export const state = {
  lastJobs: [],
  lastCutouts: [],
  lastCrops: [],
  productModels: [],
  imageTemplates: [],
  cutoutProcessingJobId: null,
  selectedReferenceFiles: [],
  selectedProductModelFiles: [],
  selectedImageTemplateFiles: [],
  selectedBranchReference: null,
  selectedRegionReference: null,
  regionEditorState: null,
  collapsedSections: {},
  advancedPromptCollapsed: false
};

import { normalizeFolderValue, formatDate, formatRelativeDateTime, formatBytes, buildVersionLabel, modelLabel, escapeHtml, fileToBase64, base64ToFile, arrayBufferToBase64, slugifyProductModelAlias, slugifyImageTemplateAlias, clamp, showToast } from './utils.js';
import {
  form,
  promptInput,
  promptAutocomplete,
  promptAutocompleteList,
  productModelMentions,
  imageTemplateMentions,
  negativePromptInput,
  promptStrengthSelect,
  renderFocusSelect,
  aspectRatioSelect,
  customPresetNameInput,
  saveCustomPresetButton,
  customPresetList,
  advancedPromptPanel,
  advancedPromptBody,
  advancedPromptToggleButton,
  styleDirectionInput,
  preserveDetailsInput,
  extraInstructionsInput,
  modelSelect,
  statusBox,
  submitButton,
  branchPreview,
  regionPreview,
  referenceInput,
  referencePreview,
  productModelNameInput,
  productModelAliasInput,
  productModelNotesInput,
  productModelImagesInput,
  productModelUploadPreview,
  productModelList,
  saveProductModelButton,
  imageTemplateNameInput,
  imageTemplateAliasInput,
  imageTemplateNotesInput,
  imageTemplateImagesInput,
  imageTemplateUploadPreview,
  imageTemplateList,
  saveImageTemplateButton,
  queueList,
  queueSummary,
  concurrencySelect,
  quantitySelect,
  galleryGrid,
  gallerySummary,
  galleryFolderFilter,
  cutoutGrid,
  cutoutSummary,
  cutoutFolderFilter,
  cropGrid,
  cropSummary,
  cropFolderFilter,
  searchInput,
  queueFilter,
  queueModelFilter,
  galleryFilter,
  viewModeSelect,
  folderFilterInput,
  createFolderButton,
  organizeSelectedButton,
  folderBoard,
  folderSummary,
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
  usageSummary,
  usageCards,
  usageModels,
  usageLinks,
  appLayout,
  composerColumn,
  composerPanel,
  composerExpandButton,
  regionEditor,
  regionCanvas,
  regionEditorTitle,
  regionEditorDescription,
  regionEditorMeta,
  closeRegionEditorButton,
  resetRegionSelectionButton,
  applyRegionSelectionButton,
  confirmDialog,
  confirmDialogTitle,
  confirmDialogMessage,
  confirmDialogCancelButton,
  confirmDialogConfirmButton,
  folderDialog,
  folderDialogTitle,
  folderDialogMessage,
  folderDialogCurrent,
  folderDialogInput,
  folderDialogOptions,
  folderDialogClearButton,
  folderDialogCancelButton,
  folderDialogConfirmButton
} from './dom.js';
import {
  CUSTOM_PRESETS_STORAGE_KEY,
  loadCustomPromptPresetsFromStorage,
  persistCustomPromptPresetsToStorage,
  sanitizePromptOptions,
} from "./prompt-presets-store.js";












































































































const MODEL_INFO = {
  "gemini-2.5-flash-image": {
    shortLabel: "Nano Banana",
  },
  "gemini-3-pro-image-preview": {
    shortLabel: "Nano Banana Pro",
  },
};

function thumbUrl(originalUrl) {
  if (!originalUrl) return '';
  return `/api/thumb?src=${encodeURIComponent(originalUrl)}`;
}

const MAX_REFERENCE_IMAGES = 4;
const CUSTOM_FOLDERS_STORAGE_KEY = "nano-banana-custom-folders";
const COLLAPSED_SECTIONS_STORAGE_KEY = "nano-banana-collapsed-sections";
const PROMPT_PRESETS = {
  product: {
    renderFocus: "product",
    styleDirection: "product shot limpo, luz controlada de estudio, acabamento premium",
    preserveDetails: "forma real do produto, proporções, materiais e identidade visual",
    extraInstructions: "fundo limpo, destaque claro do produto, reflexos suaves e nitidez comercial",
  },
  fashion: {
    renderFocus: "editorial",
    styleDirection: "editorial fashion, composicao sofisticada, luz direcional elegante",
    preserveDetails: "silhueta, materiais, styling e postura coerente",
    extraInstructions: "clima premium, fotografia refinada e tratamento visual de campanha",
  },
  lifestyle: {
    renderFocus: "lifestyle",
    styleDirection: "lifestyle natural, fotografia espontânea e calor humano",
    preserveDetails: "cena coerente, produto principal e contexto natural",
    extraInstructions: "ambiente crível, luz orgânica e atmosfera convidativa",
  },
  ads: {
    renderFocus: "advertising",
    styleDirection: "advertising high-end, impacto visual limpo e composição comercial",
    preserveDetails: "hierarquia visual do sujeito principal e leitura imediata",
    extraInstructions: "resultado polido, contraste controlado e acabamento pronto para campanha",
  },
  closeup: {
    renderFocus: "closeup",
    aspectRatio: "1:1",
    styleDirection: "macro close-up, detalhamento alto e foco preciso",
    preserveDetails: "texturas, contornos e pontos de interesse em primeiro plano",
    extraInstructions: "enquadramento fechado, profundidade de campo suave e definição elevada",
  },
  "portrait-post": {
    aspectRatio: "4:5",
    renderFocus: "editorial",
    styleDirection: "composição vertical para feed, leitura forte no centro e enquadramento elegante",
    preserveDetails: "sujeito principal dominante e área segura bem resolvida",
    extraInstructions: "resultado pensado para post retrato, com foco visual claro e bom aproveitamento vertical",
  },
  "story-reel": {
    aspectRatio: "9:16",
    renderFocus: "advertising",
    styleDirection: "composição vertical imersiva, impacto rápido e hierarquia visual objetiva",
    preserveDetails: "sujeito principal forte, enquadramento vertical e leitura limpa",
    extraInstructions: "resultado pensado para story ou reel, com área útil bem distribuída no eixo vertical",
  },
  banner: {
    aspectRatio: "16:9",
    renderFocus: "advertising",
    styleDirection: "composição horizontal ampla, visual limpo e respiro lateral",
    preserveDetails: "sujeito principal bem definido e estrutura ampla sem elementos apertados",
    extraInstructions: "resultado pensado para banner, hero ou capa horizontal com boa leitura panoramica",
  },
};

let pollTimer = null;
let lastRenderedJobsKey = "";
let lastRenderedCutoutsKey = "";
let lastRenderedCropsKey = "";
let settingsRequestInFlight = false;
state.lastJobs = [];
state.lastCutouts = [];
state.lastCrops = [];
state.productModels = [];
state.imageTemplates = [];
state.cutoutProcessingJobId = null;
state.selectedReferenceFiles = [];
state.selectedProductModelFiles = [];
state.selectedImageTemplateFiles = [];
let promptAutocompleteState = {
  query: null,
  options: [],
  activeIndex: 0,
};
state.selectedBranchReference = null;
state.selectedRegionReference = null;
state.regionEditorState = null;
let composerPinFrame = 0;
let composerExpanded = false;
let confirmDialogResolver = null;
let folderDialogResolver = null;
let customPromptPresets = loadCustomPromptPresets();
let customFolders = loadCustomFolders();
state.collapsedSections = loadCollapsedSections();
state.advancedPromptCollapsed = false;
const selectedGalleryIds = new Set();
const selectedCutoutIds = new Set();
const selectedCropIds = new Set();
const REGION_HANDLE_SIZE = 10;

checkHealth();
refreshJobs();
refreshUsage();
refreshCutouts();
refreshCrops();
refreshProductModels();
refreshImageTemplates();
renderBranchPreview();
renderRegionPreview();
renderReferencePreview();
renderProductModelUploadPreview();
renderPromptProductModelMentions();
renderImageTemplateUploadPreview();
renderPromptImageTemplateMentions();
renderCustomPromptPresets();
syncAdvancedPromptCollapsedState();
bindSectionCollapseActions();
syncSectionCollapsedState();
startPolling();
requestComposerPanelPinning();

searchInput.addEventListener("input", () => renderJobs(state.lastJobs));
promptInput.addEventListener("input", () => renderPromptProductModelMentions());
promptInput.addEventListener("input", () => renderPromptImageTemplateMentions());
promptInput.addEventListener("input", () => updatePromptAutocomplete());
promptInput.addEventListener("click", () => updatePromptAutocomplete());
promptInput.addEventListener("keyup", (event) => {
  if (["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(event.key)) {
    return;
  }
  updatePromptAutocomplete();
});
promptInput.addEventListener("blur", () => {
  window.setTimeout(() => hidePromptAutocomplete(), 120);
});
promptInput.addEventListener("keydown", handlePromptAutocompleteKeydown);
queueFilter.addEventListener("change", () => renderJobs(state.lastJobs));
queueModelFilter.addEventListener("change", () => renderJobs(state.lastJobs));
galleryFilter.addEventListener("change", () => renderJobs(state.lastJobs));
viewModeSelect.addEventListener("change", () => {
  renderJobs(state.lastJobs);
  renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
  renderCrops(state.lastCrops);
});
folderFilterInput.addEventListener("input", () => {
  renderJobs(state.lastJobs);
  renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
  renderCrops(state.lastCrops);
  renderFolderBoard();
});
galleryFolderFilter.addEventListener("change", () => renderJobs(state.lastJobs));
cutoutFolderFilter.addEventListener("change", () => renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId)));
cropFolderFilter.addEventListener("change", () => renderCrops(state.lastCrops));
window.addEventListener("scroll", requestComposerPanelPinning, { passive: true });
window.addEventListener("resize", requestComposerPanelPinning);
window.addEventListener("load", requestComposerPanelPinning);

if (typeof ResizeObserver !== "undefined" && appLayout && composerPanel) {
  const composerResizeObserver = new ResizeObserver(() => requestComposerPanelPinning());
  composerResizeObserver.observe(appLayout);
  composerResizeObserver.observe(composerPanel);
}

if (composerExpandButton && composerPanel) {
  composerExpandButton.addEventListener("click", () => {
    composerExpanded = !composerExpanded;
    syncComposerExpandedState();
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && composerExpanded) {
    composerExpanded = false;
    syncComposerExpandedState();
  }
});

clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  queueFilter.value = "active";
  queueModelFilter.value = "all";
  galleryFilter.value = "all";
  viewModeSelect.value = "grid";
  folderFilterInput.value = "";
  galleryFolderFilter.value = "all";
  cutoutFolderFilter.value = "all";
  cropFolderFilter.value = "all";
  renderJobs(state.lastJobs);
  renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
  renderCrops(state.lastCrops);
  renderFolderBoard();
});

if (organizeSelectedButton) {
  organizeSelectedButton.addEventListener("click", async () => {
    const nextFolder = await requestFolderSelection({
      title: "Organizar selecionados",
      message: "Selecione uma pasta existente ou digite uma nova para os itens selecionados.",
      currentFolder: getSharedSelectedFolder(),
    });

    if (nextFolder === null) {
      return;
    }

    await handleFolderAssignment(nextFolder);
  });
}

if (createFolderButton) {
  createFolderButton.addEventListener("click", async () => {
    const nextFolder = await requestFolderSelection({
      title: "Criar pasta",
      message: "Digite o nome da nova pasta ou selecione uma existente para ativar esse filtro.",
      currentFolder: getActiveCreationFolder(),
    });

    if (nextFolder === null) {
      return;
    }

    const normalizedFolder = normalizeFolderValue(nextFolder);
    if (!normalizedFolder) {
      statusBox.textContent = "Informe um nome de pasta para criar.";
      folderDialogInput?.focus();
      return;
    }

    registerFolderName(normalizedFolder);
    folderFilterInput.value = normalizedFolder;
    renderJobs(state.lastJobs);
    renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
    renderCrops(state.lastCrops);
    renderFolderBoard();
    statusBox.textContent = `Pasta ${normalizedFolder} pronta para uso. Novas imagens podem ser salvas nela.`;
  });
}

if (clearGalleryBulkButton) {
  clearGalleryBulkButton.addEventListener("click", () =>
    handleBulkRemoval({
      button: clearGalleryBulkButton,
      endpoint: "/api/jobs/bulk",
      getPayload: () => ({ ids: Array.from(selectedGalleryIds) }),
      confirmMessage: `Remover ${selectedGalleryIds.size} imagem(ns) selecionada(s) da Galeria?`,
      loadingLabel: "Removendo...",
      successMessage: "Imagens selecionadas removidas da Galeria.",
      refreshers: [refreshJobs, refreshUsage],
    })
  );
}

if (selectGalleryBulkButton) {
  selectGalleryBulkButton.addEventListener("click", () => {
    toggleSectionSelection(state.lastJobs.filter((job) => job.status === "completed" && job.result).map((job) => job.id), selectedGalleryIds);
    renderJobs(state.lastJobs);
  });
}

if (downloadGalleryBulkButton) {
  downloadGalleryBulkButton.addEventListener("click", () =>
    downloadSelectedItems(
      Array.from(selectedGalleryIds)
        .map((id) => state.lastJobs.find((job) => job.id === id)?.result)
        .filter(Boolean),
      "Selecione pelo menos uma imagem da Galeria para baixar.",
      "Download da Galeria iniciado."
    )
  );
}

if (clearCutoutsBulkButton) {
  clearCutoutsBulkButton.addEventListener("click", () =>
    handleBulkRemoval({
      button: clearCutoutsBulkButton,
      endpoint: "/api/cutouts/bulk",
      getPayload: () => ({ ids: Array.from(selectedCutoutIds) }),
      confirmMessage: `Remover ${selectedCutoutIds.size} item(ns) selecionado(s) de Remover fundo?`,
      loadingLabel: "Removendo...",
      successMessage: "Itens selecionados removidos de Remover fundo.",
      refreshers: [refreshCutouts],
    })
  );
}

if (selectCutoutsBulkButton) {
  selectCutoutsBulkButton.addEventListener("click", () => {
    toggleSectionSelection(state.lastCutouts.map((item) => item.id), selectedCutoutIds);
    renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
  });
}

if (downloadCutoutsBulkButton) {
  downloadCutoutsBulkButton.addEventListener("click", () =>
    downloadSelectedItems(
      Array.from(selectedCutoutIds)
        .map((id) => state.lastCutouts.find((item) => item.id === id))
        .filter(Boolean),
      "Selecione pelo menos um item em Remover fundo para baixar.",
      "Download de Remover fundo iniciado."
    )
  );
}

if (clearCropsBulkButton) {
  clearCropsBulkButton.addEventListener("click", () =>
    handleBulkRemoval({
      button: clearCropsBulkButton,
      endpoint: "/api/crops/bulk",
      getPayload: () => ({ ids: Array.from(selectedCropIds) }),
      confirmMessage: `Remover ${selectedCropIds.size} recorte(s) selecionado(s)?`,
      loadingLabel: "Removendo...",
      successMessage: "Recortes selecionados removidos.",
      refreshers: [refreshCrops],
    })
  );
}

if (selectCropsBulkButton) {
  selectCropsBulkButton.addEventListener("click", () => {
    toggleSectionSelection(state.lastCrops.map((item) => item.id), selectedCropIds);
    renderCrops(state.lastCrops);
  });
}

if (downloadCropsBulkButton) {
  downloadCropsBulkButton.addEventListener("click", () =>
    downloadSelectedItems(
      Array.from(selectedCropIds)
        .map((id) => state.lastCrops.find((item) => item.id === id))
        .filter(Boolean),
      "Selecione pelo menos um recorte para baixar.",
      "Download de Recortes iniciado."
    )
  );
}

if (clearAllMediaButton) {
  clearAllMediaButton.addEventListener("click", () =>
    handleBulkRemoval({
      button: clearAllMediaButton,
      endpoint: "/api/library/bulk",
      getPayload: () => ({
        jobs: Array.from(selectedGalleryIds),
        cutouts: Array.from(selectedCutoutIds),
        crops: Array.from(selectedCropIds),
      }),
      confirmMessage: `Remover ${selectedGalleryIds.size + selectedCutoutIds.size + selectedCropIds.size} item(ns) selecionado(s) no total?`,
      loadingLabel: "Limpando tudo...",
      successMessage: "Itens selecionados removidos.",
      refreshers: [refreshJobs, refreshUsage, refreshCutouts, refreshCrops],
    })
  );
}

if (selectAllMediaButton) {
  selectAllMediaButton.addEventListener("click", () => {
    const galleryIds = state.lastJobs.filter((job) => job.status === "completed" && job.result).map((job) => job.id);
    const cutoutIds = state.lastCutouts.map((item) => item.id);
    const cropIds = state.lastCrops.map((item) => item.id);
    const totalIds = galleryIds.length + cutoutIds.length + cropIds.length;
    const selectedTotal = selectedGalleryIds.size + selectedCutoutIds.size + selectedCropIds.size;
    const shouldSelectAll = totalIds > 0 && selectedTotal !== totalIds;

    applySectionSelection(galleryIds, selectedGalleryIds, shouldSelectAll);
    applySectionSelection(cutoutIds, selectedCutoutIds, shouldSelectAll);
    applySectionSelection(cropIds, selectedCropIds, shouldSelectAll);
    renderJobs(state.lastJobs);
    renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
    renderCrops(state.lastCrops);
  });
}

if (downloadAllMediaButton) {
  downloadAllMediaButton.addEventListener("click", () =>
    downloadSelectedItems(
      [
        ...Array.from(selectedGalleryIds).map((id) => state.lastJobs.find((job) => job.id === id)?.result),
        ...Array.from(selectedCutoutIds).map((id) => state.lastCutouts.find((item) => item.id === id)),
        ...Array.from(selectedCropIds).map((id) => state.lastCrops.find((item) => item.id === id)),
      ].filter(Boolean),
      "Selecione pelo menos um item para baixar.",
      "Download dos itens selecionados iniciado."
    )
  );
}

referenceInput.addEventListener("change", () => {
  const incomingFiles = Array.from(referenceInput.files || []);
  state.selectedReferenceFiles = incomingFiles.slice(0, MAX_REFERENCE_IMAGES);
  syncReferenceInputFiles();
  renderReferencePreview();

  if (incomingFiles.length > MAX_REFERENCE_IMAGES) {
    statusBox.textContent = `Use no máximo ${MAX_REFERENCE_IMAGES} imagens de referência por lote.`;
  }
});

if (productModelImagesInput) {
  productModelImagesInput.addEventListener("change", () => {
    const incomingFiles = Array.from(productModelImagesInput.files || []);
    state.selectedProductModelFiles = incomingFiles.slice(0, MAX_REFERENCE_IMAGES);
    syncProductModelInputFiles();
    renderProductModelUploadPreview();

    if (incomingFiles.length > MAX_REFERENCE_IMAGES) {
      statusBox.textContent = `Use no maximo ${MAX_REFERENCE_IMAGES} imagens por modelo de produto.`;
    }
  });
}

if (saveProductModelButton) {
  saveProductModelButton.addEventListener("click", saveProductModel);
}

if (imageTemplateImagesInput) {
  imageTemplateImagesInput.addEventListener("change", () => {
    const incomingFiles = Array.from(imageTemplateImagesInput.files || []);
    state.selectedImageTemplateFiles = incomingFiles.slice(0, MAX_REFERENCE_IMAGES);
    syncImageTemplateInputFiles();
    renderImageTemplateUploadPreview();

    if (incomingFiles.length > MAX_REFERENCE_IMAGES) {
      statusBox.textContent = `Use no maximo ${MAX_REFERENCE_IMAGES} imagens por template visual.`;
    }
  });
}

if (saveImageTemplateButton) {
  saveImageTemplateButton.addEventListener("click", saveImageTemplate);
}

if (productModelNameInput && productModelAliasInput) {
  productModelNameInput.addEventListener("input", () => {
    if (productModelAliasInput.value.trim()) {
      return;
    }

    productModelAliasInput.value = slugifyProductModelAlias(productModelNameInput.value);
  });
}

if (imageTemplateNameInput && imageTemplateAliasInput) {
  imageTemplateNameInput.addEventListener("input", () => {
    if (imageTemplateAliasInput.value.trim()) {
      return;
    }

    imageTemplateAliasInput.value = slugifyImageTemplateAlias(imageTemplateNameInput.value);
  });
}

for (const button of document.querySelectorAll("[data-prompt-preset]")) {
  button.addEventListener("click", () => {
    const presetKey = button.getAttribute("data-prompt-preset");
    applyPromptPreset(presetKey);
  });
}

if (saveCustomPresetButton) {
  saveCustomPresetButton.addEventListener("click", saveCurrentPromptPreset);
}

if (advancedPromptToggleButton) {
  advancedPromptToggleButton.addEventListener("click", () => {
    state.advancedPromptCollapsed = !state.advancedPromptCollapsed;
    syncAdvancedPromptCollapsedState();
  });
}

concurrencySelect.addEventListener("change", async () => {
  if (settingsRequestInFlight) {
    return;
  }

  settingsRequestInFlight = true;
  statusBox.textContent = "Atualizando concorrência da fila...";

  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ concurrency: Number(concurrencySelect.value) }),
    });

    const data = await response.json();
    if (!response.ok) {
    throw new Error(data.error || "Falha ao atualizar a concorrência.");
    }

    concurrencySelect.value = String(data.concurrency);
    statusBox.textContent = `Concorrência atualizada para ${data.concurrency} worker(s).`;
    await refreshJobs();
    await refreshUsage();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro ao atualizar concorrência.";
    statusBox.textContent = msg;
    showToast(msg);
  } finally {
    settingsRequestInFlight = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  setLoading(true, "Adicionando job na fila...");

  try {
    const activeTargetFolder = getActiveCreationFolder();
    if (activeTargetFolder) {
      registerFolderName(activeTargetFolder);
    }
    const referenceImages = await buildReferencePayload(state.selectedReferenceFiles);
    const regionReferenceImages = state.selectedRegionReference ? [state.selectedRegionReference.payload] : [];
    const promptBase = promptInput.value.trim();
    const productModelResolution = resolvePromptProductModels(promptBase);
    const imageTemplateResolution = resolvePromptImageTemplates(productModelResolution.cleanPrompt || promptBase);
    const promptOptions = collectPromptOptions();
    const localizedPrompt = buildLocalizedPrompt(
      imageTemplateResolution.cleanPrompt || productModelResolution.cleanPrompt || promptBase,
      promptOptions,
      state.selectedRegionReference,
      productModelResolution.matchedModels,
      imageTemplateResolution.matchedTemplates
    );
    const payload = {
      promptBase,
      prompt: localizedPrompt,
      promptOptions,
      model: modelSelect.value,
      quantity: Number(quantitySelect.value),
      branchReference: state.selectedBranchReference,
      referenceImages: [...regionReferenceImages, ...referenceImages],
      productModelAliases: productModelResolution.aliases,
      imageTemplateAliases: imageTemplateResolution.aliases,
      folder: activeTargetFolder,
    };

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Falha ao adicionar job na fila.");
    }

    const currentModel = payload.model || "gemini-2.5-flash-image";
    const currentConcurrency = concurrencySelect.value;
    const currentQuantity = quantitySelect.value;

    form.reset();
    state.selectedReferenceFiles = [];
    state.selectedBranchReference = null;
    state.selectedRegionReference = null;
    renderBranchPreview();
    renderReferencePreview();
    renderRegionPreview();
    renderPromptProductModelMentions();
    modelSelect.value = currentModel;
    concurrencySelect.value = currentConcurrency;
    quantitySelect.value = currentQuantity;

    setLoading(
      false,
        `${data.quantity || (data.jobs || []).length} job(s) adicionados na fila.${productModelResolution.aliases.length ? ` Modelo(s): ${productModelResolution.aliases.map((alias) => `@${alias}`).join(", ")}.` : ""}${imageTemplateResolution.aliases.length ? ` Template(s): ${imageTemplateResolution.aliases.map((alias) => `#${alias}`).join(", ")}.` : ""}${activeTargetFolder ? ` Pasta destino: ${activeTargetFolder}.` : ""}${state.selectedBranchReference ? " Base anexada." : ""}${state.selectedRegionReference ? " Região anexada." : ""}${referenceImages.length ? ` ${referenceImages.length} referência(s) anexada(s).` : ""} Você pode enviar outro agora.`
    );
    await refreshJobs();
    await refreshUsage();
    await refreshCutouts();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido.";
    setLoading(false, msg);
    showToast(msg);
  }
});

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    if (!data.hasApiKey) {
  statusBox.textContent = "Adicione sua GEMINI_API_KEY no arquivo .env para liberar a geração.";
    }
  } catch {
  statusBox.textContent = "Não foi possível verificar o servidor.";
  showToast("Servidor indisponível. Verifique se o backend está rodando.");
  }
}

function setLoading(isLoading, message) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Enfileirando..." : "Adicionar na fila";
  statusBox.textContent = message;
}

function getActiveCreationFolder() {
  return normalizeFolderValue(folderFilterInput?.value);
}



function collectPromptOptions() {
  return {
    negativePrompt: negativePromptInput?.value.trim() || "",
    promptStrength: promptStrengthSelect?.value || "balanced",
    renderFocus: renderFocusSelect?.value || "",
    aspectRatio: aspectRatioSelect?.value || "1:1",
    styleDirection: styleDirectionInput?.value.trim() || "",
    preserveDetails: preserveDetailsInput?.value.trim() || "",
    extraInstructions: extraInstructionsInput?.value.trim() || "",
  };
}

function syncAdvancedPromptCollapsedState() {
  if (!advancedPromptPanel || !advancedPromptToggleButton) {
    return;
  }

  advancedPromptPanel.classList.toggle("is-collapsed", state.advancedPromptCollapsed);
  advancedPromptToggleButton.classList.toggle("is-active", !state.advancedPromptCollapsed);
  advancedPromptToggleButton.setAttribute("aria-expanded", state.advancedPromptCollapsed ? "false" : "true");
  advancedPromptToggleButton.setAttribute("aria-label", state.advancedPromptCollapsed ? "Expandir controles avançados" : "Minimizar controles avançados");
  advancedPromptToggleButton.setAttribute("title", state.advancedPromptCollapsed ? "Expandir controles avançados" : "Minimizar controles avançados");

  if (advancedPromptBody) {
    advancedPromptBody.setAttribute("aria-hidden", state.advancedPromptCollapsed ? "true" : "false");
  }
}

function bindSectionCollapseActions() {
  for (const button of document.querySelectorAll("[data-toggle-section]")) {
    button.addEventListener("click", () => {
      const sectionKey = button.getAttribute("data-toggle-section");
      if (!sectionKey) {
        return;
      }

      state.collapsedSections = {
        ...state.collapsedSections,
        [sectionKey]: !state.collapsedSections[sectionKey],
      };
      persistCollapsedSections();
      syncSectionCollapsedState();
      requestComposerPanelPinning();
    });
  }
}

function syncSectionCollapsedState() {
  for (const section of document.querySelectorAll("[data-collapsible-section]")) {
    const sectionKey = section.getAttribute("data-collapsible-section");
    if (!sectionKey) {
      continue;
    }

    const isCollapsed = Boolean(state.collapsedSections[sectionKey]);
    section.classList.toggle("is-collapsed", isCollapsed);

    const button = section.querySelector(`[data-toggle-section="${sectionKey}"]`);
    if (!button) {
      continue;
    }

    const titleNode = section.querySelector(".section-head h2");
    const sectionTitle = titleNode?.textContent?.trim() || "secao";
    button.classList.toggle("is-collapsed", isCollapsed);
    button.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    button.setAttribute("aria-label", isCollapsed ? `Expandir ${sectionTitle}` : `Minimizar ${sectionTitle}`);
    button.setAttribute("title", isCollapsed ? `Expandir ${sectionTitle}` : `Minimizar ${sectionTitle}`);
  }
}

function loadCustomPromptPresets() {
  return loadCustomPromptPresetsFromStorage(window.localStorage, CUSTOM_PRESETS_STORAGE_KEY);
}

function loadCollapsedSections() {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_SECTIONS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([key]) => typeof key === "string" && key.trim())
        .map(([key, value]) => [key, Boolean(value)])
    );
  } catch {
    return {};
  }
}

function loadCustomFolders() {
  try {
    const raw = window.localStorage.getItem(CUSTOM_FOLDERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return Array.from(new Set(parsed.map((entry) => normalizeFolderValue(entry)).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right, "pt-BR")
    );
  } catch {
    return [];
  }
}

function persistCollapsedSections() {
  window.localStorage.setItem(COLLAPSED_SECTIONS_STORAGE_KEY, JSON.stringify(state.collapsedSections));
}

function persistCustomFolders() {
  window.localStorage.setItem(CUSTOM_FOLDERS_STORAGE_KEY, JSON.stringify(customFolders));
}

function registerFolderName(folder) {
  const normalizedFolder = normalizeFolderValue(folder);
  if (!normalizedFolder) {
    return;
  }

  if (!customFolders.includes(normalizedFolder)) {
    customFolders = [...customFolders, normalizedFolder].sort((left, right) => left.localeCompare(right, "pt-BR"));
    persistCustomFolders();
  }
}

async function refreshProductModels() {
  if (!productModelList) {
    return;
  }

  try {
    const response = await fetch("/api/product-models");
    const data = await response.json();
    if (!response.ok) {
    throw new Error(data.error || "Não foi possível carregar os modelos de produto.");
    }

    state.productModels = Array.isArray(data.state.productModels) ? data.state.productModels : [];
    renderProductModelList();
    renderPromptProductModelMentions();
    updatePromptAutocomplete();
  } catch {
    state.productModels = [];
    renderProductModelList();
    renderPromptProductModelMentions();
    updatePromptAutocomplete();
  }
}

async function refreshImageTemplates() {
  if (!imageTemplateList) {
    return;
  }

  try {
    const response = await fetch("/api/image-templates");
    const data = await response.json();
    if (!response.ok) {
    throw new Error(data.error || "Não foi possível carregar os templates visuais.");
    }

    state.imageTemplates = Array.isArray(data.state.imageTemplates) ? data.state.imageTemplates : [];
    renderImageTemplateList();
    renderPromptImageTemplateMentions();
    updatePromptAutocomplete();
  } catch {
    state.imageTemplates = [];
    renderImageTemplateList();
    renderPromptImageTemplateMentions();
    updatePromptAutocomplete();
  }
}

function renderProductModelList() {
  if (!productModelList) {
    return;
  }

  if (!state.productModels.length) {
    productModelList.innerHTML = `<p class="reference-empty">Nenhum modelo de produto cadastrado ainda.</p>`;
    bindInteractiveActions();
    return;
  }

  productModelList.innerHTML = state.productModels
    .map((model) => {
      const unavailableCount = (model.referenceImages || []).filter((image) => image && image.isAvailable === false).length;
      const usageHistory = getLibraryUsageHistory("productModel", model.alias);
      const thumbs = (model.referenceImages || [])
        .slice(0, 4)
        .map(
          (image) => `
            <span class="product-model-thumb">
              ${
                image?.url
                  ? `<img src="${image.url}" alt="${escapeHtml(model.name)}">`
                  : `<span class="product-model-thumb-fallback" aria-label="Referência indisponível">Arquivo ausente</span>`
              }
            </span>
          `
        )
        .join("");
      const evaluation = renderProductModelEvaluation(model.evaluation);

      return `
        <article class="product-model-card">
          <div class="product-model-card-head">
            <div>
              <p class="product-model-card-name">${escapeHtml(model.name)}</p>
              <p class="product-model-card-alias">@${escapeHtml(model.alias)}</p>
            </div>
            <button class="icon-action-button icon-action-button-danger" type="button" data-delete-product-model="${escapeHtml(model.alias)}" aria-label="Excluir modelo" title="Excluir modelo">
              <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                <path d="M9 3h6"></path>
                <path d="M4 6h16"></path>
                <path d="M7 6l1 14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-14"></path>
                <path d="M10 10v7"></path>
                <path d="M14 10v7"></path>
              </svg>
            </button>
          </div>
          ${model.notes ? `<p class="product-model-card-notes">${escapeHtml(model.notes)}</p>` : ""}
          ${unavailableCount ? `<p class="product-model-card-warning">${escapeHtml(`${unavailableCount} referência(s) deste modelo não estão mais disponíveis no disco.`)}</p>` : ""}
          <div class="product-model-thumb-row">${thumbs}</div>
          ${renderLibraryUsageHistory(usageHistory, "modelo")}
          ${evaluation}
          <div class="product-model-card-actions">
            <button class="ghost-button" type="button" data-insert-product-model="${escapeHtml(model.alias)}">Inserir @${escapeHtml(model.alias)}</button>
            <button class="ghost-button" type="button" data-evaluate-product-model="${escapeHtml(model.alias)}">Avaliar gratis</button>
            <button class="ghost-button" type="button" data-evaluate-product-model-ai="${escapeHtml(model.alias)}">Avaliar com IA</button>
          </div>
        </article>
      `;
    })
    .join("");

  bindInteractiveActions();
}

function renderProductModelEvaluation(evaluation) {
  if (!evaluation) {
    return `
      <div class="product-model-evaluation product-model-evaluation-empty">
        <p class="product-model-evaluation-summary">Use a avaliacao gratis para um parecer rapido, ou a avaliacao com IA se quiser uma leitura mais profunda.</p>
      </div>
    `;
  }

  const strengths = Array.isArray(evaluation.strengths) ? evaluation.strengths.slice(0, 2) : [];
  const missing = Array.isArray(evaluation.missing) ? evaluation.missing.slice(0, 2) : [];
  const recommendedShots = Array.isArray(evaluation.recommendedShots) ? evaluation.recommendedShots.slice(0, 2) : [];
  const statusLabel = getProductModelEvaluationStatusLabel(evaluation.status);
  const statusClass = getProductModelEvaluationStatusClass(evaluation.status);
  const methodLabel = evaluation.method === "gemini" ? "IA" : "Heuristica";

  return `
    <div class="product-model-evaluation ${statusClass}">
      <div class="product-model-evaluation-head">
        <span class="product-model-evaluation-badge">${escapeHtml(statusLabel)}</span>
        <span class="product-model-evaluation-score">${escapeHtml(`${Math.round(Number(evaluation.score) || 0)}/100`)}</span>
      </div>
      <p class="product-model-evaluation-summary">${escapeHtml(evaluation.summary || "Avaliacao atualizada.")}</p>
      ${strengths.length ? `<p class="product-model-evaluation-list"><strong>Pontos fortes:</strong> ${escapeHtml(strengths.join(" | "))}</p>` : ""}
      ${missing.length ? `<p class="product-model-evaluation-list"><strong>Faltando:</strong> ${escapeHtml(missing.join(" | "))}</p>` : ""}
      ${recommendedShots.length ? `<p class="product-model-evaluation-list"><strong>Recomendo:</strong> ${escapeHtml(recommendedShots.join(" | "))}</p>` : ""}
      <p class="product-model-evaluation-meta">Fonte: ${escapeHtml(methodLabel)}${evaluation.updatedAt ? ` • ${escapeHtml(formatRelativeDateTime(evaluation.updatedAt))}` : ""}</p>
    </div>
  `;
}

function getProductModelEvaluationStatusLabel(status) {
  if (status === "ready") {
    return "Pronto para usar";
  }
  if (status === "improvable") {
    return "Bom, mas pode melhorar";
  }
      return "Precisa de mais referências";
}

function getProductModelEvaluationStatusClass(status) {
  if (status === "ready") {
    return "is-ready";
  }
  if (status === "improvable") {
    return "is-improvable";
  }
  return "is-insufficient";
}

function renderProductModelUploadPreview() {
  if (!productModelUploadPreview) {
    return;
  }

  if (!state.selectedProductModelFiles.length) {
    productModelUploadPreview.innerHTML = `<p class="reference-empty">Nenhuma imagem do modelo selecionada.</p>`;
    return;
  }

  productModelUploadPreview.innerHTML = "";
  for (const [index, file] of state.selectedProductModelFiles.entries()) {
    const imageUrl = URL.createObjectURL(file);
    const card = document.createElement("article");
    card.className = "reference-card";
    card.innerHTML = `
      <img src="${imageUrl}" alt="${escapeHtml(file.name)}">
      <div class="reference-body">
        <p class="reference-name">${escapeHtml(file.name)}</p>
        <p class="reference-meta">${escapeHtml(formatBytes(file.size))}</p>
      </div>
      <button class="reference-remove" type="button" data-remove-product-model-file="${index}" aria-label="Remover imagem do modelo">Remover</button>
    `;

    const image = card.querySelector("img");
    image.addEventListener("load", () => URL.revokeObjectURL(imageUrl), { once: true });
    productModelUploadPreview.appendChild(card);
  }

  bindInteractiveActions();
}

function renderImageTemplateUploadPreview() {
  if (!imageTemplateUploadPreview) {
    return;
  }

  if (!state.selectedImageTemplateFiles.length) {
    imageTemplateUploadPreview.innerHTML = `<p class="reference-empty">Nenhuma imagem do template selecionada.</p>`;
    return;
  }

  imageTemplateUploadPreview.innerHTML = "";
  for (const [index, file] of state.selectedImageTemplateFiles.entries()) {
    const imageUrl = URL.createObjectURL(file);
    const card = document.createElement("article");
    card.className = "reference-card";
    card.innerHTML = `
      <img src="${imageUrl}" alt="${escapeHtml(file.name)}">
      <div class="reference-body">
        <p class="reference-name">${escapeHtml(file.name)}</p>
        <p class="reference-meta">${escapeHtml(formatBytes(file.size))}</p>
      </div>
      <button class="reference-remove" type="button" data-remove-image-template-file="${index}" aria-label="Remover imagem do template">Remover</button>
    `;

    const image = card.querySelector("img");
    image.addEventListener("load", () => URL.revokeObjectURL(imageUrl), { once: true });
    imageTemplateUploadPreview.appendChild(card);
  }

  bindInteractiveActions();
}

function renderPromptProductModelMentions() {
  if (!productModelMentions) {
    return;
  }

  const resolution = resolvePromptProductModels(promptInput?.value || "");
  if (!resolution.matchedModels.length) {
    productModelMentions.innerHTML = `<p class="reference-empty">Use <code>@alias</code> no prompt para puxar um modelo de produto salvo.</p>`;
    return;
  }

  const names = resolution.matchedModels.map((model) => model.name).filter(Boolean);
  productModelMentions.innerHTML = `
    <div class="prompt-mentions-card">
      <div class="product-model-mentions-list">
        ${resolution.matchedModels
          .map(
            (model) => `
              <span class="product-model-chip">
                @${escapeHtml(model.alias)}
              </span>
            `
          )
          .join("")}
      </div>
      <p class="prompt-mentions-summary">
        ${escapeHtml(names.length === 1 ? `Modelo ativo: ${names[0]}.` : `Modelos ativos: ${names.join(", ")}.`)}
      </p>
    </div>
  `;
}

function renderPromptImageTemplateMentions() {
  if (!imageTemplateMentions) {
    return;
  }

  const resolution = resolvePromptImageTemplates(promptInput?.value || "");
  if (!resolution.matchedTemplates.length) {
    imageTemplateMentions.innerHTML = `<p class="reference-empty">Use <code>#alias</code> no prompt para puxar um template visual salvo.</p>`;
    return;
  }

  const names = resolution.matchedTemplates.map((template) => template.name).filter(Boolean);
  imageTemplateMentions.innerHTML = `
    <div class="prompt-mentions-card">
      <div class="product-model-mentions-list">
        ${resolution.matchedTemplates
          .map(
            (template) => `
              <span class="product-model-chip">
                #${escapeHtml(template.alias)}
              </span>
            `
          )
          .join("")}
      </div>
      <p class="prompt-mentions-summary">
        ${escapeHtml(names.length === 1 ? `Template ativo: ${names[0]}.` : `Templates ativos: ${names.join(", ")}.`)}
      </p>
    </div>
  `;
}

function getPromptAutocompleteQuery() {
  if (!promptInput) {
    return null;
  }

  if (promptInput.selectionStart !== promptInput.selectionEnd) {
    return null;
  }

  const caret = promptInput.selectionStart || 0;
  const beforeCaret = promptInput.value.slice(0, caret);
  const match = beforeCaret.match(/(^|\s)([@#][a-z0-9_-]*)$/i);
  if (!match) {
    return null;
  }

  const rawToken = match[2] || "";
  const marker = rawToken[0];
  const search = rawToken.slice(1).toLowerCase();
  const start = caret - rawToken.length;

  if (!["@","#"].includes(marker)) {
    return null;
  }

  return { marker, search, start, end: caret };
}

function buildPromptAutocompleteOptions(query) {
  if (!query) {
    return [];
  }

  if (query.marker === "@") {
    return state.productModels
      .filter((entry) => !query.search || entry.alias.toLowerCase().startsWith(query.search) || entry.name.toLowerCase().includes(query.search))
      .slice(0, 6)
      .map((entry) => ({
        marker: "@",
        alias: entry.alias,
        name: entry.name,
        meta: entry.notes || "Modelo de produto",
      }));
  }

  if (query.marker === "#") {
    return state.imageTemplates
      .filter((entry) => !query.search || entry.alias.toLowerCase().startsWith(query.search) || entry.name.toLowerCase().includes(query.search))
      .slice(0, 6)
      .map((entry) => ({
        marker: "#",
        alias: entry.alias,
        name: entry.name,
        meta: entry.notes || buildPromptDetailsSummary(entry.promptOptions) || "Template visual",
      }));
  }

  return [];
}

function updatePromptAutocomplete() {
  const query = getPromptAutocompleteQuery();
  if (!query) {
    hidePromptAutocomplete();
    return;
  }

  const options = buildPromptAutocompleteOptions(query);
  if (!options.length || !promptAutocomplete || !promptAutocompleteList) {
    hidePromptAutocomplete();
    return;
  }

  promptAutocompleteState = {
    query,
    options,
    activeIndex: Math.min(promptAutocompleteState.activeIndex, options.length - 1),
  };
  renderPromptAutocomplete();
}

function renderPromptAutocomplete() {
  if (!promptAutocomplete || !promptAutocompleteList || !promptAutocompleteState.options.length) {
    hidePromptAutocomplete();
    return;
  }

  promptAutocomplete.hidden = false;
  promptAutocompleteList.innerHTML = promptAutocompleteState.options
    .map(
      (option, index) => `
        <button
          class="prompt-autocomplete-item${index === promptAutocompleteState.activeIndex ? " is-active" : ""}"
          type="button"
          data-autocomplete-index="${index}"
        >
          <span class="prompt-autocomplete-title">${option.marker}${escapeHtml(option.alias)}</span>
          <span class="prompt-autocomplete-name">${escapeHtml(option.name)}</span>
          <span class="prompt-autocomplete-meta">${escapeHtml(option.meta)}</span>
        </button>
      `
    )
    .join("");

  for (const button of promptAutocompleteList.querySelectorAll("[data-autocomplete-index]")) {
    button.onmousedown = (event) => {
      event.preventDefault();
      const index = Number(button.getAttribute("data-autocomplete-index"));
      if (!Number.isFinite(index)) {
        return;
      }
      applyPromptAutocompleteOption(index);
    };
  }
}

function hidePromptAutocomplete() {
  promptAutocompleteState = {
    query: null,
    options: [],
    activeIndex: 0,
  };

  if (promptAutocomplete) {
    promptAutocomplete.hidden = true;
  }
  if (promptAutocompleteList) {
    promptAutocompleteList.innerHTML = "";
  }
}

function handlePromptAutocompleteKeydown(event) {
  if (!promptAutocompleteState.options.length) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    promptAutocompleteState.activeIndex = (promptAutocompleteState.activeIndex + 1) % promptAutocompleteState.options.length;
    renderPromptAutocomplete();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    promptAutocompleteState.activeIndex =
      (promptAutocompleteState.activeIndex - 1 + promptAutocompleteState.options.length) % promptAutocompleteState.options.length;
    renderPromptAutocomplete();
    return;
  }

  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    applyPromptAutocompleteOption(promptAutocompleteState.activeIndex);
    return;
  }

  if (event.key === "Escape") {
    hidePromptAutocomplete();
  }
}

function applyPromptAutocompleteOption(index) {
  const option = promptAutocompleteState.options[index];
  const query = promptAutocompleteState.query;
  if (!option || !query || !promptInput) {
    hidePromptAutocomplete();
    return;
  }

  const before = promptInput.value.slice(0, query.start);
  const after = promptInput.value.slice(query.end);
  const mention = `${option.marker}${option.alias}`;
  const nextValue = `${before}${mention} ${after}`.replace(/\s{2,}/g, " ");
  const caret = before.length + mention.length + 1;

  promptInput.value = nextValue;
  promptInput.focus();
  promptInput.setSelectionRange(caret, caret);
  renderPromptProductModelMentions();
  renderPromptImageTemplateMentions();
  hidePromptAutocomplete();
}





function extractPromptModelAliases(prompt) {
  const matches = String(prompt || "").match(/@([a-z0-9_-]+)/gi) || [];
  return Array.from(new Set(matches.map((entry) => slugifyProductModelAlias(entry))));
}

function resolvePromptProductModels(prompt) {
  const aliases = extractPromptModelAliases(prompt);
  const matchedModels = aliases
    .map((alias) => state.productModels.find((entry) => entry.alias === alias))
    .filter(Boolean);

  let cleanPrompt = String(prompt || "");
  for (const model of matchedModels) {
    cleanPrompt = cleanPrompt.replace(new RegExp(`(^|\\s)@${model.alias}(?=\\s|$)`, "gi"), "$1");
  }

  return {
    aliases: matchedModels.map((entry) => entry.alias),
    matchedModels,
    cleanPrompt: cleanPrompt.replace(/\s{2,}/g, " ").trim(),
  };
}

function extractPromptImageTemplateAliases(prompt) {
  const matches = String(prompt || "").match(/#([a-z0-9_-]+)/gi) || [];
  return Array.from(new Set(matches.map((entry) => slugifyImageTemplateAlias(entry))));
}

function resolvePromptImageTemplates(prompt) {
  const aliases = extractPromptImageTemplateAliases(prompt);
  const matchedTemplates = aliases
    .map((alias) => state.imageTemplates.find((entry) => entry.alias === alias))
    .filter(Boolean);

  let cleanPrompt = String(prompt || "");
  for (const template of matchedTemplates) {
    cleanPrompt = cleanPrompt.replace(new RegExp(`(^|\\s)#${template.alias}(?=\\s|$)`, "gi"), "$1");
  }

  return {
    aliases: matchedTemplates.map((entry) => entry.alias),
    matchedTemplates,
    cleanPrompt: cleanPrompt.replace(/\s{2,}/g, " ").trim(),
  };
}

function renderImageTemplateList() {
  if (!imageTemplateList) {
    return;
  }

  if (!state.imageTemplates.length) {
    imageTemplateList.innerHTML = `<p class="reference-empty">Nenhum template visual cadastrado ainda.</p>`;
    bindInteractiveActions();
    return;
  }

  imageTemplateList.innerHTML = state.imageTemplates
    .map((template) => {
      const usageHistory = getLibraryUsageHistory("imageTemplate", template.alias);
      const thumbs = (template.referenceImages || [])
        .slice(0, 4)
        .map(
          (image) => `
            <span class="product-model-thumb">
              ${
                image?.url
                  ? `<img src="${image.url}" alt="${escapeHtml(template.name)}">`
                  : `<span class="product-model-thumb-fallback" aria-label="Referência indisponível">Arquivo ausente</span>`
              }
            </span>
          `
        )
        .join("");

      return `
        <article class="product-model-card">
          <div class="product-model-card-head">
            <div>
              <p class="product-model-card-name">${escapeHtml(template.name)}</p>
              <p class="product-model-card-alias">#${escapeHtml(template.alias)}</p>
            </div>
            <button class="icon-action-button icon-action-button-danger" type="button" data-delete-image-template="${escapeHtml(template.alias)}" aria-label="Excluir template" title="Excluir template">
              <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                <path d="M9 3h6"></path>
                <path d="M4 6h16"></path>
                <path d="M7 6l1 14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-14"></path>
                <path d="M10 10v7"></path>
                <path d="M14 10v7"></path>
              </svg>
            </button>
          </div>
          ${template.notes ? `<p class="product-model-card-notes">${escapeHtml(template.notes)}</p>` : ""}
          <p class="product-model-card-notes">${escapeHtml(buildPromptDetailsSummary(template.promptOptions) || "Sem ajustes extras salvos.")}</p>
          ${thumbs ? `<div class="product-model-thumb-row">${thumbs}</div>` : ""}
          ${renderLibraryUsageHistory(usageHistory, "template")}
          <div class="product-model-card-actions">
            <button class="ghost-button" type="button" data-insert-image-template="${escapeHtml(template.alias)}">Inserir #${escapeHtml(template.alias)}</button>
          </div>
        </article>
      `;
    })
    .join("");

  bindInteractiveActions();
}

function getLibraryUsageHistory(kind, alias) {
  const normalizedAlias = kind === "productModel" ? slugifyProductModelAlias(alias) : slugifyImageTemplateAlias(alias);
  const matchingJobs = state.lastJobs.filter((job) => {
    const entries = kind === "productModel" ? job.state.productModels : job.state.imageTemplates;
    return Array.isArray(entries) && entries.some((entry) => {
      const entryAlias = kind === "productModel" ? slugifyProductModelAlias(entry?.alias) : slugifyImageTemplateAlias(entry?.alias);
      return entryAlias === normalizedAlias;
    });
  });

  const completedJobs = matchingJobs.filter((job) => job.status === "completed" && job.result?.imageUrl);
  const recentResults = completedJobs
    .slice()
    .sort((left, right) => new Date(right.finishedAt || right.createdAt || 0) - new Date(left.finishedAt || left.createdAt || 0))
    .slice(0, 4);
  const recentPrompts = matchingJobs
    .slice()
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
    .slice(0, 2)
    .map((job) => buildDisplayPrompt(job))
    .filter(Boolean);

  return {
    total: matchingJobs.length,
    completed: completedJobs.length,
    recentResults,
    recentPrompts,
  };
}

function renderLibraryUsageHistory(history, label) {
  if (!history?.total) {
    return `
      <div class="library-usage-history library-usage-history-empty">
        <p class="library-usage-history-summary">Ainda não existem gerações usando este ${escapeHtml(label)}.</p>
      </div>
    `;
  }

  return `
    <div class="library-usage-history">
      <div class="library-usage-history-head">
        <p class="library-usage-history-title">Histórico</p>
              <p class="library-usage-history-count">${escapeHtml(`${history.completed}/${history.total} concluídas`)}</p>
      </div>
      ${history.recentResults.length ? `
        <div class="library-usage-history-gallery">
          ${history.recentResults
            .map(
              (job) => `
                <a class="library-usage-history-thumb" href="${job.result.imageUrl}" target="_blank" rel="noreferrer" title="${escapeHtml(buildDisplayPrompt(job))}">
                  <img src="${thumbUrl(job.result.imageUrl)}" alt="${escapeHtml(buildDisplayPrompt(job))}">
                </a>
              `
            )
            .join("")}
        </div>
      ` : ""}
      ${history.recentPrompts.length ? `
        <div class="library-usage-history-prompts">
          ${history.recentPrompts
            .map((prompt) => `<p class="library-usage-history-prompt">${escapeHtml(prompt)}</p>`)
            .join("")}
        </div>
      ` : ""}
    </div>
  `;
}

async function saveProductModel() {
  const name = productModelNameInput?.value.trim() || "";
  const alias = slugifyProductModelAlias(productModelAliasInput?.value || name);
  const notes = productModelNotesInput?.value.trim() || "";

  if (!name) {
    statusBox.textContent = "Informe o nome do produto antes de salvar o modelo.";
    productModelNameInput?.focus();
    return;
  }

  if (!alias) {
    statusBox.textContent = "Informe um alias valido para o modelo de produto.";
    productModelAliasInput?.focus();
    return;
  }

  if (!state.selectedProductModelFiles.length) {
    statusBox.textContent = "Selecione pelo menos uma imagem do produto para criar o modelo.";
    return;
  }

  saveProductModelButton.disabled = true;
  saveProductModelButton.textContent = "Salvando...";

  try {
    const referenceImages = await buildReferencePayload(state.selectedProductModelFiles);
    const response = await fetch("/api/product-models", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        alias,
        notes,
        referenceImages,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
    throw new Error(data.error || "Não foi possível salvar o modelo de produto.");
    }

    if (productModelNameInput) productModelNameInput.value = "";
    if (productModelAliasInput) productModelAliasInput.value = "";
    if (productModelNotesInput) productModelNotesInput.value = "";
    state.selectedProductModelFiles = [];
    syncProductModelInputFiles();
    renderProductModelUploadPreview();
    await refreshProductModels();
    insertProductModelMention(data.productModel.alias, { appendSpace: false });
    statusBox.textContent = `Modelo @${data.productModel.alias} salvo. Agora basta citar @${data.productModel.alias} no prompt.`;
  } catch (error) {
    statusBox.textContent = error instanceof Error ? error.message : "Falha ao salvar o modelo de produto.";
  } finally {
    saveProductModelButton.disabled = false;
    saveProductModelButton.textContent = "Salvar modelo";
  }
}

async function saveImageTemplate() {
  const name = imageTemplateNameInput?.value.trim() || "";
  const alias = slugifyImageTemplateAlias(imageTemplateAliasInput?.value || name);
  const notes = imageTemplateNotesInput?.value.trim() || "";

  if (!name) {
    statusBox.textContent = "Informe o nome do template visual antes de salvar.";
    imageTemplateNameInput?.focus();
    return;
  }

  if (!alias) {
    statusBox.textContent = "Informe um alias valido para o template visual.";
    imageTemplateAliasInput?.focus();
    return;
  }

  saveImageTemplateButton.disabled = true;
  saveImageTemplateButton.textContent = "Salvando...";

  try {
    const referenceImages = await buildReferencePayload(state.selectedImageTemplateFiles);
    const response = await fetch("/api/image-templates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        alias,
        notes,
        promptOptions: collectPromptOptions(),
        referenceImages,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
    throw new Error(data.error || "Não foi possível salvar o template visual.");
    }

    if (imageTemplateNameInput) imageTemplateNameInput.value = "";
    if (imageTemplateAliasInput) imageTemplateAliasInput.value = "";
    if (imageTemplateNotesInput) imageTemplateNotesInput.value = "";
    state.selectedImageTemplateFiles = [];
    syncImageTemplateInputFiles();
    renderImageTemplateUploadPreview();
    await refreshImageTemplates();
    insertImageTemplateMention(data.imageTemplate.alias, { appendSpace: false });
    statusBox.textContent = `Template #${data.imageTemplate.alias} salvo. Agora basta citar #${data.imageTemplate.alias} no prompt.`;
  } catch (error) {
    statusBox.textContent = error instanceof Error ? error.message : "Falha ao salvar o template visual.";
  } finally {
    saveImageTemplateButton.disabled = false;
    saveImageTemplateButton.textContent = "Salvar template";
  }
}

function insertProductModelMention(alias, options = {}) {
  if (!promptInput) {
    return;
  }

  const mention = `@${slugifyProductModelAlias(alias)}`;
  if (!mention || mention === "@") {
    return;
  }

  const currentValue = promptInput.value.trim();
  if (!currentValue.includes(mention)) {
    promptInput.value = currentValue ? `${currentValue} ${mention}` : mention;
  }

  if (options.appendSpace !== false) {
    promptInput.value = `${promptInput.value.trim()} `;
  }

  renderPromptProductModelMentions();
  promptInput.focus();
}

function insertImageTemplateMention(alias, options = {}) {
  if (!promptInput) {
    return;
  }

  const mention = `#${slugifyImageTemplateAlias(alias)}`;
  if (!mention || mention === "#") {
    return;
  }

  const currentValue = promptInput.value.trim();
  if (!currentValue.includes(mention)) {
    promptInput.value = currentValue ? `${currentValue} ${mention}` : mention;
  }

  if (options.appendSpace !== false) {
    promptInput.value = `${promptInput.value.trim()} `;
  }

  renderPromptImageTemplateMentions();
  promptInput.focus();
}

function syncProductModelInputFiles() {
  if (!productModelImagesInput) {
    return;
  }

  const dataTransfer = new DataTransfer();
  for (const file of state.selectedProductModelFiles) {
    dataTransfer.items.add(file);
  }

  productModelImagesInput.files = dataTransfer.files;
}

function syncImageTemplateInputFiles() {
  if (!imageTemplateImagesInput) {
    return;
  }

  const dataTransfer = new DataTransfer();
  for (const file of state.selectedImageTemplateFiles) {
    dataTransfer.items.add(file);
  }

  imageTemplateImagesInput.files = dataTransfer.files;
}

function persistCustomPromptPresets() {
  persistCustomPromptPresetsToStorage(window.localStorage, customPromptPresets, CUSTOM_PRESETS_STORAGE_KEY);
}

function renderCustomPromptPresets() {
  if (!customPresetList) {
    return;
  }

  if (!customPromptPresets.length) {
    customPresetList.innerHTML = `<p class="custom-preset-empty">Nenhum preset salvo ainda.</p>`;
    bindCustomPresetActions();
    return;
  }

  customPresetList.innerHTML = customPromptPresets
    .map(
      (preset) => `
        <article class="custom-preset-item">
          <div class="custom-preset-meta">
            <p class="custom-preset-name">${escapeHtml(preset.name)}</p>
            <p class="custom-preset-summary">${escapeHtml(buildPromptDetailsSummary(preset.options) || "Preset salvo pronto para reutilizar.")}</p>
          </div>
          <div class="custom-preset-actions">
            <button class="ghost-button custom-preset-apply" type="button" data-apply-custom-preset="${escapeHtml(preset.id)}">Aplicar</button>
            <button class="icon-action-button icon-action-button-danger" type="button" data-delete-custom-preset="${escapeHtml(preset.id)}" aria-label="Excluir preset" title="Excluir preset">
              <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
                <path d="M9 3h6"></path>
                <path d="M4 6h16"></path>
                <path d="M7 6l1 14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-14"></path>
                <path d="M10 10v7"></path>
                <path d="M14 10v7"></path>
              </svg>
            </button>
          </div>
        </article>
      `
    )
    .join("");

  bindCustomPresetActions();
}

function bindCustomPresetActions() {
  for (const button of document.querySelectorAll("[data-apply-custom-preset]")) {
    button.onclick = () => {
      const presetId = button.getAttribute("data-apply-custom-preset");
      const preset = customPromptPresets.find((entry) => entry.id === presetId);
      if (!preset) {
        return;
      }

      hydratePromptOptions(preset.options);
      statusBox.textContent = `Preset "${preset.name}" aplicado.`;
    };
  }

  for (const button of document.querySelectorAll("[data-delete-custom-preset]")) {
    button.onclick = async () => {
      const presetId = button.getAttribute("data-delete-custom-preset");
      const preset = customPromptPresets.find((entry) => entry.id === presetId);
      if (!preset) {
        return;
      }

      const confirmed = await requestConfirmation({
        title: "Excluir preset",
        message: `Excluir o preset "${preset.name}"?`,
        confirmLabel: "Excluir",
      });

      if (!confirmed) {
        return;
      }

      customPromptPresets = customPromptPresets.filter((entry) => entry.id !== presetId);
      persistCustomPromptPresets();
      renderCustomPromptPresets();
      statusBox.textContent = `Preset "${preset.name}" removido.`;
    };
  }
}

function saveCurrentPromptPreset() {
  const name = customPresetNameInput?.value.trim() || "";
  if (!name) {
    statusBox.textContent = "De um nome ao preset antes de salvar.";
    customPresetNameInput?.focus();
    return;
  }

  const options = sanitizePromptOptions(collectPromptOptions());
  const existingIndex = customPromptPresets.findIndex((entry) => entry.name.toLowerCase() === name.toLowerCase());
  const nextPreset = {
    id: existingIndex >= 0 ? customPromptPresets[existingIndex].id : `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    options,
  };

  if (existingIndex >= 0) {
    customPromptPresets.splice(existingIndex, 1, nextPreset);
    statusBox.textContent = `Preset "${name}" atualizado.`;
  } else {
    customPromptPresets.unshift(nextPreset);
    customPromptPresets = customPromptPresets.slice(0, 12);
    statusBox.textContent = `Preset "${name}" salvo.`;
  }

  persistCustomPromptPresets();
  renderCustomPromptPresets();

  if (customPresetNameInput) {
    customPresetNameInput.value = "";
  }
}

function applyPromptPreset(presetKey) {
  const preset = PROMPT_PRESETS[presetKey];
  if (!preset) {
    return;
  }

  if (renderFocusSelect && preset.renderFocus) {
    renderFocusSelect.value = preset.renderFocus;
  }

  if (aspectRatioSelect && preset.aspectRatio) {
    aspectRatioSelect.value = preset.aspectRatio;
  }

  if (promptStrengthSelect) {
    promptStrengthSelect.value = "balanced";
  }

  if (styleDirectionInput) {
    styleDirectionInput.value = preset.styleDirection;
  }

  if (preserveDetailsInput) {
    preserveDetailsInput.value = preset.preserveDetails;
  }

  if (extraInstructionsInput) {
    extraInstructionsInput.value = preset.extraInstructions;
  }

  statusBox.textContent = "Preset aplicado. Ajuste os campos avançados como quiser.";
}

async function handleBulkRemoval({ button, endpoint, getPayload, confirmMessage, loadingLabel, successMessage, refreshers }) {
  const payload = typeof getPayload === "function" ? getPayload() : {};
  const selectedCount = countSelectedFromPayload(payload);

  if (!button || selectedCount === 0) {
    statusBox.textContent = "Selecione pelo menos um item antes de remover.";
    return;
  }

  const confirmed = await requestConfirmation({
    title: "Confirmar remoção",
    message: confirmMessage,
    confirmLabel: "Remover",
  });

  if (!confirmed) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = loadingLabel;

  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Falha ao remover em lote.");
    }

    for (const refresh of refreshers) {
      await refresh();
    }

    clearSelectionsFromPayload(payload);
    updateBulkSelectionUi();
    statusBox.textContent = successMessage;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Falha ao remover em lote.";
    statusBox.textContent = msg;
    showToast(msg);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function requestConfirmation({ title = "Confirmar", message = "Deseja continuar?", confirmLabel = "Confirmar" } = {}) {
  if (!confirmDialog || !confirmDialogTitle || !confirmDialogMessage || !confirmDialogConfirmButton || !confirmDialogCancelButton) {
    return Promise.resolve(window.confirm(message));
  }

  if (confirmDialog.open && confirmDialogResolver) {
    confirmDialogResolver(false);
    confirmDialogResolver = null;
  }

  confirmDialogTitle.textContent = title;
  confirmDialogMessage.textContent = message;
  confirmDialogConfirmButton.textContent = confirmLabel;

  return new Promise((resolve) => {
    confirmDialogResolver = resolve;

    const cleanup = (result) => {
      if (!confirmDialogResolver) {
        return;
      }

      confirmDialogResolver = null;
      confirmDialog.removeEventListener("cancel", handleCancel);
      confirmDialog.removeEventListener("close", handleClose);
      confirmDialogCancelButton.removeEventListener("click", handleDismiss);
      confirmDialogConfirmButton.removeEventListener("click", handleConfirm);

      if (confirmDialog.open) {
        confirmDialog.close();
      }

      resolve(result);
    };

    const handleDismiss = () => cleanup(false);
    const handleConfirm = () => cleanup(true);
    const handleCancel = (event) => {
      event.preventDefault();
      cleanup(false);
    };
    const handleClose = () => cleanup(confirmDialog.returnValue === "confirm");

    confirmDialog.addEventListener("cancel", handleCancel);
    confirmDialog.addEventListener("close", handleClose);
    confirmDialogCancelButton.addEventListener("click", handleDismiss);
    confirmDialogConfirmButton.addEventListener("click", handleConfirm);
    confirmDialog.showModal();
  });
}

function requestFolderSelection({
  title = "Organizar em pasta",
  message = "Escolha uma pasta existente ou crie uma nova.",
  currentFolder = "",
} = {}) {
  if (
    !folderDialog ||
    !folderDialogTitle ||
    !folderDialogMessage ||
    !folderDialogCurrent ||
    !folderDialogInput ||
    !folderDialogOptions ||
    !folderDialogClearButton ||
    !folderDialogCancelButton ||
    !folderDialogConfirmButton
  ) {
    return Promise.resolve(window.prompt(message, currentFolder));
  }

  if (folderDialog.open && folderDialogResolver) {
    folderDialogResolver(null);
    folderDialogResolver = null;
  }

  folderDialogTitle.textContent = title;
  folderDialogMessage.textContent = message;
  folderDialogCurrent.textContent = displayFolderName(currentFolder);
  folderDialogInput.value = "";
  renderFolderDialogOptions(currentFolder);

  return new Promise((resolve) => {
    folderDialogResolver = resolve;

    const cleanup = (result) => {
      if (!folderDialogResolver) {
        return;
      }

      folderDialogResolver = null;
      folderDialog.removeEventListener("cancel", handleCancel);
      folderDialog.removeEventListener("close", handleClose);
      folderDialogCancelButton.removeEventListener("click", handleDismiss);
      folderDialogClearButton.removeEventListener("click", handleClear);
      folderDialogConfirmButton.removeEventListener("click", handleConfirm);

      for (const button of folderDialogOptions.querySelectorAll("[data-folder-choice]")) {
        button.removeEventListener("click", handleChoiceClick);
      }

      if (folderDialog.open) {
        folderDialog.close();
      }

      resolve(result);
    };

    const handleDismiss = () => cleanup(null);
    const handleClear = () => cleanup("");
    const handleConfirm = () => cleanup(folderDialogInput.value.trim());
    const handleChoiceClick = (event) => {
      const value = event.currentTarget.getAttribute("data-folder-choice") || "";
      cleanup(value);
    };
    const handleCancel = (event) => {
      event.preventDefault();
      cleanup(null);
    };
    const handleClose = () => cleanup(null);

    folderDialog.addEventListener("cancel", handleCancel);
    folderDialog.addEventListener("close", handleClose);
    folderDialogCancelButton.addEventListener("click", handleDismiss);
    folderDialogClearButton.addEventListener("click", handleClear);
    folderDialogConfirmButton.addEventListener("click", handleConfirm);

    for (const button of folderDialogOptions.querySelectorAll("[data-folder-choice]")) {
      button.addEventListener("click", handleChoiceClick);
    }

    folderDialog.showModal();
    folderDialogInput.focus();
  });
}

function countSelectedFromPayload(payload) {
  return ["ids", "jobs", "cutouts", "crops"].reduce((total, key) => total + (Array.isArray(payload[key]) ? payload[key].length : 0), 0);
}

function clearSelectionsFromPayload(payload) {
  if (Array.isArray(payload.ids)) {
    for (const id of payload.ids) {
      selectedGalleryIds.delete(id);
      selectedCutoutIds.delete(id);
      selectedCropIds.delete(id);
    }
  }

  if (Array.isArray(payload.jobs)) {
    for (const id of payload.jobs) {
      selectedGalleryIds.delete(id);
    }
  }

  if (Array.isArray(payload.cutouts)) {
    for (const id of payload.cutouts) {
      selectedCutoutIds.delete(id);
    }
  }

  if (Array.isArray(payload.crops)) {
    for (const id of payload.crops) {
      selectedCropIds.delete(id);
    }
  }
}

function getSelectedMediaItems() {
  return [
    ...Array.from(selectedGalleryIds)
      .map((id) => state.lastJobs.find((job) => job.id === id)?.result)
      .filter(Boolean),
    ...Array.from(selectedCutoutIds)
      .map((id) => state.lastCutouts.find((item) => item.id === id))
      .filter(Boolean),
    ...Array.from(selectedCropIds)
      .map((id) => state.lastCrops.find((item) => item.id === id))
      .filter(Boolean),
  ];
}

function getSharedSelectedFolder() {
  const items = getSelectedMediaItems();
  if (!items.length) {
    return "";
  }

  const folders = new Set(items.map((item) => String(item.folder || "").trim()));
  return folders.size === 1 ? Array.from(folders)[0] : "";
}

function buildSelectionControl(kind, id, checked) {
  return `
    <label class="card-select-control" title="Selecionar item">
      <input type="checkbox" data-select-kind="${kind}" data-select-id="${escapeHtml(id)}" ${checked ? "checked" : ""}>
      <span></span>
    </label>
  `;
}

function pruneSelectionSet(selectionSet, ids) {
  for (const id of Array.from(selectionSet)) {
    if (!ids.includes(id)) {
      selectionSet.delete(id);
    }
  }
}

function applySectionSelection(ids, selectionSet, shouldSelect) {
  if (shouldSelect) {
    for (const id of ids) {
      selectionSet.add(id);
    }
    return;
  }

  for (const id of ids) {
    selectionSet.delete(id);
  }
}

function toggleSectionSelection(ids, selectionSet) {
  const allSelected = ids.length > 0 && ids.every((id) => selectionSet.has(id));
  applySectionSelection(ids, selectionSet, !allSelected);
  updateBulkSelectionUi();
}

function downloadSelectedItems(items, emptyMessage, successMessage) {
  if (!items.length) {
    statusBox.textContent = emptyMessage;
    return;
  }

  for (const item of items) {
    if (!item?.imageUrl) {
      continue;
    }

    const anchor = document.createElement("a");
    anchor.href = item.imageUrl;
    anchor.download = item.filename || "";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  statusBox.textContent = successMessage;
}

async function handleFolderAssignment(folderValue) {
  const jobs = Array.from(selectedGalleryIds);
  const cutouts = Array.from(selectedCutoutIds);
  const crops = Array.from(selectedCropIds);
  const totalSelected = jobs.length + cutouts.length + crops.length;

  if (!totalSelected) {
    statusBox.textContent = "Selecione pelo menos um item para organizar em pasta.";
    return;
  }

  const normalizedFolder = String(folderValue || "").trim();
  if (!normalizedFolder && folderValue !== "") {
    statusBox.textContent = "Informe uma pasta antes de mover os itens.";
    return;
  }

  if (normalizedFolder) {
    registerFolderName(normalizedFolder);
  }

  if (organizeSelectedButton) {
    organizeSelectedButton.disabled = true;
  }

  statusBox.textContent = normalizedFolder
    ? `Movendo ${totalSelected} item(ns) para a pasta ${normalizedFolder}...`
    : `Removendo ${totalSelected} item(ns) da pasta atual...`;

  try {
    const response = await fetch("/api/library/folders/assign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        folder: normalizedFolder,
        jobs,
        cutouts,
        crops,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
    throw new Error(data.error || "Não foi possível atualizar a pasta dos itens selecionados.");
    }

    statusBox.textContent = normalizedFolder
      ? `${data.updated.total} item(ns) movido(s) para ${normalizedFolder}.`
      : `${data.updated.total} item(ns) voltaram para a raiz organizada por data.`;
    await refreshJobs();
    await refreshCutouts();
    await refreshCrops();
  } catch (error) {
    statusBox.textContent =
        error instanceof Error ? error.message : "Não foi possível atualizar a pasta dos itens selecionados.";
  } finally {
    updateBulkSelectionUi();
  }
}

async function handleSingleFolderAssignment(kind, id, folderValue) {
  const normalizedFolder = String(folderValue || "").trim();
  if (normalizedFolder) {
    registerFolderName(normalizedFolder);
  }
  const payload = {
    folder: normalizedFolder,
    jobs: [],
    cutouts: [],
    crops: [],
  };

  if (kind === "job") {
    payload.jobs = [id];
  } else if (kind === "cutout") {
    payload.cutouts = [id];
  } else if (kind === "crop") {
    payload.crops = [id];
  } else {
  statusBox.textContent = "Tipo de item inválido para organizar em pasta.";
    return;
  }

  statusBox.textContent = normalizedFolder
    ? `Movendo item para a pasta ${normalizedFolder}...`
    : "Removendo item da pasta atual...";

  const response = await fetch("/api/library/folders/assign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok) {
  throw new Error(data.error || "Não foi possível atualizar a pasta deste item.");
  }

  await refreshJobs();
  await refreshCutouts();
  await refreshCrops();
}

function updateBulkSelectionUi() {
  const galleryCount = selectedGalleryIds.size;
  const cutoutCount = selectedCutoutIds.size;
  const cropCount = selectedCropIds.size;
  const galleryTotal = state.lastJobs.filter((job) => job.status === "completed" && job.result).length;
  const cutoutTotal = state.lastCutouts.length;
  const cropTotal = state.lastCrops.length;

  if (selectGalleryBulkButton) {
    selectGalleryBulkButton.disabled = galleryTotal === 0;
    selectGalleryBulkButton.textContent = galleryTotal > 0 && galleryCount === galleryTotal ? "Limpar seleção" : "Selecionar todos";
  }

  if (downloadGalleryBulkButton) {
    downloadGalleryBulkButton.disabled = galleryCount === 0;
    downloadGalleryBulkButton.textContent = galleryCount ? `Baixar selecionados (${galleryCount})` : "Baixar selecionados";
  }

  if (clearGalleryBulkButton) {
    clearGalleryBulkButton.disabled = galleryCount === 0;
    clearGalleryBulkButton.textContent = galleryCount ? `Remover selecionados (${galleryCount})` : "Remover selecionados";
  }

  if (selectCutoutsBulkButton) {
    selectCutoutsBulkButton.disabled = cutoutTotal === 0;
    selectCutoutsBulkButton.textContent = cutoutTotal > 0 && cutoutCount === cutoutTotal ? "Limpar seleção" : "Selecionar todos";
  }

  if (downloadCutoutsBulkButton) {
    downloadCutoutsBulkButton.disabled = cutoutCount === 0;
    downloadCutoutsBulkButton.textContent = cutoutCount ? `Baixar selecionados (${cutoutCount})` : "Baixar selecionados";
  }

  if (clearCutoutsBulkButton) {
    clearCutoutsBulkButton.disabled = cutoutCount === 0;
    clearCutoutsBulkButton.textContent = cutoutCount ? `Remover selecionados (${cutoutCount})` : "Remover selecionados";
  }

  if (selectCropsBulkButton) {
    selectCropsBulkButton.disabled = cropTotal === 0;
    selectCropsBulkButton.textContent = cropTotal > 0 && cropCount === cropTotal ? "Limpar seleção" : "Selecionar todos";
  }

  if (downloadCropsBulkButton) {
    downloadCropsBulkButton.disabled = cropCount === 0;
    downloadCropsBulkButton.textContent = cropCount ? `Baixar selecionados (${cropCount})` : "Baixar selecionados";
  }

  if (clearCropsBulkButton) {
    clearCropsBulkButton.disabled = cropCount === 0;
    clearCropsBulkButton.textContent = cropCount ? `Remover selecionados (${cropCount})` : "Remover selecionados";
  }

  const totalSelected = galleryCount + cutoutCount + cropCount;
  const totalAvailable = galleryTotal + cutoutTotal + cropTotal;
  if (selectAllMediaButton) {
    selectAllMediaButton.disabled = totalAvailable === 0;
    selectAllMediaButton.textContent = totalAvailable > 0 && totalSelected === totalAvailable ? "Limpar seleção" : "Selecionar tudo";
  }

  if (downloadAllMediaButton) {
    downloadAllMediaButton.disabled = totalSelected === 0;
    downloadAllMediaButton.textContent = totalSelected ? `Baixar selecionados (${totalSelected})` : "Baixar selecionados";
  }

  if (clearAllMediaButton) {
    clearAllMediaButton.disabled = totalSelected === 0;
    clearAllMediaButton.textContent = totalSelected ? `Remover selecionados (${totalSelected})` : "Remover selecionados";
  }

  if (organizeSelectedButton) {
    organizeSelectedButton.disabled = totalSelected === 0;
    organizeSelectedButton.textContent = totalSelected
      ? `Organizar selecionados (${totalSelected})`
      : "Organizar selecionados";
  }
}

function requestComposerPanelPinning() {
  if (composerPinFrame) {
    return;
  }

  composerPinFrame = window.requestAnimationFrame(() => {
    composerPinFrame = 0;
    syncComposerPanelPinning();
  });
}

function syncComposerPanelPinning() {
  if (!appLayout || !composerColumn || !composerPanel) {
    return;
  }

  if (composerExpanded) {
    resetComposerPanelPinning();
    return;
  }

  const desktopLayout = window.innerWidth > 900;
  if (!desktopLayout) {
    resetComposerPanelPinning();
    return;
  }

  const topOffset = 8;
  const bottomOffset = 8;
  const viewportLimit = Math.max(window.innerHeight - topOffset - bottomOffset, 240);
  const panelNaturalHeight = composerPanel.scrollHeight;
  const pinnedHeight = Math.min(panelNaturalHeight, viewportLimit);
  const layoutRect = appLayout.getBoundingClientRect();
  const columnRect = composerColumn.getBoundingClientRect();
  const layoutTop = layoutRect.top + window.scrollY;
  const layoutBottom = layoutTop + appLayout.offsetHeight;
  const fixedStart = layoutTop - topOffset;
  const fixedEnd = layoutBottom - pinnedHeight - topOffset;
  const currentScroll = window.scrollY;

  composerColumn.style.minHeight = `${panelNaturalHeight}px`;
  composerPanel.style.maxHeight = `${viewportLimit}px`;
  composerPanel.style.overflowY = panelNaturalHeight > viewportLimit ? "auto" : "visible";

  if (currentScroll <= fixedStart) {
    resetComposerPanelPinning(true);
    return;
  }

  if (currentScroll >= fixedEnd) {
    composerPanel.style.position = "absolute";
    composerPanel.style.top = "auto";
    composerPanel.style.right = "auto";
    composerPanel.style.bottom = "0";
    composerPanel.style.left = "0";
    composerPanel.style.width = "100%";
    return;
  }

  composerPanel.style.position = "fixed";
  composerPanel.style.top = `${topOffset}px`;
  composerPanel.style.right = "auto";
  composerPanel.style.bottom = "auto";
  composerPanel.style.left = `${columnRect.left}px`;
  composerPanel.style.width = `${columnRect.width}px`;
}

function resetComposerPanelPinning(keepColumnHeight = false) {
  if (!composerColumn || !composerPanel) {
    return;
  }

  if (!keepColumnHeight) {
    composerColumn.style.minHeight = "";
  }

  composerPanel.style.position = "relative";
  composerPanel.style.top = "";
  composerPanel.style.right = "";
  composerPanel.style.bottom = "";
  composerPanel.style.left = "";
  composerPanel.style.width = "";
  composerPanel.style.maxHeight = "";
  composerPanel.style.overflowY = "";
}

function syncComposerExpandedState() {
  if (!composerPanel || !composerExpandButton) {
    return;
  }

  composerPanel.classList.toggle("is-expanded", composerExpanded);
  document.body.classList.toggle("composer-expanded", composerExpanded);
  composerExpandButton.setAttribute("aria-label", composerExpanded ? "Recolher painel de prompt" : "Expandir painel de prompt");
  composerExpandButton.setAttribute("title", composerExpanded ? "Recolher painel de prompt" : "Expandir painel de prompt");
  composerExpandButton.classList.toggle("is-active", composerExpanded);
  requestComposerPanelPinning();
}

async function refreshJobs() {
  try {
    const response = await fetch("/api/jobs");
    const data = await response.json();
    if (!response.ok) {
      return;
    }

    renderJobs(data.jobs || []);
    renderFolderBoard();
    if (data.concurrency) {
      concurrencySelect.value = String(data.concurrency);
    }
  } catch (err) {
    queueSummary.textContent = "Não foi possível atualizar a fila agora.";
    showToast("Falha ao atualizar a fila. Verifique sua conexão.");
  }
}

async function refreshUsage() {
  try {
    const response = await fetch("/api/usage");
    const data = await response.json();
    if (!response.ok) {
      return;
    }

    renderUsage(data);
  } catch {
    usageSummary.textContent = "Não foi possível carregar o uso estimado.";
  }
}

async function refreshCutouts() {
  try {
    const response = await fetch("/api/cutouts");
    const data = await response.json();
    if (!response.ok) {
      return;
    }

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
      cutouts: cutouts.map((item) => [item.id, item.filename, item.createdAt, item.folder || ""]),
    });

    if (nextCutoutsKey !== lastRenderedCutoutsKey) {
      lastRenderedCutoutsKey = nextCutoutsKey;
      renderCutouts(cutouts, data.processing);
    }
    renderFolderBoard();

    if (processingChanged) {
      lastRenderedJobsKey = "";
      renderJobs(state.lastJobs);
    }
  } catch {
    state.cutoutProcessingJobId = null;
    lastRenderedCutoutsKey = "";
    cutoutSummary.textContent = "Não foi possível carregar os recortes agora.";
  }
}

async function refreshCrops() {
  try {
    const response = await fetch("/api/crops");
    const data = await response.json();
    if (!response.ok) {
      return;
    }

    const crops = data.crops || [];
    state.lastCrops = crops;
    const nextCropsKey = JSON.stringify({
      folderFilter: cropFolderFilter.value,
      viewMode: viewModeSelect.value,
      crops: crops.map((item) => [item.id, item.filename, item.createdAt, item.folder || ""]),
    });
    if (nextCropsKey !== lastRenderedCropsKey) {
      lastRenderedCropsKey = nextCropsKey;
      renderCrops(crops);
    }
    renderFolderBoard();
  } catch {
    lastRenderedCropsKey = "";
    cropSummary.textContent = "Não foi possível carregar os recortes agora.";
  }
}

function startPolling() {
  pollTimer = window.setInterval(async () => {
    await refreshJobs();
    await refreshUsage();
    await refreshCutouts();
    await refreshCrops();
  }, 2000);
}

function renderJobs(jobs) {
  state.lastJobs = jobs;
  renderProductModelList();
  renderImageTemplateList();
  const filterState = JSON.stringify({
    search: searchInput.value.trim().toLowerCase(),
    queueFilter: queueFilter.value,
    queueModelFilter: queueModelFilter.value,
    galleryFilter: galleryFilter.value,
    galleryFolderFilter: galleryFolderFilter.value,
    viewMode: viewModeSelect.value,
    folderFilter: folderFilterInput.value.trim().toLowerCase(),
  });
  const nextKey = JSON.stringify(jobs.map((job) => [job.id, job.status, job.result?.filename || "", job.result?.folder || "", job.error?.error || ""]));
  const renderKey = `${nextKey}::${filterState}`;
  const filteredGalleryJobs = filterGalleryJobs(jobs.filter((job) => job.status === "completed" && job.result));
  const filteredQueueJobs = filterQueueJobs(jobs);

  if (renderKey === lastRenderedJobsKey) {
    updateQueueSummary(jobs, filteredQueueJobs);
    updateStatusFromVisibleResults(filteredGalleryJobs);
    return;
  }

  lastRenderedJobsKey = renderKey;
  updateQueueSummary(jobs, filteredQueueJobs);

  if (!filteredQueueJobs.length) {
    queueList.innerHTML = `<p class="empty-state">${queueEmptyMessage()}</p>`;
  } else {
    queueList.innerHTML = "";

    for (const job of filteredQueueJobs) {
      const item = document.createElement("article");
      item.className = `queue-item is-${job.status}${job.status === "completed" && job.result ? " has-preview" : ""}`;

      item.innerHTML = `
        ${buildJobPreview(job)}
        <div class="queue-top">
          <div>
            <div class="queue-top">
              <div>
                <p class="queue-prompt">${escapeHtml(buildDisplayPrompt(job))}</p>
                ${buildPromptOptionsSummary(job.promptOptions)}
                <p class="queue-meta">${escapeHtml(buildJobMeta(job))}</p>
                <div class="queue-label-row">
                  ${buildVersionLabel(job)}
                  ${buildReferenceBadge(job)}
                </div>
              </div>
              <span class="queue-badge">${statusLabel(job.status)}</span>
            </div>
            ${buildJobActions(job)}
          </div>
        </div>
      `;

      queueList.appendChild(item);
    }
  }

  renderGallery(filteredGalleryJobs);
  updateStatusFromVisibleResults(filteredGalleryJobs);
  renderFolderBoard();
  bindInteractiveActions();
}

function updateQueueSummary(jobs, visibleJobs = jobs) {
  const queued = jobs.filter((job) => job.status === "queued").length;
  const processing = jobs.filter((job) => job.status === "processing").length;
  const completed = jobs.filter((job) => job.status === "completed").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const visible = visibleJobs.length;
  const total = jobs.length;

  queueSummary.textContent = `${visible} exibidos de ${total} jobs - ${queued} na fila, ${processing} em execução, ${completed} concluídos, ${failed} com erro.`;
}

function buildJobActions(job) {
  if (job.status === "completed" && job.result) {
    return `
      <div class="queue-actions">
        <a class="queue-link" href="${job.result.imageUrl}" target="_blank" rel="noreferrer">Abrir imagem</a>
        <a class="queue-link" href="${job.result.imageUrl}" download="${job.result.filename}">Baixar</a>
      </div>
    `;
  }

  if (job.status === "queued") {
    return `
      <div class="queue-actions">
        <button class="queue-button" type="button" data-cancel-id="${job.id}">Cancelar</button>
      </div>
    `;
  }

  if (job.status === "failed") {
    return `<div class="queue-actions"><span class="queue-inline-error">${escapeHtml(job.error?.error || "Erro desconhecido.")}</span></div>`;
  }

  return "";
}

function buildJobPreview(job) {
  if (job.status !== "completed" || !job.result) {
    return "";
  }

  return `
    <a class="queue-preview" href="${job.result.imageUrl}" target="_blank" rel="noreferrer">
      <img src="${thumbUrl(job.result.imageUrl)}" alt="${escapeHtml(buildDisplayPrompt(job))}">
    </a>
  `;
}

function buildJobMeta(job) {
  const created = formatDate(job.createdAt);
  const model = modelLabel(job.model);
  const references = referenceLabel(job.referenceImages);

  if (job.status === "processing") {
    return [model, references, `iniciou ${formatDate(job.startedAt) || created}`].filter(Boolean).join(" - ");
  }

  if (job.status === "completed") {
    return [model, references, `concluido ${formatDate(job.finishedAt) || created}`].filter(Boolean).join(" - ");
  }

  if (job.status === "failed") {
    return [model, references, `falhou ${formatDate(job.finishedAt) || created}`].filter(Boolean).join(" - ");
  }

  return [model, references, `enfileirado ${created}`].filter(Boolean).join(" - ");
}

function buildReferenceBadge(job) {
  if (!job.referenceImages?.length) {
    return "";
  }

  return `<span class="queue-reference-pill">${job.referenceImages.length} imagem(ns) de referência</span>`;
}

function updateStatusFromVisibleResults(filteredGalleryJobs) {
  if (!filteredGalleryJobs.length && (galleryFilter.value !== "all" || searchInput.value.trim())) {
    statusBox.textContent = "Nenhuma imagem corresponde aos filtros atuais.";
    return;
  }

  if (!submitButton.disabled) {
    statusBox.textContent = "Pronto para enfileirar.";
  }
}

function renderGallery(completedJobs) {
  pruneSelectionSet(selectedGalleryIds, completedJobs.map((job) => job.id));
  updateBulkSelectionUi();

  if (!completedJobs.length) {
    gallerySummary.textContent = "0 imagens visiveis";
    galleryGrid.innerHTML = `<p class="empty-state">${galleryEmptyMessage()}</p>`;
    return;
  }

  gallerySummary.textContent = `${Math.min(completedJobs.length, 12)} de ${completedJobs.length} imagens visiveis`;
  galleryGrid.innerHTML = "";
  galleryGrid.classList.remove("gallery-grid-grouped");

  if (viewModeSelect.value === "folders") {
  renderFolderGroupedCollection(galleryGrid, completedJobs.slice(0, 12), createGalleryCard, "Nenhuma imagem encontrada nesta visualização.");
  } else {
    for (const job of completedJobs.slice(0, 12)) {
      galleryGrid.appendChild(createGalleryCard(job));
    }
  }
}

function createGalleryCard(job) {
  const card = document.createElement("article");
  const title = buildDisplayPrompt(job);
  const promptText = buildPromptDetailsSummary(job.promptOptions);
  const showPrompt = promptText && promptText !== title;
  const copyTarget = showPrompt ? promptText : title;
  const isRemovingBackground = state.cutoutProcessingJobId === job.id;
  const titleId = `gallery-text-${job.id}-title`;
  const promptId = `gallery-text-${job.id}-prompt`;

  card.className = "gallery-card";
  card.innerHTML = `
    ${buildSelectionControl("job", job.id, selectedGalleryIds.has(job.id))}
    <a href="${job.result.imageUrl}" target="_blank" rel="noreferrer">
      <img src="${thumbUrl(job.result.imageUrl)}" alt="${escapeHtml(buildDisplayPrompt(job))}">
    </a>
    <div class="gallery-body">
      <div class="gallery-copy-row">
        ${buildExpandableText({
          id: titleId,
          text: title,
          className: "gallery-title",
          lines: 4,
        })}
        ${buildCopyButton(copyTarget)}
      </div>
      ${showPrompt ? buildExpandableText({ id: promptId, text: promptText, className: "gallery-prompt", lines: 3 }) : ""}
      ${buildReferenceStrip(job.referenceImages)}
      ${buildFolderBadge(job.result?.folder)}
      <p class="gallery-meta">${escapeHtml(buildGalleryMeta(job))}</p>
      <div class="queue-actions queue-actions-main">
        <button class="queue-button queue-button-primary" type="button" data-branch-job-id="${job.id}">Editar imagem</button>
        <button class="queue-button queue-button-primary" type="button" data-branch-keep-prompt-id="${job.id}">Editar com prompt</button>
        <button class="queue-button queue-button-secondary" type="button" data-cutout-job-id="${job.id}" ${isRemovingBackground ? "disabled" : ""}>${isRemovingBackground ? "Removendo..." : "Remover fundo"}</button>
        <button class="queue-button queue-button-secondary" type="button" data-crop-job-id="${job.id}">Recortar</button>
      <button class="queue-button queue-button-secondary" type="button" data-region-job-id="${job.id}">Editar região</button>
      </div>
      <div class="queue-actions queue-actions-footer">
        <a class="queue-link queue-link-utility" href="${job.result.imageUrl}" target="_blank" rel="noreferrer">Abrir</a>
        <a class="queue-link queue-link-utility" href="${job.result.imageUrl}" download="${job.result.filename}">Baixar</a>
        ${buildFolderIconButton("job", job.id, job.result?.folder)}
        ${buildDeleteIconButton("job", job.id, "Remover imagem")}
      </div>
    </div>
  `;

  return card;
}

function buildCopyButton(prompt) {
  return `
    <button class="copy-prompt-button" type="button" data-copy-prompt="${escapeHtml(prompt)}" aria-label="Copiar prompt">
      <span class="copy-prompt-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="presentation">
          <path d="M9 9a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z"></path>
          <path d="M6 15H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"></path>
        </svg>
      </span>
      <span class="copy-prompt-label">Copiar</span>
    </button>
  `;
}

function buildDeleteIconButton(kind, id, label) {
  const attributeMap = {
    job: "data-delete-job-id",
    cutout: "data-delete-cutout-id",
    crop: "data-delete-crop-id",
  };
  const attribute = attributeMap[kind];
  if (!attribute) {
    return "";
  }

  return `
    <button class="icon-action-button icon-action-button-danger icon-action-button-end" type="button" ${attribute}="${escapeHtml(id)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
        <path d="M9 3h6"></path>
        <path d="M4 6h16"></path>
        <path d="M7 6l1 14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-14"></path>
        <path d="M10 10v7"></path>
        <path d="M14 10v7"></path>
      </svg>
    </button>
  `;
}

function buildFolderIconButton(kind, id, currentFolder) {
  return `
    <button class="icon-action-button" type="button" data-assign-folder-kind="${escapeHtml(kind)}" data-assign-folder-id="${escapeHtml(id)}" data-current-folder="${escapeHtml(currentFolder || "")}" aria-label="Adicionar a uma pasta" title="Adicionar a uma pasta">
      <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <path d="M12 11v6"></path>
        <path d="M9 14h6"></path>
      </svg>
    </button>
  `;
}

function buildExpandableText({ id, text, className, lines }) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return "";
  }

  const shouldCollapse = trimmed.length > 120;
  return `
    <div class="expandable-text-block">
      <p id="${id}" class="${className}${shouldCollapse ? " is-collapsed" : ""}" ${shouldCollapse ? `data-expandable-text data-lines="${lines}"` : ""}>${escapeHtml(trimmed)}</p>
      ${shouldCollapse ? `<button class="text-toggle-button" type="button" data-toggle-text="${id}" aria-expanded="false">Ver mais</button>` : ""}
    </div>
  `;
}

function buildPromptDetailsSummary(promptOptions = {}) {
  const parts = [];
  if (promptOptions.renderFocus) {
    parts.push(`Foco: ${humanizePromptFocus(promptOptions.renderFocus)}`);
  }

  if (promptOptions.aspectRatio) {
    parts.push(`Formato: ${promptOptions.aspectRatio}`);
  }

  if (promptOptions.promptStrength && promptOptions.promptStrength !== "balanced") {
    parts.push(`Aderência: ${humanizePromptStrength(promptOptions.promptStrength)}`);
  }

  if (promptOptions.negativePrompt) {
    parts.push(`Negativo: ${promptOptions.negativePrompt}`);
  }

  if (promptOptions.styleDirection) {
    parts.push(`Estilo: ${promptOptions.styleDirection}`);
  }

  if (promptOptions.preserveDetails) {
    parts.push(`Preservar: ${promptOptions.preserveDetails}`);
  }

  if (promptOptions.extraInstructions) {
    parts.push(`Extras: ${promptOptions.extraInstructions}`);
  }

  return parts.join(" - ");
}

function buildPromptOptionsSummary(promptOptions = {}) {
  const summary = buildPromptDetailsSummary(promptOptions);
  if (!summary) {
    return "";
  }

  return `<p class="queue-prompt-options">${escapeHtml(summary)}</p>`;
}

function buildReferenceStrip(referenceImages = []) {
  if (!referenceImages.length) {
    return "";
  }

  const thumbnails = referenceImages
    .slice(0, 3)
    .map(
      (image) => `
        <a class="reference-thumb" href="${image.url}" target="_blank" rel="noreferrer" title="${escapeHtml(image.name)}">
          <img src="${image.url}" alt="${escapeHtml(image.name)}">
        </a>
      `
    )
    .join("");

  const extraCount = referenceImages.length - 3;

  return `
    <div class="reference-strip">
      <div class="reference-thumb-row">
        ${thumbnails}
        ${extraCount > 0 ? `<span class="reference-thumb-more">+${extraCount}</span>` : ""}
      </div>
        <p class="reference-strip-label">${referenceImages.length} imagem(ns) de referência</p>
    </div>
  `;
}

function buildGalleryMeta(job) {
  return [modelLabel(job.model), referenceLabel(job.referenceImages), formatDate(job.finishedAt)].filter(Boolean).join(" - ");
}

function buildFolderBadge(folder) {
  const label = displayFolderName(folder);
  return `<p class="folder-badge">${escapeHtml(label)}</p>`;
}

function displayFolderName(folder) {
  const normalized = String(folder || "").trim();
  return normalized || "Sem pasta";
}

function getExistingFolderNames() {
  return Array.from(
    new Set(
      [
        ...customFolders,
        ...state.lastJobs
          .filter((job) => job.status === "completed" && job.result?.folder)
          .map((job) => String(job.result.folder || "").trim()),
        ...state.lastCutouts.map((item) => String(item.folder || "").trim()),
        ...state.lastCrops.map((item) => String(item.folder || "").trim()),
      ].filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function populateSectionFolderFilters() {
  const folderNames = getExistingFolderNames();
  for (const select of [galleryFolderFilter, cutoutFolderFilter, cropFolderFilter]) {
    if (!select) {
      continue;
    }

    const currentValue = select.value === "" ? "" : select.value || "all";
    select.innerHTML = `
      <option value="all">Todas</option>
      <option value="">Sem pasta</option>
      ${folderNames.map((folder) => `<option value="${escapeHtml(folder)}">${escapeHtml(folder)}</option>`).join("")}
    `;

    const hasCurrentValue =
      currentValue === "all" || currentValue === "" || folderNames.includes(currentValue);
    select.value = hasCurrentValue ? currentValue : "all";
  }
}

function applyFolderToSectionFilters(folderValue) {
  const normalizedValue = folderValue === "" ? "" : normalizeFolderValue(folderValue) || "all";

  for (const select of [galleryFolderFilter, cutoutFolderFilter, cropFolderFilter]) {
    if (!select) {
      continue;
    }

    const optionExists = Array.from(select.options).some((option) => option.value === normalizedValue);
    select.value = optionExists ? normalizedValue : "all";
  }
}

function renderFolderDialogOptions(currentFolder = "") {
  if (!folderDialogOptions) {
    return;
  }

  const folders = getExistingFolderNames();
  if (!folders.length) {
    folderDialogOptions.innerHTML = `<p class="empty-state">Nenhuma pasta criada ainda.</p>`;
    return;
  }

  folderDialogOptions.innerHTML = folders
    .map(
      (folder) => `
        <button class="folder-choice${folder === currentFolder ? " is-active" : ""}" type="button" data-folder-choice="${escapeHtml(folder)}">
          ${escapeHtml(folder)}
        </button>
      `
    )
    .join("");
}

function matchesFolderFilter(folder, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const display = displayFolderName(folder).toLowerCase();
  return display.includes(normalizedQuery);
}

function renderFolderBoard() {
  if (!folderBoard || !folderSummary) {
    return;
  }

  populateSectionFolderFilters();

  const folderQuery = folderFilterInput.value.trim().toLowerCase();
  const entries = [
    ...state.lastJobs
      .filter((job) => job.status === "completed" && job.result)
      .map((job) => ({ folder: job.result.folder || "", kind: "Galeria" })),
    ...state.lastCutouts.map((item) => ({ folder: item.folder || "", kind: "Recorte sem fundo" })),
    ...state.lastCrops.map((item) => ({ folder: item.folder || "", kind: "Crop" })),
  ];

  const grouped = new Map();
  for (const folder of getExistingFolderNames()) {
    grouped.set(folder, { total: 0, gallery: 0, cutouts: 0, crops: 0 });
  }

  for (const entry of entries) {
    const key = displayFolderName(entry.folder);
    if (!grouped.has(key)) {
      grouped.set(key, { total: 0, gallery: 0, cutouts: 0, crops: 0 });
    }

    const bucket = grouped.get(key);
    bucket.total += 1;
    if (entry.kind === "Galeria") bucket.gallery += 1;
    if (entry.kind === "Recorte sem fundo") bucket.cutouts += 1;
    if (entry.kind === "Crop") bucket.crops += 1;
  }

  const visibleFolders = Array.from(grouped.entries())
    .filter(([folderName]) => !folderQuery || folderName.toLowerCase().includes(folderQuery))
    .sort((left, right) => {
      if (left[0] === "Sem pasta") return -1;
      if (right[0] === "Sem pasta") return 1;
      return left[0].localeCompare(right[0], "pt-BR");
    });

  folderSummary.textContent = `${visibleFolders.length} pasta(s) visiveis`;
  if (!visibleFolders.length) {
    folderBoard.innerHTML = `<p class="empty-state">Nenhuma pasta corresponde ao filtro atual.</p>`;
    return;
  }

  folderBoard.innerHTML = visibleFolders
    .map(
      ([folderName, counts]) => `
        <button class="folder-card${folderFilterInput.value.trim().toLowerCase() === folderName.toLowerCase() ? " is-active" : ""}" type="button" data-folder-filter="${escapeHtml(folderName === "Sem pasta" ? "" : folderName)}">
          <span class="folder-card-name">${escapeHtml(folderName)}</span>
          <span class="folder-card-count">${counts.total} item(ns)</span>
          <span class="folder-card-meta">Galeria ${counts.gallery} - Fundo ${counts.cutouts} - Crops ${counts.crops}</span>
        </button>
      `
    )
    .join("");

  for (const button of folderBoard.querySelectorAll("[data-folder-filter]")) {
    button.onclick = () => {
      const value = button.getAttribute("data-folder-filter") || "";
      folderFilterInput.value = value;
      applyFolderToSectionFilters(value);
      renderJobs(state.lastJobs);
      renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
      renderCrops(state.lastCrops);
      renderFolderBoard();
    };
  }
}

function renderFolderGroupedCollection(container, items, cardFactory, emptyMessage) {
  if (!container) {
    return;
  }

  const groups = groupItemsByFolder(items);
  if (!groups.length) {
    container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
    return;
  }

  container.innerHTML = "";
  container.classList.add("gallery-grid-grouped");

  for (const [folderName, folderItems] of groups) {
    const section = document.createElement("section");
    section.className = "folder-group";
    section.innerHTML = `
      <div class="folder-group-head">
        <div>
          <p class="folder-group-kicker">Pasta</p>
          <h3 class="folder-group-title">${escapeHtml(folderName)}</h3>
        </div>
        <p class="folder-group-count">${folderItems.length} item(ns)</p>
      </div>
    `;

    const grid = document.createElement("div");
    grid.className = "folder-group-grid";

    for (const item of folderItems) {
      grid.appendChild(cardFactory(item));
    }

    section.appendChild(grid);
    container.appendChild(section);
  }
}

function groupItemsByFolder(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = displayFolderName(item?.result?.folder || item?.folder || "");
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  }

  return Array.from(grouped.entries()).sort((left, right) => {
    if (left[0] === "Sem pasta") return -1;
    if (right[0] === "Sem pasta") return 1;
    return left[0].localeCompare(right[0], "pt-BR");
  });
}

function renderCutouts(cutouts, processing) {
  const selectedFolder = normalizeSectionFolderFilter(cutoutFolderFilter.value);
  const visibleCutouts = cutouts.filter((item) => matchesSelectedFolder(item.folder || "", selectedFolder));
  pruneSelectionSet(selectedCutoutIds, cutouts.map((item) => item.id));
  updateBulkSelectionUi();

  cutoutSummary.textContent = processing
    ? `Removendo fundo... ${visibleCutouts.length} de ${cutouts.length} recorte(s) visiveis.`
    : `${visibleCutouts.length} de ${cutouts.length} recorte(s) visiveis.`;

  if (!visibleCutouts.length) {
    cutoutGrid.innerHTML = `<p class="empty-state">Use o botão "Remover fundo" nas imagens da galeria para criar PNGs transparentes aqui.</p>`;
    return;
  }

  cutoutGrid.innerHTML = "";
  cutoutGrid.classList.remove("gallery-grid-grouped");

  if (viewModeSelect.value === "folders") {
  renderFolderGroupedCollection(cutoutGrid, visibleCutouts.slice(0, 12), createCutoutCard, "Nenhum PNG sem fundo encontrado nesta visualização.");
  } else {
    for (const item of visibleCutouts.slice(0, 12)) {
      cutoutGrid.appendChild(createCutoutCard(item));
    }
  }

  bindInteractiveActions();
}

function createCutoutCard(item) {
  const card = document.createElement("article");
  const titleId = `cutout-text-${item.id}-title`;
  card.className = "gallery-card";
  card.innerHTML = `
    ${buildSelectionControl("cutout", item.id, selectedCutoutIds.has(item.id))}
    <a href="${item.imageUrl}" target="_blank" rel="noreferrer">
      <img src="${thumbUrl(item.imageUrl)}" alt="${escapeHtml(item.label || "Recorte sem fundo")}">
    </a>
    <div class="gallery-body">
      <div class="gallery-copy-row">
        ${buildExpandableText({
          id: titleId,
          text: item.label || "Recorte sem fundo",
          className: "gallery-title",
          lines: 4,
        })}
      </div>
      ${buildFolderBadge(item.folder)}
      <p class="gallery-meta">PNG transparente - ${escapeHtml(formatDate(item.createdAt))}</p>
      <div class="queue-actions queue-actions-main">
        <button class="queue-button queue-button-primary" type="button" data-use-cutout-base="${item.id}">Editar imagem</button>
      </div>
      <div class="queue-actions queue-actions-footer">
        <a class="queue-link queue-link-utility" href="${item.imageUrl}" target="_blank" rel="noreferrer">Abrir</a>
        <a class="queue-link queue-link-utility" href="${item.imageUrl}" download="${item.filename}">Baixar</a>
        ${buildFolderIconButton("cutout", item.id, item.folder)}
        ${buildDeleteIconButton("cutout", item.id, "Remover imagem")}
      </div>
    </div>
  `;

  return card;
}

function renderCrops(crops) {
  const selectedFolder = normalizeSectionFolderFilter(cropFolderFilter.value);
  const visibleCrops = crops.filter((item) => matchesSelectedFolder(item.folder || "", selectedFolder));
  pruneSelectionSet(selectedCropIds, crops.map((item) => item.id));
  updateBulkSelectionUi();

  cropSummary.textContent = `${visibleCrops.length} de ${crops.length} recorte(s) visiveis.`;

  if (!visibleCrops.length) {
    cropGrid.innerHTML = `<p class="empty-state">Use o botão "Recortar" nas imagens da galeria para salvar recortes aqui.</p>`;
    return;
  }

  cropGrid.innerHTML = "";
  cropGrid.classList.remove("gallery-grid-grouped");

  if (viewModeSelect.value === "folders") {
  renderFolderGroupedCollection(cropGrid, visibleCrops.slice(0, 12), createCropCard, "Nenhum crop encontrado nesta visualização.");
  } else {
    for (const item of visibleCrops.slice(0, 12)) {
      cropGrid.appendChild(createCropCard(item));
    }
  }

  bindInteractiveActions();
}

function createCropCard(item) {
  const card = document.createElement("article");
  const titleId = `crop-text-${item.id}-title`;
  card.className = "gallery-card";
  card.innerHTML = `
    ${buildSelectionControl("crop", item.id, selectedCropIds.has(item.id))}
    <a href="${item.imageUrl}" target="_blank" rel="noreferrer">
      <img src="${thumbUrl(item.imageUrl)}" alt="${escapeHtml(item.label || "Recorte")}">
    </a>
    <div class="gallery-body">
      <div class="gallery-copy-row">
        ${buildExpandableText({
          id: titleId,
          text: item.label || "Recorte",
          className: "gallery-title",
          lines: 4,
        })}
      </div>
      ${buildFolderBadge(item.folder)}
      <p class="gallery-meta">PNG recortado - ${escapeHtml(formatDate(item.createdAt))}</p>
      <div class="queue-actions queue-actions-main">
        <button class="queue-button queue-button-primary" type="button" data-use-crop-base="${item.id}">Editar imagem</button>
      </div>
      <div class="queue-actions queue-actions-footer">
        <a class="queue-link queue-link-utility" href="${item.imageUrl}" target="_blank" rel="noreferrer">Abrir</a>
        <a class="queue-link queue-link-utility" href="${item.imageUrl}" download="${item.filename}">Baixar</a>
        ${buildFolderIconButton("crop", item.id, item.folder)}
        ${buildDeleteIconButton("crop", item.id, "Remover imagem")}
      </div>
    </div>
  `;

  return card;
}

function bindInteractiveActions() {
  for (const button of document.querySelectorAll("[data-cancel-id]")) {
    button.onclick = async () => {
      const id = button.getAttribute("data-cancel-id");
      if (!id) {
        return;
      }

      button.disabled = true;
      button.textContent = "Cancelando...";

      try {
        const response = await fetch(`/api/jobs/${id}/cancel`, {
          method: "POST",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Falha ao cancelar job.");
        }

        statusBox.textContent = `Job ${id} cancelado.`;
        await refreshJobs();
        await refreshUsage();
      } catch (error) {
        statusBox.textContent = error instanceof Error ? error.message : "Erro ao cancelar job.";
        button.disabled = false;
        button.textContent = "Cancelar";
      }
    };
  }

  for (const button of document.querySelectorAll("[data-copy-prompt]")) {
    button.onclick = async () => {
      const prompt = button.getAttribute("data-copy-prompt") || "";
      if (!prompt) {
      statusBox.textContent = "Esse card não tem prompt disponível para copiar.";
        return;
      }

      try {
        await navigator.clipboard.writeText(prompt);
        statusBox.textContent = "Prompt copiado.";
        button.classList.add("is-copied");
        window.setTimeout(() => {
          button.classList.remove("is-copied");
        }, 1400);
      } catch {
      statusBox.textContent = "Não foi possível copiar o prompt.";
      }
    };
  }

  for (const input of document.querySelectorAll("[data-select-kind][data-select-id]")) {
    input.onchange = () => {
      const kind = input.getAttribute("data-select-kind");
      const id = input.getAttribute("data-select-id");
      if (!kind || !id) {
        return;
      }

      const selectionMap = {
        job: selectedGalleryIds,
        cutout: selectedCutoutIds,
        crop: selectedCropIds,
      };

      const selectionSet = selectionMap[kind];
      if (!selectionSet) {
        return;
      }

      if (input.checked) {
        selectionSet.add(id);
      } else {
        selectionSet.delete(id);
      }

      updateBulkSelectionUi();
    };
  }

  for (const button of document.querySelectorAll("[data-toggle-text]")) {
    button.onclick = () => {
      const targetId = button.getAttribute("data-toggle-text");
      if (!targetId) {
        return;
      }

      const textBlock = document.getElementById(targetId);
      if (!textBlock) {
        return;
      }

      const isCollapsed = textBlock.classList.toggle("is-collapsed");
      button.textContent = isCollapsed ? "Ver mais" : "Ver menos";
      button.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    };
  }

  for (const button of document.querySelectorAll("[data-cutout-job-id]")) {
    button.onclick = async () => {
      const jobId = button.getAttribute("data-cutout-job-id");
      const job = state.lastJobs.find((entry) => entry.id === jobId);
      if (!job?.result?.imageUrl) {
      statusBox.textContent = "Não foi possível remover o fundo dessa imagem.";
        return;
      }

      button.disabled = true;
      button.textContent = "Removendo...";
      statusBox.textContent = "Removendo fundo da imagem...";
      state.cutoutProcessingJobId = job.id;
      renderJobs(state.lastJobs);
      const activeTargetFolder = getActiveCreationFolder();
      if (activeTargetFolder) {
        registerFolderName(activeTargetFolder);
      }

      try {
        const response = await fetch("/api/cutouts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jobId: job.id,
            imageUrl: job.result.imageUrl,
            filename: job.result.filename,
            label: buildDisplayPrompt(job),
            folder: activeTargetFolder,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Falha ao remover o fundo.");
        }

        statusBox.textContent = "Fundo removido com sucesso.";
        await refreshCutouts();
      } catch (error) {
        statusBox.textContent = error instanceof Error ? error.message : "Falha ao remover o fundo.";
      } finally {
        state.cutoutProcessingJobId = null;
        renderJobs(state.lastJobs);
      }
    };
  }

  for (const button of document.querySelectorAll("[data-delete-job-id]")) {
    button.onclick = async () => {
      const jobId = button.getAttribute("data-delete-job-id");
      const confirmed = jobId
        ? await requestConfirmation({
            title: "Remover imagem",
            message: "Remover esta imagem da galeria?",
            confirmLabel: "Remover",
          })
        : false;
      if (!jobId || !confirmed) {
        return;
      }

      button.disabled = true;
      button.classList.add("is-busy");

      try {
        const response = await fetch(`/api/jobs/${jobId}`, {
          method: "DELETE",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Falha ao remover a imagem.");
        }

        statusBox.textContent = "Imagem removida da galeria.";
        await refreshJobs();
        await refreshUsage();
      } catch (error) {
        statusBox.textContent = error instanceof Error ? error.message : "Falha ao remover a imagem.";
        button.disabled = false;
        button.classList.remove("is-busy");
      }
    };
  }

  for (const button of document.querySelectorAll("[data-branch-job-id]")) {
    button.onclick = () => {
      const jobId = button.getAttribute("data-branch-job-id");
      selectBranchFromJob(jobId, false);
    };
  }

  for (const button of document.querySelectorAll("[data-branch-keep-prompt-id]")) {
    button.onclick = () => {
      const jobId = button.getAttribute("data-branch-keep-prompt-id");
      selectBranchFromJob(jobId, true);
    };
  }

  for (const button of document.querySelectorAll("[data-crop-job-id]")) {
    button.onclick = () => {
      const jobId = button.getAttribute("data-crop-job-id");
      openRegionEditor(jobId, "crop");
    };
  }

  for (const button of document.querySelectorAll("[data-region-job-id]")) {
    button.onclick = () => {
      const jobId = button.getAttribute("data-region-job-id");
      openRegionEditor(jobId);
    };
  }

  for (const button of document.querySelectorAll("[data-use-cutout-base]")) {
    button.onclick = async () => {
      const cutoutId = button.getAttribute("data-use-cutout-base");

      try {
        const response = await fetch("/api/cutouts");
        const data = await response.json();
        const item = (data.cutouts || []).find((entry) => entry.id === cutoutId);
        if (!item) {
      throw new Error("Recorte não encontrado.");
        }

        state.selectedBranchReference = {
          jobId: item.sourceJobId,
          imageUrl: item.imageUrl,
          filename: item.filename,
          name: item.label || "Recorte sem fundo",
        };
        state.selectedRegionReference = null;
        renderBranchPreview();
        renderRegionPreview();
        statusBox.textContent = "Recorte carregado como imagem base.";
        promptInput.focus();
      } catch (error) {
      statusBox.textContent = error instanceof Error ? error.message : "Não foi possível usar esse recorte.";
      }
    };
  }

  for (const button of document.querySelectorAll("[data-delete-cutout-id]")) {
    button.onclick = async () => {
      const cutoutId = button.getAttribute("data-delete-cutout-id");
      const confirmed = cutoutId
        ? await requestConfirmation({
            title: "Remover imagem",
            message: "Remover este PNG sem fundo?",
            confirmLabel: "Remover",
          })
        : false;
      if (!cutoutId || !confirmed) {
        return;
      }

      button.disabled = true;
      button.classList.add("is-busy");

      try {
        const response = await fetch(`/api/cutouts/${cutoutId}`, {
          method: "DELETE",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Falha ao remover o recorte.");
        }

        statusBox.textContent = "PNG sem fundo removido.";
        await refreshCutouts();
      } catch (error) {
        statusBox.textContent = error instanceof Error ? error.message : "Falha ao remover o recorte.";
        button.disabled = false;
        button.classList.remove("is-busy");
      }
    };
  }

  for (const button of document.querySelectorAll("[data-use-crop-base]")) {
    button.onclick = async () => {
      const cropId = button.getAttribute("data-use-crop-base");

      try {
        const response = await fetch("/api/crops");
        const data = await response.json();
        const item = (data.crops || []).find((entry) => entry.id === cropId);
        if (!item) {
      throw new Error("Recorte não encontrado.");
        }

        state.selectedBranchReference = {
          jobId: item.sourceJobId,
          imageUrl: item.imageUrl,
          filename: item.filename,
          name: item.label || "Recorte",
        };
        state.selectedRegionReference = null;
        renderBranchPreview();
        renderRegionPreview();
        statusBox.textContent = "Recorte carregado como imagem base.";
        promptInput.focus();
      } catch (error) {
      statusBox.textContent = error instanceof Error ? error.message : "Não foi possível usar esse recorte.";
      }
    };
  }

  for (const button of document.querySelectorAll("[data-assign-folder-kind][data-assign-folder-id]")) {
    button.onclick = async () => {
      const kind = button.getAttribute("data-assign-folder-kind");
      const id = button.getAttribute("data-assign-folder-id");
      const currentFolder = button.getAttribute("data-current-folder") || "";
      if (!kind || !id) {
        return;
      }

      const nextFolder = await requestFolderSelection({
        title: "Organizar item",
        message: "Selecione uma pasta existente ou digite uma nova para este item.",
        currentFolder,
      });

      if (nextFolder === null) {
        return;
      }

      button.disabled = true;
      button.classList.add("is-busy");

      try {
        await handleSingleFolderAssignment(kind, id, nextFolder);
        statusBox.textContent = nextFolder.trim()
          ? `Item movido para ${nextFolder.trim()}.`
          : "Item removido da pasta atual.";
      } catch (error) {
        statusBox.textContent =
        error instanceof Error ? error.message : "Não foi possível atualizar a pasta deste item.";
        button.disabled = false;
        button.classList.remove("is-busy");
      }
    };
  }

  for (const button of document.querySelectorAll("[data-delete-crop-id]")) {
    button.onclick = async () => {
      const cropId = button.getAttribute("data-delete-crop-id");
      const confirmed = cropId
        ? await requestConfirmation({
            title: "Remover imagem",
            message: "Remover este recorte salvo?",
            confirmLabel: "Remover",
          })
        : false;
      if (!cropId || !confirmed) {
        return;
      }

      button.disabled = true;
      button.classList.add("is-busy");

      try {
        const response = await fetch(`/api/crops/${cropId}`, {
          method: "DELETE",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Falha ao remover o recorte.");
        }

        statusBox.textContent = "Recorte removido.";
        await refreshCrops();
      } catch (error) {
        statusBox.textContent = error instanceof Error ? error.message : "Falha ao remover o recorte.";
        button.disabled = false;
        button.classList.remove("is-busy");
      }
    };
  }

  for (const button of referencePreview.querySelectorAll("[data-remove-reference]")) {
    button.onclick = () => {
      const index = Number(button.getAttribute("data-remove-reference"));
      if (!Number.isFinite(index)) {
        return;
      }

      state.selectedReferenceFiles.splice(index, 1);
      syncReferenceInputFiles();
      renderReferencePreview();
    };
  }

  for (const button of referencePreview.querySelectorAll("[data-remove-reference-bg]")) {
    button.onclick = async () => {
      const index = Number(button.getAttribute("data-remove-reference-bg"));
      if (!Number.isFinite(index)) {
        return;
      }

      const file = state.selectedReferenceFiles[index];
      if (!file) {
        return;
      }

      button.disabled = true;
      button.textContent = "Processando...";
      statusBox.textContent = `Removendo fundo de ${file.name}...`;

      try {
        const response = await fetch("/api/reference-images/remove-background", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: file.name,
            mimeType: file.type,
            data: await fileToBase64(file),
          }),
        });
        const data = await response.json();

        if (!response.ok) {
      throw new Error(data.error || "Não foi possível remover o fundo desta referência.");
        }

        state.selectedReferenceFiles[index] = base64ToFile(
          data.referenceImage?.data || "",
          data.referenceImage?.name || `${file.name.replace(/\.[^.]+$/, "")}-sem-fundo.png`,
          data.referenceImage?.mimeType || "image/png"
        );
        syncReferenceInputFiles();
        renderReferencePreview();
    statusBox.textContent = `Fundo removido da referência ${file.name}.`;
      } catch (error) {
        statusBox.textContent =
      error instanceof Error ? error.message : "Não foi possível remover o fundo desta referência.";
        button.disabled = false;
        button.textContent = "Remover fundo";
      }
    };
  }

  for (const button of document.querySelectorAll("[data-remove-product-model-file]")) {
    button.onclick = () => {
      const index = Number(button.getAttribute("data-remove-product-model-file"));
      if (!Number.isFinite(index)) {
        return;
      }

      state.selectedProductModelFiles.splice(index, 1);
      syncProductModelInputFiles();
      renderProductModelUploadPreview();
    };
  }

  for (const button of document.querySelectorAll("[data-insert-product-model]")) {
    button.onclick = () => {
      const alias = button.getAttribute("data-insert-product-model");
      if (!alias) {
        return;
      }

      insertProductModelMention(alias);
      statusBox.textContent = `@${alias} inserido no prompt.`;
    };
  }

  for (const button of document.querySelectorAll("[data-evaluate-product-model]")) {
    button.onclick = async () => {
      const alias = button.getAttribute("data-evaluate-product-model");
      const model = state.productModels.find((entry) => entry.alias === alias);
      if (!alias || !model) {
        return;
      }

      button.disabled = true;
      button.textContent = "Avaliando...";
      statusBox.textContent = `Avaliando gratis o modelo @${alias}...`;

      try {
        const response = await fetch(`/api/product-models/${encodeURIComponent(alias)}/evaluate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "heuristic",
          }),
        });
        const data = await response.json();
        if (!response.ok) {
      throw new Error(data.error || "Não foi possível avaliar o modelo.");
        }

        await refreshProductModels();
        const evaluationLabel = getProductModelEvaluationStatusLabel(data.evaluation?.status);
      statusBox.textContent = `Avaliação grátis de @${alias} concluída: ${evaluationLabel}.`;
      } catch (error) {
      statusBox.textContent = error instanceof Error ? error.message : "Não foi possível avaliar o modelo.";
        button.disabled = false;
        button.textContent = "Avaliar gratis";
      }
    };
  }

  for (const button of document.querySelectorAll("[data-evaluate-product-model-ai]")) {
    button.onclick = async () => {
      const alias = button.getAttribute("data-evaluate-product-model-ai");
      const model = state.productModels.find((entry) => entry.alias === alias);
      if (!alias || !model) {
        return;
      }

      button.disabled = true;
      button.textContent = "Avaliando...";
      statusBox.textContent = `Avaliando com IA o modelo @${alias}... Isso pode consumir API.`;

      try {
        const response = await fetch(`/api/product-models/${encodeURIComponent(alias)}/evaluate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "gemini",
          }),
        });
        const data = await response.json();
        if (!response.ok) {
      throw new Error(data.error || "Não foi possível avaliar o modelo com IA.");
        }

        await refreshProductModels();
        const evaluationLabel = getProductModelEvaluationStatusLabel(data.evaluation?.status);
      statusBox.textContent = `Avaliação com IA de @${alias} concluída: ${evaluationLabel}.`;
      } catch (error) {
      statusBox.textContent = error instanceof Error ? error.message : "Não foi possível avaliar o modelo com IA.";
        button.disabled = false;
        button.textContent = "Avaliar com IA";
      }
    };
  }

  for (const button of document.querySelectorAll("[data-delete-product-model]")) {
    button.onclick = async () => {
      const alias = button.getAttribute("data-delete-product-model");
      const model = state.productModels.find((entry) => entry.alias === alias);
      if (!alias || !model) {
        return;
      }

      const confirmed = await requestConfirmation({
        title: "Excluir modelo de produto",
        message: `Excluir o modelo @${alias}? As referências salvas dele serão removidas.`,
        confirmLabel: "Excluir",
      });

      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(`/api/product-models/${encodeURIComponent(alias)}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Falha ao excluir o modelo de produto.");
        }

        await refreshProductModels();
        renderPromptProductModelMentions();
        statusBox.textContent = `Modelo @${alias} removido.`;
      } catch (error) {
        statusBox.textContent = error instanceof Error ? error.message : "Falha ao excluir o modelo de produto.";
      }
    };
  }

  for (const button of document.querySelectorAll("[data-remove-image-template-file]")) {
    button.onclick = () => {
      const index = Number(button.getAttribute("data-remove-image-template-file"));
      if (!Number.isFinite(index)) {
        return;
      }

      state.selectedImageTemplateFiles.splice(index, 1);
      syncImageTemplateInputFiles();
      renderImageTemplateUploadPreview();
    };
  }

  for (const button of document.querySelectorAll("[data-insert-image-template]")) {
    button.onclick = () => {
      const alias = button.getAttribute("data-insert-image-template");
      if (!alias) {
        return;
      }

      insertImageTemplateMention(alias);
      statusBox.textContent = `#${alias} inserido no prompt.`;
    };
  }

  for (const button of document.querySelectorAll("[data-delete-image-template]")) {
    button.onclick = async () => {
      const alias = button.getAttribute("data-delete-image-template");
      const template = state.imageTemplates.find((entry) => entry.alias === alias);
      if (!alias || !template) {
        return;
      }

      const confirmed = await requestConfirmation({
        title: "Excluir template visual",
        message: `Excluir o template #${alias}? As referências salvas dele serão removidas.`,
        confirmLabel: "Excluir",
      });

      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(`/api/image-templates/${encodeURIComponent(alias)}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Falha ao excluir o template visual.");
        }

        await refreshImageTemplates();
        renderPromptImageTemplateMentions();
        statusBox.textContent = `Template #${alias} removido.`;
      } catch (error) {
        statusBox.textContent = error instanceof Error ? error.message : "Falha ao excluir o template visual.";
      }
    };
  }
}

function renderReferencePreview() {
  if (!state.selectedReferenceFiles.length) {
    referencePreview.innerHTML = `<p class="reference-empty">Nenhuma referência selecionada.</p>`;
    return;
  }

  referencePreview.innerHTML = "";

  for (const [index, file] of state.selectedReferenceFiles.entries()) {
    const card = document.createElement("article");
    const imageUrl = URL.createObjectURL(file);
    card.className = "reference-card";
    card.innerHTML = `
      <img src="${imageUrl}" alt="${escapeHtml(file.name)}">
      <div class="reference-body">
        <p class="reference-name">${escapeHtml(file.name)}</p>
        <p class="reference-meta">${escapeHtml(formatBytes(file.size))}</p>
      </div>
      <div class="reference-actions">
          <button class="reference-remove" type="button" data-remove-reference-bg="${index}" aria-label="Remover fundo da referência">Remover fundo</button>
          <button class="reference-remove" type="button" data-remove-reference="${index}" aria-label="Remover referência">Remover</button>
      </div>
    `;

    const image = card.querySelector("img");
    image.addEventListener("load", () => URL.revokeObjectURL(imageUrl), { once: true });
    referencePreview.appendChild(card);
  }

  bindInteractiveActions();
}

function renderBranchPreview() {
  if (!state.selectedBranchReference) {
    branchPreview.innerHTML = `<p class="reference-empty">Nenhuma imagem base selecionada.</p>`;
    return;
  }

  branchPreview.innerHTML = `
    <article class="reference-card branch-card">
      <img src="${state.selectedBranchReference.imageUrl}" alt="${escapeHtml(state.selectedBranchReference.name || "Imagem base")}">
      <div class="reference-body">
        <p class="reference-name">${escapeHtml(state.selectedBranchReference.name || "Imagem base")}</p>
        <p class="reference-meta">A próxima geração vai editar a partir desta imagem.</p>
      </div>
      <button class="reference-remove" type="button" id="clear-branch-reference">Limpar</button>
    </article>
  `;

  const clearButton = branchPreview.querySelector("#clear-branch-reference");
  if (clearButton) {
    clearButton.onclick = () => {
      state.selectedBranchReference = null;
      state.selectedRegionReference = null;
      renderBranchPreview();
      renderRegionPreview();
      statusBox.textContent = "Imagem base removida.";
    };
  }
}

function renderRegionPreview() {
  if (!state.selectedRegionReference) {
    regionPreview.innerHTML = `<p class="reference-empty">Nenhuma região marcada.</p>`;
    return;
  }

  regionPreview.innerHTML = `
    <article class="reference-card branch-card">
      <img src="${state.selectedRegionReference.previewUrl}" alt="Região selecionada">
      <div class="reference-body">
        <p class="reference-name">Região marcada</p>
        <p class="reference-meta">A edição vai priorizar esta área e preservar o restante da imagem.</p>
      </div>
      <button class="reference-remove" type="button" id="clear-region-reference">Limpar</button>
    </article>
  `;

  const clearButton = regionPreview.querySelector("#clear-region-reference");
  if (clearButton) {
    clearButton.onclick = () => {
      state.selectedRegionReference = null;
      renderRegionPreview();
  statusBox.textContent = "Região removida.";
    };
  }
}

function selectBranchFromJob(jobId, keepPrompt) {
  const job = state.lastJobs.find((entry) => entry.id === jobId);
  if (!job?.result?.imageUrl) {
    statusBox.textContent = "Não foi possível selecionar essa imagem como base.";
    return;
  }

  state.selectedBranchReference = {
    jobId: job.id,
    imageUrl: job.result.imageUrl,
    filename: job.result.filename,
    name: buildDisplayPrompt(job),
  };
  state.selectedRegionReference = null;

  if (keepPrompt) {
    promptInput.value = job.promptBase || job.prompt || "";
    hydratePromptOptions(job.promptOptions || {});
  statusBox.textContent = "Imagem base e prompt original carregados. Ajuste o texto para criar a variação.";
  } else {
    statusBox.textContent = "Imagem base selecionada. Escreva o prompt com a modificacao desejada.";
  }

  renderBranchPreview();
  renderRegionPreview();
  promptInput.focus();
}

function hydratePromptOptions(promptOptions = {}) {
  if (negativePromptInput) {
    negativePromptInput.value = promptOptions.negativePrompt || "";
  }

  if (promptStrengthSelect) {
    promptStrengthSelect.value = promptOptions.promptStrength || "balanced";
  }

  if (renderFocusSelect) {
    renderFocusSelect.value = promptOptions.renderFocus || "";
  }

  if (aspectRatioSelect) {
    aspectRatioSelect.value = promptOptions.aspectRatio || "1:1";
  }

  if (styleDirectionInput) {
    styleDirectionInput.value = promptOptions.styleDirection || "";
  }

  if (preserveDetailsInput) {
    preserveDetailsInput.value = promptOptions.preserveDetails || "";
  }

  if (extraInstructionsInput) {
    extraInstructionsInput.value = promptOptions.extraInstructions || "";
  }
}

function buildLocalizedPrompt(prompt, promptOptions = {}, regionReference, productModels = [], imageTemplates = []) {
  const sections = [];

  if (regionReference) {
    sections.push("Edite apenas a região mostrada na referência recortada.");
    sections.push("Mantenha o restante da imagem igual, preservando enquadramento, fundo e elementos fora da área marcada.");
  }

  sections.push(prompt);

  for (const model of state.productModels) {
    sections.push(
      `Use o modelo de produto @${model.alias} como referência principal, mantendo fidelidade real ao produto ${model.name}.`
    );
    sections.push("Preserve com precisão forma, proporções, materiais, costuras, volume e identidade visual do produto.");
    if (model.notes) {
      sections.push(`Detalhes obrigatorios do modelo: ${model.notes}.`);
    }
  }

  for (const template of state.imageTemplates) {
    sections.push(`Use o template visual #${template.alias} como linguagem principal da imagem, mantendo o padrão visual ${template.name}.`);
    if (template.notes) {
      sections.push(`Diretrizes obrigatorias do template: ${template.notes}.`);
    }
    const templateOptionsSummary = buildPromptDetailsSummary(template.promptOptions);
    if (templateOptionsSummary) {
      sections.push(`Ajustes do template: ${templateOptionsSummary}.`);
    }
  }

  if (promptOptions.renderFocus) {
    sections.push(`Foco principal: ${humanizePromptFocus(promptOptions.renderFocus)}.`);
  }

  if (promptOptions.aspectRatio) {
    sections.push(`Use proporção de imagem ${promptOptions.aspectRatio}.`);
  }

  if (promptOptions.promptStrength === "strong") {
    sections.push("Siga o pedido com alta aderência, mantendo forte fidelidade aos detalhes e restrições descritos.");
  } else if (promptOptions.promptStrength === "soft") {
    sections.push("Interprete o pedido com mais liberdade criativa, preservando a intencao geral.");
  }

  if (promptOptions.styleDirection) {
    sections.push(`Direção de estilo: ${promptOptions.styleDirection}.`);
  }

  if (promptOptions.preserveDetails) {
    sections.push(`Preservar obrigatoriamente: ${promptOptions.preserveDetails}.`);
  }

  if (promptOptions.extraInstructions) {
    sections.push(`Instruções extras: ${promptOptions.extraInstructions}.`);
  }

  if (promptOptions.negativePrompt) {
    sections.push(`Evitar: ${promptOptions.negativePrompt}.`);
  }

  return sections.join("\n");
}

function humanizePromptStrength(value) {
  if (value === "strong") {
    return "alta";
  }

  if (value === "soft") {
    return "livre";
  }

  return "equilibrada";
}

function humanizePromptFocus(value) {
  if (value === "photoreal") {
    return "realismo";
  }

  if (value === "product") {
    return "produto";
  }

  if (value === "editorial") {
    return "editorial";
  }

  if (value === "lifestyle") {
    return "lifestyle";
  }

  if (value === "advertising") {
    return "ads";
  }

  if (value === "closeup") {
    return "close-up";
  }

  return value || "auto";
}

function openRegionEditor(jobId, mode = "region") {
  const job = state.lastJobs.find((entry) => entry.id === jobId);
  if (!job?.result?.imageUrl) {
    statusBox.textContent = "Não foi possível abrir o editor de região para essa imagem.";
    return;
  }

  const image = new Image();
  image.onload = () => {
    state.regionEditorState = {
      job,
      mode,
      image,
      displayWidth: image.width,
      displayHeight: image.height,
      selection: null,
      isDragging: false,
      dragStart: null,
      dragMode: null,
      dragHandle: null,
      dragOriginSelection: null,
    };

    const maxWidth = Math.max(320, Math.min(760, window.innerWidth - 220));
    const maxHeight = Math.max(220, window.innerHeight - 300);
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    regionCanvas.width = Math.round(image.width * scale);
    regionCanvas.height = Math.round(image.height * scale);
    state.regionEditorState.scale = scale;
    syncRegionEditorCopy();
    drawRegionCanvas();
    regionEditor.showModal();
  };
  image.src = `${job.result.imageUrl}?editor=${Date.now()}`;
}

function syncRegionEditorCopy() {
  if (!state.regionEditorState || state.regionEditorState.mode !== "crop") {
    regionEditorTitle.textContent = "Selecionar região";
    regionEditorDescription.textContent = "Arraste sobre a imagem para marcar a área que deseja editar.";
    applyRegionSelectionButton.textContent = "Usar região";
    updateRegionEditorMeta();
    return;
  }

  regionEditorTitle.textContent = "Recortar imagem";
    regionEditorDescription.textContent = "Arraste sobre a imagem para selecionar a área que deseja salvar como novo PNG.";
  applyRegionSelectionButton.textContent = "Salvar recorte";
  updateRegionEditorMeta();
}

function drawRegionCanvas() {
  if (!state.regionEditorState) {
    return;
  }

  const context = regionCanvas.getContext("2d");
  const { image, selection } = state.regionEditorState;
  context.clearRect(0, 0, regionCanvas.width, regionCanvas.height);
  context.drawImage(image, 0, 0, regionCanvas.width, regionCanvas.height);

  context.fillStyle = "rgba(0, 0, 0, 0.28)";
  context.fillRect(0, 0, regionCanvas.width, regionCanvas.height);

  if (selection) {
    context.clearRect(selection.x, selection.y, selection.width, selection.height);
    context.drawImage(
      image,
      selection.x / state.regionEditorState.scale,
      selection.y / state.regionEditorState.scale,
      selection.width / state.regionEditorState.scale,
      selection.height / state.regionEditorState.scale,
      selection.x,
      selection.y,
      selection.width,
      selection.height
    );
    context.strokeStyle = "#ec7b38";
    context.lineWidth = 2.5;
    context.strokeRect(selection.x, selection.y, selection.width, selection.height);
    drawSelectionGrid(context, selection);
    drawSelectionHandles(context, selection);
    drawSelectionBadge(context, selection);
  }
}

regionCanvas.addEventListener("pointerdown", (event) => {
  if (!state.regionEditorState) {
    return;
  }

  const point = getCanvasPoint(event);
  const handle = state.regionEditorState.selection ? getSelectionHandle(point, state.regionEditorState.selection) : null;
  const isInside = state.regionEditorState.selection ? pointInsideSelection(point, state.regionEditorState.selection) : false;

  state.regionEditorState.isDragging = true;
  state.regionEditorState.dragStart = point;
  state.regionEditorState.dragOriginSelection = state.regionEditorState.selection ? { ...state.regionEditorState.selection } : null;

  if (handle) {
    state.regionEditorState.dragMode = "resize";
    state.regionEditorState.dragHandle = handle;
  } else if (isInside) {
    state.regionEditorState.dragMode = "move";
    state.regionEditorState.dragHandle = null;
  } else {
    state.regionEditorState.dragMode = "create";
    state.regionEditorState.dragHandle = null;
    state.regionEditorState.selection = { x: point.x, y: point.y, width: 0, height: 0 };
  }

  regionCanvas.setPointerCapture?.(event.pointerId);
  drawRegionCanvas();
  updateRegionEditorMeta();
});

regionCanvas.addEventListener("pointermove", (event) => {
  if (!state.regionEditorState) {
    return;
  }

  const point = getCanvasPoint(event);

  if (!state.regionEditorState.isDragging || !state.regionEditorState.dragStart) {
    updateRegionCursor(point);
    return;
  }

  if (state.regionEditorState.dragMode === "move" && state.regionEditorState.dragOriginSelection) {
    state.regionEditorState.selection = moveSelection(
      state.regionEditorState.dragOriginSelection,
      point.x - state.regionEditorState.dragStart.x,
      point.y - state.regionEditorState.dragStart.y,
      regionCanvas.width,
      regionCanvas.height
    );
  } else if (state.regionEditorState.dragMode === "resize" && state.regionEditorState.dragOriginSelection && state.regionEditorState.dragHandle) {
    state.regionEditorState.selection = resizeSelection(
      state.regionEditorState.dragOriginSelection,
      state.regionEditorState.dragHandle,
      point,
      regionCanvas.width,
      regionCanvas.height
    );
  } else {
    state.regionEditorState.selection = normalizeSelection(state.regionEditorState.dragStart, point);
  }

  drawRegionCanvas();
  updateRegionEditorMeta();
});

regionCanvas.addEventListener("pointerup", (event) => {
  if (!state.regionEditorState) {
    return;
  }

  state.regionEditorState.isDragging = false;
  state.regionEditorState.dragMode = null;
  state.regionEditorState.dragHandle = null;
  state.regionEditorState.dragOriginSelection = null;
  regionCanvas.releasePointerCapture?.(event.pointerId);
  updateRegionCursor(getCanvasPoint(event));
  updateRegionEditorMeta();
});

closeRegionEditorButton.addEventListener("click", () => {
  regionEditor.close();
});

resetRegionSelectionButton.addEventListener("click", () => {
  if (!state.regionEditorState) {
    return;
  }

  state.regionEditorState.selection = null;
  drawRegionCanvas();
  updateRegionEditorMeta();
});

applyRegionSelectionButton.addEventListener("click", () => {
  if (!state.regionEditorState?.selection || !state.regionEditorState.job?.result?.imageUrl) {
    statusBox.textContent = "Marque uma área antes de confirmar.";
    return;
  }

  if (state.regionEditorState.selection.width < 12 || state.regionEditorState.selection.height < 12) {
    statusBox.textContent = "Marque uma área um pouco maior para editar.";
    return;
  }

  const cropDataUrl = cropSelectionFromEditor();
  if (!cropDataUrl) {
    statusBox.textContent = "Não foi possível criar a referência da região.";
    return;
  }

  if (state.regionEditorState.mode === "crop") {
    saveCropFromEditor(cropDataUrl);
    return;
  }

  const base64Data = cropDataUrl.split(",")[1] || "";
  state.selectedBranchReference = {
    jobId: state.regionEditorState.job.id,
    imageUrl: state.regionEditorState.job.result.imageUrl,
    filename: state.regionEditorState.job.result.filename,
    name: buildDisplayPrompt(state.regionEditorState.job),
  };
  state.selectedRegionReference = {
    previewUrl: cropDataUrl,
    payload: {
      name: `regiao-${state.regionEditorState.job.result.filename}`,
      mimeType: "image/png",
      data: base64Data,
    },
  };

  renderBranchPreview();
  renderRegionPreview();
  regionEditor.close();
    statusBox.textContent = "Imagem base e região selecionadas. Agora descreva a alteração desejada.";
  promptInput.focus();
});

async function saveCropFromEditor(cropDataUrl) {
  if (!state.regionEditorState?.job?.result?.imageUrl) {
    statusBox.textContent = "Não foi possível salvar esse recorte.";
    return;
  }

  applyRegionSelectionButton.disabled = true;
  applyRegionSelectionButton.textContent = "Salvando...";
  const activeTargetFolder = getActiveCreationFolder();
  if (activeTargetFolder) {
    registerFolderName(activeTargetFolder);
  }

  try {
    const response = await fetch("/api/crops", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: state.regionEditorState.job.id,
        sourceImageUrl: state.regionEditorState.job.result.imageUrl,
        label: `${buildDisplayPrompt(state.regionEditorState.job)} - recorte`,
        mimeType: "image/png",
        data: cropDataUrl.split(",")[1] || "",
        folder: activeTargetFolder,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Falha ao salvar o recorte.");
    }

    await refreshCrops();
    regionEditor.close();
    statusBox.textContent = "Recorte salvo com sucesso.";
  } catch (error) {
    statusBox.textContent = error instanceof Error ? error.message : "Não foi possível salvar o recorte.";
  } finally {
    applyRegionSelectionButton.disabled = false;
    syncRegionEditorCopy();
  }
}

function cropSelectionFromEditor() {
  if (!state.regionEditorState?.selection) {
    return null;
  }

  const { image, selection, scale } = state.regionEditorState;
  const sourceX = Math.round(selection.x / scale);
  const sourceY = Math.round(selection.y / scale);
  const sourceWidth = Math.max(1, Math.round(selection.width / scale));
  const sourceHeight = Math.max(1, Math.round(selection.height / scale));

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = sourceWidth;
  cropCanvas.height = sourceHeight;
  const context = cropCanvas.getContext("2d");
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  return cropCanvas.toDataURL("image/png");
}

function updateRegionEditorMeta() {
  if (!state.regionEditorState?.selection) {
    regionEditorMeta.textContent =
      state.regionEditorState?.mode === "crop"
        ? "Arraste para criar o recorte. Depois mova ou ajuste pelas bordas."
    : "Arraste para criar a seleção. Depois mova ou ajuste pelas bordas.";
    return;
  }

  const metrics = getSelectionMetrics(state.regionEditorState.selection, state.regionEditorState.scale);
  regionEditorMeta.textContent = `${metrics.width} x ${metrics.height} px - X ${metrics.x} - Y ${metrics.y}`;
}

function getSelectionMetrics(selection, scale) {
  return {
    x: Math.round(selection.x / scale),
    y: Math.round(selection.y / scale),
    width: Math.max(1, Math.round(selection.width / scale)),
    height: Math.max(1, Math.round(selection.height / scale)),
  };
}

function pointInsideSelection(point, selection) {
  return (
    point.x >= selection.x &&
    point.x <= selection.x + selection.width &&
    point.y >= selection.y &&
    point.y <= selection.y + selection.height
  );
}

function getSelectionHandle(point, selection) {
  const handles = buildSelectionHandles(selection);
  for (const [name, handle] of Object.entries(handles)) {
    if (
      point.x >= handle.x - REGION_HANDLE_SIZE &&
      point.x <= handle.x + REGION_HANDLE_SIZE &&
      point.y >= handle.y - REGION_HANDLE_SIZE &&
      point.y <= handle.y + REGION_HANDLE_SIZE
    ) {
      return name;
    }
  }
  return null;
}

function buildSelectionHandles(selection) {
  const midX = selection.x + selection.width / 2;
  const midY = selection.y + selection.height / 2;
  const maxX = selection.x + selection.width;
  const maxY = selection.y + selection.height;

  return {
    nw: { x: selection.x, y: selection.y },
    n: { x: midX, y: selection.y },
    ne: { x: maxX, y: selection.y },
    e: { x: maxX, y: midY },
    se: { x: maxX, y: maxY },
    s: { x: midX, y: maxY },
    sw: { x: selection.x, y: maxY },
    w: { x: selection.x, y: midY },
  };
}

function updateRegionCursor(point) {
  if (!state.regionEditorState?.selection) {
    regionCanvas.style.cursor = "crosshair";
    return;
  }

  const handle = getSelectionHandle(point, state.regionEditorState.selection);
  if (handle) {
    regionCanvas.style.cursor = cursorForHandle(handle);
    return;
  }

  regionCanvas.style.cursor = pointInsideSelection(point, state.regionEditorState.selection) ? "move" : "crosshair";
}

function cursorForHandle(handle) {
  if (handle === "nw" || handle === "se") {
    return "nwse-resize";
  }
  if (handle === "ne" || handle === "sw") {
    return "nesw-resize";
  }
  if (handle === "n" || handle === "s") {
    return "ns-resize";
  }
  return "ew-resize";
}

function moveSelection(selection, deltaX, deltaY, maxWidth, maxHeight) {
  const nextX = clamp(selection.x + deltaX, 0, maxWidth - selection.width);
  const nextY = clamp(selection.y + deltaY, 0, maxHeight - selection.height);
  return {
    ...selection,
    x: nextX,
    y: nextY,
  };
}

function resizeSelection(selection, handle, point, maxWidth, maxHeight) {
  let x1 = selection.x;
  let y1 = selection.y;
  let x2 = selection.x + selection.width;
  let y2 = selection.y + selection.height;

  if (handle.includes("n")) y1 = point.y;
  if (handle.includes("s")) y2 = point.y;
  if (handle.includes("w")) x1 = point.x;
  if (handle.includes("e")) x2 = point.x;

  const normalized = normalizeSelection(
    { x: clamp(x1, 0, maxWidth), y: clamp(y1, 0, maxHeight) },
    { x: clamp(x2, 0, maxWidth), y: clamp(y2, 0, maxHeight) }
  );

  return {
    x: normalized.x,
    y: normalized.y,
    width: Math.max(1, normalized.width),
    height: Math.max(1, normalized.height),
  };
}

function drawSelectionGrid(context, selection) {
  context.save();
  context.strokeStyle = "rgba(236, 123, 56, 0.45)";
  context.lineWidth = 1;

  const thirdWidth = selection.width / 3;
  const thirdHeight = selection.height / 3;

  for (let index = 1; index <= 2; index += 1) {
    const x = selection.x + thirdWidth * index;
    const y = selection.y + thirdHeight * index;
    context.beginPath();
    context.moveTo(x, selection.y);
    context.lineTo(x, selection.y + selection.height);
    context.stroke();

    context.beginPath();
    context.moveTo(selection.x, y);
    context.lineTo(selection.x + selection.width, y);
    context.stroke();
  }

  context.restore();
}

function drawSelectionHandles(context, selection) {
  context.save();
  context.fillStyle = "#fff7ef";
  context.strokeStyle = "#ec7b38";
  context.lineWidth = 1.5;

  for (const handle of Object.values(buildSelectionHandles(selection))) {
    context.beginPath();
    context.rect(handle.x - 4, handle.y - 4, 8, 8);
    context.fill();
    context.stroke();
  }

  context.restore();
}

function drawSelectionBadge(context, selection) {
  const metrics = getSelectionMetrics(selection, state.regionEditorState.scale);
  const label = `${metrics.width}x${metrics.height}`;

  context.save();
  context.font = '600 12px "IBM Plex Mono", monospace';
  const textWidth = context.measureText(label).width;
  const badgeWidth = textWidth + 14;
  const badgeHeight = 24;
  const badgeX = selection.x + 8;
  const badgeY = Math.max(8, selection.y - badgeHeight - 8);

  context.fillStyle = "rgba(34, 24, 16, 0.86)";
  context.beginPath();
  context.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 999);
  context.fill();

  context.fillStyle = "#fff7ef";
  context.fillText(label, badgeX + 7, badgeY + 16);
  context.restore();
}



function getCanvasPoint(event) {
  const rect = regionCanvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(regionCanvas.width, event.clientX - rect.left));
  const y = Math.max(0, Math.min(regionCanvas.height, event.clientY - rect.top));
  return { x, y };
}

function normalizeSelection(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}

async function buildReferencePayload(files) {
  if (!files.length) {
    return [];
  }

  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      mimeType: file.type,
      data: await fileToBase64(file),
    }))
  );
}







function syncReferenceInputFiles() {
  const dataTransfer = new DataTransfer();
  for (const file of state.selectedReferenceFiles) {
    dataTransfer.items.add(file);
  }

  referenceInput.files = dataTransfer.files;
}

function statusLabel(status) {
  if (status === "queued") {
    return "Na fila";
  }

  if (status === "processing") {
    return "Gerando";
  }

  if (status === "completed") {
    return "Pronto";
  }

  if (status === "failed") {
    return "Erro";
  }

  if (status === "cancelled") {
    return "Cancelado";
  }

  return status;
}









function buildDisplayPrompt(job) {
  const displayPrompt = job.promptBase || job.prompt;
  if (!job.batchIndex || !job.batchTotal) {
    return displayPrompt;
  }

  return `${displayPrompt} - versao ${job.batchIndex}/${job.batchTotal}`;
}



function referenceLabel(referenceImages = []) {
  if (!referenceImages?.length) {
    return "";
  }

  return `${referenceImages.length} ref${referenceImages.length > 1 ? "s" : ""}`;
}

function filterQueueJobs(jobs) {
  const query = searchInput.value.trim().toLowerCase();
  const status = queueFilter.value;
  const model = queueModelFilter.value;

  return jobs.filter((job) => {
    const matchesQuery = !query || buildDisplayPrompt(job).toLowerCase().includes(query);
    const matchesStatus =
      status === "all" ? true : status === "active" ? job.status === "queued" || job.status === "processing" : job.status === status;
    const matchesModel = model === "all" || job.model === model;
    return matchesQuery && matchesStatus && matchesModel;
  });
}

function filterGalleryJobs(jobs) {
  const query = searchInput.value.trim().toLowerCase();
  const model = galleryFilter.value;
  const folderQuery = normalizeSectionFolderFilter(galleryFolderFilter.value);

  return jobs.filter((job) => {
    const matchesQuery = !query || buildDisplayPrompt(job).toLowerCase().includes(query);
    const matchesModel = model === "all" || job.model === model;
    const matchesFolder = matchesSelectedFolder(job.result?.folder || "", folderQuery);
    return matchesQuery && matchesModel && matchesFolder;
  });
}

function normalizeSectionFolderFilter(value) {
  if (value === "all") {
    return "all";
  }

  return String(value || "").trim();
}

function matchesSelectedFolder(folder, selectedFolder) {
  if (selectedFolder === "all") {
    return true;
  }

  return String(folder || "").trim() === selectedFolder;
}

function queueEmptyMessage() {
  if (queueFilter.value === "active") {
  return "Não há jobs ativos agora. Troque o filtro para Prontos ou Todos se quiser revisar o histórico recente.";
  }

  return "Nenhum job corresponde aos filtros atuais. Limpe os filtros ou troque o modelo para voltar a navegar pela fila.";
}

function galleryEmptyMessage() {
  if (galleryFilter.value === "gemini-3-pro-image-preview") {
  return "Nenhuma imagem do Nano Banana Pro foi encontrada no histórico atual.";
  }

  if (galleryFilter.value === "gemini-2.5-flash-image") {
  return "Nenhuma imagem do Nano Banana foi encontrada no histórico atual.";
  }

  return "Nenhuma imagem corresponde aos filtros atuais. Limpe os filtros ou gere um novo lote para preencher a galeria.";
}

function renderUsage(data) {
  usageSummary.textContent = `${data.completedJobs} concluídos, ${data.processingJobs} em execução, ${data.queuedJobs} na fila, ${data.failedJobs} com erro.`;

  const baseCards = `
    <article class="usage-card">
      <p class="usage-label">Custo total estimado</p>
      <p class="usage-value">${formatMoney(data.totalEstimatedCost, data.currency)}</p>
      <p class="usage-note">Baseado no histórico local de jobs concluídos.</p>
    </article>
    <article class="usage-card">
      <p class="usage-label">Custo hoje estimado</p>
      <p class="usage-value">${formatMoney(data.todayEstimatedCost, data.currency)}</p>
      <p class="usage-note">${data.todayCompleted} imagem(ns) concluídas hoje.</p>
    </article>
    <article class="usage-card">
      <p class="usage-label">Imagens concluídas</p>
      <p class="usage-value">${data.completedJobs}</p>
      <p class="usage-note">Inclui todas as gerações persistidas no histórico local.</p>
    </article>
  `;

  if (!data.byModel?.length) {
    usageModels.innerHTML = "";
  } else {
    usageModels.innerHTML = data.byModel
      .map(
        (entry) => `
          <article class="usage-model-card">
            <p class="usage-label">${escapeHtml(entry.label)}</p>
            <p class="usage-value">${entry.completed} imagem(ns)</p>
            <p class="usage-note">Estimado: ${formatMoney(entry.estimatedCost, entry.currency)} - ${formatMoney(entry.unitCost, entry.currency)}/imagem</p>
          </article>
        `
      )
      .join("");
  }

  usageCards.innerHTML = baseCards + usageModels.innerHTML;
  usageModels.innerHTML = "";

  usageLinks.innerHTML = "";
  for (const [label, url] of Object.entries(data.links || {})) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = linkLabel(label);
    usageLinks.appendChild(anchor);
  }
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value || 0);
}



function linkLabel(key) {
  if (key === "billing") {
    return "Abrir billing";
  }

  if (key === "rateLimits") {
    return "Ver rate limits";
  }

  if (key === "usage") {
    return "Ver uso";
  }

  if (key === "keys" || key === "apiKeys") {
    return "Abrir API keys";
  }

  return key;
}

