import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile } from '../types';

const reviewSchema = z.object({
  finalPost: z.string(),
  notes: z.array(z.string()),
  passed: z.boolean(),
});

export interface ReviewerResult {
  finalPost: string;
  notes: string[];
  passed: boolean;
}

export async function runReviewer(
  input: { finalPost: string; objective: string; toneOfVoice: Record<string, unknown> },
  config: ConfigProfile
): Promise<ReviewerResult> {
  try {
    const { object } = await generateObject({
      model: openrouter(resolveModel('reviewer', config.modelOverrides)),
      schema: reviewSchema,
      prompt: `Revise este post de LinkedIn:\n\n${input.finalPost}\n\nObjetivo do post: ${input.objective}\nTom de voz esperado: ${JSON.stringify(input.toneOfVoice)}\n\nCorte qualquer trecho redundante ou "gordura", garanta que a voz combina com o tom esperado, e valide se o post cumpre o objetivo. Retorne o post final revisado em "finalPost" (reescreva se necessário), uma lista de observações em "notes", e "passed" como true se o post está pronto para publicar ou false se ainda precisa de ajustes.`,
    });
    return object;
  } catch (cause) {
    throw new StageError('reviewer', cause);
  }
}
