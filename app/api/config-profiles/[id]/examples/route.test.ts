import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import * as repository from '@/lib/configProfiles/structureExamples/repository';
import * as profilesRepository from '@/lib/configProfiles/repository';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/configProfiles/structureExamples/repository');
vi.mock('@/lib/configProfiles/repository');
vi.mock('@/lib/supabase/client');

const profile = {
  id: 'cfg-1',
  name: 'Voz de DevOps',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue(
    {} as ReturnType<typeof supabaseClient.createSupabaseClient>
  );
  vi.mocked(profilesRepository.getConfigProfile).mockResolvedValue(profile);
});

describe('GET /api/config-profiles/[id]/examples', () => {
  it('lists the examples for a profile', async () => {
    vi.mocked(repository.listStructureExamples).mockResolvedValue([
      { id: 'ex-1', configProfileId: 'cfg-1', filename: 'exemplo.md', content: 'texto' },
    ]);

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'cfg-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
  });
});

describe('POST /api/config-profiles/[id]/examples', () => {
  it('creates an example and returns 201', async () => {
    vi.mocked(repository.listStructureExamples).mockResolvedValue([]);
    vi.mocked(repository.createStructureExample).mockResolvedValue({
      id: 'ex-1',
      configProfileId: 'cfg-1',
      filename: 'exemplo.md',
      content: '# Título',
    });

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ filename: 'exemplo.md', content: '# Título' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'cfg-1' }) });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe('ex-1');
    expect(repository.createStructureExample).toHaveBeenCalledWith(expect.anything(), 'cfg-1', {
      filename: 'exemplo.md',
      content: '# Título',
    });
  });

  it('returns 400 when the body is invalid', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ filename: 'exemplo.png', content: '# Título' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'cfg-1' }) });

    expect(response.status).toBe(400);
  });

  it('returns 404 when the config profile does not exist', async () => {
    vi.mocked(profilesRepository.getConfigProfile).mockResolvedValue(null);

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ filename: 'exemplo.md', content: '# Título' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'missing' }) });

    expect(response.status).toBe(404);
  });

  it('returns 400 when the profile already has 5 examples', async () => {
    vi.mocked(repository.listStructureExamples).mockResolvedValue([
      { id: 'ex-1', configProfileId: 'cfg-1', filename: 'a.md', content: 'a' },
      { id: 'ex-2', configProfileId: 'cfg-1', filename: 'b.md', content: 'b' },
      { id: 'ex-3', configProfileId: 'cfg-1', filename: 'c.md', content: 'c' },
      { id: 'ex-4', configProfileId: 'cfg-1', filename: 'd.md', content: 'd' },
      { id: 'ex-5', configProfileId: 'cfg-1', filename: 'e.md', content: 'e' },
    ]);

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ filename: 'f.md', content: 'f' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'cfg-1' }) });

    expect(response.status).toBe(400);
  });
});
