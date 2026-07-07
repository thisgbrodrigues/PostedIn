import { generateText } from 'ai';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type Brandbook, type ConfigProfile, type Fact } from '../types';

export interface WriterResult {
  draft: string;
}

function formatBrandbook(brandbook: Brandbook | null): string {
  if (!brandbook) return 'Nenhum.';
  return `Nome: ${brandbook.name}\nCargo: ${brandbook.role}\nEmpresa: ${brandbook.company}\nSetor: ${brandbook.industry}\nBio: ${brandbook.bio}\nValores: ${brandbook.values}\nReferências de voz: ${brandbook.voiceReferences}`;
}

function formatStructureExamples(examples: string[]): string {
  if (examples.length === 0) return 'Nenhum.';
  return examples.map((example, i) => `Exemplo ${i + 1}:\n${example}`).join('\n\n');
}

export async function runWriter(
  input: {
    thesis: string;
    pov: string;
    facts: Fact[];
    template: Record<string, unknown>;
    toneOfVoice: Record<string, unknown>;
    brandbook: Brandbook | null;
    structureExamples: string[];
  },
  config: ConfigProfile
): Promise<WriterResult> {
  try {
    const { text } = await generateText({
      model: openrouter(resolveModel('writer', config.modelOverrides)),
      prompt: `Escreva o rascunho de um post de LinkedIn.\n\nTese: ${input.thesis}\nPonto de vista: ${input.pov}\nFatos de apoio: ${JSON.stringify(input.facts)}\nTemplate/estrutura: ${JSON.stringify(input.template)}\nTom de voz: ${JSON.stringify(input.toneOfVoice)}\n\nIdentidade de quem escreve (Brandbook):\n${formatBrandbook(input.brandbook)}\n\nExemplos de estrutura para seguir como referência de FORMATAÇÃO (parágrafos, bullets, quebras de linha) — não copie o conteúdo, só o padrão estrutural:\n${formatStructureExamples(input.structureExamples)}\n\nEscreva apenas o corpo do post, sem título nem comentários.`,
    });
    return { draft: text };
  } catch (cause) {
    throw new StageError('writer', cause);
  }
}
