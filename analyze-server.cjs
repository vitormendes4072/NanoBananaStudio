const fs = require('fs');

const code = fs.readFileSync('server.js', 'utf8');

const lines = code.split('\n');
const globals = [];
const functions = [];

lines.forEach((line) => {
  if (line.match(/^(const|let) ([a-zA-Z0-9_]+) =/)) {
    const match = line.match(/^(const|let) ([a-zA-Z0-9_]+) =/);
    globals.push(match[2]);
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
