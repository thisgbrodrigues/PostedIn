import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConfigProfile, PipelineState, StageName } from './types';
import { StageError } from './types';
import { runThemeStrategist } from './stages/themeStrategist';
import { runResearcher } from './stages/researcher';
import { runAngleDefiner } from './stages/angleDefiner';
import { runWriter } from './stages/writer';
import { runHookEditor } from './stages/hookEditor';
import { runReviewer } from './stages/reviewer';
import { resolveModel } from './defaultModels';
import {
  createExecution,
  saveStageResult,
  markExecutionFailed,
  markExecutionSuccess,
  saveGeneratedPost,
} from './repository';

export interface PipelineResult {
  executionId: string;
  finalPost: string;
  hookVariations: string[];
  trace: PipelineState;
}

export async function runPipeline(
  supabase: SupabaseClient,
  config: ConfigProfile,
  inputTheme?: string
): Promise<PipelineResult> {
  const execution = await createExecution(supabase, config.id, inputTheme ?? null);
  const state: PipelineState = {};

  async function runStage<T>(stage: StageName, fn: () => Promise<T>, input: unknown): Promise<T> {
    const start = Date.now();
    try {
      const output = await fn();
      await saveStageResult(
        supabase,
        execution.id,
        stage,
        input,
        output,
        resolveModel(stage, config.modelOverrides),
        Date.now() - start
      );
      return output;
    } catch (cause) {
      const stageError = cause instanceof StageError ? cause : new StageError(stage, cause);
      stageError.executionId = execution.id;
      await markExecutionFailed(supabase, execution.id, stageError.stage, stageError.message);
      throw stageError;
    }
  }

  const themeResult = await runStage(
    'theme',
    () => runThemeStrategist({ theme: inputTheme, niche: config.niche, objective: config.objective }, config),
    { theme: inputTheme, niche: config.niche }
  );
  state.theme = themeResult.theme;
  state.themeRationale = themeResult.rationale;

  const researchResult = await runStage(
    'research',
    () => runResearcher({ theme: state.theme! }, config),
    { theme: state.theme }
  );
  state.facts = researchResult.facts;

  const angleResult = await runStage(
    'angle',
    () => runAngleDefiner({ theme: state.theme!, facts: state.facts! }, config),
    { theme: state.theme, facts: state.facts }
  );
  state.thesis = angleResult.thesis;
  state.pov = angleResult.pov;

  const writerResult = await runStage(
    'writer',
    () =>
      runWriter(
        {
          thesis: state.thesis!,
          pov: state.pov!,
          facts: state.facts!,
          template: config.template,
          toneOfVoice: config.toneOfVoice,
        },
        config
      ),
    { thesis: state.thesis, pov: state.pov }
  );
  state.draft = writerResult.draft;

  const hookResult = await runStage('hook', () => runHookEditor({ draft: state.draft! }, config), {
    draft: state.draft,
  });
  state.finalPost = hookResult.finalPost;
  state.hookVariations = hookResult.hookVariations;

  const reviewResult = await runStage(
    'reviewer',
    () =>
      runReviewer(
        { finalPost: state.finalPost!, objective: config.objective, toneOfVoice: config.toneOfVoice },
        config
      ),
    { finalPost: state.finalPost }
  );
  state.finalPost = reviewResult.finalPost;
  state.reviewNotes = reviewResult.notes;
  state.reviewPassed = reviewResult.passed;

  await saveGeneratedPost(supabase, execution.id, state.finalPost!, state.hookVariations ?? []);
  await markExecutionSuccess(supabase, execution.id);

  return {
    executionId: execution.id,
    finalPost: state.finalPost!,
    hookVariations: state.hookVariations ?? [],
    trace: state,
  };
}
