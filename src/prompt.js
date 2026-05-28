import deps from './deps.js';
import { state, PROMPT_PRESETS } from './state.js';
import { escapeHtml, slugifyProductModelAlias, slugifyImageTemplateAlias } from './utils.js';
import { buildPromptDetailsSummary, humanizePromptFocus } from './render-queue.js';
import {
  renderPromptProductModelMentions,
  renderPromptImageTemplateMentions,
} from './render-library.js';
import { requestConfirmation } from './dialogs.js';
import {
  promptInput,
  promptAutocomplete,
  promptAutocompleteList,
  negativePromptInput,
  promptStrengthSelect,
  renderFocusSelect,
  aspectRatioSelect,
  styleDirectionInput,
  preserveDetailsInput,
  extraInstructionsInput,
  customPresetNameInput,
  customPresetList,
  statusBox,
} from './dom.js';
import {
  CUSTOM_PRESETS_STORAGE_KEY,
  persistCustomPromptPresetsToStorage,
  sanitizePromptOptions,
} from './prompt-presets-store.js';

let promptAutocompleteState = { query: null, options: [], activeIndex: 0 };

export function collectPromptOptions() {
  return {
    negativePrompt: negativePromptInput?.value.trim() || '',
    promptStrength: promptStrengthSelect?.value || 'balanced',
    renderFocus: renderFocusSelect?.value || '',
    aspectRatio: aspectRatioSelect?.value || '1:1',
    styleDirection: styleDirectionInput?.value.trim() || '',
    preserveDetails: preserveDetailsInput?.value.trim() || '',
    extraInstructions: extraInstructionsInput?.value.trim() || '',
  };
}

export function hydratePromptOptions(promptOptions = {}) {
  if (negativePromptInput) negativePromptInput.value = promptOptions.negativePrompt || '';
  if (promptStrengthSelect) promptStrengthSelect.value = promptOptions.promptStrength || 'balanced';
  if (renderFocusSelect) renderFocusSelect.value = promptOptions.renderFocus || '';
  if (aspectRatioSelect) aspectRatioSelect.value = promptOptions.aspectRatio || '1:1';
  if (styleDirectionInput) styleDirectionInput.value = promptOptions.styleDirection || '';
  if (preserveDetailsInput) preserveDetailsInput.value = promptOptions.preserveDetails || '';
  if (extraInstructionsInput) extraInstructionsInput.value = promptOptions.extraInstructions || '';
}

export function extractPromptModelAliases(prompt) {
  const matches = String(prompt || '').match(/@([a-z0-9_-]+)/gi) || [];
  return Array.from(new Set(matches.map((entry) => slugifyProductModelAlias(entry))));
}

export function resolvePromptProductModels(prompt) {
  const aliases = extractPromptModelAliases(prompt);
  const matchedModels = aliases
    .map((alias) => state.productModels.find((e) => e.alias === alias))
    .filter(Boolean);
  let cleanPrompt = String(prompt || '');
  for (const model of matchedModels)
    cleanPrompt = cleanPrompt.replace(new RegExp(`(^|\\s)@${model.alias}(?=\\s|$)`, 'gi'), '$1');
  return {
    aliases: matchedModels.map((e) => e.alias),
    matchedModels,
    cleanPrompt: cleanPrompt.replace(/\s{2,}/g, ' ').trim(),
  };
}

export function extractPromptImageTemplateAliases(prompt) {
  const matches = String(prompt || '').match(/#([a-z0-9_-]+)/gi) || [];
  return Array.from(new Set(matches.map((entry) => slugifyImageTemplateAlias(entry))));
}

export function resolvePromptImageTemplates(prompt) {
  const aliases = extractPromptImageTemplateAliases(prompt);
  const matchedTemplates = aliases
    .map((alias) => state.imageTemplates.find((e) => e.alias === alias))
    .filter(Boolean);
  let cleanPrompt = String(prompt || '');
  for (const template of matchedTemplates)
    cleanPrompt = cleanPrompt.replace(new RegExp(`(^|\\s)#${template.alias}(?=\\s|$)`, 'gi'), '$1');
  return {
    aliases: matchedTemplates.map((e) => e.alias),
    matchedTemplates,
    cleanPrompt: cleanPrompt.replace(/\s{2,}/g, ' ').trim(),
  };
}

export function buildLocalizedPrompt(prompt, promptOptions = {}, regionReference) {
  const sections = [];
  if (regionReference) {
    sections.push('Edite apenas a região mostrada na referência recortada.');
    sections.push(
      'Mantenha o restante da imagem igual, preservando enquadramento, fundo e elementos fora da área marcada.'
    );
  }
  sections.push(prompt);
  for (const model of state.productModels) {
    sections.push(
      `Use o modelo de produto @${model.alias} como referência principal, mantendo fidelidade real ao produto ${model.name}.`
    );
    sections.push(
      'Preserve com precisão forma, proporções, materiais, costuras, volume e identidade visual do produto.'
    );
    if (model.notes) sections.push(`Detalhes obrigatorios do modelo: ${model.notes}.`);
  }
  for (const template of state.imageTemplates) {
    sections.push(
      `Use o template visual #${template.alias} como linguagem principal da imagem, mantendo o padrão visual ${template.name}.`
    );
    if (template.notes) sections.push(`Diretrizes obrigatorias do template: ${template.notes}.`);
    const templateOptionsSummary = buildPromptDetailsSummary(template.promptOptions);
    if (templateOptionsSummary) sections.push(`Ajustes do template: ${templateOptionsSummary}.`);
  }
  if (promptOptions.renderFocus)
    sections.push(`Foco principal: ${humanizePromptFocus(promptOptions.renderFocus)}.`);
  if (promptOptions.aspectRatio)
    sections.push(`Use proporção de imagem ${promptOptions.aspectRatio}.`);
  if (promptOptions.promptStrength === 'strong')
    sections.push(
      'Siga o pedido com alta aderência, mantendo forte fidelidade aos detalhes e restrições descritos.'
    );
  else if (promptOptions.promptStrength === 'soft')
    sections.push('Interprete o pedido com mais liberdade criativa, preservando a intencao geral.');
  if (promptOptions.styleDirection)
    sections.push(`Direção de estilo: ${promptOptions.styleDirection}.`);
  if (promptOptions.preserveDetails)
    sections.push(`Preservar obrigatoriamente: ${promptOptions.preserveDetails}.`);
  if (promptOptions.extraInstructions)
    sections.push(`Instruções extras: ${promptOptions.extraInstructions}.`);
  if (promptOptions.negativePrompt) sections.push(`Evitar: ${promptOptions.negativePrompt}.`);
  return sections.join('\n');
}

function getPromptAutocompleteQuery() {
  if (!promptInput) return null;
  if (promptInput.selectionStart !== promptInput.selectionEnd) return null;
  const caret = promptInput.selectionStart || 0;
  const beforeCaret = promptInput.value.slice(0, caret);
  const match = beforeCaret.match(/(^|\s)([@#][a-z0-9_-]*)$/i);
  if (!match) return null;
  const rawToken = match[2] || '';
  const marker = rawToken[0];
  const search = rawToken.slice(1).toLowerCase();
  const start = caret - rawToken.length;
  if (!['@', '#'].includes(marker)) return null;
  return { marker, search, start, end: caret };
}

function buildPromptAutocompleteOptions(query) {
  if (!query) return [];
  if (query.marker === '@') {
    return state.productModels
      .filter(
        (e) =>
          !query.search ||
          e.alias.toLowerCase().startsWith(query.search) ||
          e.name.toLowerCase().includes(query.search)
      )
      .slice(0, 6)
      .map((e) => ({
        marker: '@',
        alias: e.alias,
        name: e.name,
        meta: e.notes || 'Modelo de produto',
      }));
  }
  if (query.marker === '#') {
    return state.imageTemplates
      .filter(
        (e) =>
          !query.search ||
          e.alias.toLowerCase().startsWith(query.search) ||
          e.name.toLowerCase().includes(query.search)
      )
      .slice(0, 6)
      .map((e) => ({
        marker: '#',
        alias: e.alias,
        name: e.name,
        meta: e.notes || buildPromptDetailsSummary(e.promptOptions) || 'Template visual',
      }));
  }
  return [];
}

export function updatePromptAutocomplete() {
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
    <button class="prompt-autocomplete-item${index === promptAutocompleteState.activeIndex ? ' is-active' : ''}" type="button" data-autocomplete-index="${index}">
      <span class="prompt-autocomplete-title">${option.marker}${escapeHtml(option.alias)}</span>
      <span class="prompt-autocomplete-name">${escapeHtml(option.name)}</span>
      <span class="prompt-autocomplete-meta">${escapeHtml(option.meta)}</span>
    </button>`
    )
    .join('');
  for (const button of promptAutocompleteList.querySelectorAll('[data-autocomplete-index]')) {
    button.onmousedown = (event) => {
      event.preventDefault();
      const index = Number(button.getAttribute('data-autocomplete-index'));
      if (Number.isFinite(index)) applyPromptAutocompleteOption(index);
    };
  }
}

export function hidePromptAutocomplete() {
  promptAutocompleteState = { query: null, options: [], activeIndex: 0 };
  if (promptAutocomplete) promptAutocomplete.hidden = true;
  if (promptAutocompleteList) promptAutocompleteList.innerHTML = '';
}

export function handlePromptAutocompleteKeydown(event) {
  if (!promptAutocompleteState.options.length) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    promptAutocompleteState.activeIndex =
      (promptAutocompleteState.activeIndex + 1) % promptAutocompleteState.options.length;
    renderPromptAutocomplete();
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    promptAutocompleteState.activeIndex =
      (promptAutocompleteState.activeIndex - 1 + promptAutocompleteState.options.length) %
      promptAutocompleteState.options.length;
    renderPromptAutocomplete();
    return;
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault();
    applyPromptAutocompleteOption(promptAutocompleteState.activeIndex);
    return;
  }
  if (event.key === 'Escape') hidePromptAutocomplete();
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
  const nextValue = `${before}${mention} ${after}`.replace(/\s{2,}/g, ' ');
  const caret = before.length + mention.length + 1;
  promptInput.value = nextValue;
  promptInput.focus();
  promptInput.setSelectionRange(caret, caret);
  renderPromptProductModelMentions();
  renderPromptImageTemplateMentions();
  hidePromptAutocomplete();
}

export function applyPromptPreset(presetKey) {
  const preset = PROMPT_PRESETS[presetKey];
  if (!preset) return;
  if (renderFocusSelect && preset.renderFocus) renderFocusSelect.value = preset.renderFocus;
  if (aspectRatioSelect && preset.aspectRatio) aspectRatioSelect.value = preset.aspectRatio;
  if (promptStrengthSelect) promptStrengthSelect.value = 'balanced';
  if (styleDirectionInput) styleDirectionInput.value = preset.styleDirection;
  if (preserveDetailsInput) preserveDetailsInput.value = preset.preserveDetails;
  if (extraInstructionsInput) extraInstructionsInput.value = preset.extraInstructions;
  statusBox.textContent = 'Preset aplicado. Ajuste os campos avançados como quiser.';
}

export function persistCustomPromptPresets() {
  persistCustomPromptPresetsToStorage(
    window.localStorage,
    state.customPromptPresets,
    CUSTOM_PRESETS_STORAGE_KEY
  );
}

export function renderCustomPromptPresets() {
  if (!customPresetList) return;
  if (!state.customPromptPresets.length) {
    customPresetList.innerHTML = `<p class="custom-preset-empty">Nenhum preset salvo ainda.</p>`;
    bindCustomPresetActions();
    return;
  }
  customPresetList.innerHTML = state.customPromptPresets
    .map(
      (preset) => `
    <article class="custom-preset-item">
      <div class="custom-preset-meta">
        <p class="custom-preset-name">${escapeHtml(preset.name)}</p>
        <p class="custom-preset-summary">${escapeHtml(buildPromptDetailsSummary(preset.options) || 'Preset salvo pronto para reutilizar.')}</p>
      </div>
      <div class="custom-preset-actions">
        <button class="ghost-button custom-preset-apply" type="button" data-apply-custom-preset="${escapeHtml(preset.id)}">Aplicar</button>
        <button class="icon-action-button icon-action-button-danger" type="button" data-delete-custom-preset="${escapeHtml(preset.id)}" aria-label="Excluir preset" title="Excluir preset">
          <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true"><path d="M9 3h6"></path><path d="M4 6h16"></path><path d="M7 6l1 14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-14"></path><path d="M10 10v7"></path><path d="M14 10v7"></path></svg>
        </button>
      </div>
    </article>`
    )
    .join('');
  bindCustomPresetActions();
}

function bindCustomPresetActions() {
  for (const button of document.querySelectorAll('[data-apply-custom-preset]')) {
    button.onclick = () => {
      const preset = state.customPromptPresets.find(
        (e) => e.id === button.getAttribute('data-apply-custom-preset')
      );
      if (!preset) return;
      hydratePromptOptions(preset.options);
      statusBox.textContent = `Preset "${preset.name}" aplicado.`;
    };
  }
  for (const button of document.querySelectorAll('[data-delete-custom-preset]')) {
    button.onclick = async () => {
      const presetId = button.getAttribute('data-delete-custom-preset');
      const preset = state.customPromptPresets.find((e) => e.id === presetId);
      if (!preset) return;
      const confirmed = await requestConfirmation({
        title: 'Excluir preset',
        message: `Excluir o preset "${preset.name}"?`,
        confirmLabel: 'Excluir',
      });
      if (!confirmed) return;
      state.customPromptPresets = state.customPromptPresets.filter((e) => e.id !== presetId);
      persistCustomPromptPresets();
      renderCustomPromptPresets();
      statusBox.textContent = `Preset "${preset.name}" removido.`;
    };
  }
}

export function saveCurrentPromptPreset() {
  const name = customPresetNameInput?.value.trim() || '';
  if (!name) {
    statusBox.textContent = 'De um nome ao preset antes de salvar.';
    customPresetNameInput?.focus();
    return;
  }
  const options = sanitizePromptOptions(collectPromptOptions());
  const existingIndex = state.customPromptPresets.findIndex(
    (e) => e.name.toLowerCase() === name.toLowerCase()
  );
  const nextPreset = {
    id:
      existingIndex >= 0
        ? state.customPromptPresets[existingIndex].id
        : `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    options,
  };
  if (existingIndex >= 0) {
    state.customPromptPresets.splice(existingIndex, 1, nextPreset);
    statusBox.textContent = `Preset "${name}" atualizado.`;
  } else {
    state.customPromptPresets.unshift(nextPreset);
    state.customPromptPresets = state.customPromptPresets.slice(0, 12);
    statusBox.textContent = `Preset "${name}" salvo.`;
  }
  persistCustomPromptPresets();
  renderCustomPromptPresets();
  if (customPresetNameInput) customPresetNameInput.value = '';
}

deps.collectPromptOptions = collectPromptOptions;
deps.hydratePromptOptions = hydratePromptOptions;
deps.resolvePromptProductModels = resolvePromptProductModels;
deps.resolvePromptImageTemplates = resolvePromptImageTemplates;
deps.buildLocalizedPrompt = buildLocalizedPrompt;
deps.updatePromptAutocomplete = updatePromptAutocomplete;
deps.hidePromptAutocomplete = hidePromptAutocomplete;
deps.handlePromptAutocompleteKeydown = handlePromptAutocompleteKeydown;
deps.applyPromptPreset = applyPromptPreset;
deps.renderCustomPromptPresets = renderCustomPromptPresets;
deps.saveCurrentPromptPreset = saveCurrentPromptPreset;
