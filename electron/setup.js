// Renderer da janela de setup. Sem Node aqui — usa apenas a ponte `setupApi`
// exposta pelo preload (contextBridge).

const input = document.getElementById('key');
const saveButton = document.getElementById('save');

// Pré-preenche com a chave atual, se já existir.
window.setupApi.onCurrentKey((key) => {
  if (key) input.value = key;
});

function save() {
  saveButton.disabled = true;
  window.setupApi.saveApiKey(input.value);
  // O main process fecha esta janela após gravar.
}

saveButton.addEventListener('click', save);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') save();
});
input.focus();
