import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import * as repository from '@/lib/configProfiles/repository';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/configProfiles/repository');
vi.mock('@/lib/supabase/client');

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue({} as ReturnType<typeof supabaseClient.createSupabaseClient>);
});

describe('POST /api/config-profiles', () => {
  it('creates a config profile and returns 201', async () => {
    vi.mocked(repository.createConfigProfile).mockResolvedValue({
      id: 'cfg-1',
      name: 'Devops Voice',
      toneOfVoice: {},
      objective: 'gerar autoridade',
      niche: 'devops',
      template: {},
      modelOverrides: {},
    });

    const request = new Request('http://localhost/api/config-profiles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Devops Voice', objective: 'gerar autoridade', niche: 'devops' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe('cfg-1');
  });

  it('returns 400 when the body is invalid', async () => {
    const request = new Request('http://localhost/api/config-profiles', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

describe('GET /api/config-profiles', () => {
  it('lists all config profiles', async () => {
    vi.mocked(repository.listConfigProfiles).mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});
