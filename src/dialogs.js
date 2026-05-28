import { displayFolderName } from './render-queue.js';
import { renderFolderDialogOptions } from './render-folders.js';
import {
  confirmDialog,
  confirmDialogTitle,
  confirmDialogMessage,
  confirmDialogCancelButton,
  confirmDialogConfirmButton,
  folderDialog,
  folderDialogTitle,
  folderDialogMessage,
  folderDialogCurrent,
  folderDialogInput,
  folderDialogOptions,
  folderDialogClearButton,
  folderDialogCancelButton,
  folderDialogConfirmButton,
} from './dom.js';

let confirmDialogResolver = null;
let folderDialogResolver = null;

export function requestConfirmation({
  title = 'Confirmar',
  message = 'Deseja continuar?',
  confirmLabel = 'Confirmar',
} = {}) {
  if (
    !confirmDialog ||
    !confirmDialogTitle ||
    !confirmDialogMessage ||
    !confirmDialogConfirmButton ||
    !confirmDialogCancelButton
  ) {
    return Promise.resolve(window.confirm(message));
  }
  if (confirmDialog.open && confirmDialogResolver) {
    confirmDialogResolver(false);
    confirmDialogResolver = null;
  }
  confirmDialogTitle.textContent = title;
  confirmDialogMessage.textContent = message;
  confirmDialogConfirmButton.textContent = confirmLabel;
  return new Promise((resolve) => {
    confirmDialogResolver = resolve;
    const cleanup = (result) => {
      if (!confirmDialogResolver) return;
      confirmDialogResolver = null;
      confirmDialog.removeEventListener('cancel', handleCancel);
      confirmDialog.removeEventListener('close', handleClose);
      confirmDialogCancelButton.removeEventListener('click', handleDismiss);
      confirmDialogConfirmButton.removeEventListener('click', handleConfirm);
      if (confirmDialog.open) confirmDialog.close();
      resolve(result);
    };
    const handleDismiss = () => cleanup(false);
    const handleConfirm = () => cleanup(true);
    const handleCancel = (event) => {
      event.preventDefault();
      cleanup(false);
    };
    const handleClose = () => cleanup(confirmDialog.returnValue === 'confirm');
    confirmDialog.addEventListener('cancel', handleCancel);
    confirmDialog.addEventListener('close', handleClose);
    confirmDialogCancelButton.addEventListener('click', handleDismiss);
    confirmDialogConfirmButton.addEventListener('click', handleConfirm);
    confirmDialog.showModal();
  });
}

export function requestFolderSelection({
  title = 'Organizar em pasta',
  message = 'Escolha uma pasta existente ou crie uma nova.',
  currentFolder = '',
} = {}) {
  if (
    !folderDialog ||
    !folderDialogTitle ||
    !folderDialogMessage ||
    !folderDialogCurrent ||
    !folderDialogInput ||
    !folderDialogOptions ||
    !folderDialogClearButton ||
    !folderDialogCancelButton ||
    !folderDialogConfirmButton
  ) {
    return Promise.resolve(window.prompt(message, currentFolder));
  }
  if (folderDialog.open && folderDialogResolver) {
    folderDialogResolver(null);
    folderDialogResolver = null;
  }
  folderDialogTitle.textContent = title;
  folderDialogMessage.textContent = message;
  folderDialogCurrent.textContent = displayFolderName(currentFolder);
  folderDialogInput.value = '';
  renderFolderDialogOptions(currentFolder);
  return new Promise((resolve) => {
    folderDialogResolver = resolve;
    const cleanup = (result) => {
      if (!folderDialogResolver) return;
      folderDialogResolver = null;
      folderDialog.removeEventListener('cancel', handleCancel);
      folderDialog.removeEventListener('close', handleClose);
      folderDialogCancelButton.removeEventListener('click', handleDismiss);
      folderDialogClearButton.removeEventListener('click', handleClear);
      folderDialogConfirmButton.removeEventListener('click', handleConfirm);
      for (const button of folderDialogOptions.querySelectorAll('[data-folder-choice]'))
        button.removeEventListener('click', handleChoiceClick);
      if (folderDialog.open) folderDialog.close();
      resolve(result);
    };
    const handleDismiss = () => cleanup(null);
    const handleClear = () => cleanup('');
    const handleConfirm = () => cleanup(folderDialogInput.value.trim());
    const handleChoiceClick = (event) => {
      cleanup(event.currentTarget.getAttribute('data-folder-choice') || '');
    };
    const handleCancel = (event) => {
      event.preventDefault();
      cleanup(null);
    };
    const handleClose = () => cleanup(null);
    folderDialog.addEventListener('cancel', handleCancel);
    folderDialog.addEventListener('close', handleClose);
    folderDialogCancelButton.addEventListener('click', handleDismiss);
    folderDialogClearButton.addEventListener('click', handleClear);
    folderDialogConfirmButton.addEventListener('click', handleConfirm);
    for (const button of folderDialogOptions.querySelectorAll('[data-folder-choice]'))
      button.addEventListener('click', handleChoiceClick);
    folderDialog.showModal();
    folderDialogInput.focus();
  });
}
