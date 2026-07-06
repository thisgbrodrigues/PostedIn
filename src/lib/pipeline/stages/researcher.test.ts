import { describe, it, expect, vi } from 'vitest';
import { runResearcher } from './researcher';
import { StageError, type ConfigProfile } from '../types';
import * as ai from 'ai';
import { tavilySearch } from '../../tavily';

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateObject: vi.fn() };
});
vi.mock('../../tavily');

const baseConfig: ConfigProfile = {
  id: 'cfg-1',
  name: 'Test',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

describe('runResearcher', () => {
  it('plans searches, calls Tavily for each query, and synthesizes facts with sources', async () => {
    vi.mocked(ai.generateObject)
      .mockResolvedValueOnce({
        object: { queries: ['observabilidade microsserviços 2026', 'custo de downtime devops'] },
      } as Awaited<ReturnType<typeof ai.generateObject>>)
      .mockResolvedValueOnce({
        object: {
          facts: [
            {
              claim: 'Downtime custa em média X por hora para times pequenos',
              sources: [{ title: 'Fonte A', url: 'https://a.com' }],
              confidence: 'high',
            },
          ],
        },
      } as Awaited<ReturnType<typeof ai.generateObject>>);

    vi.mocked(tavilySearch).mockResolvedValue([{ title: 'Fonte A', url: 'https://a.com', content: 'conteúdo' }]);

    const result = await runResearcher({ theme: 'Observabilidade' }, baseConfig);

    expect(tavilySearch).toHaveBeenCalledTimes(2);
    expect(result.facts[0].confidence).toBe('high');
    expect(result.facts[0].sources[0].url).toBe('https://a.com');
  });

  it('throws a StageError when the search tool fails', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { queries: ['q1', 'q2'] },
    } as Awaited<ReturnType<typeof ai.generateObject>>);
    vi.mocked(tavilySearch).mockRejectedValue(new Error('network error'));

    await expect(runResearcher({ theme: 'Observabilidade' }, baseConfig)).rejects.toThrow(StageError);
  });
});
