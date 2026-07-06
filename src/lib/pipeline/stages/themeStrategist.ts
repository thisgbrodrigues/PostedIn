import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile } from '../types';

const themeSchema = z.object({
  theme: z.string(),
  rationale: z.string(),
});

export interface ThemeStrategistResult {
  theme: string;
  rationale: string;
}

export async function runThemeStrategist(
  input: { theme?: string; niche: string; objective: string },
  config: ConfigProfile
): Promise<ThemeStrategistResult> {
  if (input.theme) {
    return { theme: input.theme, rationale: 'Tema fornecido diretamente pelo usuário.' };
  }

  try {
    const { object } = await generateObject({
      model: openrouter(resolveModel('theme', config.modelOverrides)),
      schema: themeSchema,
      prompt: `Você é um estrategista de conteúdo para LinkedIn. Dado o nicho "${input.niche}" e o objetivo "${input.objective}", proponha UM tema específico e interessante para um post, e explique em uma frase por que esse tema funciona para esse nicho e objetivo.`,
    });
    return object;
  } catch (cause) {
    throw new StageError('theme', cause);
  }
}
