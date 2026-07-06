import { describe, it, expect, vi } from 'vitest';
import { runWriter } from './writer';
import { StageError, type ConfigProfile } from '../types';
import * as ai from 'ai';

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: vi.fn() };
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

describe('runWriter', () => {
  it('returns the draft text from the model', async () => {
    vi.mocked(ai.generateText).mockResolvedValueOnce({
      text: 'Rascunho do post...',
    } as Awaited<ReturnType<typeof ai.generateText>>);

    const result = await runWriter({ thesis: 't', pov: 'p', facts: [], template: {}, toneOfVoice: {} }, baseConfig);

    expect(result.draft).toBe('Rascunho do post...');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateText).mockRejectedValueOnce(new Error('overloaded'));

    await expect(
      runWriter({ thesis: 't', pov: 'p', facts: [], template: {}, toneOfVoice: {} }, baseConfig)
    ).rejects.toThrow(StageError);
  });
});
