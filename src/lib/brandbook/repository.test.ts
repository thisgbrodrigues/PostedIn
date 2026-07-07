import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBrandbook, upsertBrandbook } from './repository';

function mockSelectEqMaybeSingle(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, eq } as unknown as SupabaseClient & { eq: typeof eq };
}

function mockUpsertSelectSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const upsert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ upsert });
  return { from, upsert } as unknown as SupabaseClient & { upsert: typeof upsert };
}

const row = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Ana Silva',
  role: 'Head de Engenharia',
  company: 'Acme',
  industry: 'devops',
  bio: 'Bio aqui',
  brand_values: 'Transparência acima de tudo',
  voice_references: '#buildinpublic',
};

describe('getBrandbook', () => {
  it('returns the mapped brandbook when it exists', async () => {
    const supabase = mockSelectEqMaybeSingle(row);

    const result = await getBrandbook(supabase);

    expect(result).toEqual({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Ana Silva',
      role: 'Head de Engenharia',
      company: 'Acme',
      industry: 'devops',
      bio: 'Bio aqui',
      values: 'Transparência acima de tudo',
      voiceReferences: '#buildinpublic',
    });
    expect(supabase.eq).toHaveBeenCalledWith('id', '00000000-0000-0000-0000-000000000001');
  });

  it('returns null when no brandbook exists yet', async () => {
    const supabase = mockSelectEqMaybeSingle(null);

    const result = await getBrandbook(supabase);

    expect(result).toBeNull();
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockSelectEqMaybeSingle(null, { message: 'connection refused' });

    await expect(getBrandbook(supabase)).rejects.toThrow('Failed to get brandbook: connection refused');
  });
});

describe('upsertBrandbook', () => {
  it('upserts using the fixed singleton id and maps the returned row', async () => {
    const supabase = mockUpsertSelectSingle(row);

    const result = await upsertBrandbook(supabase, {
      name: 'Ana Silva',
      role: 'Head de Engenharia',
      company: 'Acme',
      industry: 'devops',
      bio: 'Bio aqui',
      values: 'Transparência acima de tudo',
      voiceReferences: '#buildinpublic',
    });

    expect(result.name).toBe('Ana Silva');
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Ana Silva',
        brand_values: 'Transparência acima de tudo',
        voice_references: '#buildinpublic',
      }),
      { onConflict: 'id' }
    );
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockUpsertSelectSingle(null, { message: 'insert failed' });

    await expect(
      upsertBrandbook(supabase, {
        name: 'x',
        role: 'y',
        company: 'z',
        industry: 'w',
        bio: '',
        values: '',
        voiceReferences: '',
      })
    ).rejects.toThrow('Failed to save brandbook: insert failed');
  });
});
