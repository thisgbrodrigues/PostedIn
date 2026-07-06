import { describe, it, expect, vi } from 'vitest';
import { runAngleDefiner } from './angleDefiner';
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

describe('runAngleDefiner', () => {
  it('returns the thesis and pov from the model', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { thesis: 'Observabilidade é subestimada em times pequenos', pov: 'Times pequenos sofrem mais com isso' },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    const result = await runAngleDefiner({ theme: 'Observabilidade', facts: [] }, baseConfig);

    expect(result.thesis).toBe('Observabilidade é subestimada em times pequenos');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateObject).mockRejectedValueOnce(new Error('timeout'));

    await expect(runAngleDefiner({ theme: 'Observabilidade', facts: [] }, baseConfig)).rejects.toThrow(StageError);
  });
});
