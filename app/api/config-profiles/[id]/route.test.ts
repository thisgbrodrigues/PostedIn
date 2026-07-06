import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from './route';
import * as repository from '@/lib/configProfiles/repository';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/configProfiles/repository');
vi.mock('@/lib/supabase/client');

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue({} as ReturnType<typeof supabaseClient.createSupabaseClient>);
});

const profile = {
  id: 'cfg-1',
  name: 'Devops Voice',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

describe('GET /api/config-profiles/[id]', () => {
  it('returns the profile when found', async () => {
    vi.mocked(repository.getConfigProfile).mockResolvedValue(profile);

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'cfg-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe('cfg-1');
  });

  it('returns 404 when not found', async () => {
    vi.mocked(repository.getConfigProfile).mockResolvedValue(null);

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) });

    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/config-profiles/[id]', () => {
  it('updates and returns the profile', async () => {
    vi.mocked(repository.updateConfigProfile).mockResolvedValue({ ...profile, name: 'Nova voz' });

    const request = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ name: 'Nova voz' }) });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'cfg-1' }) });
    const body = await response.json();

    expect(body.name).toBe('Nova voz');
    // Guards against regressing to configProfileInputSchema.partial(), which
    // would have filled in toneOfVoice/template/modelOverrides defaults here.
    expect(repository.updateConfigProfile).toHaveBeenCalledWith(expect.anything(), 'cfg-1', { name: 'Nova voz' });
  });

  it('returns 400 for an invalid body', async () => {
    const request = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ name: '' }) });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'cfg-1' }) });

    expect(response.status).toBe(400);
  });
});
