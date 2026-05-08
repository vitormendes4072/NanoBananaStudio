const fs = require('fs');

const files = ['utils.js', 'gemini.js', 'queue.js', 'backgroundRemoval.js', 'media.js'];

for (const file of files) {
  const filepath = 'server/' + file;
  if (fs.existsSync(filepath)) {
    let code = fs.readFileSync(filepath, 'utf8');
    // Replace literal '\n' and '\r' strings with actual newlines
    code = code.replace(/\\n/g, '\n');
    fs.writeFileSync(filepath, code);
  }
}

// Check if routes.js has this issue
if (fs.existsSync('server/routes.js')) {
  let code = fs.readFileSync('server/routes.js', 'utf8');
  code = code.replace(/\\n/g, '\n');
  fs.writeFileSync('server/routes.js', code);
}
