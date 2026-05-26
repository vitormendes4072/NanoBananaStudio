export const CUSTOM_PRESETS_STORAGE_KEY = 'nano-banana-custom-presets-v1';

const ALLOWED_PROMPT_STRENGTHS = new Set(['balanced', 'strong', 'soft']);
const ALLOWED_RENDER_FOCUS = new Set([
  '',
  'photoreal',
  'product',
  'editorial',
  'lifestyle',
  'advertising',
  'closeup',
]);
const ALLOWED_ASPECT_RATIOS = new Set([
  '1:1',
  '4:5',
  '5:4',
  '3:4',
  '4:3',
  '2:3',
  '3:2',
  '9:16',
  '16:9',
  '21:9',
]);

export function sanitizePromptOptions(promptOptions = {}) {
  return {
    negativePrompt: String(promptOptions.negativePrompt || '').trim(),
    promptStrength: ALLOWED_PROMPT_STRENGTHS.has(promptOptions.promptStrength)
      ? promptOptions.promptStrength
      : 'balanced',
    renderFocus: ALLOWED_RENDER_FOCUS.has(promptOptions.renderFocus)
      ? promptOptions.renderFocus
      : '',
    aspectRatio: ALLOWED_ASPECT_RATIOS.has(promptOptions.aspectRatio)
      ? promptOptions.aspectRatio
      : '1:1',
    styleDirection: String(promptOptions.styleDirection || '').trim(),
    preserveDetails: String(promptOptions.preserveDetails || '').trim(),
    extraInstructions: String(promptOptions.extraInstructions || '').trim(),
  };
}

export function loadCustomPromptPresetsFromStorage(
  storage,
  storageKey = CUSTOM_PRESETS_STORAGE_KEY
) {
  try {
    const raw = storage?.getItem(storageKey);
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => ({
        id: String(entry?.id || '').trim(),
        name: String(entry?.name || '').trim(),
        options: sanitizePromptOptions(entry?.options || {}),
      }))
      .filter((entry) => entry.id && entry.name);
  } catch {
    return [];
  }
}

export function persistCustomPromptPresetsToStorage(
  storage,
  presets,
  storageKey = CUSTOM_PRESETS_STORAGE_KEY
) {
  storage?.setItem(storageKey, JSON.stringify(presets));
}
