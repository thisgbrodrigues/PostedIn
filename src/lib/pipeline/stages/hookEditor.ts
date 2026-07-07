import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile } from '../types';

// Array length constraints (minItems/maxItems) are intentionally omitted: some
// OpenRouter-routed backends (e.g. Azure/OpenAI strict structured output) reject
// `minItems`/`maxItems` > 1. The desired count is requested in the prompt instead.
const hookVariationsSchema = z.object({
  hookVariations: z.array(z.string()),
});

export interface HookEditorResult {
  finalPost: string;
  hookVariations: string[];
}

// Split into two calls rather than one generateObject call that echoes the
// full post back inside a JSON string: forcing the (potentially long, with
// line breaks/accents/quotes) post body through structured-output JSON is
// the most likely cause of "No object generated: could not parse the
// response" failures. generateText has no such parsing risk — it's the same
// approach already used reliably by the writer stage — and the structured
// call is kept tiny (just the hook variations array) to minimize risk there.
export async function runHookEditor(input: { draft: string }, config: ConfigProfile): Promise<HookEditorResult> {
  try {
    const model = openrouter(resolveModel('hook', config.modelOverrides));

    const { text: finalPost } = await generateText({
      model,
      prompt: `Este é o rascunho de um post de LinkedIn:\n\n${input.draft}\n\nReescreva SOMENTE as 2-3 primeiras linhas (o gancho), mantendo o resto do post idêntico, para maximizar o "ver mais" no feed. Retorne apenas o post completo com o novo gancho, sem título nem comentários.`,
    });

    const { object } = await generateObject({
      model,
      schema: hookVariationsSchema,
      prompt: `Este é o post final de LinkedIn, já com o gancho (as 2-3 primeiras linhas) definido:\n\n${finalPost}\n\nGere de 2 a 3 variações alternativas do gancho (só as primeiras linhas, não o post inteiro).`,
    });

    return { finalPost, hookVariations: object.hookVariations };
  } catch (cause) {
    throw new StageError('hook', cause);
  }
}
