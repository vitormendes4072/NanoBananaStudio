const fs = require('fs');
const path = require('path');

const mainFile = path.join(__dirname, 'src', 'main.js');
const utilsFile = path.join(__dirname, 'src', 'utils.js');

let code = fs.readFileSync(mainFile, 'utf8');

const utilsToExtract = [
  'normalizeFolderValue',
  'formatDate',
  'formatRelativeDateTime',
  'formatBytes',
  'buildVersionLabel',
  'modelLabel',
  'escapeHtml',
  'fileToBase64',
  'base64ToFile',
  'arrayBufferToBase64',
  'slugifyProductModelAlias',
  'slugifyImageTemplateAlias',
  'clamp'
];

let extractedCode = '';
let imports = [];

utilsToExtract.forEach(fnName => {
  // Regex to match function declaration and its body
  // Assumes functions are well formatted with closing brace at the start of line
  const regex = new RegExp(`^function ${fnName}\\s*\\([^{]*\\)\\s*\\{[\\s\\S]*?\\n\\}`, 'm');
  const match = code.match(regex);
  if (match) {
    extractedCode += `export ${match[0]}\n\n`;
    code = code.replace(match[0], '');
    imports.push(fnName);
  } else {
    // Try async function
    const asyncRegex = new RegExp(`^async function ${fnName}\\s*\\([^{]*\\)\\s*\\{[\\s\\S]*?\\n\\}`, 'm');
    const asyncMatch = code.match(asyncRegex);
    if (asyncMatch) {
      extractedCode += `export ${asyncMatch[0]}\n\n`;
      code = code.replace(asyncMatch[0], '');
      imports.push(fnName);
    }
  }
});

if (imports.length > 0) {
  const importStatement = `import { ${imports.join(', ')} } from './utils.js';\n`;
  code = importStatement + code;
  fs.writeFileSync(mainFile, code);
  fs.writeFileSync(utilsFile, extractedCode);
  console.log('Extracted to utils.js:', imports.join(', '));
} else {
  console.log('Nothing extracted.');
}
