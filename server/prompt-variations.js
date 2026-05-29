// @ts-check

/**
 * Curated catalogue of automatic-variation axes. Each option has:
 *  - id: stable identifier sent by the client and validated server-side
 *  - label: human-friendly PT-BR label (mirrored on the frontend for the UI)
 *  - prompt: the phrase woven into the final prompt for that option
 *
 * @typedef {{ id: string, label: string, prompt: string }} VariationOption
 * @typedef {{ id: 'angles' | 'backgrounds' | 'styles', label: string, connector: string, options: VariationOption[] }} VariationAxis
 */

/** @type {VariationAxis[]} */
export const VARIATION_AXES = [
  {
    id: 'angles',
    label: 'Ângulos',
    connector: 'ângulo',
    options: [
      { id: 'frontal', label: 'Frontal', prompt: 'vista frontal direta' },
      { id: 'lateral', label: 'Lateral', prompt: 'vista lateral em perfil' },
      { id: 'tres-quartos', label: '3/4', prompt: 'vista em três quartos' },
      { id: 'superior', label: 'Vista superior', prompt: 'vista de cima (top-down)' },
      { id: 'closeup', label: 'Close-up', prompt: 'close-up de detalhe' },
      { id: 'traseira', label: 'Vista traseira', prompt: 'vista traseira' },
    ],
  },
  {
    id: 'backgrounds',
    label: 'Fundos',
    connector: 'fundo',
    options: [
      {
        id: 'branco-infinito',
        label: 'Branco infinito',
        prompt: 'fundo branco infinito de estúdio',
      },
      { id: 'cinza-estudio', label: 'Cinza estúdio', prompt: 'fundo cinza neutro de estúdio' },
      {
        id: 'lifestyle',
        label: 'Ambiente lifestyle',
        prompt: 'ambiente lifestyle real e contextual',
      },
      { id: 'gradiente', label: 'Gradiente suave', prompt: 'fundo com gradiente suave de cor' },
      { id: 'madeira', label: 'Superfície de madeira', prompt: 'superfície de madeira natural' },
      { id: 'escuro', label: 'Fundo escuro', prompt: 'fundo escuro dramático' },
    ],
  },
  {
    id: 'styles',
    label: 'Estilos',
    connector: 'estilo',
    options: [
      { id: 'produto-limpo', label: 'Produto limpo', prompt: 'foto de produto limpa e comercial' },
      {
        id: 'editorial-premium',
        label: 'Editorial premium',
        prompt: 'editorial premium sofisticado',
      },
      {
        id: 'lifestyle-natural',
        label: 'Lifestyle natural',
        prompt: 'lifestyle natural e espontâneo',
      },
      {
        id: 'advertising',
        label: 'Advertising high-end',
        prompt: 'advertising high-end de impacto',
      },
    ],
  },
];

/**
 * Validate and normalize raw client input into a map of axisId -> VariationOption[].
 * Unknown axis keys and unknown option ids are dropped silently; order follows
 * the catalogue order (not the client order) for deterministic expansion.
 *
 * @param {unknown} input
 * @returns {Map<string, VariationOption[]>}
 */
export function normalizeVariations(input) {
  /** @type {Map<string, VariationOption[]>} */
  const result = new Map();
  if (!input || typeof input !== 'object') return result;

  for (const axis of VARIATION_AXES) {
    const rawIds = /** @type {Record<string, unknown>} */ (input)[axis.id];
    if (!Array.isArray(rawIds)) continue;
    const wanted = new Set(rawIds.map((v) => String(v)));
    const picked = axis.options.filter((opt) => wanted.has(opt.id));
    if (picked.length > 0) result.set(axis.id, picked);
  }

  return result;
}

/**
 * Total number of jobs a normalized variation map would produce (cartesian product).
 * @param {Map<string, VariationOption[]>} normalized
 * @returns {number}
 */
export function countVariations(normalized) {
  if (normalized.size === 0) return 0;
  let total = 1;
  for (const options of normalized.values()) {
    total *= options.length;
  }
  return total;
}

/**
 * Expand a base prompt across the selected variation axes (cartesian product).
 * Each result weaves the chosen option phrases into the base prompt using the
 * axis connectors, e.g. "{base} | ângulo: vista frontal | fundo: ... | estilo: ...".
 *
 * @param {string} basePrompt
 * @param {Map<string, VariationOption[]>} normalized
 * @returns {Array<{ prompt: string, parts: Record<string, string> }>}
 */
export function expandVariations(basePrompt, normalized) {
  const base = String(basePrompt || '').trim();
  if (normalized.size === 0) return [];

  // Build axis list in catalogue order to keep output deterministic.
  const axes = VARIATION_AXES.filter((axis) => normalized.has(axis.id)).map((axis) => ({
    axis,
    options: /** @type {VariationOption[]} */ (normalized.get(axis.id)),
  }));

  /** @type {Array<{ prompt: string, parts: Record<string, string> }>} */
  let combos = [{ prompt: base, parts: {} }];

  for (const { axis, options } of axes) {
    /** @type {Array<{ prompt: string, parts: Record<string, string> }>} */
    const next = [];
    for (const combo of combos) {
      for (const opt of options) {
        next.push({
          prompt: `${combo.prompt} | ${axis.connector}: ${opt.prompt}`,
          parts: { ...combo.parts, [axis.id]: opt.id },
        });
      }
    }
    combos = next;
  }

  return combos;
}
