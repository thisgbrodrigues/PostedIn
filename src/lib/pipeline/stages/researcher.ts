import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile, type Fact } from '../types';
import { tavilySearch } from '../../tavily';

const querySchema = z.object({ queries: z.array(z.string()).min(2).max(4) });

const factsSchema = z.object({
  facts: z.array(
    z.object({
      claim: z.string(),
      sources: z.array(z.object({ title: z.string(), url: z.string() })),
      confidence: z.enum(['high', 'low']),
    })
  ),
});

export interface ResearcherResult {
  facts: Fact[];
}

export async function runResearcher(input: { theme: string }, config: ConfigProfile): Promise<ResearcherResult> {
  try {
    const model = openrouter(resolveModel('research', config.modelOverrides));

    const { object: plan } = await generateObject({
      model,
      schema: querySchema,
      prompt: `Planeje de 2 a 4 buscas na web para reunir dados, exemplos e estatísticas reais sobre o tema: "${input.theme}". Cada busca deve ser uma query curta e específica.`,
    });

    const searchResults = await Promise.all(plan.queries.map((query) => tavilySearch(query)));
    const flatResults = searchResults.flat();

    const { object } = await generateObject({
      model,
      schema: factsSchema,
      prompt: `Com base nestes resultados de busca:\n${JSON.stringify(flatResults)}\n\nExtraia de 3 a 6 fatos, dados ou estatísticas relevantes sobre "${input.theme}". Para cada fato, cite a(s) fonte(s) (título e url) usadas. Se não houver uma fonte confiável para sustentar uma alegação, marque confidence como "low"; caso contrário, "high".`,
    });

    return object;
  } catch (cause) {
    throw new StageError('research', cause);
  }
}
