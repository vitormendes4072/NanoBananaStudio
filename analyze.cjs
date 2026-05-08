const fs = require('fs');
const code = fs.readFileSync('public/app.js', 'utf8');

const lines = code.split('\n');
const globals = [];
const functions = [];

lines.forEach((line, i) => {
  if (line.startsWith('const ') && line.includes('document.querySelector')) {
    globals.push(line.split('=')[0].replace('const ', '').trim());
  } else if (line.startsWith('let ')) {
    globals.push(line.split('=')[0].replace('let ', '').trim());
  } else if (line.match(/^(async )?function ([a-zA-Z0-9_]+)/)) {
    const match = line.match(/^(async )?function ([a-zA-Z0-9_]+)/);
    functions.push(match[2]);
  }
});

console.log('--- Globals ---');
console.log(globals.join(', '));
console.log('\n--- Functions ---');
console.log(functions.join(', '));
console.log(`\nTotal globals: ${globals.length}`);
console.log(`Total functions: ${functions.length}`);
