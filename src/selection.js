import { state, selectedGalleryIds, selectedCutoutIds, selectedCropIds } from './state.js';
import { showToast } from './utils.js';
import {
  statusBox,
  selectGalleryBulkButton,
  downloadGalleryBulkButton,
  clearGalleryBulkButton,
  selectCutoutsBulkButton,
  downloadCutoutsBulkButton,
  clearCutoutsBulkButton,
  selectCropsBulkButton,
  downloadCropsBulkButton,
  clearCropsBulkButton,
  selectAllMediaButton,
  downloadAllMediaButton,
  clearAllMediaButton,
  organizeSelectedButton,
} from './dom.js';

export function updateBulkSelectionUi() {
  const galleryCount = selectedGalleryIds.size;
  const cutoutCount = selectedCutoutIds.size;
  const cropCount = selectedCropIds.size;
  const galleryTotal = state.lastJobs.filter((j) => j.status === 'completed' && j.result).length;
  const cutoutTotal = state.lastCutouts.length;
  const cropTotal = state.lastCrops.length;
  if (selectGalleryBulkButton) {
    selectGalleryBulkButton.disabled = galleryTotal === 0;
    selectGalleryBulkButton.textContent =
      galleryTotal > 0 && galleryCount === galleryTotal ? 'Limpar seleção' : 'Selecionar todos';
  }
  if (downloadGalleryBulkButton) {
    downloadGalleryBulkButton.disabled = galleryCount === 0;
    downloadGalleryBulkButton.textContent = galleryCount
      ? `Baixar selecionados (${galleryCount})`
      : 'Baixar selecionados';
  }
  if (clearGalleryBulkButton) {
    clearGalleryBulkButton.disabled = galleryCount === 0;
    clearGalleryBulkButton.textContent = galleryCount
      ? `Remover selecionados (${galleryCount})`
      : 'Remover selecionados';
  }
  if (selectCutoutsBulkButton) {
    selectCutoutsBulkButton.disabled = cutoutTotal === 0;
    selectCutoutsBulkButton.textContent =
      cutoutTotal > 0 && cutoutCount === cutoutTotal ? 'Limpar seleção' : 'Selecionar todos';
  }
  if (downloadCutoutsBulkButton) {
    downloadCutoutsBulkButton.disabled = cutoutCount === 0;
    downloadCutoutsBulkButton.textContent = cutoutCount
      ? `Baixar selecionados (${cutoutCount})`
      : 'Baixar selecionados';
  }
  if (clearCutoutsBulkButton) {
    clearCutoutsBulkButton.disabled = cutoutCount === 0;
    clearCutoutsBulkButton.textContent = cutoutCount
      ? `Remover selecionados (${cutoutCount})`
      : 'Remover selecionados';
  }
  if (selectCropsBulkButton) {
    selectCropsBulkButton.disabled = cropTotal === 0;
    selectCropsBulkButton.textContent =
      cropTotal > 0 && cropCount === cropTotal ? 'Limpar seleção' : 'Selecionar todos';
  }
  if (downloadCropsBulkButton) {
    downloadCropsBulkButton.disabled = cropCount === 0;
    downloadCropsBulkButton.textContent = cropCount
      ? `Baixar selecionados (${cropCount})`
      : 'Baixar selecionados';
  }
  if (clearCropsBulkButton) {
    clearCropsBulkButton.disabled = cropCount === 0;
    clearCropsBulkButton.textContent = cropCount
      ? `Remover selecionados (${cropCount})`
      : 'Remover selecionados';
  }
  const totalSelected = galleryCount + cutoutCount + cropCount;
  const totalAvailable = galleryTotal + cutoutTotal + cropTotal;
  if (selectAllMediaButton) {
    selectAllMediaButton.disabled = totalAvailable === 0;
    selectAllMediaButton.textContent =
      totalAvailable > 0 && totalSelected === totalAvailable ? 'Limpar seleção' : 'Selecionar tudo';
  }
  if (downloadAllMediaButton) {
    downloadAllMediaButton.disabled = totalSelected === 0;
    downloadAllMediaButton.textContent = totalSelected
      ? `Baixar selecionados (${totalSelected})`
      : 'Baixar selecionados';
  }
  if (clearAllMediaButton) {
    clearAllMediaButton.disabled = totalSelected === 0;
    clearAllMediaButton.textContent = totalSelected
      ? `Remover selecionados (${totalSelected})`
      : 'Remover selecionados';
  }
  if (organizeSelectedButton) {
    organizeSelectedButton.disabled = totalSelected === 0;
    organizeSelectedButton.textContent = totalSelected
      ? `Organizar selecionados (${totalSelected})`
      : 'Organizar selecionados';
  }
}

export function pruneSelectionSet(selectionSet, ids) {
  for (const id of Array.from(selectionSet)) {
    if (!ids.includes(id)) selectionSet.delete(id);
  }
}

export function applySectionSelection(ids, selectionSet, shouldSelect) {
  if (shouldSelect) {
    for (const id of ids) selectionSet.add(id);
    return;
  }
  for (const id of ids) selectionSet.delete(id);
}

export function toggleSectionSelection(ids, selectionSet) {
  const allSelected = ids.length > 0 && ids.every((id) => selectionSet.has(id));
  applySectionSelection(ids, selectionSet, !allSelected);
  updateBulkSelectionUi();
}

export function downloadSelectedItems(items, emptyMessage, successMessage) {
  if (!items.length) {
    statusBox.textContent = emptyMessage;
    return;
  }
  for (const item of items) {
    if (!item?.imageUrl) continue;
    const anchor = document.createElement('a');
    anchor.href = item.imageUrl;
    anchor.download = item.filename || '';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
  statusBox.textContent = successMessage;
}

export function getSelectedMediaItems() {
  return [
    ...Array.from(selectedGalleryIds)
      .map((id) => state.lastJobs.find((j) => j.id === id)?.result)
      .filter(Boolean),
    ...Array.from(selectedCutoutIds)
      .map((id) => state.lastCutouts.find((item) => item.id === id))
      .filter(Boolean),
    ...Array.from(selectedCropIds)
      .map((id) => state.lastCrops.find((item) => item.id === id))
      .filter(Boolean),
  ];
}

export function getSharedSelectedFolder() {
  const items = getSelectedMediaItems();
  if (!items.length) return '';
  const folders = new Set(items.map((item) => String(item.folder || '').trim()));
  return folders.size === 1 ? Array.from(folders)[0] : '';
}

export function countSelectedFromPayload(payload) {
  return ['ids', 'jobs', 'cutouts', 'crops'].reduce(
    (total, key) => total + (Array.isArray(payload[key]) ? payload[key].length : 0),
    0
  );
}

export function clearSelectionsFromPayload(payload) {
  if (Array.isArray(payload.ids))
    for (const id of payload.ids) {
      selectedGalleryIds.delete(id);
      selectedCutoutIds.delete(id);
      selectedCropIds.delete(id);
    }
  if (Array.isArray(payload.jobs)) for (const id of payload.jobs) selectedGalleryIds.delete(id);
  if (Array.isArray(payload.cutouts))
    for (const id of payload.cutouts) selectedCutoutIds.delete(id);
  if (Array.isArray(payload.crops)) for (const id of payload.crops) selectedCropIds.delete(id);
}

/**
 * Envia os IDs selecionados para o backend e baixa um único arquivo ZIP.
 * @param {{ jobs?: string[], cutouts?: string[], crops?: string[] }} payload
 * @param {string} emptyMessage
 */
export async function exportSelectedItems(payload, emptyMessage) {
  const total =
    (payload.jobs?.length ?? 0) + (payload.cutouts?.length ?? 0) + (payload.crops?.length ?? 0);

  if (!total) {
    statusBox.textContent = emptyMessage;
    return;
  }

  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Falha ao gerar o arquivo ZIP.');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nano-banana-export.zip';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    statusBox.textContent = `${total} arquivo(s) exportado(s) como ZIP.`;
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Falha ao exportar arquivos.', 'error');
  }
}
