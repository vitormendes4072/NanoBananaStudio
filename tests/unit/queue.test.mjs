import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isRetryable } from '../../server/utils/retry.js';

// ---------------------------------------------------------------------------
// isRetryable
// ---------------------------------------------------------------------------
describe('isRetryable', () => {
  it('returns false for auth errors', () => {
    assert.equal(isRetryable({ errorType: 'auth' }), false);
  });

  it('returns false for quota errors', () => {
    assert.equal(isRetryable({ errorType: 'quota' }), false);
  });

  it('returns true for generic errors', () => {
    assert.equal(isRetryable({ errorType: 'generic' }), true);
  });

  it('returns true for plain Error objects (no errorType)', () => {
    assert.equal(isRetryable(new Error('network failure')), true);
  });

  it('returns true for null', () => {
    assert.equal(isRetryable(null), true);
  });

  it('returns true for undefined', () => {
    assert.equal(isRetryable(undefined), true);
  });
});
