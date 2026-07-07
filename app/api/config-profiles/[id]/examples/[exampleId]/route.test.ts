import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from './route';
import * as repository from '@/lib/configProfiles/structureExamples/repository';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/configProfiles/structureExamples/repository');
vi.mock('@/lib/supabase/client');

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue(
    {} as ReturnType<typeof supabaseClient.createSupabaseClient>
  );
});

describe('DELETE /api/config-profiles/[id]/examples/[exampleId]', () => {
  it('deletes the example and returns ok', async () => {
    vi.mocked(repository.deleteStructureExample).mockResolvedValue(true);

    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'cfg-1', exampleId: 'ex-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(repository.deleteStructureExample).toHaveBeenCalledWith(expect.anything(), 'ex-1');
  });

  it('returns 404 when the example does not exist', async () => {
    vi.mocked(repository.deleteStructureExample).mockResolvedValue(false);

    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'cfg-1', exampleId: 'missing' }),
    });

    expect(response.status).toBe(404);
  });
});
