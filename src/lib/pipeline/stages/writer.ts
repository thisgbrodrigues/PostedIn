import { generateText } from 'ai';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile, type Fact } from '../types';

export interface WriterResult {
  draft: string;
}

export async function runWriter(
  input: {
    thesis: string;
    pov: string;
    facts: Fact[];
    template: Record<string, unknown>;
    toneOfVoice: Record<string, unknown>;
  },
  config: ConfigProfile
): Promise<WriterResult> {
  try {
    const { text } = await generateText({
      model: openrouter(resolveModel('writer', config.modelOverrides)),
      prompt: `Escreva o rascunho de um post de LinkedIn.\n\nTese: ${input.thesis}\nPonto de vista: ${input.pov}\nFatos de apoio: ${JSON.stringify(input.facts)}\nTemplate/estrutura: ${JSON.stringify(input.template)}\nTom de voz: ${JSON.stringify(input.toneOfVoice)}\n\nEscreva apenas o corpo do post, sem título nem comentários.`,
    });
    return { draft: text };
  } catch (cause) {
    throw new StageError('writer', cause);
  }
}
