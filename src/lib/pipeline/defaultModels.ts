import type { StageName } from './types';

// Defaults chosen for cost/quality fit per task; swap freely as the
// OpenRouter catalog evolves — nothing else in the codebase depends on
// these specific IDs.
export const DEFAULT_STAGE_MODELS: Record<StageName, string> = {
  theme: 'anthropic/claude-sonnet-5',
  research: 'anthropic/claude-haiku-4-5',
  angle: 'anthropic/claude-sonnet-5',
  writer: 'anthropic/claude-sonnet-5',
  hook: 'anthropic/claude-sonnet-5',
  reviewer: 'anthropic/claude-sonnet-5',
};

export function resolveModel(stage: StageName, overrides?: Partial<Record<StageName, string>>): string {
  return overrides?.[stage] ?? DEFAULT_STAGE_MODELS[stage];
}
