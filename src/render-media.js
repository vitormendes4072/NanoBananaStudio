import deps from './deps.js';
import { selectedCutoutIds, selectedCropIds } from './state.js';
import { escapeHtml, formatDate } from './utils.js';
import {
  normalizeSectionFolderFilter,
  matchesSelectedFolder,
  thumbUrl,
  buildSelectionControl,
  buildExpandableText,
  buildFolderBadge,
  buildFolderIconButton,
  buildDeleteIconButton,
} from './render-queue.js';
import { pruneSelectionSet, updateBulkSelectionUi } from './selection.js';
import { renderFolderGroupedCollection } from './render-folders.js';
import { bindInteractiveActions } from './events.js';
import {
  cutoutGrid,
  cutoutSummary,
  cutoutFolderFilter,
  cropGrid,
  cropSummary,
  cropFolderFilter,
  viewModeSelect,
} from './dom.js';

export function renderCutouts(cutouts, processing) {
  const selectedFolder = normalizeSectionFolderFilter(cutoutFolderFilter.value);
  const visibleCutouts = cutouts.filter((item) =>
    matchesSelectedFolder(item.folder || '', selectedFolder)
  );
  pruneSelectionSet(
    selectedCutoutIds,
    cutouts.map((item) => item.id)
  );
  updateBulkSelectionUi();

  cutoutSummary.textContent = processing
    ? `Removendo fundo... ${visibleCutouts.length} de ${cutouts.length} recorte(s) visiveis.`
    : `${visibleCutouts.length} de ${cutouts.length} recorte(s) visiveis.`;

  if (!visibleCutouts.length) {
    cutoutGrid.innerHTML = `<p class="empty-state">Use o botão "Remover fundo" nas imagens da galeria para criar PNGs transparentes aqui.</p>`;
    return;
  }

  cutoutGrid.innerHTML = '';
  cutoutGrid.classList.remove('gallery-grid-grouped');

  if (viewModeSelect.value === 'folders') {
    renderFolderGroupedCollection(
      cutoutGrid,
      visibleCutouts.slice(0, 12),
      createCutoutCard,
      'Nenhum PNG sem fundo encontrado nesta visualização.'
    );
  } else {
    for (const item of visibleCutouts.slice(0, 12)) cutoutGrid.appendChild(createCutoutCard(item));
  }

  bindInteractiveActions();
}

function createCutoutCard(item) {
  const card = document.createElement('article');
  const titleId = `cutout-text-${item.id}-title`;
  card.className = 'gallery-card';
  card.innerHTML = `
    ${buildSelectionControl('cutout', item.id, selectedCutoutIds.has(item.id))}
    <a href="${item.imageUrl}" target="_blank" rel="noreferrer"><img src="${thumbUrl(item.imageUrl)}" alt="${escapeHtml(item.label || 'Recorte sem fundo')}"></a>
    <div class="gallery-body">
      <div class="gallery-copy-row">${buildExpandableText({ id: titleId, text: item.label || 'Recorte sem fundo', className: 'gallery-title', lines: 4 })}</div>
      ${buildFolderBadge(item.folder)}
      <p class="gallery-meta">PNG transparente - ${escapeHtml(formatDate(item.createdAt))}</p>
      <div class="queue-actions queue-actions-main">
        <button class="queue-button queue-button-primary" type="button" data-use-cutout-base="${item.id}">Editar imagem</button>
      </div>
      <div class="queue-actions queue-actions-footer">
        <a class="queue-link queue-link-utility" href="${item.imageUrl}" target="_blank" rel="noreferrer">Abrir</a>
        <a class="queue-link queue-link-utility" href="${item.imageUrl}" download="${item.filename}">Baixar</a>
        ${buildFolderIconButton('cutout', item.id, item.folder)}
        ${buildDeleteIconButton('cutout', item.id, 'Remover imagem')}
      </div>
    </div>
  `;
  return card;
}

export function renderCrops(crops) {
  const selectedFolder = normalizeSectionFolderFilter(cropFolderFilter.value);
  const visibleCrops = crops.filter((item) =>
    matchesSelectedFolder(item.folder || '', selectedFolder)
  );
  pruneSelectionSet(
    selectedCropIds,
    crops.map((item) => item.id)
  );
  updateBulkSelectionUi();

  cropSummary.textContent = `${visibleCrops.length} de ${crops.length} recorte(s) visiveis.`;

  if (!visibleCrops.length) {
    cropGrid.innerHTML = `<p class="empty-state">Use o botão "Recortar" nas imagens da galeria para salvar recortes aqui.</p>`;
    return;
  }

  cropGrid.innerHTML = '';
  cropGrid.classList.remove('gallery-grid-grouped');

  if (viewModeSelect.value === 'folders') {
    renderFolderGroupedCollection(
      cropGrid,
      visibleCrops.slice(0, 12),
      createCropCard,
      'Nenhum crop encontrado nesta visualização.'
    );
  } else {
    for (const item of visibleCrops.slice(0, 12)) cropGrid.appendChild(createCropCard(item));
  }

  bindInteractiveActions();
}

function createCropCard(item) {
  const card = document.createElement('article');
  const titleId = `crop-text-${item.id}-title`;
  card.className = 'gallery-card';
  card.innerHTML = `
    ${buildSelectionControl('crop', item.id, selectedCropIds.has(item.id))}
    <a href="${item.imageUrl}" target="_blank" rel="noreferrer"><img src="${thumbUrl(item.imageUrl)}" alt="${escapeHtml(item.label || 'Recorte')}"></a>
    <div class="gallery-body">
      <div class="gallery-copy-row">${buildExpandableText({ id: titleId, text: item.label || 'Recorte', className: 'gallery-title', lines: 4 })}</div>
      ${buildFolderBadge(item.folder)}
      <p class="gallery-meta">PNG recortado - ${escapeHtml(formatDate(item.createdAt))}</p>
      <div class="queue-actions queue-actions-main">
        <button class="queue-button queue-button-primary" type="button" data-use-crop-base="${item.id}">Editar imagem</button>
      </div>
      <div class="queue-actions queue-actions-footer">
        <a class="queue-link queue-link-utility" href="${item.imageUrl}" target="_blank" rel="noreferrer">Abrir</a>
        <a class="queue-link queue-link-utility" href="${item.imageUrl}" download="${item.filename}">Baixar</a>
        ${buildFolderIconButton('crop', item.id, item.folder)}
        ${buildDeleteIconButton('crop', item.id, 'Remover imagem')}
      </div>
    </div>
  `;
  return card;
}

deps.renderCutouts = renderCutouts;
deps.renderCrops = renderCrops;
