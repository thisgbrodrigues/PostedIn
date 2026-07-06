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
  return { from } as unknown as SupabaseClient;
}

function mockInsert(error: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ insert });
  return { from } as unknown as SupabaseClient;
}

function mockUpdateEq(error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ error });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from } as unknown as SupabaseClient;
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
  });
});

describe('markExecutionSuccess', () => {
  it('updates status to success', async () => {
    const supabase = mockUpdateEq();

    await markExecutionSuccess(supabase, 'exec-1');

    expect(supabase.from).toHaveBeenCalledWith('pipeline_executions');
  });
});

describe('saveGeneratedPost', () => {
  it('inserts the generated post row', async () => {
    const supabase = mockInsert();

    await saveGeneratedPost(supabase, 'exec-1', 'Meu post final', ['Gancho A', 'Gancho B']);

    expect(supabase.from).toHaveBeenCalledWith('generated_posts');
  });
});
