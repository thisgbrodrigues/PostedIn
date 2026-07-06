import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { createConfigProfile, listConfigProfiles, getConfigProfile, updateConfigProfile } from './repository';

function mockInsertSelectSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return { from, insert } as unknown as SupabaseClient & { insert: typeof insert };
}

function mockSelect(data: unknown, error: unknown = null) {
  const select = vi.fn().mockResolvedValue({ data, error });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as SupabaseClient;
}

function mockSelectEqMaybeSingle(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, eq } as unknown as SupabaseClient & { eq: typeof eq };
}

function mockUpdateEqSelectSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from, update, eq } as unknown as SupabaseClient & { update: typeof update; eq: typeof eq };
}

const row = {
  id: 'cfg-1',
  name: 'Devops Voice',
  tone_of_voice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  model_overrides: {},
};

describe('createConfigProfile', () => {
  it('inserts and maps the row', async () => {
    const supabase = mockInsertSelectSingle(row);

    const result = await createConfigProfile(supabase, {
      name: 'Devops Voice',
      toneOfVoice: {},
      objective: 'gerar autoridade',
      niche: 'devops',
      template: {},
      modelOverrides: {},
    });

    expect(result.id).toBe('cfg-1');
    expect(supabase.insert).toHaveBeenCalledWith({
      name: 'Devops Voice',
      tone_of_voice: {},
      objective: 'gerar autoridade',
      niche: 'devops',
      template: {},
      model_overrides: {},
    });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockInsertSelectSingle(null, { message: 'duplicate name' });

    await expect(
      createConfigProfile(supabase, {
        name: 'x',
        toneOfVoice: {},
        objective: 'o',
        niche: 'n',
        template: {},
        modelOverrides: {},
      })
    ).rejects.toThrow('Failed to create config profile: duplicate name');
  });
});

describe('listConfigProfiles', () => {
  it('returns the mapped list', async () => {
    const supabase = mockSelect([row]);

    const result = await listConfigProfiles(supabase);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cfg-1');
  });
});

describe('getConfigProfile', () => {
  it('returns the mapped profile when found', async () => {
    const supabase = mockSelectEqMaybeSingle(row);

    const result = await getConfigProfile(supabase, 'cfg-1');

    expect(result?.id).toBe('cfg-1');
    expect(supabase.eq).toHaveBeenCalledWith('id', 'cfg-1');
  });

  it('returns null when not found', async () => {
    const supabase = mockSelectEqMaybeSingle(null);

    const result = await getConfigProfile(supabase, 'missing');

    expect(result).toBeNull();
  });
});

describe('updateConfigProfile', () => {
  it('updates the profile and returns the mapped row', async () => {
    const supabase = mockUpdateEqSelectSingle({ ...row, name: 'Nova voz' });

    const result = await updateConfigProfile(supabase, 'cfg-1', { name: 'Nova voz' });

    expect(result.name).toBe('Nova voz');
    expect(supabase.update).toHaveBeenCalledWith({ name: 'Nova voz' });
    expect(supabase.eq).toHaveBeenCalledWith('id', 'cfg-1');
  });
});
