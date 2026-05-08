const fs = require('fs');
const path = require('path');

const mainFile = path.join(__dirname, 'src', 'main.js');
const domFile = path.join(__dirname, 'src', 'dom.js');

let code = fs.readFileSync(mainFile, 'utf8');

const domRegex = /const\s+([a-zA-Z0-9_]+)\s*=\s*document\.querySelector\([^)]+\);/g;
let match;
let domElements = [];
let extractedCode = '';

while ((match = domRegex.exec(code)) !== null) {
  domElements.push(match[1]);
  extractedCode += `export ${match[0]}\n`;
}

if (domElements.length > 0) {
  // Remove them from main.js
  code = code.replace(domRegex, '');

  // Add import to main.js
  const importStatement = `import {\n  ${domElements.join(',\n  ')}\n} from './dom.js';\n`;
  
  // ensure we insert after other imports
  // find last import
  const lastImportIndex = code.lastIndexOf("from './");
  if (lastImportIndex !== -1) {
    const endOfImport = code.indexOf('\n', lastImportIndex);
    code = code.slice(0, endOfImport + 1) + importStatement + code.slice(endOfImport + 1);
  } else {
    code = importStatement + code;
  }

  fs.writeFileSync(mainFile, code);
  fs.writeFileSync(domFile, extractedCode);
  console.log(`Extracted ${domElements.length} DOM elements to dom.js.`);
} else {
  console.log('No DOM elements found.');
}
