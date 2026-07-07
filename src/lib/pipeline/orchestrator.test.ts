import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runPipeline } from './orchestrator';
import { StageError, type ConfigProfile } from './types';
import * as repository from './repository';
import * as brandbookRepository from '../brandbook/repository';
import * as structureExamplesRepository from '../configProfiles/structureExamples/repository';
import { runThemeStrategist } from './stages/themeStrategist';
import { runResearcher } from './stages/researcher';
import { runAngleDefiner } from './stages/angleDefiner';
import { runWriter } from './stages/writer';
import { runHookEditor } from './stages/hookEditor';
import { runReviewer } from './stages/reviewer';

vi.mock('./repository');
vi.mock('../brandbook/repository');
vi.mock('../configProfiles/structureExamples/repository');
vi.mock('./stages/themeStrategist');
vi.mock('./stages/researcher');
vi.mock('./stages/angleDefiner');
vi.mock('./stages/writer');
vi.mock('./stages/hookEditor');
vi.mock('./stages/reviewer');

const baseConfig: ConfigProfile = {
  id: 'cfg-1',
  name: 'Test',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

const fakeSupabase = {} as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repository.createExecution).mockResolvedValue({
    id: 'exec-1',
    configProfileId: 'cfg-1',
    inputTheme: null,
    status: 'running',
    failedStage: null,
    errorMessage: null,
  });
  vi.mocked(repository.saveStageResult).mockResolvedValue(undefined);
  vi.mocked(repository.markExecutionFailed).mockResolvedValue(undefined);
  vi.mocked(repository.markExecutionSuccess).mockResolvedValue(undefined);
  vi.mocked(repository.saveGeneratedPost).mockResolvedValue(undefined);
  vi.mocked(brandbookRepository.getBrandbook).mockResolvedValue(null);
  vi.mocked(structureExamplesRepository.listStructureExamples).mockResolvedValue([]);
});

describe('runPipeline happy path', () => {
  it('runs all 6 stages in order and returns the final result', async () => {
    vi.mocked(runThemeStrategist).mockResolvedValue({ theme: 'Observabilidade', rationale: 'r' });
    vi.mocked(runResearcher).mockResolvedValue({ facts: [{ claim: 'x', sources: [], confidence: 'high' }] });
    vi.mocked(runAngleDefiner).mockResolvedValue({ thesis: 't', pov: 'p' });
    vi.mocked(runWriter).mockResolvedValue({ draft: 'rascunho' });
    vi.mocked(runHookEditor).mockResolvedValue({ finalPost: 'post com gancho', hookVariations: ['A', 'B'] });
    vi.mocked(runReviewer).mockResolvedValue({ finalPost: 'post revisado', notes: [], passed: true });

    const result = await runPipeline(fakeSupabase, baseConfig);

    expect(result.executionId).toBe('exec-1');
    expect(result.finalPost).toBe('post revisado');
    expect(result.hookVariations).toEqual(['A', 'B']);
    expect(repository.saveStageResult).toHaveBeenCalledTimes(6);
    expect(repository.markExecutionSuccess).toHaveBeenCalledWith(fakeSupabase, 'exec-1');
  });

  it('fetches the brandbook and structure examples and passes them to the writer and reviewer stages', async () => {
    const brandbook = {
      id: 'bb-1',
      name: 'Ana Silva',
      role: 'Head de Engenharia',
      company: 'Acme',
      industry: 'devops',
      bio: 'Bio aqui',
      values: 'Transparência acima de tudo',
      voiceReferences: '#buildinpublic',
    };
    vi.mocked(brandbookRepository.getBrandbook).mockResolvedValue(brandbook);
    vi.mocked(structureExamplesRepository.listStructureExamples).mockResolvedValue([
      { id: 'ex-1', configProfileId: 'cfg-1', filename: 'a.md', content: 'conteudo A' },
    ]);
    vi.mocked(runThemeStrategist).mockResolvedValue({ theme: 'Observabilidade', rationale: 'r' });
    vi.mocked(runResearcher).mockResolvedValue({ facts: [] });
    vi.mocked(runAngleDefiner).mockResolvedValue({ thesis: 't', pov: 'p' });
    vi.mocked(runWriter).mockResolvedValue({ draft: 'rascunho' });
    vi.mocked(runHookEditor).mockResolvedValue({ finalPost: 'post com gancho', hookVariations: ['A'] });
    vi.mocked(runReviewer).mockResolvedValue({ finalPost: 'post revisado', notes: [], passed: true });

    await runPipeline(fakeSupabase, baseConfig);

    expect(structureExamplesRepository.listStructureExamples).toHaveBeenCalledWith(fakeSupabase, 'cfg-1');
    expect(runWriter).toHaveBeenCalledWith(
      expect.objectContaining({ brandbook, structureExamples: ['conteudo A'] }),
      baseConfig
    );
    expect(runReviewer).toHaveBeenCalledWith(expect.objectContaining({ brandbook }), baseConfig);
  });
});

describe('runPipeline failure path', () => {
  it('stops at the failing stage, marks the execution as failed, and attaches the executionId', async () => {
    vi.mocked(runThemeStrategist).mockResolvedValue({ theme: 'Observabilidade', rationale: 'r' });
    vi.mocked(runResearcher).mockResolvedValue({ facts: [] });
    vi.mocked(runAngleDefiner).mockResolvedValue({ thesis: 't', pov: 'p' });
    vi.mocked(runWriter).mockRejectedValue(new Error('boom'));

    try {
      await runPipeline(fakeSupabase, baseConfig);
      expect.unreachable('runPipeline should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(StageError);
      expect((error as StageError).stage).toBe('writer');
      expect((error as StageError).executionId).toBe('exec-1');
    }

    expect(repository.saveStageResult).toHaveBeenCalledTimes(3);
    expect(repository.markExecutionFailed).toHaveBeenCalledWith(
      fakeSupabase,
      'exec-1',
      'writer',
      expect.stringContaining('boom')
    );
    expect(runHookEditor).not.toHaveBeenCalled();
  });
});
