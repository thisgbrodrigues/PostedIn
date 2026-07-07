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

const baseInput = {
  thesis: 't',
  pov: 'p',
  facts: [],
  template: {},
  toneOfVoice: {},
  brandbook: null,
  structureExamples: [],
};

describe('runWriter', () => {
  it('returns the draft text from the model', async () => {
    vi.mocked(ai.generateText).mockResolvedValueOnce({
      text: 'Rascunho do post...',
    } as Awaited<ReturnType<typeof ai.generateText>>);

    const result = await runWriter(baseInput, baseConfig);

    expect(result.draft).toBe('Rascunho do post...');
  });

  it('includes the brandbook identity in the prompt when present', async () => {
    vi.mocked(ai.generateText).mockResolvedValueOnce({
      text: 'Rascunho',
    } as Awaited<ReturnType<typeof ai.generateText>>);

    await runWriter(
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

    const calls = vi.mocked(ai.generateText).mock.calls;
    const call = calls[calls.length - 1][0];
    expect(call.prompt).toContain('Ana Silva');
    expect(call.prompt).toContain('Transparência acima de tudo');
  });

  it('includes structure examples in the prompt when present', async () => {
    vi.mocked(ai.generateText).mockResolvedValueOnce({
      text: 'Rascunho',
    } as Awaited<ReturnType<typeof ai.generateText>>);

    await runWriter({ ...baseInput, structureExamples: ['# Título curto\n\n- ponto 1\n- ponto 2'] }, baseConfig);

    const calls = vi.mocked(ai.generateText).mock.calls;
    const call = calls[calls.length - 1][0];
    expect(call.prompt).toContain('ponto 1');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateText).mockRejectedValueOnce(new Error('overloaded'));

    await expect(runWriter(baseInput, baseConfig)).rejects.toThrow(StageError);
  });
});
