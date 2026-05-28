import deps from './deps.js';
import { state } from './state.js';
import { escapeHtml, normalizeFolderValue } from './utils.js';
import { displayFolderName, renderJobs } from './render-queue.js';
import { renderCutouts, renderCrops } from './render-media.js';
import {
  galleryFolderFilter,
  cutoutFolderFilter,
  cropFolderFilter,
  folderFilterInput,
  folderBoard,
  folderSummary,
  folderDialogOptions,
} from './dom.js';

export function getExistingFolderNames() {
  return Array.from(
    new Set(
      [
        ...state.customFolders,
        ...state.lastJobs
          .filter((j) => j.status === 'completed' && j.result?.folder)
          .map((j) => String(j.result.folder || '').trim()),
        ...state.lastCutouts.map((item) => String(item.folder || '').trim()),
        ...state.lastCrops.map((item) => String(item.folder || '').trim()),
      ].filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function populateSectionFolderFilters() {
  const folderNames = getExistingFolderNames();
  for (const select of [galleryFolderFilter, cutoutFolderFilter, cropFolderFilter]) {
    if (!select) continue;
    const currentValue = select.value === '' ? '' : select.value || 'all';
    select.innerHTML = `<option value="all">Todas</option><option value="">Sem pasta</option>${folderNames.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('')}`;
    const hasCurrentValue =
      currentValue === 'all' || currentValue === '' || folderNames.includes(currentValue);
    select.value = hasCurrentValue ? currentValue : 'all';
  }
}

export function applyFolderToSectionFilters(folderValue) {
  const normalizedValue = folderValue === '' ? '' : normalizeFolderValue(folderValue) || 'all';
  for (const select of [galleryFolderFilter, cutoutFolderFilter, cropFolderFilter]) {
    if (!select) continue;
    const optionExists = Array.from(select.options).some((o) => o.value === normalizedValue);
    select.value = optionExists ? normalizedValue : 'all';
  }
}

export function renderFolderDialogOptions(currentFolder = '') {
  if (!folderDialogOptions) return;
  const folders = getExistingFolderNames();
  if (!folders.length) {
    folderDialogOptions.innerHTML = `<p class="empty-state">Nenhuma pasta criada ainda.</p>`;
    return;
  }
  folderDialogOptions.innerHTML = folders
    .map(
      (folder) => `
    <button class="folder-choice${folder === currentFolder ? ' is-active' : ''}" type="button" data-folder-choice="${escapeHtml(folder)}">${escapeHtml(folder)}</button>`
    )
    .join('');
}

export function renderFolderGroupedCollection(container, items, cardFactory, emptyMessage) {
  if (!container) return;
  const groups = groupItemsByFolder(items);
  if (!groups.length) {
    container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
    return;
  }
  container.innerHTML = '';
  container.classList.add('gallery-grid-grouped');
  for (const [folderName, folderItems] of groups) {
    const section = document.createElement('section');
    section.className = 'folder-group';
    section.innerHTML = `<div class="folder-group-head"><div><p class="folder-group-kicker">Pasta</p><h3 class="folder-group-title">${escapeHtml(folderName)}</h3></div><p class="folder-group-count">${folderItems.length} item(ns)</p></div>`;
    const grid = document.createElement('div');
    grid.className = 'folder-group-grid';
    for (const item of folderItems) grid.appendChild(cardFactory(item));
    section.appendChild(grid);
    container.appendChild(section);
  }
}

function groupItemsByFolder(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = displayFolderName(item?.result?.folder || item?.folder || '');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return Array.from(grouped.entries()).sort((a, b) => {
    if (a[0] === 'Sem pasta') return -1;
    if (b[0] === 'Sem pasta') return 1;
    return a[0].localeCompare(b[0], 'pt-BR');
  });
}

export function renderFolderBoard() {
  if (!folderBoard || !folderSummary) return;
  populateSectionFolderFilters();
  const folderQuery = folderFilterInput.value.trim().toLowerCase();
  const entries = [
    ...state.lastJobs
      .filter((j) => j.status === 'completed' && j.result)
      .map((j) => ({ folder: j.result.folder || '', kind: 'Galeria' })),
    ...state.lastCutouts.map((item) => ({ folder: item.folder || '', kind: 'Recorte sem fundo' })),
    ...state.lastCrops.map((item) => ({ folder: item.folder || '', kind: 'Crop' })),
  ];
  const grouped = new Map();
  for (const folder of getExistingFolderNames())
    grouped.set(folder, { total: 0, gallery: 0, cutouts: 0, crops: 0 });
  for (const entry of entries) {
    const key = displayFolderName(entry.folder);
    if (!grouped.has(key)) grouped.set(key, { total: 0, gallery: 0, cutouts: 0, crops: 0 });
    const bucket = grouped.get(key);
    bucket.total += 1;
    if (entry.kind === 'Galeria') bucket.gallery += 1;
    if (entry.kind === 'Recorte sem fundo') bucket.cutouts += 1;
    if (entry.kind === 'Crop') bucket.crops += 1;
  }
  const visibleFolders = Array.from(grouped.entries())
    .filter(([name]) => !folderQuery || name.toLowerCase().includes(folderQuery))
    .sort((a, b) => {
      if (a[0] === 'Sem pasta') return -1;
      if (b[0] === 'Sem pasta') return 1;
      return a[0].localeCompare(b[0], 'pt-BR');
    });
  folderSummary.textContent = `${visibleFolders.length} pasta(s) visiveis`;
  if (!visibleFolders.length) {
    folderBoard.innerHTML = `<p class="empty-state">Nenhuma pasta corresponde ao filtro atual.</p>`;
    return;
  }
  folderBoard.innerHTML = visibleFolders
    .map(
      ([folderName, counts]) => `
    <button class="folder-card${folderFilterInput.value.trim().toLowerCase() === folderName.toLowerCase() ? ' is-active' : ''}" type="button" data-folder-filter="${escapeHtml(folderName === 'Sem pasta' ? '' : folderName)}">
      <span class="folder-card-name">${escapeHtml(folderName)}</span>
      <span class="folder-card-count">${counts.total} item(ns)</span>
      <span class="folder-card-meta">Galeria ${counts.gallery} - Fundo ${counts.cutouts} - Crops ${counts.crops}</span>
    </button>`
    )
    .join('');
  for (const button of folderBoard.querySelectorAll('[data-folder-filter]')) {
    button.onclick = () => {
      const value = button.getAttribute('data-folder-filter') || '';
      folderFilterInput.value = value;
      applyFolderToSectionFilters(value);
      renderJobs(state.lastJobs);
      renderCutouts(state.lastCutouts, Boolean(state.cutoutProcessingJobId));
      renderCrops(state.lastCrops);
      renderFolderBoard();
    };
  }
}

deps.renderFolderBoard = renderFolderBoard;
deps.renderFolderGroupedCollection = renderFolderGroupedCollection;
deps.renderFolderDialogOptions = renderFolderDialogOptions;
deps.getExistingFolderNames = getExistingFolderNames;
deps.applyFolderToSectionFilters = applyFolderToSectionFilters;
