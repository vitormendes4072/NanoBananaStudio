const fs = require('fs');

const files = ['server/utils.js', 'server/gemini.js', 'server/queue.js', 'server/backgroundRemoval.js', 'server/media.js', 'server/routes.js'];

const stateVars = [
  'jobs', 'cutouts', 'crops', 'productModels', 'imageTemplates',
  'jobsById', 'cutoutsById', 'cropsById', 'productModelsByAlias', 'imageTemplatesByAlias',
  'activeJobIds', 'backgroundRemovalInFlight', 'backgroundRemovalSourceJobId', 'queueState', 'concurrency'
];

for (const filepath of files) {
  if (fs.existsSync(filepath)) {
    let code = fs.readFileSync(filepath, 'utf8');
    
    stateVars.forEach(v => {
      // Find variables that don't have . before them and are not followed by :
      const regex = new RegExp('([^\\\\.\\\\w]|^)' + v + '([^\\\\w:]|$)', 'g');
      
      // Need a loop because overlapping matches (like ' jobs jobs ') might fail with replace
      let newCode = code;
      let prevCode = '';
      while (newCode !== prevCode) {
         prevCode = newCode;
         newCode = newCode.replace(regex, (match, p1, p2) => {
            // Ignore if it's already state.v
            if (p1.endsWith('state.')) return match;
            // Ignore object keys like { jobs: [] } or jobs: ...
            if (p2.startsWith(':')) return match;
            return p1 + 'state.' + v + p2;
         });
      }
      code = newCode;
    });
    
    fs.writeFileSync(filepath, code);
  }
}
console.log('Fixed state prefixes using capture groups.');
