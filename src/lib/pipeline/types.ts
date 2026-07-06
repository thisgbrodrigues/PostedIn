export type StageName = 'theme' | 'research' | 'angle' | 'writer' | 'hook' | 'reviewer';

export interface ConfigProfile {
  id: string;
  name: string;
  toneOfVoice: Record<string, unknown>;
  objective: string;
  niche: string;
  template: Record<string, unknown>;
  modelOverrides: Partial<Record<StageName, string>>;
}

export interface Fact {
  claim: string;
  sources: { title: string; url: string }[];
  confidence: 'high' | 'low';
}

export interface PipelineState {
  theme?: string;
  themeRationale?: string;
  facts?: Fact[];
  thesis?: string;
  pov?: string;
  draft?: string;
  finalPost?: string;
  hookVariations?: string[];
  reviewNotes?: string[];
  reviewPassed?: boolean;
}

export class StageError extends Error {
  executionId?: string;

  constructor(
    public stage: StageName,
    public cause: unknown
  ) {
    super(`Stage "${stage}" failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'StageError';
  }
}
