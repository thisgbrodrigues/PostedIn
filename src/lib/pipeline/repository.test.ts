import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createExecution,
  saveStageResult,
  markExecutionFailed,
  markExecutionSuccess,
  saveGeneratedPost,
} from './repository';

function mockInsertSelectSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return { from, insert } as unknown as SupabaseClient & { insert: typeof insert };
}

function mockInsert(error: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ insert });
  return { from, insert } as unknown as SupabaseClient & { insert: typeof insert };
}

function mockUpdateEq(error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ error });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from, update, eq } as unknown as SupabaseClient & { update: typeof update; eq: typeof eq };
}

describe('createExecution', () => {
  it('inserts a running execution and maps the returned row', async () => {
    const supabase = mockInsertSelectSingle({
      id: 'exec-1',
      config_profile_id: 'cfg-1',
      input_theme: null,
      status: 'running',
      failed_stage: null,
      error_message: null,
    });

    const result = await createExecution(supabase, 'cfg-1', null);

    expect(result).toEqual({
      id: 'exec-1',
      configProfileId: 'cfg-1',
      inputTheme: null,
      status: 'running',
      failedStage: null,
      errorMessage: null,
    });
    expect(supabase.from).toHaveBeenCalledWith('pipeline_executions');
    expect(supabase.insert).toHaveBeenCalledWith({
      config_profile_id: 'cfg-1',
      input_theme: null,
      status: 'running',
    });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockInsertSelectSingle(null, { message: 'connection refused' });

    await expect(createExecution(supabase, 'cfg-1', null)).rejects.toThrow(
      'Failed to create execution: connection refused'
    );
  });
});

describe('saveStageResult', () => {
  it('inserts the stage result row', async () => {
    const supabase = mockInsert();

    await saveStageResult(
      supabase,
      'exec-1',
      'theme',
      { niche: 'devops' },
      { theme: 'x', rationale: 'y' },
      'anthropic/claude-sonnet-5',
      1200
    );

    expect(supabase.from).toHaveBeenCalledWith('stage_results');
    expect(supabase.insert).toHaveBeenCalledWith({
      execution_id: 'exec-1',
      stage_name: 'theme',
      input: { niche: 'devops' },
      output: { theme: 'x', rationale: 'y' },
      model_used: 'anthropic/claude-sonnet-5',
      duration_ms: 1200,
    });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockInsert({ message: 'insert failed' });

    await expect(saveStageResult(supabase, 'exec-1', 'theme', {}, {}, 'model', 100)).rejects.toThrow(
      'Failed to save stage result: insert failed'
    );
  });
});

describe('markExecutionFailed', () => {
  it('updates status to failed with stage and error message', async () => {
    const supabase = mockUpdateEq();

    await markExecutionFailed(supabase, 'exec-1', 'writer', 'boom');

    expect(supabase.from).toHaveBeenCalledWith('pipeline_executions');
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failed_stage: 'writer',
        error_message: 'boom',
      })
    );
    expect(supabase.eq).toHaveBeenCalledWith('id', 'exec-1');
  });
});

describe('markExecutionSuccess', () => {
  it('updates status to success', async () => {
    const supabase = mockUpdateEq();

    await markExecutionSuccess(supabase, 'exec-1');

    expect(supabase.from).toHaveBeenCalledWith('pipeline_executions');
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    expect(supabase.eq).toHaveBeenCalledWith('id', 'exec-1');
  });
});

describe('saveGeneratedPost', () => {
  it('inserts the generated post row', async () => {
    const supabase = mockInsert();

    await saveGeneratedPost(supabase, 'exec-1', 'Meu post final', ['Gancho A', 'Gancho B']);

    expect(supabase.from).toHaveBeenCalledWith('generated_posts');
    expect(supabase.insert).toHaveBeenCalledWith({
      execution_id: 'exec-1',
      final_post: 'Meu post final',
      hook_variations: ['Gancho A', 'Gancho B'],
    });
  });
});
