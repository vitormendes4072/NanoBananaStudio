import { state } from './state.js';
import {
  escapeHtml,
  formatRelativeDateTime,
  formatBytes,
  slugifyProductModelAlias,
  slugifyImageTemplateAlias,
} from './utils.js';
import { bindInteractiveActions } from './events.js';
import { buildPromptDetailsSummary, buildDisplayPrompt, thumbUrl } from './render-queue.js';
import {
  resolvePromptProductModels,
  resolvePromptImageTemplates,
  collectPromptOptions,
} from './prompt.js';
import { buildReferencePayload } from './main.js';
import { refreshProductModels, refreshImageTemplates } from './api.js';
import {
  promptInput,
  statusBox,
  productModelNameInput,
  productModelAliasInput,
  productModelNotesInput,
  productModelImagesInput,
  productModelUploadPreview,
  productModelList,
  saveProductModelButton,
  productModelMentions,
  imageTemplateNameInput,
  imageTemplateAliasInput,
  imageTemplateNotesInput,
  imageTemplateImagesInput,
  imageTemplateUploadPreview,
  imageTemplateList,
  saveImageTemplateButton,
  imageTemplateMentions,
} from './dom.js';

export function renderProductModelList() {
  if (!productModelList) return;
  if (!state.productModels.length) {
    productModelList.innerHTML = `<p class="reference-empty">Nenhum modelo de produto cadastrado ainda.</p>`;
    bindInteractiveActions();
    return;
  }

  productModelList.innerHTML = state.productModels
    .map((model) => {
      const unavailableCount = (model.referenceImages || []).filter(
        (image) => image && image.isAvailable === false
      ).length;
      const usageHistory = getLibraryUsageHistory('productModel', model.alias);
      const thumbs = (model.referenceImages || [])
        .slice(0, 4)
        .map(
          (image) => `
      <span class="product-model-thumb">
        ${image?.url ? `<img src="${image.url}" alt="${escapeHtml(model.name)}">` : `<span class="product-model-thumb-fallback" aria-label="Referência indisponível">Arquivo ausente</span>`}
      </span>`
        )
        .join('');
      const evaluation = renderProductModelEvaluation(model.evaluation);
      return `
      <article class="product-model-card">
        <div class="product-model-card-head">
          <div>
            <p class="product-model-card-name">${escapeHtml(model.name)}</p>
            <p class="product-model-card-alias">@${escapeHtml(model.alias)}</p>
          </div>
          <button class="icon-action-button icon-action-button-danger" type="button" data-delete-product-model="${escapeHtml(model.alias)}" aria-label="Excluir modelo" title="Excluir modelo">
            <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true"><path d="M9 3h6"></path><path d="M4 6h16"></path><path d="M7 6l1 14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-14"></path><path d="M10 10v7"></path><path d="M14 10v7"></path></svg>
          </button>
        </div>
        ${model.notes ? `<p class="product-model-card-notes">${escapeHtml(model.notes)}</p>` : ''}
        ${unavailableCount ? `<p class="product-model-card-warning">${escapeHtml(`${unavailableCount} referência(s) deste modelo não estão mais disponíveis no disco.`)}</p>` : ''}
        <div class="product-model-thumb-row">${thumbs}</div>
        ${renderLibraryUsageHistory(usageHistory, 'modelo')}
        ${evaluation}
        <div class="product-model-card-actions">
          <button class="ghost-button" type="button" data-insert-product-model="${escapeHtml(model.alias)}">Inserir @${escapeHtml(model.alias)}</button>
          <button class="ghost-button" type="button" data-evaluate-product-model="${escapeHtml(model.alias)}">Avaliar grátis</button>
          <button class="ghost-button" type="button" data-evaluate-product-model-ai="${escapeHtml(model.alias)}">Avaliar com IA</button>
        </div>
      </article>`;
    })
    .join('');
  bindInteractiveActions();
}

function renderProductModelEvaluation(evaluation) {
  if (!evaluation) {
    return `<div class="product-model-evaluation product-model-evaluation-empty"><p class="product-model-evaluation-summary">Use a avaliacao gratis para um parecer rapido, ou a avaliacao com IA se quiser uma leitura mais profunda.</p></div>`;
  }
  const strengths = Array.isArray(evaluation.strengths) ? evaluation.strengths.slice(0, 2) : [];
  const missing = Array.isArray(evaluation.missing) ? evaluation.missing.slice(0, 2) : [];
  const recommendedShots = Array.isArray(evaluation.recommendedShots)
    ? evaluation.recommendedShots.slice(0, 2)
    : [];
  const label = getProductModelEvaluationStatusLabel(evaluation.status);
  const statusClass = getProductModelEvaluationStatusClass(evaluation.status);
  const methodLabel = evaluation.method === 'gemini' ? 'IA' : 'Heuristica';
  return `
    <div class="product-model-evaluation ${statusClass}">
      <div class="product-model-evaluation-head">
        <span class="product-model-evaluation-badge">${escapeHtml(label)}</span>
        <span class="product-model-evaluation-score">${escapeHtml(`${Math.round(Number(evaluation.score) || 0)}/100`)}</span>
      </div>
      <p class="product-model-evaluation-summary">${escapeHtml(evaluation.summary || 'Avaliacao atualizada.')}</p>
      ${strengths.length ? `<p class="product-model-evaluation-list"><strong>Pontos fortes:</strong> ${escapeHtml(strengths.join(' | '))}</p>` : ''}
      ${missing.length ? `<p class="product-model-evaluation-list"><strong>Faltando:</strong> ${escapeHtml(missing.join(' | '))}</p>` : ''}
      ${recommendedShots.length ? `<p class="product-model-evaluation-list"><strong>Recomendo:</strong> ${escapeHtml(recommendedShots.join(' | '))}</p>` : ''}
      <p class="product-model-evaluation-meta">Fonte: ${escapeHtml(methodLabel)}${evaluation.updatedAt ? ` • ${escapeHtml(formatRelativeDateTime(evaluation.updatedAt))}` : ''}</p>
    </div>`;
}

export function getProductModelEvaluationStatusLabel(status) {
  if (status === 'ready') return 'Pronto para usar';
  if (status === 'improvable') return 'Bom, mas pode melhorar';
  return 'Precisa de mais referências';
}

function getProductModelEvaluationStatusClass(status) {
  if (status === 'ready') return 'is-ready';
  if (status === 'improvable') return 'is-improvable';
  return 'is-insufficient';
}

export function renderProductModelUploadPreview() {
  if (!productModelUploadPreview) return;
  if (!state.selectedProductModelFiles.length) {
    productModelUploadPreview.innerHTML = `<p class="reference-empty">Nenhuma imagem do modelo selecionada.</p>`;
    return;
  }
  productModelUploadPreview.innerHTML = '';
  for (const [index, file] of state.selectedProductModelFiles.entries()) {
    const imageUrl = URL.createObjectURL(file);
    const card = document.createElement('article');
    card.className = 'reference-card';
    card.innerHTML = `
      <img src="${imageUrl}" alt="${escapeHtml(file.name)}">
      <div class="reference-body"><p class="reference-name">${escapeHtml(file.name)}</p><p class="reference-meta">${escapeHtml(formatBytes(file.size))}</p></div>
      <button class="reference-remove" type="button" data-remove-product-model-file="${index}" aria-label="Remover imagem do modelo">Remover</button>`;
    card
      .querySelector('img')
      .addEventListener('load', () => URL.revokeObjectURL(imageUrl), { once: true });
    productModelUploadPreview.appendChild(card);
  }
  bindInteractiveActions();
}

export function renderImageTemplateList() {
  if (!imageTemplateList) return;
  if (!state.imageTemplates.length) {
    imageTemplateList.innerHTML = `<p class="reference-empty">Nenhum template visual cadastrado ainda.</p>`;
    bindInteractiveActions();
    return;
  }

  imageTemplateList.innerHTML = state.imageTemplates
    .map((template) => {
      const usageHistory = getLibraryUsageHistory('imageTemplate', template.alias);
      const thumbs = (template.referenceImages || [])
        .slice(0, 4)
        .map(
          (image) => `
      <span class="product-model-thumb">
        ${image?.url ? `<img src="${image.url}" alt="${escapeHtml(template.name)}">` : `<span class="product-model-thumb-fallback" aria-label="Referência indisponível">Arquivo ausente</span>`}
      </span>`
        )
        .join('');
      return `
      <article class="product-model-card">
        <div class="product-model-card-head">
          <div>
            <p class="product-model-card-name">${escapeHtml(template.name)}</p>
            <p class="product-model-card-alias">#${escapeHtml(template.alias)}</p>
          </div>
          <button class="icon-action-button icon-action-button-danger" type="button" data-delete-image-template="${escapeHtml(template.alias)}" aria-label="Excluir template" title="Excluir template">
            <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true"><path d="M9 3h6"></path><path d="M4 6h16"></path><path d="M7 6l1 14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-14"></path><path d="M10 10v7"></path><path d="M14 10v7"></path></svg>
          </button>
        </div>
        ${template.notes ? `<p class="product-model-card-notes">${escapeHtml(template.notes)}</p>` : ''}
        <p class="product-model-card-notes">${escapeHtml(buildPromptDetailsSummary(template.promptOptions) || 'Sem ajustes extras salvos.')}</p>
        ${thumbs ? `<div class="product-model-thumb-row">${thumbs}</div>` : ''}
        ${renderLibraryUsageHistory(usageHistory, 'template')}
        <div class="product-model-card-actions">
          <button class="ghost-button" type="button" data-insert-image-template="${escapeHtml(template.alias)}">Inserir #${escapeHtml(template.alias)}</button>
        </div>
      </article>`;
    })
    .join('');
  bindInteractiveActions();
}

export function renderImageTemplateUploadPreview() {
  if (!imageTemplateUploadPreview) return;
  if (!state.selectedImageTemplateFiles.length) {
    imageTemplateUploadPreview.innerHTML = `<p class="reference-empty">Nenhuma imagem do template selecionada.</p>`;
    return;
  }
  imageTemplateUploadPreview.innerHTML = '';
  for (const [index, file] of state.selectedImageTemplateFiles.entries()) {
    const imageUrl = URL.createObjectURL(file);
    const card = document.createElement('article');
    card.className = 'reference-card';
    card.innerHTML = `
      <img src="${imageUrl}" alt="${escapeHtml(file.name)}">
      <div class="reference-body"><p class="reference-name">${escapeHtml(file.name)}</p><p class="reference-meta">${escapeHtml(formatBytes(file.size))}</p></div>
      <button class="reference-remove" type="button" data-remove-image-template-file="${index}" aria-label="Remover imagem do template">Remover</button>`;
    card
      .querySelector('img')
      .addEventListener('load', () => URL.revokeObjectURL(imageUrl), { once: true });
    imageTemplateUploadPreview.appendChild(card);
  }
  bindInteractiveActions();
}

function getLibraryUsageHistory(kind, alias) {
  const normalizedAlias =
    kind === 'productModel' ? slugifyProductModelAlias(alias) : slugifyImageTemplateAlias(alias);
  const matchingJobs = state.lastJobs.filter((job) => {
    const entries = kind === 'productModel' ? job.state?.productModels : job.state?.imageTemplates;
    return (
      Array.isArray(entries) &&
      entries.some((entry) => {
        const entryAlias =
          kind === 'productModel'
            ? slugifyProductModelAlias(entry?.alias)
            : slugifyImageTemplateAlias(entry?.alias);
        return entryAlias === normalizedAlias;
      })
    );
  });
  const completedJobs = matchingJobs.filter(
    (job) => job.status === 'completed' && job.result?.imageUrl
  );
  const recentResults = completedJobs
    .slice()
    .sort(
      (a, b) =>
        new Date(b.finishedAt || b.createdAt || 0) - new Date(a.finishedAt || a.createdAt || 0)
    )
    .slice(0, 4);
  const recentPrompts = matchingJobs
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
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
    return `<div class="library-usage-history library-usage-history-empty"><p class="library-usage-history-summary">Ainda não existem gerações usando este ${escapeHtml(label)}.</p></div>`;
  }
  return `
    <div class="library-usage-history">
      <div class="library-usage-history-head">
        <p class="library-usage-history-title">Histórico</p>
        <p class="library-usage-history-count">${escapeHtml(`${history.completed}/${history.total} concluídas`)}</p>
      </div>
      ${
        history.recentResults.length
          ? `<div class="library-usage-history-gallery">${history.recentResults
              .map(
                (job) => `
        <a class="library-usage-history-thumb" href="${job.result.imageUrl}" target="_blank" rel="noreferrer" title="${escapeHtml(buildDisplayPrompt(job))}">
          <img src="${thumbUrl(job.result.imageUrl)}" alt="${escapeHtml(buildDisplayPrompt(job))}">
        </a>`
              )
              .join('')}</div>`
          : ''
      }
      ${history.recentPrompts.length ? `<div class="library-usage-history-prompts">${history.recentPrompts.map((prompt) => `<p class="library-usage-history-prompt">${escapeHtml(prompt)}</p>`).join('')}</div>` : ''}
    </div>`;
}

export function renderPromptProductModelMentions() {
  if (!productModelMentions) return;
  const resolution = resolvePromptProductModels(promptInput?.value || '');
  if (!resolution.matchedModels.length) {
    productModelMentions.innerHTML = `<p class="reference-empty">Use <code>@alias</code> no prompt para puxar um modelo de produto salvo.</p>`;
    return;
  }
  const names = resolution.matchedModels.map((m) => m.name).filter(Boolean);
  productModelMentions.innerHTML = `
    <div class="prompt-mentions-card">
      <div class="product-model-mentions-list">${resolution.matchedModels.map((m) => `<span class="product-model-chip">@${escapeHtml(m.alias)}</span>`).join('')}</div>
      <p class="prompt-mentions-summary">${escapeHtml(names.length === 1 ? `Modelo ativo: ${names[0]}.` : `Modelos ativos: ${names.join(', ')}.`)}</p>
    </div>`;
}

export function renderPromptImageTemplateMentions() {
  if (!imageTemplateMentions) return;
  const resolution = resolvePromptImageTemplates(promptInput?.value || '');
  if (!resolution.matchedTemplates.length) {
    imageTemplateMentions.innerHTML = `<p class="reference-empty">Use <code>#alias</code> no prompt para puxar um template visual salvo.</p>`;
    return;
  }
  const names = resolution.matchedTemplates.map((t) => t.name).filter(Boolean);
  imageTemplateMentions.innerHTML = `
    <div class="prompt-mentions-card">
      <div class="product-model-mentions-list">${resolution.matchedTemplates.map((t) => `<span class="product-model-chip">#${escapeHtml(t.alias)}</span>`).join('')}</div>
      <p class="prompt-mentions-summary">${escapeHtml(names.length === 1 ? `Template ativo: ${names[0]}.` : `Templates ativos: ${names.join(', ')}.`)}</p>
    </div>`;
}

export async function saveProductModel() {
  const name = productModelNameInput?.value.trim() || '';
  const alias = slugifyProductModelAlias(productModelAliasInput?.value || name);
  const notes = productModelNotesInput?.value.trim() || '';
  if (!name) {
    statusBox.textContent = 'Informe o nome do produto antes de salvar o modelo.';
    productModelNameInput?.focus();
    return;
  }
  if (!alias) {
    statusBox.textContent = 'Informe um alias valido para o modelo de produto.';
    productModelAliasInput?.focus();
    return;
  }
  if (!state.selectedProductModelFiles.length) {
    statusBox.textContent = 'Selecione pelo menos uma imagem do produto para criar o modelo.';
    return;
  }
  saveProductModelButton.disabled = true;
  saveProductModelButton.textContent = 'Salvando...';
  try {
    const referenceImages = await buildReferencePayload(state.selectedProductModelFiles);
    const response = await fetch('/api/product-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, alias, notes, referenceImages }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível salvar o modelo de produto.');
    if (productModelNameInput) productModelNameInput.value = '';
    if (productModelAliasInput) productModelAliasInput.value = '';
    if (productModelNotesInput) productModelNotesInput.value = '';
    state.selectedProductModelFiles = [];
    syncProductModelInputFiles();
    renderProductModelUploadPreview();
    await refreshProductModels();
    insertProductModelMention(data.productModel.alias, { appendSpace: false });
    statusBox.textContent = `Modelo @${data.productModel.alias} salvo. Agora basta citar @${data.productModel.alias} no prompt.`;
  } catch (error) {
    statusBox.textContent =
      error instanceof Error ? error.message : 'Falha ao salvar o modelo de produto.';
  } finally {
    saveProductModelButton.disabled = false;
    saveProductModelButton.textContent = 'Salvar modelo';
  }
}

export async function saveImageTemplate() {
  const name = imageTemplateNameInput?.value.trim() || '';
  const alias = slugifyImageTemplateAlias(imageTemplateAliasInput?.value || name);
  const notes = imageTemplateNotesInput?.value.trim() || '';
  if (!name) {
    statusBox.textContent = 'Informe o nome do template visual antes de salvar.';
    imageTemplateNameInput?.focus();
    return;
  }
  if (!alias) {
    statusBox.textContent = 'Informe um alias valido para o template visual.';
    imageTemplateAliasInput?.focus();
    return;
  }
  saveImageTemplateButton.disabled = true;
  saveImageTemplateButton.textContent = 'Salvando...';
  try {
    const referenceImages = await buildReferencePayload(state.selectedImageTemplateFiles);
    const response = await fetch('/api/image-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        alias,
        notes,
        promptOptions: collectPromptOptions(),
        referenceImages,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível salvar o template visual.');
    if (imageTemplateNameInput) imageTemplateNameInput.value = '';
    if (imageTemplateAliasInput) imageTemplateAliasInput.value = '';
    if (imageTemplateNotesInput) imageTemplateNotesInput.value = '';
    state.selectedImageTemplateFiles = [];
    syncImageTemplateInputFiles();
    renderImageTemplateUploadPreview();
    await refreshImageTemplates();
    insertImageTemplateMention(data.imageTemplate.alias, { appendSpace: false });
    statusBox.textContent = `Template #${data.imageTemplate.alias} salvo. Agora basta citar #${data.imageTemplate.alias} no prompt.`;
  } catch (error) {
    statusBox.textContent =
      error instanceof Error ? error.message : 'Falha ao salvar o template visual.';
  } finally {
    saveImageTemplateButton.disabled = false;
    saveImageTemplateButton.textContent = 'Salvar template';
  }
}

export function insertProductModelMention(alias, options = {}) {
  if (!promptInput) return;
  const mention = `@${slugifyProductModelAlias(alias)}`;
  if (!mention || mention === '@') return;
  const currentValue = promptInput.value.trim();
  if (!currentValue.includes(mention))
    promptInput.value = currentValue ? `${currentValue} ${mention}` : mention;
  if (options.appendSpace !== false) promptInput.value = `${promptInput.value.trim()} `;
  renderPromptProductModelMentions();
  promptInput.focus();
}

export function insertImageTemplateMention(alias, options = {}) {
  if (!promptInput) return;
  const mention = `#${slugifyImageTemplateAlias(alias)}`;
  if (!mention || mention === '#') return;
  const currentValue = promptInput.value.trim();
  if (!currentValue.includes(mention))
    promptInput.value = currentValue ? `${currentValue} ${mention}` : mention;
  if (options.appendSpace !== false) promptInput.value = `${promptInput.value.trim()} `;
  renderPromptImageTemplateMentions();
  promptInput.focus();
}

export function syncProductModelInputFiles() {
  if (!productModelImagesInput) return;
  const dt = new DataTransfer();
  for (const file of state.selectedProductModelFiles) dt.items.add(file);
  productModelImagesInput.files = dt.files;
}

export function syncImageTemplateInputFiles() {
  if (!imageTemplateImagesInput) return;
  const dt = new DataTransfer();
  for (const file of state.selectedImageTemplateFiles) dt.items.add(file);
  imageTemplateImagesInput.files = dt.files;
}
