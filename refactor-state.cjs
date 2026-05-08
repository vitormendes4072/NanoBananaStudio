const fs = require('fs');
const path = require('path');

const mainFile = path.join(__dirname, 'src', 'main.js');
let code = fs.readFileSync(mainFile, 'utf8');

const stateVars = [
  'lastJobs',
  'lastCutouts',
  'lastCrops',
  'productModels',
  'imageTemplates',
  'cutoutProcessingJobId',
  'selectedReferenceFiles',
  'selectedProductModelFiles',
  'selectedImageTemplateFiles',
  'selectedBranchReference',
  'selectedRegionReference',
  'regionEditorState',
  'collapsedSections',
  'advancedPromptCollapsed'
];

// Replaces "let lastJobs = [];" with "state.lastJobs = [];" but wait, we need to create state object.
// Actually, it's easier to just replace all occurrences of these variables with state.xxx
// But we must be careful not to replace local variables with the same name.
// Fortunately, they are uniquely named in global scope.
// Let's do a regex replace for word boundaries.

let replacementsMade = false;

stateVars.forEach(v => {
  const regex = new RegExp(`\\b${v}\\b`, 'g');
  code = code.replace(regex, `state.${v}`);
  replacementsMade = true;
});

// Fix "let state.lastJobs = ... " to "state.lastJobs = ..."
code = code.replace(/let\s+state\./g, 'state.');
// In the global declaration block, they were like:
// state.lastJobs = [];
// This is valid if we initialize state before it.

const stateInit = `
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
  advancedPromptCollapsed: false
};
`;

code = stateInit + '\n' + code;

fs.writeFileSync(mainFile, code);
console.log('State variables refactored to state object.');
