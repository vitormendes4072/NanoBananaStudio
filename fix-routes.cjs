const fs = require('fs');

const filepath = 'server/routes.js';
let code = fs.readFileSync(filepath, 'utf8');

code = code.split('/api/state.').join('/api/');
code = code.split('/state.cutouts/').join('/cutouts/');
code = code.split('/state.crops/').join('/crops/');
code = code.split('state.concurrency,').join('concurrency: state.concurrency,');
code = code.split('state.cutouts,').join('cutouts: state.cutouts,');
code = code.split('state.crops,').join('crops: state.crops,');
code = code.split('Apenas state.jobs').join('Apenas jobs');
code = code.split('serveAssetFromDir(res, state.cutoutsDir,').join('serveAssetFromDir(res, cutoutsDir,');
code = code.split('serveAssetFromDir(res, state.cropsDir,').join('serveAssetFromDir(res, cropsDir,');

fs.writeFileSync(filepath, code);
console.log('Fixed routes errors using split/join.');
