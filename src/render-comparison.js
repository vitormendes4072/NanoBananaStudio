import { state, MODEL_INFO } from './state.js';
import { escapeHtml } from './utils.js';
import { comparisonPanel, comparisonList, comparisonSummary } from './dom.js';

function thumbUrl(originalUrl) {
  if (!originalUrl) return '';
  return `/api/thumb?src=${encodeURIComponent(originalUrl)}`;
}

function shortModelLabel(modelId) {
  return MODEL_INFO[modelId]?.shortLabel || modelId;
}

function statusLabel(status) {
  switch (status) {
    case 'queued':
      return 'Na fila';
    case 'processing':
      return 'Gerando...';
    case 'completed':
      return 'Pronto';
    case 'failed':
      return 'Falhou';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status || '';
  }
}

function buildColumn(job) {
  if (!job) {
    return `
      <div class="comparison-column is-empty">
        <div class="comparison-column-head">
          <span class="comparison-model">—</span>
          <span class="comparison-status">aguardando</span>
        </div>
        <div class="comparison-preview is-placeholder"></div>
      </div>`;
  }

  const modelLabel = shortModelLabel(job.model);
  const status = job.status;
  const isCompleted = status === 'completed' && job.result;
  const isFailed = status === 'failed';
  const isProcessing = status === 'processing' || status === 'queued';

  let preview;
  if (isCompleted) {
    preview = `
      <a class="comparison-preview" href="${job.result.imageUrl}" target="_blank" rel="noreferrer">
        <img src="${thumbUrl(job.result.imageUrl)}" alt="${escapeHtml(job.promptBase || job.prompt || '')}" loading="lazy" />
      </a>`;
  } else if (isFailed) {
    preview = `<div class="comparison-preview is-failed">${escapeHtml(job.error?.message || 'Falha na geração.')}</div>`;
  } else if (isProcessing) {
    preview = `<div class="comparison-preview is-loading"><div class="comparison-shimmer"></div></div>`;
  } else {
    preview = `<div class="comparison-preview is-placeholder">${escapeHtml(statusLabel(status))}</div>`;
  }

  const actions = isCompleted
    ? `
      <div class="comparison-actions">
        <a class="queue-link queue-link-utility" href="${job.result.imageUrl}" target="_blank" rel="noreferrer">Abrir</a>
        <a class="queue-link queue-link-utility" href="${job.result.imageUrl}" download="${job.result.filename || ''}">Baixar</a>
      </div>`
    : '';

  return `
    <div class="comparison-column is-${status}">
      <div class="comparison-column-head">
        <span class="comparison-model">${escapeHtml(modelLabel)}</span>
        <span class="comparison-status">${escapeHtml(statusLabel(status))}</span>
      </div>
      ${preview}
      ${actions}
    </div>`;
}

function groupByComparisonId(jobs) {
  const groups = new Map();
  for (const job of jobs) {
    if (!job.comparisonId) continue;
    if (!groups.has(job.comparisonId)) groups.set(job.comparisonId, []);
    groups.get(job.comparisonId).push(job);
  }
  return groups;
}

function buildComparisonCard(comparisonId, jobs) {
  // Newest jobs come first in state.lastJobs (descending id). Reverse so the
  // visual order is stable (the first allowed model on the left).
  const ordered = [...jobs].sort((a, b) => a.id.localeCompare(b.id));
  const promptBase = ordered[0]?.promptBase || ordered[0]?.prompt || '';
  const createdAt = ordered[0]?.createdAt
    ? new Date(ordered[0].createdAt).toLocaleString('pt-BR')
    : '';

  const completedCount = ordered.filter((j) => j.status === 'completed').length;
  const totalCount = ordered.length;

  return `
    <article class="comparison-card" data-comparison-id="${escapeHtml(comparisonId)}">
      <header class="comparison-card-head">
        <div class="comparison-card-meta">
          <span class="comparison-card-label">Comparação</span>
          <span class="comparison-card-progress">${completedCount}/${totalCount} prontos</span>
        </div>
        <p class="comparison-card-prompt" title="${escapeHtml(promptBase)}">${escapeHtml(promptBase)}</p>
        ${createdAt ? `<p class="comparison-card-time">${escapeHtml(createdAt)}</p>` : ''}
      </header>
      <div class="comparison-card-grid">
        ${ordered.map(buildColumn).join('')}
      </div>
    </article>`;
}

let lastRenderedKey = '';

export function resetRenderedComparisonsKey() {
  lastRenderedKey = '';
}

export function renderComparisons() {
  if (!comparisonList || !comparisonPanel) return;
  const jobs = state.lastJobs || [];
  const groups = groupByComparisonId(jobs);

  if (groups.size === 0) {
    comparisonPanel.hidden = true;
    if (comparisonSummary) comparisonSummary.textContent = 'Nenhuma comparação ainda.';
    return;
  }

  comparisonPanel.hidden = false;

  // Sort groups by newest first (highest job id in the group)
  const sorted = [...groups.entries()].sort((a, b) => {
    const aMax = a[1].reduce((m, j) => (j.id > m ? j.id : m), '');
    const bMax = b[1].reduce((m, j) => (j.id > m ? j.id : m), '');
    return bMax.localeCompare(aMax);
  });

  const key = JSON.stringify(
    sorted.map(([cid, list]) => [cid, list.map((j) => [j.id, j.status, j.result?.imageUrl || ''])])
  );
  if (key === lastRenderedKey) return;
  lastRenderedKey = key;

  comparisonList.innerHTML = sorted.map(([cid, list]) => buildComparisonCard(cid, list)).join('');

  const pendingGroups = sorted.filter(([, list]) =>
    list.some((j) => j.status !== 'completed' && j.status !== 'failed' && j.status !== 'cancelled')
  ).length;
  if (comparisonSummary) {
    comparisonSummary.textContent =
      pendingGroups > 0
        ? `${sorted.length} comparação(ões) · ${pendingGroups} em andamento`
        : `${sorted.length} comparação(ões) concluída(s)`;
  }
}
