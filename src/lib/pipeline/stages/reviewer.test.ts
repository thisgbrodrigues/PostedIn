import { describe, it, expect, vi } from 'vitest';
import { runReviewer } from './reviewer';
import { StageError, type ConfigProfile } from '../types';
import * as ai from 'ai';

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateObject: vi.fn() };
});

const baseConfig: ConfigProfile = {
  id: 'cfg-1',
  name: 'Test',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

describe('runReviewer', () => {
  it('returns the reviewed post with notes and a passed flag', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { finalPost: 'Post revisado', notes: ['Cortado trecho redundante'], passed: true },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    const result = await runReviewer(
      { finalPost: 'Post original', objective: 'gerar autoridade', toneOfVoice: {} },
      baseConfig
    );

    expect(result.passed).toBe(true);
    expect(result.finalPost).toBe('Post revisado');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateObject).mockRejectedValueOnce(new Error('invalid schema'));

    await expect(
      runReviewer({ finalPost: 'x', objective: 'gerar autoridade', toneOfVoice: {} }, baseConfig)
    ).rejects.toThrow(StageError);
  });
});
