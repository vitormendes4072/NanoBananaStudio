import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractQuotaModel,
  extractRetrySeconds,
  classifyGeminiError,
  buildHeuristicProductModelEvaluation,
} from '../../server/utils/cost.js';

// ---------------------------------------------------------------------------
// extractQuotaModel
// ---------------------------------------------------------------------------
describe('extractQuotaModel', () => {
  it('extracts model from a quota violation payload', () => {
    const parsed = {
      error: {
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [{ quotaDimensions: { model: 'imagen-3.0-generate-002' } }],
          },
        ],
      },
    };
    assert.equal(extractQuotaModel(parsed), 'imagen-3.0-generate-002');
  });

  it('returns null when details are missing', () => {
    assert.equal(extractQuotaModel({ error: {} }), null);
  });

  it('returns null for null input', () => {
    assert.equal(extractQuotaModel(null), null);
  });

  it('returns null when no QuotaFailure detail is present', () => {
    const parsed = {
      error: {
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '5s' }],
      },
    };
    assert.equal(extractQuotaModel(parsed), null);
  });
});

// ---------------------------------------------------------------------------
// extractRetrySeconds
// ---------------------------------------------------------------------------
describe('extractRetrySeconds', () => {
  it('extracts seconds from a retryDelay string', () => {
    const parsed = {
      error: {
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '30s',
          },
        ],
      },
    };
    assert.equal(extractRetrySeconds(parsed), 30);
  });

  it('returns null when RetryInfo is absent', () => {
    assert.equal(extractRetrySeconds({ error: { details: [] } }), null);
  });

  it('returns null for null input', () => {
    assert.equal(extractRetrySeconds(null), null);
  });

  it('returns null when retryDelay has no numeric part', () => {
    const parsed = {
      error: {
        details: [
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: 'unknown' },
        ],
      },
    };
    assert.equal(extractRetrySeconds(parsed), null);
  });
});

// ---------------------------------------------------------------------------
// classifyGeminiError
// ---------------------------------------------------------------------------
describe('classifyGeminiError', () => {
  it('classifies HTTP 429 as quota error', () => {
    const result = classifyGeminiError({}, 429);
    assert.equal(result.errorType, 'quota');
  });

  it('classifies HTTP 401 as auth error', () => {
    const result = classifyGeminiError({}, 401);
    assert.equal(result.errorType, 'auth');
  });

  it('classifies "quota exceeded" message as quota error (any status)', () => {
    const parsed = { error: { message: 'QUOTA EXCEEDED for this project.' } };
    const result = classifyGeminiError(parsed, 200);
    assert.equal(result.errorType, 'quota');
  });

  it('classifies "billing" in message as quota error', () => {
    const parsed = { error: { message: 'Billing not enabled for this project.' } };
    const result = classifyGeminiError(parsed, 403);
    assert.equal(result.errorType, 'quota');
  });

  it('classifies "api key" in message as auth error', () => {
    const parsed = { error: { message: 'API key not valid.' } };
    const result = classifyGeminiError(parsed, 400);
    assert.equal(result.errorType, 'auth');
  });

  it('classifies unknown errors as generic', () => {
    const parsed = { error: { message: 'Internal server error.' } };
    const result = classifyGeminiError(parsed, 500);
    assert.equal(result.errorType, 'generic');
  });

  it('includes retrySeconds guidance when RetryInfo is present', () => {
    const parsed = {
      error: {
        message: 'quota exceeded',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '60s',
          },
        ],
      },
    };
    const result = classifyGeminiError(parsed, 429);
    assert.ok(result.guidance.some((g) => g.includes('60')));
  });

  it('includes technical.statusCode in the result', () => {
    const result = classifyGeminiError({}, 503);
    assert.equal(result.technical.statusCode, 503);
  });
});

// ---------------------------------------------------------------------------
// buildHeuristicProductModelEvaluation
// ---------------------------------------------------------------------------
describe('buildHeuristicProductModelEvaluation', () => {
  it('returns insufficient status with base score 30 for empty model', () => {
    const result = buildHeuristicProductModelEvaluation({ referenceImages: [], notes: '' });
    assert.equal(result.status, 'insufficient');
    assert.equal(result.score, 30);
  });

  it('returns ready status with score >= 78 for well-covered model', () => {
    const refs = Array.from({ length: 4 }, (_, i) => ({ id: `r${i}` }));
    const result = buildHeuristicProductModelEvaluation({
      referenceImages: refs,
      notes: 'Tênis branco com solado azul, costuras visíveis, sem logotipo no lateral direito.',
    });
    assert.equal(result.status, 'ready');
    assert.ok(result.score >= 78);
  });

  it('returns improvable status for partial coverage (2 refs, no notes)', () => {
    const refs = [{ id: 'r1' }, { id: 'r2' }];
    const result = buildHeuristicProductModelEvaluation({ referenceImages: refs, notes: '' });
    assert.equal(result.status, 'improvable');
    assert.ok(result.score >= 52 && result.score < 78);
  });

  it('score is capped at 100', () => {
    const refs = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}` }));
    const result = buildHeuristicProductModelEvaluation({
      referenceImages: refs,
      notes: 'x'.repeat(200),
    });
    assert.ok(result.score <= 100);
  });

  it('includes missing and recommendedShots arrays', () => {
    const result = buildHeuristicProductModelEvaluation({ referenceImages: [], notes: '' });
    assert.ok(Array.isArray(result.missing));
    assert.ok(Array.isArray(result.recommendedShots));
  });

  it('includes strengths when refs are present', () => {
    const result = buildHeuristicProductModelEvaluation({
      referenceImages: [{ id: 'r1' }],
      notes: '',
    });
    assert.ok(result.strengths.length > 0);
  });

  it('sets method to "heuristic"', () => {
    const result = buildHeuristicProductModelEvaluation({ referenceImages: [], notes: '' });
    assert.equal(result.method, 'heuristic');
  });
});
