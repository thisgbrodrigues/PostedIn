import { describe, it, expect } from 'vitest';
import { StageError } from './types';

describe('StageError', () => {
  it('formats the message using the cause error message', () => {
    const error = new StageError('writer', new Error('rate limited'));

    expect(error.message).toBe('Stage "writer" failed: rate limited');
    expect(error.stage).toBe('writer');
    expect(error.executionId).toBeUndefined();
  });

  it('formats the message using String(cause) when cause is not an Error', () => {
    const error = new StageError('hook', 'timeout');

    expect(error.message).toBe('Stage "hook" failed: timeout');
  });
});
