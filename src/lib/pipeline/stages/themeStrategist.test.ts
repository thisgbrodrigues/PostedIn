import { describe, it, expect, vi } from 'vitest';
import { runThemeStrategist } from './themeStrategist';
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

describe('runThemeStrategist', () => {
  it('returns the given theme without calling the LLM when a theme is provided', async () => {
    const result = await runThemeStrategist(
      { theme: 'CI/CD para times pequenos', niche: 'devops', objective: 'gerar autoridade' },
      baseConfig
    );

    expect(result.theme).toBe('CI/CD para times pequenos');
    expect(ai.generateObject).not.toHaveBeenCalled();
  });

  it('generates a theme from niche and objective when no theme is provided', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { theme: 'Observabilidade em microsserviços', rationale: 'É uma dor comum no nicho.' },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    const result = await runThemeStrategist({ niche: 'devops', objective: 'gerar autoridade' }, baseConfig);

    expect(result.theme).toBe('Observabilidade em microsserviços');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateObject).mockRejectedValueOnce(new Error('rate limited'));

    await expect(
      runThemeStrategist({ niche: 'devops', objective: 'gerar autoridade' }, baseConfig)
    ).rejects.toThrow(StageError);
  });
});
