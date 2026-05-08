const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server.js');
let code = fs.readFileSync(serverFile, 'utf8');

// Extrair utilitarios que não dependem do state
// normalizePromptOptions, normalizeJobError, buildJobId, buildBatchId...

const stateFile = path.join(__dirname, 'server', 'state.js');
const stateContent = `
import fs from "fs";
import { 
  queueStatePath, cutoutStatePath, cropStatePath, 
  productModelStatePath, imageTemplateStatePath 
} from "./config.js";

export const state = {
  queueState: { lastJobId: 0, lastBatchId: 0 },
  jobs: [],
  cutouts: [],
  crops: [],
  productModels: [],
  imageTemplates: [],
  jobsById: new Map(),
  cutoutsById: new Map(),
  cropsById: new Map(),
  productModelsByAlias: new Map(),
  imageTemplatesByAlias: new Map(),
  activeJobIds: new Set(),
  backgroundRemovalInFlight: false,
  backgroundRemovalSourceJobId: null,
};

export async function loadState() {
  loadQueueState();
  loadCutoutState();
  loadCropState();
  loadProductModelState();
  loadImageTemplateState();
}

export function loadQueueState() {
  try {
    if (fs.existsSync(queueStatePath)) {
      const data = JSON.parse(fs.readFileSync(queueStatePath, "utf8"));
      if (data.jobs && Array.isArray(data.jobs)) {
        state.jobs = data.jobs;
        state.queueState.lastJobId = data.lastJobId || 0;
        state.queueState.lastBatchId = data.lastBatchId || 0;
        state.jobsById.clear();
        for (const job of state.jobs) {
          state.jobsById.set(job.id, job);
          if (job.status === "processing" || job.status === "pending") {
            job.status = "pending";
          }
        }
        console.log(\`Carregados \${state.jobs.length} jobs da fila.\`);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar estado da fila:", error);
  }
}

export function persistQueueState() {
  try {
    const data = {
      lastJobId: state.queueState.lastJobId,
      lastBatchId: state.queueState.lastBatchId,
      jobs: state.jobs,
    };
    fs.writeFileSync(queueStatePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Erro ao salvar estado da fila:", error);
  }
}

export function loadCutoutState() {
  try {
    if (fs.existsSync(cutoutStatePath)) {
      const data = JSON.parse(fs.readFileSync(cutoutStatePath, "utf8"));
      if (data.cutouts && Array.isArray(data.cutouts)) {
        state.cutouts = data.cutouts;
        state.cutoutsById.clear();
        for (const cutout of state.cutouts) {
          state.cutoutsById.set(cutout.id, cutout);
        }
        console.log(\`Carregados \${state.cutouts.length} recortes de fundo.\`);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar estado de recortes:", error);
  }
}

export function persistCutoutState() {
  try {
    const data = { cutouts: state.cutouts };
    fs.writeFileSync(cutoutStatePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Erro ao salvar estado de recortes:", error);
  }
}

export function loadCropState() {
  try {
    if (fs.existsSync(cropStatePath)) {
      const data = JSON.parse(fs.readFileSync(cropStatePath, "utf8"));
      if (data.crops && Array.isArray(data.crops)) {
        state.crops = data.crops;
        state.cropsById.clear();
        for (const crop of state.crops) {
          state.cropsById.set(crop.id, crop);
        }
        console.log(\`Carregados \${state.crops.length} cortes (crops).\`);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar estado de cortes:", error);
  }
}

export function persistCropState() {
  try {
    const data = { crops: state.crops };
    fs.writeFileSync(cropStatePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Erro ao salvar estado de cortes:", error);
  }
}

export function loadProductModelState() {
  try {
    if (fs.existsSync(productModelStatePath)) {
      const data = JSON.parse(fs.readFileSync(productModelStatePath, "utf8"));
      if (data.productModels && Array.isArray(data.productModels)) {
        state.productModels = data.productModels;
        state.productModelsByAlias.clear();
        for (const model of state.productModels) {
          state.productModelsByAlias.set(model.alias, model);
        }
        console.log(\`Carregados \${state.productModels.length} modelos de produto.\`);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar estado de modelos de produto:", error);
  }
}

export function persistProductModelState() {
  try {
    const data = { productModels: state.productModels };
    fs.writeFileSync(productModelStatePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Erro ao salvar estado de modelos de produto:", error);
  }
}

export function loadImageTemplateState() {
  try {
    if (fs.existsSync(imageTemplateStatePath)) {
      const data = JSON.parse(fs.readFileSync(imageTemplateStatePath, "utf8"));
      if (data.imageTemplates && Array.isArray(data.imageTemplates)) {
        state.imageTemplates = data.imageTemplates;
        state.imageTemplatesByAlias.clear();
        for (const template of state.imageTemplates) {
          state.imageTemplatesByAlias.set(template.alias, template);
        }
        console.log(\`Carregados \${state.imageTemplates.length} templates visuais.\`);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar estado de templates visuais:", error);
  }
}

export function persistImageTemplateState() {
  try {
    const data = { imageTemplates: state.imageTemplates };
    fs.writeFileSync(imageTemplateStatePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Erro ao salvar estado de templates visuais:", error);
  }
}
`;

fs.writeFileSync(stateFile, stateContent.trim());
console.log('Criado server/state.js');
