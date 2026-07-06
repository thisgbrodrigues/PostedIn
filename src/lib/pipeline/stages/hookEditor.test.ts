import { describe, it, expect, vi } from 'vitest';
import { runHookEditor } from './hookEditor';
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

describe('runHookEditor', () => {
  it('returns the final post and hook variations', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { finalPost: 'Gancho novo\n\nResto do post...', hookVariations: ['Gancho A', 'Gancho B'] },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    const result = await runHookEditor({ draft: 'Gancho velho\n\nResto do post...' }, baseConfig);

    expect(result.hookVariations).toHaveLength(2);
    expect(result.finalPost).toBe('Gancho novo\n\nResto do post...');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateObject).mockRejectedValueOnce(new Error('bad request'));

    await expect(runHookEditor({ draft: 'x' }, baseConfig)).rejects.toThrow(StageError);
  });
});
