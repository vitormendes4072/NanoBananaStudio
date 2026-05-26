import { escapeHtml } from './utils.js';
import { analyticsSummary, analyticsCharts } from './dom.js';

function formatMoney(value, currency) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value || 0);
}

export async function refreshAnalytics() {
  try {
    const response = await fetch('/api/analytics');
    const data = await response.json();
    if (!response.ok) return;
    renderAnalytics(data);
  } catch {
    if (analyticsSummary) analyticsSummary.textContent = 'Não foi possível carregar analytics.';
  }
}

function renderAnalytics(data) {
  if (!analyticsCharts) return;
  if (analyticsSummary) {
    analyticsSummary.textContent = `${data.periodCount} imagem(ns) em ${data.periodDays} dias`;
    if (data.periodCost > 0) {
      analyticsSummary.textContent += ` — ${formatMoney(data.periodCost, 'USD')} estimado`;
    }
  }
  analyticsCharts.innerHTML = `
    <div class="analytics-chart-block">
      <h3 class="analytics-chart-title">Imagens por dia <span class="analytics-chart-subtitle">(últimos ${data.periodDays} dias)</span></h3>
      ${renderDailyCostChart(data.dailyCosts)}
    </div>
    <div class="analytics-chart-block">
      <h3 class="analytics-chart-title">Jobs por modelo</h3>
      ${renderByModelChart(data.byModel)}
    </div>
  `;
}

function renderDailyCostChart(dailyCosts) {
  if (!dailyCosts?.length) {
    return '<p class="analytics-empty">Nenhuma geração no período.</p>';
  }
  const W = 700,
    H = 180;
  const PAD = { top: 12, right: 12, bottom: 36, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxCost = Math.max(...dailyCosts.map((d) => d.cost));
  const maxCount = Math.max(...dailyCosts.map((d) => d.count), 1);
  const useCost = maxCost > 0;
  const maxVal = useCost ? maxCost : maxCount;
  const getValue = (d) => (useCost ? d.cost : d.count);

  const barSpacing = chartW / dailyCosts.length;
  const barW = Math.max(3, barSpacing - 3);

  const bars = dailyCosts
    .map((d, i) => {
      const val = getValue(d);
      const barH = maxVal > 0 ? Math.max(2, (val / maxVal) * chartH) : 2;
      const x = PAD.left + i * barSpacing + (barSpacing - barW) / 2;
      const y = PAD.top + chartH - barH;
      const label = d.date.slice(5);
      const showLabel =
        dailyCosts.length <= 31 &&
        (i === 0 || i === dailyCosts.length - 1 || i % Math.ceil(dailyCosts.length / 8) === 0);
      return [
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" class="analytics-bar"/>`,
        showLabel
          ? `<text x="${(x + barW / 2).toFixed(1)}" y="${(PAD.top + chartH + 20).toFixed(1)}" class="analytics-tick analytics-tick-x">${escapeHtml(label)}</text>`
          : '',
      ].join('');
    })
    .join('\n');

  const gridLines = [0, 0.5, 1]
    .map((pct) => {
      const val = maxVal * pct;
      const y = PAD.top + chartH - pct * chartH;
      const labelText = useCost ? formatMoney(val, 'USD') : String(Math.round(val));
      return [
        `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${PAD.left + chartW}" y2="${y.toFixed(1)}" class="analytics-gridline"/>`,
        `<text x="${(PAD.left - 4).toFixed(1)}" y="${(y + 4).toFixed(1)}" class="analytics-tick analytics-tick-y">${escapeHtml(labelText)}</text>`,
      ].join('');
    })
    .join('\n');

  return `<svg viewBox="0 0 ${W} ${H}" class="analytics-svg" aria-hidden="true">
  ${gridLines}
  ${bars}
</svg>`;
}

function renderByModelChart(byModel) {
  if (!byModel?.length) {
    return '<p class="analytics-empty">Nenhum dado disponível.</p>';
  }
  const W = 700;
  const ROW_H = 34;
  const PAD = { top: 6, right: 60, bottom: 6, left: 210 };
  const chartW = W - PAD.left - PAD.right;
  const H = byModel.length * ROW_H + PAD.top + PAD.bottom;
  const maxCount = Math.max(...byModel.map((m) => m.count), 1);

  const rows = byModel
    .map((m, i) => {
      const barW = Math.max(2, (m.count / maxCount) * chartW);
      const y = PAD.top + i * ROW_H;
      const midY = y + ROW_H / 2;
      const rawLabel = m.label || m.model || '—';
      const label = rawLabel.length > 30 ? rawLabel.slice(0, 28) + '…' : rawLabel;
      return [
        `<text x="${(PAD.left - 8).toFixed(1)}" y="${(midY + 4).toFixed(1)}" class="analytics-tick analytics-tick-model">${escapeHtml(label)}</text>`,
        `<rect x="${PAD.left}" y="${(y + 7).toFixed(1)}" width="${barW.toFixed(1)}" height="${(ROW_H - 14).toFixed(1)}" class="analytics-bar analytics-bar-model"/>`,
        `<text x="${(PAD.left + barW + 6).toFixed(1)}" y="${(midY + 4).toFixed(1)}" class="analytics-tick">${m.count}</text>`,
      ].join('');
    })
    .join('\n');

  return `<svg viewBox="0 0 ${W} ${H}" class="analytics-svg analytics-svg-model" aria-hidden="true">
  ${rows}
</svg>`;
}
