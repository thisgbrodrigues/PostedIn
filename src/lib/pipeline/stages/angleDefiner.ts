import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile, type Fact } from '../types';

const angleSchema = z.object({ thesis: z.string(), pov: z.string() });

export interface AngleDefinerResult {
  thesis: string;
  pov: string;
}

export async function runAngleDefiner(
  input: { theme: string; facts: Fact[] },
  config: ConfigProfile
): Promise<AngleDefinerResult> {
  try {
    const { object } = await generateObject({
      model: openrouter(resolveModel('angle', config.modelOverrides)),
      schema: angleSchema,
      prompt: `Tema: "${input.theme}"\nFatos disponíveis: ${JSON.stringify(input.facts)}\n\nDefina uma tese (thesis) específica e um ponto de vista (pov) claro e defensável para um post de LinkedIn sobre esse tema, usando os fatos acima como apoio.`,
    });
    return object;
  } catch (cause) {
    throw new StageError('angle', cause);
  }
}
