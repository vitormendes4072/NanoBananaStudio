import { appLayout, composerColumn, composerPanel, composerExpandButton } from './dom.js';

let composerPinFrame = 0;
let composerExpanded = false;

export function requestComposerPanelPinning() {
  if (composerPinFrame) return;
  composerPinFrame = window.requestAnimationFrame(() => {
    composerPinFrame = 0;
    syncComposerPanelPinning();
  });
}

function syncComposerPanelPinning() {
  if (!appLayout || !composerColumn || !composerPanel) return;
  if (composerExpanded) {
    resetComposerPanelPinning();
    return;
  }
  const desktopLayout = window.innerWidth > 900;
  if (!desktopLayout) {
    resetComposerPanelPinning();
    return;
  }
  const topOffset = 8;
  const bottomOffset = 8;
  const viewportLimit = Math.max(window.innerHeight - topOffset - bottomOffset, 240);
  const panelNaturalHeight = composerPanel.scrollHeight;
  const pinnedHeight = Math.min(panelNaturalHeight, viewportLimit);
  const layoutRect = appLayout.getBoundingClientRect();
  const columnRect = composerColumn.getBoundingClientRect();
  const layoutTop = layoutRect.top + window.scrollY;
  const layoutBottom = layoutTop + appLayout.offsetHeight;
  const fixedStart = layoutTop - topOffset;
  const fixedEnd = layoutBottom - pinnedHeight - topOffset;
  const currentScroll = window.scrollY;
  composerColumn.style.minHeight = `${panelNaturalHeight}px`;
  composerPanel.style.maxHeight = `${viewportLimit}px`;
  composerPanel.style.overflowY = panelNaturalHeight > viewportLimit ? 'auto' : 'visible';
  if (currentScroll <= fixedStart) {
    resetComposerPanelPinning(true);
    return;
  }
  if (currentScroll >= fixedEnd) {
    composerPanel.style.position = 'absolute';
    composerPanel.style.top = 'auto';
    composerPanel.style.right = 'auto';
    composerPanel.style.bottom = '0';
    composerPanel.style.left = '0';
    composerPanel.style.width = '100%';
    return;
  }
  composerPanel.style.position = 'fixed';
  composerPanel.style.top = `${topOffset}px`;
  composerPanel.style.right = 'auto';
  composerPanel.style.bottom = 'auto';
  composerPanel.style.left = `${columnRect.left}px`;
  composerPanel.style.width = `${columnRect.width}px`;
}

function resetComposerPanelPinning(keepColumnHeight = false) {
  if (!composerColumn || !composerPanel) return;
  if (!keepColumnHeight) composerColumn.style.minHeight = '';
  composerPanel.style.position = 'relative';
  composerPanel.style.top = '';
  composerPanel.style.right = '';
  composerPanel.style.bottom = '';
  composerPanel.style.left = '';
  composerPanel.style.width = '';
  composerPanel.style.maxHeight = '';
  composerPanel.style.overflowY = '';
}

export function syncComposerExpandedState() {
  if (!composerPanel || !composerExpandButton) return;
  composerPanel.classList.toggle('is-expanded', composerExpanded);
  document.body.classList.toggle('composer-expanded', composerExpanded);
  composerExpandButton.setAttribute(
    'aria-label',
    composerExpanded ? 'Recolher painel de prompt' : 'Expandir painel de prompt'
  );
  composerExpandButton.setAttribute(
    'title',
    composerExpanded ? 'Recolher painel de prompt' : 'Expandir painel de prompt'
  );
  composerExpandButton.classList.toggle('is-active', composerExpanded);
  requestComposerPanelPinning();
}

export function toggleComposerExpanded() {
  composerExpanded = !composerExpanded;
  syncComposerExpandedState();
}

export function collapseComposer() {
  if (composerExpanded) {
    composerExpanded = false;
    syncComposerExpandedState();
  }
}

export function isComposerExpanded() {
  return composerExpanded;
}
