import type { SupabaseClient } from '@supabase/supabase-js';
import type { StageName } from './types';

export interface Execution {
  id: string;
  configProfileId: string;
  inputTheme: string | null;
  status: 'running' | 'success' | 'failed';
  failedStage: StageName | null;
  errorMessage: string | null;
}

export async function createExecution(
  supabase: SupabaseClient,
  configProfileId: string,
  inputTheme: string | null
): Promise<Execution> {
  const { data, error } = await supabase
    .from('pipeline_executions')
    .insert({ config_profile_id: configProfileId, input_theme: inputTheme, status: 'running' })
    .select()
    .single();

  if (error) throw new Error(`Failed to create execution: ${error.message}`);

  return {
    id: data.id,
    configProfileId: data.config_profile_id,
    inputTheme: data.input_theme,
    status: data.status,
    failedStage: data.failed_stage,
    errorMessage: data.error_message,
  };
}

export async function saveStageResult(
  supabase: SupabaseClient,
  executionId: string,
  stageName: StageName,
  input: unknown,
  output: unknown,
  modelUsed: string,
  durationMs: number
): Promise<void> {
  const { error } = await supabase.from('stage_results').insert({
    execution_id: executionId,
    stage_name: stageName,
    input,
    output,
    model_used: modelUsed,
    duration_ms: durationMs,
  });

  if (error) throw new Error(`Failed to save stage result: ${error.message}`);
}

export async function markExecutionFailed(
  supabase: SupabaseClient,
  executionId: string,
  failedStage: StageName,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('pipeline_executions')
    .update({
      status: 'failed',
      failed_stage: failedStage,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq('id', executionId);

  if (error) throw new Error(`Failed to mark execution as failed: ${error.message}`);
}

export async function markExecutionSuccess(supabase: SupabaseClient, executionId: string): Promise<void> {
  const { error } = await supabase
    .from('pipeline_executions')
    .update({ status: 'success', finished_at: new Date().toISOString() })
    .eq('id', executionId);

  if (error) throw new Error(`Failed to mark execution as success: ${error.message}`);
}

export async function saveGeneratedPost(
  supabase: SupabaseClient,
  executionId: string,
  finalPost: string,
  hookVariations: string[]
): Promise<void> {
  const { error } = await supabase.from('generated_posts').insert({
    execution_id: executionId,
    final_post: finalPost,
    hook_variations: hookVariations,
  });

  if (error) throw new Error(`Failed to save generated post: ${error.message}`);
}
