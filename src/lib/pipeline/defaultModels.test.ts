import { describe, it, expect } from 'vitest';
import { DEFAULT_STAGE_MODELS, resolveModel } from './defaultModels';

describe('resolveModel', () => {
  it('returns the override when present', () => {
    expect(resolveModel('writer', { writer: 'openai/gpt-5.2' })).toBe('openai/gpt-5.2');
  });

  it('falls back to the default stage model when no override is given', () => {
    expect(resolveModel('writer', {})).toBe(DEFAULT_STAGE_MODELS.writer);
  });

  it('falls back to the default when overrides is undefined', () => {
    expect(resolveModel('theme', undefined)).toBe(DEFAULT_STAGE_MODELS.theme);
  });
});
