export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
}

export async function tavilySearch(query: string): Promise<TavilySearchResult[]> {
  const apiKey = process.env.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;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY must be set');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 5 }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  const data = await response.json();
  return (data.results ?? []).map((result: { title: string; url: string; content: string }) => ({
    title: result.title,
    url: result.url,
    content: result.content,
  }));
}
