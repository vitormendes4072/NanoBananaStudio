import deps from "./deps.js";
import { state, MODEL_INFO, selectedGalleryIds } from "./state.js";
import { escapeHtml, formatDate, buildVersionLabel } from "./utils.js";
import {
  searchInput, queueFilter, queueModelFilter, galleryFilter, galleryFolderFilter,
  viewModeSelect, folderFilterInput, queueList, queueSummary, galleryGrid,
  gallerySummary, statusBox, submitButton,
} from "./dom.js";

let lastRenderedJobsKey = "";

export function resetRenderedJobsKey() { lastRenderedJobsKey = ""; }

export function thumbUrl(originalUrl) {
  if (!originalUrl) return "";
  return `/api/thumb?src=${encodeURIComponent(originalUrl)}`;
}

export function statusLabel(status) {
  if (status === "queued") return "Na fila";
  if (status === "processing") return "Gerando";
  if (status === "completed") return "Pronto";
  if (status === "failed") return "Erro";
  if (status === "cancelled") return "Cancelado";
  return status;
}

export function buildDisplayPrompt(job) {
  const displayPrompt = job.promptBase || job.prompt;
  if (!job.batchIndex || !job.batchTotal) return displayPrompt;
  return `${displayPrompt} - versao ${job.batchIndex}/${job.batchTotal}`;
}

export function modelLabel(modelId) {
  return MODEL_INFO[modelId]?.shortLabel || modelId;
}

function referenceLabel(referenceImages = []) {
  if (!referenceImages?.length) return "";
  return `${referenceImages.length} ref${referenceImages.length > 1 ?"s" : ""}`;
}

export function humanizePromptStrength(value) {
  if (value === "strong") return "alta";
  if (value === "soft") return "livre";
  return "equilibrada";
}

export function humanizePromptFocus(value) {
  if (value === "photoreal") return "realismo";
  if (value === "product") return "produto";
  if (value === "editorial") return "editorial";
  if (value === "lifestyle") return "lifestyle";
  if (value === "advertising") return "ads";
  if (value === "closeup") return "close-up";
  return value || "auto";
}

export function buildPromptDetailsSummary(promptOptions = {}) {
  const parts = [];
  if (promptOptions.renderFocus) parts.push(`Foco: ${humanizePromptFocus(promptOptions.renderFocus)}`);
  if (promptOptions.aspectRatio) parts.push(`Formato: ${promptOptions.aspectRatio}`);
  if (promptOptions.promptStrength && promptOptions.promptStrength !== "balanced") parts.push(`Aderência: ${humanizePromptStrength(promptOptions.promptStrength)}`);
  if (promptOptions.negativePrompt) parts.push(`Negativo: ${promptOptions.negativePrompt}`);
  if (promptOptions.styleDirection) parts.push(`Estilo: ${promptOptions.styleDirection}`);
  if (promptOptions.preserveDetails) parts.push(`Preservar: ${promptOptions.preserveDetails}`);
  if (promptOptions.extraInstructions) parts.push(`Extras: ${promptOptions.extraInstructions}`);
  return parts.join(" - ");
}

function buildPromptOptionsSummary(promptOptions = {}) {
  const summary = buildPromptDetailsSummary(promptOptions);
  if (!summary) return "";
  return `<p class="queue-prompt-options">${escapeHtml(summary)}</p>`;
}

export function buildSelectionControl(kind, id, checked) {
  return `
    <label class="card-select-control" title="Selecionar item">
      <input type="checkbox" data-select-kind="${kind}" data-select-id="${escapeHtml(id)}" ${checked ?"checked" : ""}>
      <span></span>
    </label>
  `;
}

export function buildExpandableText({ id, text, className, lines }) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  const shouldCollapse = trimmed.length > 120;
  return `
    <div class="expandable-text-block">
      <p id="${id}" class="${className}${shouldCollapse ?" is-collapsed" : ""}" ${shouldCollapse ?`data-expandable-text data-lines="${lines}"` : ""}>${escapeHtml(trimmed)}</p>
      ${shouldCollapse ?`<button class="text-toggle-button" type="button" data-toggle-text="${id}" aria-expanded="false">Ver mais</button>` : ""}
    </div>
  `;
}

export function buildCopyButton(prompt) {
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

export function buildDeleteIconButton(kind, id, label) {
  const attributeMap = { job: "data-delete-job-id", cutout: "data-delete-cutout-id", crop: "data-delete-crop-id" };
  const attribute = attributeMap[kind];
  if (!attribute) return "";
  return `
    <button class="icon-action-button icon-action-button-danger icon-action-button-end" type="button" ${attribute}="${escapeHtml(id)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
        <path d="M9 3h6"></path><path d="M4 6h16"></path>
        <path d="M7 6l1 14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-14"></path>
        <path d="M10 10v7"></path><path d="M14 10v7"></path>
      </svg>
    </button>
  `;
}

export function buildFolderIconButton(kind, id, currentFolder) {
  return `
    <button class="icon-action-button" type="button" data-assign-folder-kind="${escapeHtml(kind)}" data-assign-folder-id="${escapeHtml(id)}" data-current-folder="${escapeHtml(currentFolder || "")}" aria-label="Adicionar a uma pasta" title="Adicionar a uma pasta">
      <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <path d="M12 11v6"></path><path d="M9 14h6"></path>
      </svg>
    </button>
  `;
}

export function displayFolderName(folder) {
  return String(folder || "").trim() || "Sem pasta";
}

export function buildFolderBadge(folder) {
  return `<p class="folder-badge">${escapeHtml(displayFolderName(folder))}</p>`;
}

function buildReferenceStrip(referenceImages = []) {
  const availableImages = referenceImages.filter((image) => image?.url);
  if (!availableImages.length) return "";
  const thumbnails = availableImages.slice(0, 3).map((image) => `
    <a class="reference-thumb" href="${image.url}" target="_blank" rel="noreferrer" title="${escapeHtml(image.name)}">
      <img src="${image.url}" alt="${escapeHtml(image.name)}">
    </a>`).join("");
  const extraCount = availableImages.length - 3;
  return `<div class="reference-strip"><div class="reference-thumb-row">${thumbnails}${extraCount > 0 ? `<span class="reference-thumb-more">+${extraCount}</span>` : ""}</div><p class="reference-strip-label">${availableImages.length} imagem(ns) de referência</p></div>`;
}
function buildReferenceBadge(job) {
  if (!job.referenceImages?.length) return "";
  return `<span class="queue-reference-pill">${job.referenceImages.length} imagem(ns) de referência</span>`;
}

function buildJobMeta(job) {
  const created = formatDate(job.createdAt);
  const model = modelLabel(job.model);
  const references = referenceLabel(job.referenceImages);
  if (job.status === "processing") return [model, references, `iniciou ${formatDate(job.startedAt) || created}`].filter(Boolean).join(" - ");
  if (job.status === "completed") return [model, references, `concluído ${formatDate(job.finishedAt) || created}`].filter(Boolean).join(" - ");
  if (job.status === "failed") return [model, references, `falhou ${formatDate(job.finishedAt) || created}`].filter(Boolean).join(" - ");
  return [model, references, `enfileirado ${created}`].filter(Boolean).join(" - ");
}

function buildGalleryMeta(job) {
  return [modelLabel(job.model), referenceLabel(job.referenceImages), formatDate(job.finishedAt)].filter(Boolean).join(" - ");
}

function buildJobPreview(job) {
  if (job.status !== "completed" || !job.result) return "";
  return `<a class="queue-preview" href="${job.result.imageUrl}" target="_blank" rel="noreferrer"><img src="${thumbUrl(job.result.imageUrl)}" alt="${escapeHtml(buildDisplayPrompt(job))}"></a>`;
}

function buildJobActions(job) {
  if (job.status === "completed" && job.result) {
    return `<div class="queue-actions"><a class="queue-link" href="${job.result.imageUrl}" target="_blank" rel="noreferrer">Abrir imagem</a><a class="queue-link" href="${job.result.imageUrl}" download="${job.result.filename}">Baixar</a></div>`;
  }
  if (job.status === "queued") return `<div class="queue-actions"><button class="queue-button" type="button" data-cancel-id="${job.id}">Cancelar</button></div>`;
  if (job.status === "failed") return `<div class="queue-actions"><span class="queue-inline-error">${escapeHtml(job.error?.error || "Erro desconhecido.")}</span></div>`;
  return "";
}

export function createGalleryCard(job) {
  const card = document.createElement("article");
  const title = buildDisplayPrompt(job);
  const promptText = buildPromptDetailsSummary(job.promptOptions);
  const showPrompt = promptText && promptText !== title;
  const copyTarget = showPrompt ?promptText : title;
  const isRemovingBackground = state.cutoutProcessingJobId === job.id;
  const titleId = `gallery-text-${job.id}-title`;
  const promptId = `gallery-text-${job.id}-prompt`;
  card.className = "gallery-card";
  card.innerHTML = `
    ${buildSelectionControl("job", job.id, selectedGalleryIds.has(job.id))}
    <a href="${job.result.imageUrl}" target="_blank" rel="noreferrer"><img src="${thumbUrl(job.result.imageUrl)}" alt="${escapeHtml(buildDisplayPrompt(job))}"></a>
    <div class="gallery-body">
      <div class="gallery-copy-row">${buildExpandableText({ id: titleId, text: title, className: "gallery-title", lines: 4 })}${buildCopyButton(copyTarget)}</div>
      ${showPrompt ?buildExpandableText({ id: promptId, text: promptText, className: "gallery-prompt", lines: 3 }) : ""}
      ${buildReferenceStrip(job.referenceImages)}
      ${buildFolderBadge(job.result?.folder)}
      <p class="gallery-meta">${escapeHtml(buildGalleryMeta(job))}</p>
      <div class="queue-actions queue-actions-main">
        <button class="queue-button queue-button-primary" type="button" data-branch-job-id="${job.id}">Editar imagem</button>
        <button class="queue-button queue-button-primary" type="button" data-branch-keep-prompt-id="${job.id}">Editar com prompt</button>
        <button class="queue-button queue-button-secondary" type="button" data-cutout-job-id="${job.id}" ${isRemovingBackground ?"disabled" : ""}>${isRemovingBackground ?"Removendo..." : "Remover fundo"}</button>
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

export function filterQueueJobs(jobs) {
  const query = searchInput.value.trim().toLowerCase();
  const status = queueFilter.value;
  const model = queueModelFilter.value;
  return jobs.filter((job) => {
    const matchesQuery = !query || buildDisplayPrompt(job).toLowerCase().includes(query);
    const matchesStatus = status === "all" ?true : status === "active" ?job.status === "queued" || job.status === "processing" : job.status === status;
    const matchesModel = model === "all" || job.model === model;
    return matchesQuery && matchesStatus && matchesModel;
  });
}

export function filterGalleryJobs(jobs) {
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

export function normalizeSectionFolderFilter(value) {
  if (value === "all") return "all";
  return String(value || "").trim();
}

export function matchesSelectedFolder(folder, selectedFolder) {
  if (selectedFolder === "all") return true;
  return String(folder || "").trim() === selectedFolder;
}

function queueEmptyMessage() {
  if (queueFilter.value === "active") return "Não há jobs ativos agora. Troque o filtro para Prontos ou Todos se quiser revisar o histórico recente.";
  return "Nenhum job corresponde aos filtros atuais. Limpe os filtros ou troque o modelo para voltar a navegar pela fila.";
}

function galleryEmptyMessage() {
  if (galleryFilter.value === "gemini-3-pro-image-preview") return "Nenhuma imagem do Nano Banana Pro foi encontrada no histórico atual.";
  if (galleryFilter.value === "gemini-2.5-flash-image") return "Nenhuma imagem do Nano Banana foi encontrada no histórico atual.";
  return "Nenhuma imagem corresponde aos filtros atuais. Limpe os filtros ou gere um novo lote para preencher a galeria.";
}

function updateQueueSummary(jobs, visibleJobs = jobs) {
  const queued = jobs.filter((j) => j.status === "queued").length;
  const processing = jobs.filter((j) => j.status === "processing").length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  queueSummary.textContent = `${visibleJobs.length} exibidos de ${jobs.length} jobs - ${queued} na fila, ${processing} em execução, ${completed} concluídos, ${failed} com erro.`;
}

function updateStatusFromVisibleResults(filteredGalleryJobs) {
  if (!filteredGalleryJobs.length && (galleryFilter.value !== "all" || searchInput.value.trim())) {
    statusBox.textContent = "Nenhuma imagem corresponde aos filtros atuais.";
    return;
  }
  if (!submitButton.disabled) statusBox.textContent = "Pronto para enfileirar.";
}

export function renderGallery(completedJobs) {
  deps.pruneSelectionSet(selectedGalleryIds, completedJobs.map((job) => job.id));
  deps.updateBulkSelectionUi();

  if (!completedJobs.length) {
    gallerySummary.textContent = "0 imagens visiveis";
    galleryGrid.innerHTML = `<p class="empty-state">${galleryEmptyMessage()}</p>`;
    return;
  }

  gallerySummary.textContent = `${Math.min(completedJobs.length, 12)} de ${completedJobs.length} imagens visiveis`;
  galleryGrid.innerHTML = "";
  galleryGrid.classList.remove("gallery-grid-grouped");

  if (viewModeSelect.value === "folders") {
    deps.renderFolderGroupedCollection(galleryGrid, completedJobs.slice(0, 12), createGalleryCard, "Nenhuma imagem encontrada nesta visualização.");
  } else {
    for (const job of completedJobs.slice(0, 12)) galleryGrid.appendChild(createGalleryCard(job));
  }
}

export function renderJobs(jobs) {
  state.lastJobs = jobs;
  deps.renderProductModelList();
  deps.renderImageTemplateList();

  const filterState = JSON.stringify({
    search: searchInput.value.trim().toLowerCase(), queueFilter: queueFilter.value,
    queueModelFilter: queueModelFilter.value, galleryFilter: galleryFilter.value,
    galleryFolderFilter: galleryFolderFilter.value, viewMode: viewModeSelect.value,
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
      item.className = `queue-item is-${job.status}${job.status === "completed" && job.result ?" has-preview" : ""}`;
      item.innerHTML = `
        ${buildJobPreview(job)}
        <div class="queue-top"><div>
          <div class="queue-top"><div>
            <p class="queue-prompt">${escapeHtml(buildDisplayPrompt(job))}</p>
            ${buildPromptOptionsSummary(job.promptOptions)}
            <p class="queue-meta">${escapeHtml(buildJobMeta(job))}</p>
            <div class="queue-label-row">${buildVersionLabel(job)}${buildReferenceBadge(job)}</div>
          </div><span class="queue-badge">${statusLabel(job.status)}</span></div>
          ${buildJobActions(job)}
        </div></div>
      `;
      queueList.appendChild(item);
    }
  }

  renderGallery(filteredGalleryJobs);
  updateStatusFromVisibleResults(filteredGalleryJobs);
  deps.renderFolderBoard();
  deps.bindInteractiveActions();
}

// Register on deps
deps.renderJobs = renderJobs;
deps.renderGallery = renderGallery;
deps.thumbUrl = thumbUrl;
deps.buildDisplayPrompt = buildDisplayPrompt;
deps.buildPromptDetailsSummary = buildPromptDetailsSummary;
deps.modelLabel = modelLabel;
deps.displayFolderName = displayFolderName;
deps.buildSelectionControl = buildSelectionControl;
deps.buildExpandableText = buildExpandableText;
deps.buildFolderBadge = buildFolderBadge;
deps.buildDeleteIconButton = buildDeleteIconButton;
deps.buildFolderIconButton = buildFolderIconButton;
deps.resetRenderedJobsKey = resetRenderedJobsKey;
deps.filterGalleryJobs = filterGalleryJobs;
deps.filterQueueJobs = filterQueueJobs;
deps.normalizeSectionFolderFilter = normalizeSectionFolderFilter;
deps.matchesSelectedFolder = matchesSelectedFolder;
