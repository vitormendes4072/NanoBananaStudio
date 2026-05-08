const fs = require('fs');

const files = ['utils.js', 'gemini.js', 'queue.js', 'backgroundRemoval.js', 'media.js', 'routes.js'];

const stateVars = [
  'jobs', 'cutouts', 'crops', 'productModels', 'imageTemplates',
  'jobsById', 'cutoutsById', 'cropsById', 'productModelsByAlias', 'imageTemplatesByAlias',
  'activeJobIds', 'backgroundRemovalInFlight', 'backgroundRemovalSourceJobId', 'queueState', 'concurrency'
];

for (const file of files) {
  const filepath = 'server/' + file;
  if (fs.existsSync(filepath)) {
    let code = fs.readFileSync(filepath, 'utf8');
    
    stateVars.forEach(v => {
      const regex = new RegExp('(?<!\\\\.|state\\\\.)\\\\b' + v + '\\\\b(?!\\\\s*:)', 'g');
      code = code.replace(regex, 'state.' + v);
    });
    
    fs.writeFileSync(filepath, code);
  }
}
console.log('Fixed state prefixes.');
