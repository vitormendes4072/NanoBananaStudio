import { state, REGION_HANDLE_SIZE } from './state.js';
import { clamp } from './utils.js';
import {
  getActiveCreationFolder,
  registerFolderName,
  renderBranchPreview,
  renderRegionPreview,
} from './main.js';
import { buildDisplayPrompt } from './render-queue.js';
import { refreshCrops } from './api.js';
import {
  statusBox,
  promptInput,
  regionEditor,
  regionCanvas,
  regionEditorTitle,
  regionEditorDescription,
  regionEditorMeta,
  closeRegionEditorButton,
  resetRegionSelectionButton,
  applyRegionSelectionButton,
} from './dom.js';

export function openRegionEditor(jobId, mode = 'region') {
  const job = state.lastJobs.find((e) => e.id === jobId);
  if (!job?.result?.imageUrl) {
    statusBox.textContent = 'Não foi possível abrir o editor de região para essa imagem.';
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
  if (!state.regionEditorState || state.regionEditorState.mode !== 'crop') {
    regionEditorTitle.textContent = 'Selecionar região';
    regionEditorDescription.textContent =
      'Arraste sobre a imagem para marcar a área que deseja editar.';
    applyRegionSelectionButton.textContent = 'Usar região';
  } else {
    regionEditorTitle.textContent = 'Recortar imagem';
    regionEditorDescription.textContent =
      'Arraste sobre a imagem para selecionar a área que deseja salvar como novo PNG.';
    applyRegionSelectionButton.textContent = 'Salvar recorte';
  }
  updateRegionEditorMeta();
}

function drawRegionCanvas() {
  if (!state.regionEditorState) return;
  const context = regionCanvas.getContext('2d');
  const { image, selection } = state.regionEditorState;
  context.clearRect(0, 0, regionCanvas.width, regionCanvas.height);
  context.drawImage(image, 0, 0, regionCanvas.width, regionCanvas.height);
  context.fillStyle = 'rgba(0, 0, 0, 0.28)';
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
    context.strokeStyle = '#ec7b38';
    context.lineWidth = 2.5;
    context.strokeRect(selection.x, selection.y, selection.width, selection.height);
    drawSelectionGrid(context, selection);
    drawSelectionHandles(context, selection);
    drawSelectionBadge(context, selection);
  }
}

function getCanvasPoint(event) {
  const rect = regionCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(regionCanvas.width, event.clientX - rect.left)),
    y: Math.max(0, Math.min(regionCanvas.height, event.clientY - rect.top)),
  };
}

function normalizeSelection(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function pointInsideSelection(point, sel) {
  return (
    point.x >= sel.x &&
    point.x <= sel.x + sel.width &&
    point.y >= sel.y &&
    point.y <= sel.y + sel.height
  );
}

function buildSelectionHandles(sel) {
  const midX = sel.x + sel.width / 2,
    midY = sel.y + sel.height / 2,
    maxX = sel.x + sel.width,
    maxY = sel.y + sel.height;
  return {
    nw: { x: sel.x, y: sel.y },
    n: { x: midX, y: sel.y },
    ne: { x: maxX, y: sel.y },
    e: { x: maxX, y: midY },
    se: { x: maxX, y: maxY },
    s: { x: midX, y: maxY },
    sw: { x: sel.x, y: maxY },
    w: { x: sel.x, y: midY },
  };
}

function getSelectionHandle(point, sel, tolerance = REGION_HANDLE_SIZE) {
  for (const [name, handle] of Object.entries(buildSelectionHandles(sel))) {
    if (
      point.x >= handle.x - tolerance &&
      point.x <= handle.x + tolerance &&
      point.y >= handle.y - tolerance &&
      point.y <= handle.y + tolerance
    )
      return name;
  }
  return null;
}

function cursorForHandle(handle) {
  if (handle === 'nw' || handle === 'se') return 'nwse-resize';
  if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
  if (handle === 'n' || handle === 's') return 'ns-resize';
  return 'ew-resize';
}

function updateRegionCursor(point) {
  if (!state.regionEditorState?.selection) {
    regionCanvas.style.cursor = 'crosshair';
    return;
  }
  const handle = getSelectionHandle(point, state.regionEditorState.selection);
  if (handle) {
    regionCanvas.style.cursor = cursorForHandle(handle);
    return;
  }
  regionCanvas.style.cursor = pointInsideSelection(point, state.regionEditorState.selection)
    ? 'move'
    : 'crosshair';
}

function moveSelection(sel, dX, dY, maxW, maxH) {
  return {
    ...sel,
    x: clamp(sel.x + dX, 0, maxW - sel.width),
    y: clamp(sel.y + dY, 0, maxH - sel.height),
  };
}

function resizeSelection(sel, handle, point, maxW, maxH) {
  let x1 = sel.x,
    y1 = sel.y,
    x2 = sel.x + sel.width,
    y2 = sel.y + sel.height;
  if (handle.includes('n')) y1 = point.y;
  if (handle.includes('s')) y2 = point.y;
  if (handle.includes('w')) x1 = point.x;
  if (handle.includes('e')) x2 = point.x;
  const n = normalizeSelection(
    { x: clamp(x1, 0, maxW), y: clamp(y1, 0, maxH) },
    { x: clamp(x2, 0, maxW), y: clamp(y2, 0, maxH) }
  );
  return { x: n.x, y: n.y, width: Math.max(1, n.width), height: Math.max(1, n.height) };
}

function getSelectionMetrics(sel, scale) {
  return {
    x: Math.round(sel.x / scale),
    y: Math.round(sel.y / scale),
    width: Math.max(1, Math.round(sel.width / scale)),
    height: Math.max(1, Math.round(sel.height / scale)),
  };
}

function updateRegionEditorMeta() {
  if (!state.regionEditorState?.selection) {
    regionEditorMeta.textContent =
      state.regionEditorState?.mode === 'crop'
        ? 'Arraste para criar o recorte. Depois mova ou ajuste pelas bordas.'
        : 'Arraste para criar a seleção. Depois mova ou ajuste pelas bordas.';
    return;
  }
  const m = getSelectionMetrics(state.regionEditorState.selection, state.regionEditorState.scale);
  regionEditorMeta.textContent = `${m.width} x ${m.height} px - X ${m.x} - Y ${m.y}`;
}

function drawSelectionGrid(ctx, sel) {
  ctx.save();
  ctx.strokeStyle = 'rgba(236, 123, 56, 0.45)';
  ctx.lineWidth = 1;
  const tw = sel.width / 3,
    th = sel.height / 3;
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(sel.x + tw * i, sel.y);
    ctx.lineTo(sel.x + tw * i, sel.y + sel.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sel.x, sel.y + th * i);
    ctx.lineTo(sel.x + sel.width, sel.y + th * i);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSelectionHandles(ctx, sel) {
  ctx.save();
  ctx.fillStyle = '#fff7ef';
  ctx.strokeStyle = '#ec7b38';
  ctx.lineWidth = 1.5;
  for (const h of Object.values(buildSelectionHandles(sel))) {
    ctx.beginPath();
    ctx.rect(h.x - 4, h.y - 4, 8, 8);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawSelectionBadge(ctx, sel) {
  const m = getSelectionMetrics(sel, state.regionEditorState.scale);
  const label = `${m.width}x${m.height}`;
  ctx.save();
  ctx.font = '600 12px "IBM Plex Mono", monospace';
  const tw = ctx.measureText(label).width;
  const bw = tw + 14,
    bh = 24,
    bx = sel.x + 8,
    by = Math.max(8, sel.y - bh - 8);
  ctx.fillStyle = 'rgba(34, 24, 16, 0.86)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 999);
  ctx.fill();
  ctx.fillStyle = '#fff7ef';
  ctx.fillText(label, bx + 7, by + 16);
  ctx.restore();
}

function cropSelectionFromEditor() {
  if (!state.regionEditorState?.selection) return null;
  const { image, selection, scale } = state.regionEditorState;
  const sX = Math.round(selection.x / scale),
    sY = Math.round(selection.y / scale);
  const sW = Math.max(1, Math.round(selection.width / scale)),
    sH = Math.max(1, Math.round(selection.height / scale));
  const c = document.createElement('canvas');
  c.width = sW;
  c.height = sH;
  c.getContext('2d').drawImage(image, sX, sY, sW, sH, 0, 0, sW, sH);
  return c.toDataURL('image/png');
}

async function saveCropFromEditor(cropDataUrl) {
  if (!state.regionEditorState?.job?.result?.imageUrl) {
    statusBox.textContent = 'Não foi possível salvar esse recorte.';
    return;
  }
  applyRegionSelectionButton.disabled = true;
  applyRegionSelectionButton.textContent = 'Salvando...';
  const activeTargetFolder = getActiveCreationFolder();
  if (activeTargetFolder) registerFolderName(activeTargetFolder);
  try {
    const response = await fetch('/api/crops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: state.regionEditorState.job.id,
        sourceImageUrl: state.regionEditorState.job.result.imageUrl,
        label: `${buildDisplayPrompt(state.regionEditorState.job)} - recorte`,
        mimeType: 'image/png',
        data: cropDataUrl.split(',')[1] || '',
        folder: activeTargetFolder,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha ao salvar o recorte.');
    await refreshCrops();
    regionEditor.close();
    statusBox.textContent = 'Recorte salvo com sucesso.';
  } catch (error) {
    statusBox.textContent =
      error instanceof Error ? error.message : 'Não foi possível salvar o recorte.';
  } finally {
    applyRegionSelectionButton.disabled = false;
    syncRegionEditorCopy();
  }
}

// Canvas event listeners
regionCanvas.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary) return;
  if (!state.regionEditorState) return;
  event.preventDefault();
  const point = getCanvasPoint(event);
  const tolerance = event.pointerType === 'touch' ? REGION_HANDLE_SIZE * 2 : REGION_HANDLE_SIZE;
  const handle = state.regionEditorState.selection
    ? getSelectionHandle(point, state.regionEditorState.selection, tolerance)
    : null;
  const isInside = state.regionEditorState.selection
    ? pointInsideSelection(point, state.regionEditorState.selection)
    : false;
  state.regionEditorState.isDragging = true;
  state.regionEditorState.dragStart = point;
  state.regionEditorState.dragOriginSelection = state.regionEditorState.selection
    ? { ...state.regionEditorState.selection }
    : null;
  if (handle) {
    state.regionEditorState.dragMode = 'resize';
    state.regionEditorState.dragHandle = handle;
  } else if (isInside) {
    state.regionEditorState.dragMode = 'move';
    state.regionEditorState.dragHandle = null;
  } else {
    state.regionEditorState.dragMode = 'create';
    state.regionEditorState.dragHandle = null;
    state.regionEditorState.selection = { x: point.x, y: point.y, width: 0, height: 0 };
  }
  regionCanvas.setPointerCapture?.(event.pointerId);
  drawRegionCanvas();
  updateRegionEditorMeta();
});

regionCanvas.addEventListener('pointermove', (event) => {
  if (!event.isPrimary) return;
  if (!state.regionEditorState) return;
  const point = getCanvasPoint(event);
  if (!state.regionEditorState.isDragging || !state.regionEditorState.dragStart) {
    updateRegionCursor(point);
    return;
  }
  if (state.regionEditorState.dragMode === 'move' && state.regionEditorState.dragOriginSelection) {
    state.regionEditorState.selection = moveSelection(
      state.regionEditorState.dragOriginSelection,
      point.x - state.regionEditorState.dragStart.x,
      point.y - state.regionEditorState.dragStart.y,
      regionCanvas.width,
      regionCanvas.height
    );
  } else if (
    state.regionEditorState.dragMode === 'resize' &&
    state.regionEditorState.dragOriginSelection &&
    state.regionEditorState.dragHandle
  ) {
    state.regionEditorState.selection = resizeSelection(
      state.regionEditorState.dragOriginSelection,
      state.regionEditorState.dragHandle,
      point,
      regionCanvas.width,
      regionCanvas.height
    );
  } else {
    state.regionEditorState.selection = normalizeSelection(
      state.regionEditorState.dragStart,
      point
    );
  }
  drawRegionCanvas();
  updateRegionEditorMeta();
});

function endDrag(event) {
  if (!state.regionEditorState) return;
  state.regionEditorState.isDragging = false;
  state.regionEditorState.dragMode = null;
  state.regionEditorState.dragHandle = null;
  state.regionEditorState.dragOriginSelection = null;
  regionCanvas.releasePointerCapture?.(event.pointerId);
  updateRegionCursor(getCanvasPoint(event));
  updateRegionEditorMeta();
}

regionCanvas.addEventListener('pointerup', (event) => {
  if (!event.isPrimary) return;
  endDrag(event);
});

// Correção 3: pointercancel dispara quando o OS intercepta o gesto
// (pull-down de notificação, multi-touch acidental). Sem esse handler,
// isDragging fica preso em true e o editor congela.
regionCanvas.addEventListener('pointercancel', (event) => {
  if (!event.isPrimary) return;
  endDrag(event);
});

// Correção 5: impede menu de contexto por long press em dispositivos touch
regionCanvas.addEventListener('contextmenu', (event) => event.preventDefault());

closeRegionEditorButton.addEventListener('click', () => regionEditor.close());

resetRegionSelectionButton.addEventListener('click', () => {
  if (!state.regionEditorState) return;
  state.regionEditorState.selection = null;
  drawRegionCanvas();
  updateRegionEditorMeta();
});

applyRegionSelectionButton.addEventListener('click', () => {
  if (!state.regionEditorState?.selection || !state.regionEditorState.job?.result?.imageUrl) {
    statusBox.textContent = 'Marque uma área antes de confirmar.';
    return;
  }
  if (
    state.regionEditorState.selection.width < 12 ||
    state.regionEditorState.selection.height < 12
  ) {
    statusBox.textContent = 'Marque uma área um pouco maior para editar.';
    return;
  }
  const cropDataUrl = cropSelectionFromEditor();
  if (!cropDataUrl) {
    statusBox.textContent = 'Não foi possível criar a referência da região.';
    return;
  }
  if (state.regionEditorState.mode === 'crop') {
    saveCropFromEditor(cropDataUrl);
    return;
  }
  const base64Data = cropDataUrl.split(',')[1] || '';
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
      mimeType: 'image/png',
      data: base64Data,
    },
  };
  renderBranchPreview();
  renderRegionPreview();
  regionEditor.close();
  statusBox.textContent = 'Imagem base e região selecionadas. Agora descreva a alteração desejada.';
  promptInput.focus();
});
