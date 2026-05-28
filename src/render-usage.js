import { escapeHtml } from './utils.js';
import { usageSummary, usageCards, usageModels, usageLinks } from './dom.js';

function formatMoney(value, currency) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value || 0);
}

function linkLabel(key) {
  if (key === 'billing') return 'Abrir billing';
  if (key === 'rateLimits') return 'Ver rate limits';
  if (key === 'usage') return 'Ver uso';
  if (key === 'keys' || key === 'apiKeys') return 'Abrir API keys';
  return key;
}

export function renderUsage(data) {
  usageSummary.textContent = `${data.completedJobs} concluídos, ${data.processingJobs} em execução, ${data.queuedJobs} na fila, ${data.failedJobs} com erro.`;
  const baseCards = `
    <article class="usage-card"><p class="usage-label">Custo total estimado</p><p class="usage-value">${formatMoney(data.totalEstimatedCost, data.currency)}</p><p class="usage-note">Baseado no histórico local de jobs concluídos.</p></article>
    <article class="usage-card"><p class="usage-label">Custo hoje estimado</p><p class="usage-value">${formatMoney(data.todayEstimatedCost, data.currency)}</p><p class="usage-note">${data.todayCompleted} imagem(ns) concluídas hoje.</p></article>
    <article class="usage-card"><p class="usage-label">Imagens concluídas</p><p class="usage-value">${data.completedJobs}</p><p class="usage-note">Inclui todas as gerações persistidas no histórico local.</p></article>`;
  if (!data.byModel?.length) {
    usageModels.innerHTML = '';
  } else {
    usageModels.innerHTML = data.byModel
      .map(
        (entry) => `
      <article class="usage-model-card"><p class="usage-label">${escapeHtml(entry.label)}</p><p class="usage-value">${entry.completed} imagem(ns)</p><p class="usage-note">Estimado: ${formatMoney(entry.estimatedCost, entry.currency)} - ${formatMoney(entry.unitCost, entry.currency)}/imagem</p></article>`
      )
      .join('');
  }
  usageCards.innerHTML = baseCards + usageModels.innerHTML;
  usageModels.innerHTML = '';
  usageLinks.innerHTML = '';
  for (const [label, url] of Object.entries(data.links || {})) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.textContent = linkLabel(label);
    usageLinks.appendChild(anchor);
  }
}
