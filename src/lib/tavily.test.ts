import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tavilySearch } from './tavily';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
  process.env = { ...originalEnv, TAVILY_API_KEY: 'test-key' };
});

afterEach(() => {
  process.env = originalEnv;
  global.fetch = originalFetch;
});

describe('tavilySearch', () => {
  it('returns mapped search results on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ title: 'A', url: 'https://a.com', content: 'texto' }] }),
    }) as unknown as typeof fetch;

    const results = await tavilySearch('observabilidade');

    expect(results).toEqual([{ title: 'A', url: 'https://a.com', content: 'texto' }]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when the response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(tavilySearch('observabilidade')).rejects.toThrow('Tavily search failed with status 500');
  });

  it('throws when TAVILY_API_KEY is missing', async () => {
    delete process.env.TAVILY_API_KEY;

    await expect(tavilySearch('observabilidade')).rejects.toThrow('TAVILY_API_KEY must be set');
  });
});
