import deps from './deps.js';
import { state, selectedGalleryIds, selectedCutoutIds, selectedCropIds } from './state.js';
import { showToast, fileToBase64, base64ToFile } from './utils.js';
import { statusBox, referencePreview, promptInput } from './dom.js';

export function bindInteractiveActions() {
  for (const button of document.querySelectorAll('[data-cancel-id]')) {
    button.onclick = async () => {
      const id = button.getAttribute('data-cancel-id');
      if (!id) return;
      button.disabled = true;
      button.textContent = 'Cancelando...';
      try {
        const r = await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha ao cancelar job.');
        statusBox.textContent = `Job ${id} cancelado.`;
        await deps.refreshJobs();
        await deps.refreshUsage();
      } catch (e) {
        statusBox.textContent = e instanceof Error ? e.message : 'Erro ao cancelar job.';
        button.disabled = false;
        button.textContent = 'Cancelar';
      }
    };
  }
  for (const button of document.querySelectorAll('[data-copy-prompt]')) {
    button.onclick = async () => {
      const prompt = button.getAttribute('data-copy-prompt') || '';
      if (!prompt) {
        statusBox.textContent = 'Esse card não tem prompt disponível para copiar.';
        return;
      }
      try {
        await navigator.clipboard.writeText(prompt);
        statusBox.textContent = 'Prompt copiado.';
        button.classList.add('is-copied');
        window.setTimeout(() => button.classList.remove('is-copied'), 1400);
      } catch {
        statusBox.textContent = 'Não foi possível copiar o prompt.';
      }
    };
  }
  for (const input of document.querySelectorAll('[data-select-kind][data-select-id]')) {
    input.onchange = () => {
      const kind = input.getAttribute('data-select-kind'),
        id = input.getAttribute('data-select-id');
      if (!kind || !id) return;
      const map = { job: selectedGalleryIds, cutout: selectedCutoutIds, crop: selectedCropIds };
      const set = map[kind];
      if (!set) return;
      if (input.checked) set.add(id);
      else set.delete(id);
      deps.updateBulkSelectionUi();
    };
  }
  for (const button of document.querySelectorAll('[data-toggle-text]')) {
    button.onclick = () => {
      const t = document.getElementById(button.getAttribute('data-toggle-text'));
      if (!t) return;
      const collapsed = t.classList.toggle('is-collapsed');
      button.textContent = collapsed ? 'Ver mais' : 'Ver menos';
      button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    };
  }
  for (const button of document.querySelectorAll('[data-cutout-job-id]')) {
    button.onclick = async () => {
      const job = state.lastJobs.find((e) => e.id === button.getAttribute('data-cutout-job-id'));
      if (!job?.result?.imageUrl) {
        statusBox.textContent = 'Não foi possível remover o fundo dessa imagem.';
        return;
      }
      button.disabled = true;
      button.textContent = 'Removendo...';
      statusBox.textContent = 'Removendo fundo da imagem...';
      state.cutoutProcessingJobId = job.id;
      deps.renderJobs(state.lastJobs);
      const folder = deps.getActiveCreationFolder();
      if (folder) deps.registerFolderName(folder);
      try {
        const r = await fetch('/api/cutouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: job.id,
            imageUrl: job.result.imageUrl,
            filename: job.result.filename,
            label: deps.buildDisplayPrompt(job),
            folder,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha ao remover o fundo.');
        statusBox.textContent = 'Fundo removido com sucesso.';
        await deps.refreshCutouts();
      } catch (e) {
        statusBox.textContent = e instanceof Error ? e.message : 'Falha ao remover o fundo.';
      } finally {
        state.cutoutProcessingJobId = null;
        deps.renderJobs(state.lastJobs);
      }
    };
  }
  for (const button of document.querySelectorAll('[data-delete-job-id]')) {
    button.onclick = async () => {
      const jobId = button.getAttribute('data-delete-job-id');
      const confirmed = jobId
        ? await deps.requestConfirmation({
            title: 'Remover imagem',
            message: 'Remover esta imagem da galeria?',
            confirmLabel: 'Remover',
          })
        : false;
      if (!jobId || !confirmed) return;
      button.disabled = true;
      button.classList.add('is-busy');
      try {
        const r = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha ao remover a imagem.');
        statusBox.textContent = 'Imagem removida da galeria.';
        await deps.refreshJobs();
        await deps.refreshUsage();
      } catch (e) {
        statusBox.textContent = e instanceof Error ? e.message : 'Falha ao remover a imagem.';
        button.disabled = false;
        button.classList.remove('is-busy');
      }
    };
  }
  for (const button of document.querySelectorAll('[data-branch-job-id]')) {
    button.onclick = () =>
      deps.selectBranchFromJob(button.getAttribute('data-branch-job-id'), false);
  }
  for (const button of document.querySelectorAll('[data-branch-keep-prompt-id]')) {
    button.onclick = () =>
      deps.selectBranchFromJob(button.getAttribute('data-branch-keep-prompt-id'), true);
  }
  for (const button of document.querySelectorAll('[data-crop-job-id]')) {
    button.onclick = () => deps.openRegionEditor(button.getAttribute('data-crop-job-id'), 'crop');
  }
  for (const button of document.querySelectorAll('[data-region-job-id]')) {
    button.onclick = () => deps.openRegionEditor(button.getAttribute('data-region-job-id'));
  }
  for (const button of document.querySelectorAll('[data-use-cutout-base]')) {
    button.onclick = async () => {
      try {
        const r = await fetch('/api/cutouts');
        const d = await r.json();
        const item = (d.cutouts || []).find(
          (e) => e.id === button.getAttribute('data-use-cutout-base')
        );
        if (!item) throw new Error('Recorte não encontrado.');
        state.selectedBranchReference = {
          jobId: item.sourceJobId,
          imageUrl: item.imageUrl,
          filename: item.filename,
          name: item.label || 'Recorte sem fundo',
        };
        state.selectedRegionReference = null;
        deps.renderBranchPreview();
        deps.renderRegionPreview();
        statusBox.textContent = 'Recorte carregado como imagem base.';
        promptInput.focus();
      } catch (e) {
        statusBox.textContent =
          e instanceof Error ? e.message : 'Não foi possível usar esse recorte.';
      }
    };
  }
  for (const button of document.querySelectorAll('[data-delete-cutout-id]')) {
    button.onclick = async () => {
      const id = button.getAttribute('data-delete-cutout-id');
      const ok = id
        ? await deps.requestConfirmation({
            title: 'Remover imagem',
            message: 'Remover este PNG sem fundo?',
            confirmLabel: 'Remover',
          })
        : false;
      if (!id || !ok) return;
      button.disabled = true;
      button.classList.add('is-busy');
      try {
        const r = await fetch(`/api/cutouts/${id}`, { method: 'DELETE' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha ao remover o recorte.');
        statusBox.textContent = 'PNG sem fundo removido.';
        await deps.refreshCutouts();
      } catch (e) {
        statusBox.textContent = e instanceof Error ? e.message : 'Falha ao remover o recorte.';
        button.disabled = false;
        button.classList.remove('is-busy');
      }
    };
  }
  for (const button of document.querySelectorAll('[data-use-crop-base]')) {
    button.onclick = async () => {
      try {
        const r = await fetch('/api/crops');
        const d = await r.json();
        const item = (d.crops || []).find(
          (e) => e.id === button.getAttribute('data-use-crop-base')
        );
        if (!item) throw new Error('Recorte não encontrado.');
        state.selectedBranchReference = {
          jobId: item.sourceJobId,
          imageUrl: item.imageUrl,
          filename: item.filename,
          name: item.label || 'Recorte',
        };
        state.selectedRegionReference = null;
        deps.renderBranchPreview();
        deps.renderRegionPreview();
        statusBox.textContent = 'Recorte carregado como imagem base.';
        promptInput.focus();
      } catch (e) {
        statusBox.textContent =
          e instanceof Error ? e.message : 'Não foi possível usar esse recorte.';
      }
    };
  }
  for (const button of document.querySelectorAll(
    '[data-assign-folder-kind][data-assign-folder-id]'
  )) {
    button.onclick = async () => {
      const kind = button.getAttribute('data-assign-folder-kind'),
        id = button.getAttribute('data-assign-folder-id'),
        currentFolder = button.getAttribute('data-current-folder') || '';
      if (!kind || !id) return;
      const next = await deps.requestFolderSelection({
        title: 'Organizar item',
        message: 'Selecione uma pasta existente ou digite uma nova para este item.',
        currentFolder,
      });
      if (next === null) return;
      button.disabled = true;
      button.classList.add('is-busy');
      try {
        await deps.handleSingleFolderAssignment(kind, id, next);
        statusBox.textContent = next.trim()
          ? `Item movido para ${next.trim()}.`
          : 'Item removido da pasta atual.';
      } catch (e) {
        statusBox.textContent =
          e instanceof Error ? e.message : 'Não foi possível atualizar a pasta deste item.';
        button.disabled = false;
        button.classList.remove('is-busy');
      }
    };
  }
  for (const button of document.querySelectorAll('[data-delete-crop-id]')) {
    button.onclick = async () => {
      const id = button.getAttribute('data-delete-crop-id');
      const ok = id
        ? await deps.requestConfirmation({
            title: 'Remover imagem',
            message: 'Remover este recorte salvo?',
            confirmLabel: 'Remover',
          })
        : false;
      if (!id || !ok) return;
      button.disabled = true;
      button.classList.add('is-busy');
      try {
        const r = await fetch(`/api/crops/${id}`, { method: 'DELETE' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha ao remover o recorte.');
        statusBox.textContent = 'Recorte removido.';
        await deps.refreshCrops();
      } catch (e) {
        statusBox.textContent = e instanceof Error ? e.message : 'Falha ao remover o recorte.';
        button.disabled = false;
        button.classList.remove('is-busy');
      }
    };
  }
  for (const button of referencePreview.querySelectorAll('[data-remove-reference]')) {
    button.onclick = () => {
      const i = Number(button.getAttribute('data-remove-reference'));
      if (!Number.isFinite(i)) return;
      state.selectedReferenceFiles.splice(i, 1);
      deps.syncReferenceInputFiles();
      deps.renderReferencePreview();
    };
  }
  for (const button of referencePreview.querySelectorAll('[data-remove-reference-bg]')) {
    button.onclick = async () => {
      const i = Number(button.getAttribute('data-remove-reference-bg'));
      if (!Number.isFinite(i)) return;
      const file = state.selectedReferenceFiles[i];
      if (!file) return;
      button.disabled = true;
      button.textContent = 'Processando...';
      statusBox.textContent = `Removendo fundo de ${file.name}...`;
      try {
        const r = await fetch('/api/reference-images/remove-background', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            mimeType: file.type,
            data: await fileToBase64(file),
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Não foi possível remover o fundo desta referência.');
        state.selectedReferenceFiles[i] = base64ToFile(
          d.referenceImage?.data || '',
          d.referenceImage?.name || `${file.name.replace(/\.[^.]+$/, '')}-sem-fundo.png`,
          d.referenceImage?.mimeType || 'image/png'
        );
        deps.syncReferenceInputFiles();
        deps.renderReferencePreview();
        statusBox.textContent = `Fundo removido da referência ${file.name}.`;
      } catch (e) {
        statusBox.textContent =
          e instanceof Error ? e.message : 'Não foi possível remover o fundo desta referência.';
        button.disabled = false;
        button.textContent = 'Remover fundo';
      }
    };
  }
  for (const button of document.querySelectorAll('[data-remove-product-model-file]')) {
    button.onclick = () => {
      const i = Number(button.getAttribute('data-remove-product-model-file'));
      if (!Number.isFinite(i)) return;
      state.selectedProductModelFiles.splice(i, 1);
      deps.syncProductModelInputFiles();
      deps.renderProductModelUploadPreview();
    };
  }
  for (const button of document.querySelectorAll('[data-insert-product-model]')) {
    button.onclick = () => {
      const alias = button.getAttribute('data-insert-product-model');
      if (!alias) return;
      deps.insertProductModelMention(alias);
      statusBox.textContent = `@${alias} inserido no prompt.`;
    };
  }
  for (const button of document.querySelectorAll('[data-evaluate-product-model]')) {
    button.onclick = async () => {
      const alias = button.getAttribute('data-evaluate-product-model');
      const model = state.productModels.find((e) => e.alias === alias);
      if (!alias || !model) return;
      button.disabled = true;
      button.textContent = 'Avaliando...';
      statusBox.textContent = `Avaliando gratis o modelo @${alias}...`;
      try {
        const r = await fetch(`/api/product-models/${encodeURIComponent(alias)}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'heuristic' }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Não foi possível avaliar o modelo.');
        await deps.refreshProductModels();
        statusBox.textContent = `Avaliação grátis de @${alias} concluída: ${deps.getProductModelEvaluationStatusLabel(d.evaluation?.status)}.`;
      } catch (e) {
        statusBox.textContent =
          e instanceof Error ? e.message : 'Não foi possível avaliar o modelo.';
        button.disabled = false;
        button.textContent = 'Avaliar grátis';
      }
    };
  }
  for (const button of document.querySelectorAll('[data-evaluate-product-model-ai]')) {
    button.onclick = async () => {
      const alias = button.getAttribute('data-evaluate-product-model-ai');
      const model = state.productModels.find((e) => e.alias === alias);
      if (!alias || !model) return;
      button.disabled = true;
      button.textContent = 'Avaliando...';
      statusBox.textContent = `Avaliando com IA o modelo @${alias}... Isso pode consumir API.`;
      try {
        const r = await fetch(`/api/product-models/${encodeURIComponent(alias)}/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'gemini' }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Não foi possível avaliar o modelo com IA.');
        await deps.refreshProductModels();
        statusBox.textContent = `Avaliação com IA de @${alias} concluída: ${deps.getProductModelEvaluationStatusLabel(d.evaluation?.status)}.`;
      } catch (e) {
        statusBox.textContent =
          e instanceof Error ? e.message : 'Não foi possível avaliar o modelo com IA.';
        button.disabled = false;
        button.textContent = 'Avaliar com IA';
      }
    };
  }
  for (const button of document.querySelectorAll('[data-delete-product-model]')) {
    button.onclick = async () => {
      const alias = button.getAttribute('data-delete-product-model');
      if (!alias || !state.productModels.find((e) => e.alias === alias)) return;
      if (
        !(await deps.requestConfirmation({
          title: 'Excluir modelo de produto',
          message: `Excluir o modelo @${alias}? As referências salvas dele serão removidas.`,
          confirmLabel: 'Excluir',
        }))
      )
        return;
      try {
        const r = await fetch(`/api/product-models/${encodeURIComponent(alias)}`, {
          method: 'DELETE',
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha ao excluir o modelo de produto.');
        await deps.refreshProductModels();
        deps.renderPromptProductModelMentions();
        statusBox.textContent = `Modelo @${alias} removido.`;
      } catch (e) {
        statusBox.textContent =
          e instanceof Error ? e.message : 'Falha ao excluir o modelo de produto.';
      }
    };
  }
  for (const button of document.querySelectorAll('[data-remove-image-template-file]')) {
    button.onclick = () => {
      const i = Number(button.getAttribute('data-remove-image-template-file'));
      if (!Number.isFinite(i)) return;
      state.selectedImageTemplateFiles.splice(i, 1);
      deps.syncImageTemplateInputFiles();
      deps.renderImageTemplateUploadPreview();
    };
  }
  for (const button of document.querySelectorAll('[data-insert-image-template]')) {
    button.onclick = () => {
      const alias = button.getAttribute('data-insert-image-template');
      if (!alias) return;
      deps.insertImageTemplateMention(alias);
      statusBox.textContent = `#${alias} inserido no prompt.`;
    };
  }
  for (const button of document.querySelectorAll('[data-delete-image-template]')) {
    button.onclick = async () => {
      const alias = button.getAttribute('data-delete-image-template');
      if (!alias || !state.imageTemplates.find((e) => e.alias === alias)) return;
      if (
        !(await deps.requestConfirmation({
          title: 'Excluir template visual',
          message: `Excluir o template #${alias}? As referências salvas dele serão removidas.`,
          confirmLabel: 'Excluir',
        }))
      )
        return;
      try {
        const r = await fetch(`/api/image-templates/${encodeURIComponent(alias)}`, {
          method: 'DELETE',
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha ao excluir o template visual.');
        await deps.refreshImageTemplates();
        deps.renderPromptImageTemplateMentions();
        statusBox.textContent = `Template #${alias} removido.`;
      } catch (e) {
        statusBox.textContent =
          e instanceof Error ? e.message : 'Falha ao excluir o template visual.';
      }
    };
  }
}

export async function handleBulkRemoval({
  button,
  endpoint,
  getPayload,
  confirmMessage,
  loadingLabel,
  successMessage,
  refreshers,
}) {
  const payload = typeof getPayload === 'function' ? getPayload() : {};
  const selectedCount = deps.countSelectedFromPayload(payload);
  if (!button || selectedCount === 0) {
    statusBox.textContent = 'Selecione pelo menos um item antes de remover.';
    return;
  }
  if (
    !(await deps.requestConfirmation({
      title: 'Confirmar remoção',
      message: confirmMessage,
      confirmLabel: 'Remover',
    }))
  )
    return;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = loadingLabel;
  try {
    const r = await fetch(endpoint, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Falha ao remover em lote.');
    for (const refresh of refreshers) await refresh();
    deps.clearSelectionsFromPayload(payload);
    deps.updateBulkSelectionUi();
    statusBox.textContent = successMessage;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao remover em lote.';
    statusBox.textContent = msg;
    showToast(msg);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

export async function handleFolderAssignment(folderValue) {
  const jobs = Array.from(selectedGalleryIds),
    cutouts = Array.from(selectedCutoutIds),
    crops = Array.from(selectedCropIds);
  const total = jobs.length + cutouts.length + crops.length;
  if (!total) {
    statusBox.textContent = 'Selecione pelo menos um item para organizar em pasta.';
    return;
  }
  const f = String(folderValue || '').trim();
  if (!f && folderValue !== '') {
    statusBox.textContent = 'Informe uma pasta antes de mover os itens.';
    return;
  }
  if (f) deps.registerFolderName(f);
  if (deps.organizeSelectedButton) deps.organizeSelectedButton.disabled = true;
  statusBox.textContent = f
    ? `Movendo ${total} item(ns) para a pasta ${f}...`
    : `Removendo ${total} item(ns) da pasta atual...`;
  try {
    const r = await fetch('/api/library/folders/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: f, jobs, cutouts, crops }),
    });
    const d = await r.json();
    if (!r.ok)
      throw new Error(d.error || 'Não foi possível atualizar a pasta dos itens selecionados.');
    statusBox.textContent = f
      ? `${d.updated.total} item(ns) movido(s) para ${f}.`
      : `${d.updated.total} item(ns) voltaram para a raiz organizada por data.`;
    await deps.refreshJobs();
    await deps.refreshCutouts();
    await deps.refreshCrops();
  } catch (e) {
    statusBox.textContent =
      e instanceof Error ? e.message : 'Não foi possível atualizar a pasta dos itens selecionados.';
  } finally {
    deps.updateBulkSelectionUi();
  }
}

export async function handleSingleFolderAssignment(kind, id, folderValue) {
  const f = String(folderValue || '').trim();
  if (f) deps.registerFolderName(f);
  const payload = { folder: f, jobs: [], cutouts: [], crops: [] };
  if (kind === 'job') payload.jobs = [id];
  else if (kind === 'cutout') payload.cutouts = [id];
  else if (kind === 'crop') payload.crops = [id];
  else {
    statusBox.textContent = 'Tipo de item inválido para organizar em pasta.';
    return;
  }
  statusBox.textContent = f
    ? `Movendo item para a pasta ${f}...`
    : 'Removendo item da pasta atual...';
  const r = await fetch('/api/library/folders/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Não foi possível atualizar a pasta deste item.');
  statusBox.textContent = f ? `Item movido para ${f}.` : 'Item removido da pasta atual.';
  await deps.refreshJobs();
  await deps.refreshCutouts();
  await deps.refreshCrops();
}

deps.bindInteractiveActions = bindInteractiveActions;
deps.handleBulkRemoval = handleBulkRemoval;
deps.handleFolderAssignment = handleFolderAssignment;
deps.handleSingleFolderAssignment = handleSingleFolderAssignment;
