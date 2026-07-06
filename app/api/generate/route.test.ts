import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import * as repository from '@/lib/configProfiles/repository';
import * as supabaseClient from '@/lib/supabase/client';
import * as orchestrator from '@/lib/pipeline/orchestrator';
import { StageError } from '@/lib/pipeline/types';

vi.mock('@/lib/configProfiles/repository');
vi.mock('@/lib/supabase/client');
vi.mock('@/lib/pipeline/orchestrator');

const profile = {
  id: 'cfg-1',
  name: 'Devops Voice',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue({} as ReturnType<typeof supabaseClient.createSupabaseClient>);
});

describe('POST /api/generate', () => {
  it('returns 400 when configProfileId is missing', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify({}) });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when theme is present but not a string', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ configProfileId: 'cfg-1', theme: 123 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 404 when the config profile does not exist', async () => {
    vi.mocked(repository.getConfigProfile).mockResolvedValue(null);

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ configProfileId: 'missing' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(404);
  });

  it('runs the pipeline and returns the result on success', async () => {
    vi.mocked(repository.getConfigProfile).mockResolvedValue(profile);
    vi.mocked(orchestrator.runPipeline).mockResolvedValue({
      executionId: 'exec-1',
      finalPost: 'Post final',
      hookVariations: ['A', 'B'],
      trace: {},
    });

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ configProfileId: 'cfg-1', theme: 'Observabilidade' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.finalPost).toBe('Post final');
  });

  it('returns 500 with the failed stage when the pipeline throws a StageError', async () => {
    vi.mocked(repository.getConfigProfile).mockResolvedValue(profile);
    const stageError = new StageError('writer', new Error('boom'));
    stageError.executionId = 'exec-1';
    vi.mocked(orchestrator.runPipeline).mockRejectedValue(stageError);

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ configProfileId: 'cfg-1' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.failedStage).toBe('writer');
    expect(body.executionId).toBe('exec-1');
  });
});
