import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile } from '../types';

// Array length constraints (minItems/maxItems) are intentionally omitted: some
// OpenRouter-routed backends (e.g. Azure/OpenAI strict structured output) reject
// `minItems`/`maxItems` > 1. The desired count is requested in the prompt instead.
const hookSchema = z.object({
  finalPost: z.string(),
  hookVariations: z.array(z.string()),
});

export interface HookEditorResult {
  finalPost: string;
  hookVariations: string[];
}

export async function runHookEditor(input: { draft: string }, config: ConfigProfile): Promise<HookEditorResult> {
  try {
    const { object } = await generateObject({
      model: openrouter(resolveModel('hook', config.modelOverrides)),
      schema: hookSchema,
      prompt: `Este é o rascunho de um post de LinkedIn:\n\n${input.draft}\n\nReescreva SOMENTE as 2-3 primeiras linhas (o gancho), mantendo o resto do post idêntico, para maximizar o "ver mais" no feed. Retorne o post completo com o novo gancho em "finalPost", e gere de 2 a 3 variações alternativas do gancho em "hookVariations" (só as primeiras linhas de cada variação, não o post inteiro).`,
    });
    return object;
  } catch (cause) {
    throw new StageError('hook', cause);
  }
}
