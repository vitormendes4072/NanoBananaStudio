export const state = {
  lastJobs: [],
  lastCutouts: [],
  lastCrops: [],
  productModels: [],
  imageTemplates: [],
  cutoutProcessingJobId: null,
  selectedReferenceFiles: [],
  selectedProductModelFiles: [],
  selectedImageTemplateFiles: [],
  selectedBranchReference: null,
  selectedRegionReference: null,
  regionEditorState: null,
  collapsedSections: {},
  advancedPromptCollapsed: false,
  customFolders: [],
  customPromptPresets: [],
};

export const MODEL_INFO = {
  "gemini-2.5-flash-image": {
    shortLabel: "Nano Banana",
  },
  "gemini-3-pro-image-preview": {
    shortLabel: "Nano Banana Pro",
  },
};

export const PROMPT_PRESETS = {
  product: {
    renderFocus: "product",
    styleDirection: "product shot limpo, luz controlada de estudio, acabamento premium",
    preserveDetails: "forma real do produto, proporções, materiais e identidade visual",
    extraInstructions: "fundo limpo, destaque claro do produto, reflexos suaves e nitidez comercial",
  },
  fashion: {
    renderFocus: "editorial",
    styleDirection: "editorial fashion, composicao sofisticada, luz direcional elegante",
    preserveDetails: "silhueta, materiais, styling e postura coerente",
    extraInstructions: "clima premium, fotografia refinada e tratamento visual de campanha",
  },
  lifestyle: {
    renderFocus: "lifestyle",
    styleDirection: "lifestyle natural, fotografia espontânea e calor humano",
    preserveDetails: "cena coerente, produto principal e contexto natural",
    extraInstructions: "ambiente crível, luz orgânica e atmosfera convidativa",
  },
  ads: {
    renderFocus: "advertising",
    styleDirection: "advertising high-end, impacto visual limpo e composição comercial",
    preserveDetails: "hierarquia visual do sujeito principal e leitura imediata",
    extraInstructions: "resultado polido, contraste controlado e acabamento pronto para campanha",
  },
  closeup: {
    renderFocus: "closeup",
    aspectRatio: "1:1",
    styleDirection: "macro close-up, detalhamento alto e foco preciso",
    preserveDetails: "texturas, contornos e pontos de interesse em primeiro plano",
    extraInstructions: "enquadramento fechado, profundidade de campo suave e definição elevada",
  },
  "portrait-post": {
    aspectRatio: "4:5",
    renderFocus: "editorial",
    styleDirection: "composição vertical para feed, leitura forte no centro e enquadramento elegante",
    preserveDetails: "sujeito principal dominante e área segura bem resolvida",
    extraInstructions: "resultado pensado para post retrato, com foco visual claro e bom aproveitamento vertical",
  },
  "story-reel": {
    aspectRatio: "9:16",
    renderFocus: "advertising",
    styleDirection: "composição vertical imersiva, impacto rápido e hierarquia visual objetiva",
    preserveDetails: "sujeito principal forte, enquadramento vertical e leitura limpa",
    extraInstructions: "resultado pensado para story ou reel, com área útil bem distribuída no eixo vertical",
  },
  banner: {
    aspectRatio: "16:9",
    renderFocus: "advertising",
    styleDirection: "composição horizontal ampla, visual limpo e respiro lateral",
    preserveDetails: "sujeito principal bem definido e estrutura ampla sem elementos apertados",
    extraInstructions: "resultado pensado para banner, hero ou capa horizontal com boa leitura panoramica",
  },
};

export const MAX_REFERENCE_IMAGES = 4;
export const CUSTOM_FOLDERS_STORAGE_KEY = "nano-banana-custom-folders";
export const COLLAPSED_SECTIONS_STORAGE_KEY = "nano-banana-collapsed-sections";
export const REGION_HANDLE_SIZE = 10;

export const selectedGalleryIds = new Set();
export const selectedCutoutIds = new Set();
export const selectedCropIds = new Set();
