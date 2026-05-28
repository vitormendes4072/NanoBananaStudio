import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickAllowedValue,
  sanitizeFileName,
  sanitizePathSegment,
  normalizeManagedRelativePath,
  normalizeLibraryFolder,
  badRequestError,
  notFoundError,
  normalizeProductModelAlias,
  normalizeImageTemplateAlias,
  normalizeConcurrency,
  normalizeQuantity,
  normalizeIdList,
  normalizeStringList,
  normalizePromptOptions,
  normalizeStoredReferenceImages,
  normalizeReferenceImages,
  normalizeBranchReference,
  normalizeCutoutSource,
  normalizeCropSource,
} from '../../server/utils/validation.js';

// ---------------------------------------------------------------------------
// pickAllowedValue
// ---------------------------------------------------------------------------
describe('pickAllowedValue', () => {
  it('returns value when it is in the allowed list', () => {
    assert.equal(pickAllowedValue('b', ['a', 'b', 'c'], 'a'), 'b');
  });

  it('returns fallback when value is not in the allowed list', () => {
    assert.equal(pickAllowedValue('z', ['a', 'b', 'c'], 'a'), 'a');
  });

  it('returns fallback for undefined', () => {
    assert.equal(pickAllowedValue(undefined, ['a', 'b'], 'a'), 'a');
  });
});

// ---------------------------------------------------------------------------
// sanitizeFileName
// ---------------------------------------------------------------------------
describe('sanitizeFileName', () => {
  it('replaces disallowed characters with dashes', () => {
    // '!' becomes '-', then trailing dash is stripped by the second replace
    assert.equal(sanitizeFileName('hello world!'), 'hello-world');
  });

  it('trims leading and trailing dashes', () => {
    assert.equal(sanitizeFileName('---foo---'), 'foo');
  });

  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(100);
    assert.equal(sanitizeFileName(long).length, 80);
  });

  it('returns "referencia" for an empty string', () => {
    assert.equal(sanitizeFileName(''), 'referencia');
  });

  it('allows dots and underscores', () => {
    assert.equal(sanitizeFileName('my_file.png'), 'my_file.png');
  });
});

// ---------------------------------------------------------------------------
// sanitizePathSegment
// ---------------------------------------------------------------------------
describe('sanitizePathSegment', () => {
  it('strips forbidden characters', () => {
    assert.equal(sanitizePathSegment('foo<bar>baz'), 'foobarbaz');
  });

  it('strips control characters', () => {
    assert.equal(sanitizePathSegment('ab\x00cd\x1Fef'), 'abcdef');
  });

  it('trims surrounding whitespace', () => {
    assert.equal(sanitizePathSegment('  hello  '), 'hello');
  });

  it('allows normal alphanumeric and spaces inside', () => {
    assert.equal(sanitizePathSegment('produtos 2024'), 'produtos 2024');
  });
});

// ---------------------------------------------------------------------------
// normalizeManagedRelativePath
// ---------------------------------------------------------------------------
describe('normalizeManagedRelativePath', () => {
  it('returns empty string for null', () => {
    assert.equal(normalizeManagedRelativePath(null), '');
  });

  it('returns empty string for undefined', () => {
    assert.equal(normalizeManagedRelativePath(undefined), '');
  });

  it('normalizes backslashes to forward slashes', () => {
    assert.equal(normalizeManagedRelativePath('folder\\file.png'), 'folder/file.png');
  });

  it('strips .. traversal segments', () => {
    assert.equal(normalizeManagedRelativePath('../etc/passwd'), 'etc/passwd');
  });

  it('strips . segments', () => {
    assert.equal(normalizeManagedRelativePath('./foo/./bar.png'), 'foo/bar.png');
  });

  it('sanitizes the last segment as a filename', () => {
    // special chars in filename part get replaced with dash
    assert.equal(normalizeManagedRelativePath('pasta/meu arquivo!.png'), 'pasta/meu-arquivo-.png');
  });

  it('returns empty string when all segments are filtered out', () => {
    assert.equal(normalizeManagedRelativePath('../../..'), '');
  });
});

// ---------------------------------------------------------------------------
// normalizeLibraryFolder
// ---------------------------------------------------------------------------
describe('normalizeLibraryFolder', () => {
  it('returns empty string for null', () => {
    assert.equal(normalizeLibraryFolder(null), '');
  });

  it('returns empty string for undefined', () => {
    assert.equal(normalizeLibraryFolder(undefined), '');
  });

  it('strips file extension from the final segment', () => {
    assert.equal(normalizeLibraryFolder('pastas/campanha.json'), 'pastas/campanha');
  });

  it('truncates to 120 characters', () => {
    const long = 'a'.repeat(130);
    assert.ok(normalizeLibraryFolder(long).length <= 120);
  });

  it('returns a plain folder name unchanged', () => {
    assert.equal(normalizeLibraryFolder('campanha-verao'), 'campanha-verao');
  });
});

// ---------------------------------------------------------------------------
// badRequestError / notFoundError
// ---------------------------------------------------------------------------
describe('badRequestError', () => {
  it('creates an Error with statusCode 400', () => {
    const err = badRequestError('campo obrigatório');
    assert.ok(err instanceof Error);
    assert.equal(err.message, 'campo obrigatório');
    assert.equal(err.statusCode, 400);
  });
});

describe('notFoundError', () => {
  it('creates an Error with statusCode 404', () => {
    const err = notFoundError('não encontrado');
    assert.ok(err instanceof Error);
    assert.equal(err.message, 'não encontrado');
    assert.equal(err.statusCode, 404);
  });
});

// ---------------------------------------------------------------------------
// normalizeProductModelAlias
// ---------------------------------------------------------------------------
describe('normalizeProductModelAlias', () => {
  it('lowercases and strips diacritics', () => {
    assert.equal(normalizeProductModelAlias('Tênis'), 'tenis');
  });

  it('strips leading @ sign', () => {
    assert.equal(normalizeProductModelAlias('@meu-modelo'), 'meu-modelo');
  });

  it('replaces spaces and special chars with dashes', () => {
    assert.equal(normalizeProductModelAlias('meu modelo 2024'), 'meu-modelo-2024');
  });

  it('collapses consecutive dashes', () => {
    assert.equal(normalizeProductModelAlias('foo--bar'), 'foo-bar');
  });

  it('strips leading and trailing dashes', () => {
    assert.equal(normalizeProductModelAlias('-foo-'), 'foo');
  });

  it('truncates to 40 characters', () => {
    const long = 'a'.repeat(50);
    assert.equal(normalizeProductModelAlias(long).length, 40);
  });

  it('returns empty string for empty input', () => {
    assert.equal(normalizeProductModelAlias(''), '');
  });
});

// ---------------------------------------------------------------------------
// normalizeImageTemplateAlias
// ---------------------------------------------------------------------------
describe('normalizeImageTemplateAlias', () => {
  it('strips leading # sign', () => {
    assert.equal(normalizeImageTemplateAlias('#meu-template'), 'meu-template');
  });

  it('lowercases and normalizes', () => {
    assert.equal(normalizeImageTemplateAlias('Fundo Branco'), 'fundo-branco');
  });

  it('truncates to 40 characters', () => {
    const long = 'b'.repeat(50);
    assert.equal(normalizeImageTemplateAlias(long).length, 40);
  });
});

// ---------------------------------------------------------------------------
// normalizeConcurrency
// ---------------------------------------------------------------------------
describe('normalizeConcurrency', () => {
  it('returns 1 for non-numeric input', () => {
    assert.equal(normalizeConcurrency('abc'), 1);
  });

  it('clamps below minimum to 1', () => {
    assert.equal(normalizeConcurrency(0), 1);
  });

  it('clamps above maximum to 5', () => {
    assert.equal(normalizeConcurrency(99), 5);
  });

  it('floors decimals', () => {
    assert.equal(normalizeConcurrency(2.9), 2);
  });

  it('accepts valid value in range', () => {
    assert.equal(normalizeConcurrency(3), 3);
  });
});

// ---------------------------------------------------------------------------
// normalizeQuantity
// ---------------------------------------------------------------------------
describe('normalizeQuantity', () => {
  it('returns 1 for non-numeric input', () => {
    assert.equal(normalizeQuantity(null), 1);
  });

  it('clamps below minimum to 1', () => {
    assert.equal(normalizeQuantity(-5), 1);
  });

  it('clamps above maximum to 8', () => {
    assert.equal(normalizeQuantity(100), 8);
  });

  it('floors decimals', () => {
    assert.equal(normalizeQuantity(3.7), 3);
  });
});

// ---------------------------------------------------------------------------
// normalizeIdList
// ---------------------------------------------------------------------------
describe('normalizeIdList', () => {
  it('returns empty array for non-array input', () => {
    assert.deepEqual(normalizeIdList('not-array'), []);
    assert.deepEqual(normalizeIdList(null), []);
  });

  it('filters out non-string entries', () => {
    assert.deepEqual(normalizeIdList([1, true, 'abc']), ['abc']);
  });

  it('filters out empty-string entries', () => {
    assert.deepEqual(normalizeIdList(['', '  ', 'abc']), ['abc']);
  });

  it('trims string entries', () => {
    assert.deepEqual(normalizeIdList(['  id-1  ']), ['id-1']);
  });
});

// ---------------------------------------------------------------------------
// normalizeStringList
// ---------------------------------------------------------------------------
describe('normalizeStringList', () => {
  it('returns empty array for non-array input', () => {
    assert.deepEqual(normalizeStringList(null), []);
  });

  it('applies the limit', () => {
    assert.equal(normalizeStringList(['a', 'b', 'c', 'd', 'e'], 3).length, 3);
  });

  it('truncates entries to maxLength', () => {
    const result = normalizeStringList(['a'.repeat(200)], 4, 50);
    assert.equal(result[0].length, 50);
  });

  it('collapses internal whitespace', () => {
    assert.deepEqual(normalizeStringList(['hello   world']), ['hello world']);
  });

  it('filters empty strings after trim', () => {
    assert.deepEqual(normalizeStringList(['  ']), []);
  });
});

// ---------------------------------------------------------------------------
// normalizePromptOptions
// ---------------------------------------------------------------------------
describe('normalizePromptOptions', () => {
  it('returns defaults for null input', () => {
    const defaults = normalizePromptOptions(null);
    assert.equal(defaults.promptStrength, 'balanced');
    assert.equal(defaults.aspectRatio, '1:1');
    assert.equal(defaults.negativePrompt, '');
  });

  it('falls back to default for disallowed promptStrength', () => {
    const result = normalizePromptOptions({ promptStrength: 'invalid' });
    assert.equal(result.promptStrength, 'balanced');
  });

  it('accepts valid promptStrength', () => {
    const result = normalizePromptOptions({ promptStrength: 'strong' });
    assert.equal(result.promptStrength, 'strong');
  });

  it('falls back to default for disallowed aspectRatio', () => {
    const result = normalizePromptOptions({ aspectRatio: '7:3' });
    assert.equal(result.aspectRatio, '1:1');
  });

  it('truncates negativePrompt to 600 chars', () => {
    const result = normalizePromptOptions({ negativePrompt: 'x'.repeat(700) });
    assert.equal(result.negativePrompt.length, 600);
  });

  it('accepts valid renderFocus', () => {
    const result = normalizePromptOptions({ renderFocus: 'product' });
    assert.equal(result.renderFocus, 'product');
  });
});

// ---------------------------------------------------------------------------
// normalizeStoredReferenceImages
// ---------------------------------------------------------------------------
describe('normalizeStoredReferenceImages', () => {
  it('returns empty array for non-array input', () => {
    assert.deepEqual(normalizeStoredReferenceImages(null), []);
  });

  it('filters entries without a valid relativePath', () => {
    const result = normalizeStoredReferenceImages([{ id: '1', relativePath: '' }]);
    assert.deepEqual(result, []);
  });

  it('normalizes a valid entry', () => {
    const result = normalizeStoredReferenceImages([
      {
        id: 'ref-1',
        name: 'foto.png',
        mimeType: 'image/png',
        size: 1000,
        relativePath: 'refs/foto.png',
      },
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].relativePath, 'refs/foto.png');
    assert.equal(result[0].mimeType, 'image/png');
  });

  it('generates an id when one is missing', () => {
    const result = normalizeStoredReferenceImages([
      { name: 'x.png', mimeType: 'image/png', size: 1, relativePath: 'refs/x.png' },
    ]);
    assert.ok(typeof result[0].id === 'string' && result[0].id.length > 0);
  });
});

// ---------------------------------------------------------------------------
// normalizeReferenceImages
// ---------------------------------------------------------------------------

const VALID_BASE64_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

describe('normalizeReferenceImages', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(normalizeReferenceImages([]), []);
  });

  it('throws when more than maxReferenceImages are sent', () => {
    const tooMany = Array.from({ length: 5 }, (_, i) => ({
      name: `img${i}.png`,
      mimeType: 'image/png',
      data: VALID_BASE64_PNG,
    }));
    assert.throws(() => normalizeReferenceImages(tooMany), { statusCode: 400 });
  });

  it('throws for disallowed mime type', () => {
    assert.throws(
      () =>
        normalizeReferenceImages([
          { name: 'f.gif', mimeType: 'image/gif', data: VALID_BASE64_PNG },
        ]),
      { statusCode: 400 }
    );
  });

  it('throws when data is missing', () => {
    assert.throws(
      () => normalizeReferenceImages([{ name: 'f.png', mimeType: 'image/png', data: '' }]),
      { statusCode: 400 }
    );
  });

  it('throws when buffer exceeds size limit', () => {
    const bigData = Buffer.alloc(16 * 1024 * 1024).toString('base64'); // 16 MB
    assert.throws(
      () => normalizeReferenceImages([{ name: 'f.png', mimeType: 'image/png', data: bigData }]),
      { statusCode: 400 }
    );
  });

  it('returns normalized entry for a valid image', () => {
    const result = normalizeReferenceImages([
      { name: 'foto.png', mimeType: 'image/png', data: VALID_BASE64_PNG },
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].mimeType, 'image/png');
    assert.ok(result[0].id.startsWith('ref_'));
    assert.ok(Buffer.isBuffer(result[0].buffer));
  });
});

// ---------------------------------------------------------------------------
// normalizeBranchReference
// ---------------------------------------------------------------------------
describe('normalizeBranchReference', () => {
  it('returns null for null input', () => {
    assert.equal(normalizeBranchReference(null), null);
  });

  it('throws when imageUrl is missing', () => {
    assert.throws(() => normalizeBranchReference({ imageUrl: '' }), { statusCode: 400 });
  });

  it('returns normalized object for valid input', () => {
    const result = normalizeBranchReference({
      imageUrl: '/generated/foto.png',
      filename: 'foto.png',
      jobId: 'job-1',
    });
    assert.equal(result.imageUrl, '/generated/foto.png');
    assert.equal(result.filename, 'foto.png');
    assert.equal(result.sourceJobId, 'job-1');
  });
});

// ---------------------------------------------------------------------------
// normalizeCutoutSource
// ---------------------------------------------------------------------------
describe('normalizeCutoutSource', () => {
  it('throws for null input', () => {
    assert.throws(() => normalizeCutoutSource(null), { statusCode: 400 });
  });

  it('throws when imageUrl is empty', () => {
    assert.throws(() => normalizeCutoutSource({ imageUrl: '', filename: 'x.png' }), {
      statusCode: 400,
    });
  });

  it('returns normalized object for valid input', () => {
    const result = normalizeCutoutSource({
      imageUrl: '/data/cutouts/x.png',
      filename: 'x.png',
      label: 'Meu recorte',
      jobId: 'job-2',
    });
    assert.equal(result.imageUrl, '/data/cutouts/x.png');
    assert.equal(result.label, 'Meu recorte');
  });
});

// ---------------------------------------------------------------------------
// normalizeCropSource
// ---------------------------------------------------------------------------
describe('normalizeCropSource', () => {
  it('throws for null input', () => {
    assert.throws(() => normalizeCropSource(null), { statusCode: 400 });
  });

  it('throws for non-PNG mime type', () => {
    assert.throws(() => normalizeCropSource({ mimeType: 'image/jpeg', data: VALID_BASE64_PNG }), {
      statusCode: 400,
    });
  });

  it('throws when data is empty', () => {
    assert.throws(() => normalizeCropSource({ mimeType: 'image/png', data: '' }), {
      statusCode: 400,
    });
  });

  it('throws when buffer exceeds size limit', () => {
    const bigData = Buffer.alloc(16 * 1024 * 1024).toString('base64');
    assert.throws(() => normalizeCropSource({ mimeType: 'image/png', data: bigData }), {
      statusCode: 400,
    });
  });

  it('returns normalized object for valid PNG crop', () => {
    const result = normalizeCropSource({
      label: 'Detalhe',
      mimeType: 'image/png',
      data: VALID_BASE64_PNG,
      sourceImageUrl: '/generated/base.png',
      jobId: 'job-3',
    });
    assert.equal(result.label, 'Detalhe');
    assert.equal(result.mimeType, 'image/png');
    assert.ok(Buffer.isBuffer(result.buffer));
  });
});
