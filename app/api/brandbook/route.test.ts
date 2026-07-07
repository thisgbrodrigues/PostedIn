import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT } from './route';
import * as repository from '@/lib/brandbook/repository';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/brandbook/repository');
vi.mock('@/lib/supabase/client');

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue(
    {} as ReturnType<typeof supabaseClient.createSupabaseClient>
  );
});

const brandbook = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Ana Silva',
  role: 'Head de Engenharia',
  company: 'Acme',
  industry: 'devops',
  bio: '',
  values: '',
  voiceReferences: '',
};

describe('GET /api/brandbook', () => {
  it('returns null when no brandbook exists yet', async () => {
    vi.mocked(repository.getBrandbook).mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toBeNull();
  });

  it('returns the brandbook when it exists', async () => {
    vi.mocked(repository.getBrandbook).mockResolvedValue(brandbook);

    const response = await GET();
    const body = await response.json();

    expect(body.name).toBe('Ana Silva');
  });
});

describe('PUT /api/brandbook', () => {
  it('saves and returns the brandbook', async () => {
    vi.mocked(repository.upsertBrandbook).mockResolvedValue(brandbook);

    const request = new Request('http://localhost/api/brandbook', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Ana Silva', role: 'Head de Engenharia', company: 'Acme', industry: 'devops' }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe('Ana Silva');
  });

  it('returns 400 for an invalid body', async () => {
    const request = new Request('http://localhost/api/brandbook', {
      method: 'PUT',
      body: JSON.stringify({ name: '' }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(400);
  });
});
