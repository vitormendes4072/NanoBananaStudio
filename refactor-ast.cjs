const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync('server.js', 'utf8');

// Instead of escodegen, we can just slice the original code using node.start and node.end
// This preserves all comments, formatting, and avoids AST generator quirks.

const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });

const functionMap = new Map();
let createServerBody = '';

ast.body.forEach(node => {
  if (node.type === 'FunctionDeclaration') {
    const fnName = node.id.name;
    const fnCode = code.slice(node.start, node.end);
    functionMap.set(fnName, fnCode);
  }
  
  if (node.type === 'VariableDeclaration') {
    node.declarations.forEach(decl => {
      if (decl.id.name === 'server' && decl.init && decl.init.callee && decl.init.callee.property && decl.init.callee.property.name === 'createServer') {
        const callback = decl.init.arguments[0];
        // callback is an ArrowFunctionExpression or FunctionExpression
        if (callback.body.type === 'BlockStatement') {
          // get the inside of the block
          createServerBody = code.slice(callback.body.start + 1, callback.body.end - 1);
        }
      }
    });
  }
});

// Define groupings
const groups = {
  gemini: ['generateImage'],
  queue: ['createJob', 'processQueue', 'runJob', 'deleteJob', 'trimJobs', 'deleteGalleryJobsBulk', 'deleteCutoutsBulk', 'deleteCropsBulk', 'deleteLibraryBulk'],
  backgroundRemoval: ['runBackgroundRemoval', 'removeBackgroundFromReferenceImage'],
  media: ['createBranchReference', 'createCutout', 'createCrop', 'trimCutouts', 'trimCrops', 'deleteCutout', 'deleteCrop', 'assignLibraryFolder', 'upsertProductModel', 'upsertImageTemplate', 'deleteProductModel', 'deleteImageTemplate'],
  utils: [
    'buildImageName', 'serializeJob', 'normalizePromptOptions', 'normalizeJobError', 'buildJobId', 'buildBatchId',
    'cleanupReferenceFilesForJobs', 'normalizeConcurrency', 'normalizeQuantity', 'normalizeReferenceImages',
    'normalizeReferenceUploadForProcessing', 'normalizeBranchReference', 'normalizeCutoutSource', 'normalizeCropSource',
    'storeReferenceImages', 'normalizeIdList', 'normalizeLibraryFolder', 'removeFileIfPresent', 'buildReferenceParts',
    'serializeReferenceImages', 'normalizeStoredReferenceImages', 'normalizeProductModelAlias', 'normalizeImageTemplateAlias',
    'normalizeJobProductModels', 'normalizeJobImageTemplates', 'buildJobProductModelMeta', 'buildJobImageTemplateMeta',
    'serializeProductModel', 'serializeImageTemplate', 'resolveProductModelsByAlias', 'resolveImageTemplatesByAlias',
    'normalizeProductModelEvaluation', 'normalizeStringList', 'evaluateProductModelQuality', 'evaluateProductModelWithGemini',
    'buildHeuristicProductModelEvaluation', 'parseJsonObject', 'cleanupReferenceImageFiles', 'buildUsageSummary',
    'mimeTypeToExtension', 'sanitizeFileName', 'classifyGeminiError', 'extractQuotaModel', 'extractRetrySeconds',
    'pickAllowedValue', 'sendJson', 'readJsonBody', 'serveFile', 'serveAssetFromDir', 'loadDotEnv', 'badRequestError',
    'notFoundError', 'resolveReferenceAbsolutePath', 'resolveImageSourcePath', 'hydrateLegacyReferenceFiles',
    'hydrateManagedMediaState', 'normalizeMediaRecordState', 'inferAssetTypeFromBaseDir', 'extractCustomFolderFromRelativePath',
    'moveMediaRecordToFolder', 'buildManagedAssetRelativePath', 'normalizeManagedRelativePath', 'sanitizePathSegment',
    'resolveManagedAssetPath', 'resolveManagedAssetWritePath', 'buildAssetUrl', 'extractRelativeAssetPath', 'resolveAssetPathFromRequest'
  ]
};

// We will write these to temporary files so we can combine them into the new modules.
// However, since we need to add imports manually, I will just dump the functions into files with `export` added.

function exportFunctions(groupName) {
  let fileCode = '';
  const fns = groups[groupName];
  fns.forEach(fnName => {
    if (functionMap.has(fnName)) {
      let fnStr = functionMap.get(fnName);
      // add export if not present
      if (!fnStr.startsWith('export ')) {
        // handle async function or function
        fnStr = fnStr.replace(/^(async\s+)?function/, 'export $1function');
      }
      fileCode += fnStr + '\\n\\n';
    }
  });
  fs.writeFileSync('server/' + groupName + '.raw.js', fileCode);
}

Object.keys(groups).forEach(exportFunctions);

fs.writeFileSync('server/routes.raw.js', createServerBody);

console.log('Extração concluída com AST.');
