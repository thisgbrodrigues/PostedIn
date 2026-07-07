import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runReviewer } from './reviewer';
import { StageError, type ConfigProfile } from '../types';
import * as ai from 'ai';

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateObject: vi.fn() };
});

beforeEach(() => vi.clearAllMocks());

const baseConfig: ConfigProfile = {
  id: 'cfg-1',
  name: 'Test',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

const baseInput = {
  finalPost: 'Post original',
  objective: 'gerar autoridade',
  toneOfVoice: {},
  brandbook: null,
};

describe('runReviewer', () => {
  it('returns the reviewed post with notes and a passed flag', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { finalPost: 'Post revisado', notes: ['Cortado trecho redundante'], passed: true },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    const result = await runReviewer(baseInput, baseConfig);

    expect(result.passed).toBe(true);
    expect(result.finalPost).toBe('Post revisado');
  });

  it('includes the brandbook values in the prompt when present', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { finalPost: 'Post revisado', notes: [], passed: true },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    await runReviewer(
      {
        ...baseInput,
        brandbook: {
          id: 'bb-1',
          name: 'Ana Silva',
          role: 'Head de Engenharia',
          company: 'Acme',
          industry: 'devops',
          bio: 'Bio aqui',
          values: 'Transparência acima de tudo',
          voiceReferences: '#buildinpublic',
        },
      },
      baseConfig
    );

    const call = vi.mocked(ai.generateObject).mock.calls[0][0];
    expect(call.prompt).toContain('Transparência acima de tudo');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateObject).mockRejectedValueOnce(new Error('invalid schema'));

    await expect(runReviewer(baseInput, baseConfig)).rejects.toThrow(StageError);
  });
});
