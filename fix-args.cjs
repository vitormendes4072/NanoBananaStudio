const fs = require('fs');

const files = ['server/queue.js', 'server/media.js', 'server/utils.js', 'server/backgroundRemoval.js'];

for (const filepath of files) {
  if (fs.existsSync(filepath)) {
    let code = fs.readFileSync(filepath, 'utf8');
    
    // Fix function arguments
    code = code.replace(/state\.jobs = \[\]/g, 'jobs = []');
    code = code.replace(/state\.cutouts = \[\]/g, 'cutouts = []');
    code = code.replace(/state\.crops = \[\]/g, 'crops = []');
    code = code.replace(/state\.productModels = \[\]/g, 'productModels = []');
    code = code.replace(/state\.imageTemplates = \[\]/g, 'imageTemplates = []');
    
    fs.writeFileSync(filepath, code);
  }
}
console.log('Fixed function argument prefixes.');
