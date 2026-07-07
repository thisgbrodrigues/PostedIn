import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listStructureExamples, createStructureExample, deleteStructureExample } from './repository';

function mockSelectEq(data: unknown, error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, eq } as unknown as SupabaseClient & { eq: typeof eq };
}

function mockInsertSelectSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return { from, insert } as unknown as SupabaseClient & { insert: typeof insert };
}

function mockDeleteEqSelect(data: unknown, error: unknown = null) {
  const select = vi.fn().mockResolvedValue({ data, error });
  const eq2 = vi.fn().mockReturnValue({ select });
  const eq = vi.fn().mockReturnValue({ eq: eq2, select });
  const del = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ delete: del });
  return { from, delete: del, eq, eq2 } as unknown as SupabaseClient & {
    delete: typeof del;
    eq: typeof eq;
    eq2: typeof eq2;
  };
}

const row = {
  id: 'ex-1',
  config_profile_id: 'cfg-1',
  filename: 'exemplo.md',
  content: '# Título\n\nCorpo curto.',
};

describe('listStructureExamples', () => {
  it('returns the mapped list for a profile', async () => {
    const supabase = mockSelectEq([row]);

    const result = await listStructureExamples(supabase, 'cfg-1');

    expect(result).toEqual([
      { id: 'ex-1', configProfileId: 'cfg-1', filename: 'exemplo.md', content: '# Título\n\nCorpo curto.' },
    ]);
    expect(supabase.eq).toHaveBeenCalledWith('config_profile_id', 'cfg-1');
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockSelectEq(null, { message: 'connection refused' });

    await expect(listStructureExamples(supabase, 'cfg-1')).rejects.toThrow(
      'Failed to list structure examples: connection refused'
    );
  });
});

describe('createStructureExample', () => {
  it('inserts and maps the row', async () => {
    const supabase = mockInsertSelectSingle(row);

    const result = await createStructureExample(supabase, 'cfg-1', {
      filename: 'exemplo.md',
      content: '# Título\n\nCorpo curto.',
    });

    expect(result.id).toBe('ex-1');
    expect(supabase.insert).toHaveBeenCalledWith({
      config_profile_id: 'cfg-1',
      filename: 'exemplo.md',
      content: '# Título\n\nCorpo curto.',
    });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockInsertSelectSingle(null, { message: 'insert failed' });

    await expect(
      createStructureExample(supabase, 'cfg-1', { filename: 'x.md', content: 'y' })
    ).rejects.toThrow('Failed to create structure example: insert failed');
  });
});

describe('deleteStructureExample', () => {
  it('returns true when a row was deleted', async () => {
    const supabase = mockDeleteEqSelect([{ id: 'ex-1' }]);

    const result = await deleteStructureExample(supabase, 'cfg-1', 'ex-1');

    expect(result).toBe(true);
    expect(supabase.eq).toHaveBeenCalledWith('config_profile_id', 'cfg-1');
    expect(supabase.eq2).toHaveBeenCalledWith('id', 'ex-1');
  });

  it('returns false when nothing matched the id', async () => {
    const supabase = mockDeleteEqSelect([]);

    const result = await deleteStructureExample(supabase, 'cfg-1', 'missing');

    expect(result).toBe(false);
  });

  it('returns false when the example belongs to a different profile', async () => {
    const supabase = mockDeleteEqSelect([]);

    const result = await deleteStructureExample(supabase, 'wrong-cfg', 'ex-1');

    expect(result).toBe(false);
    expect(supabase.eq).toHaveBeenCalledWith('config_profile_id', 'wrong-cfg');
    expect(supabase.eq2).toHaveBeenCalledWith('id', 'ex-1');
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockDeleteEqSelect(null, { message: 'delete failed' });

    await expect(deleteStructureExample(supabase, 'cfg-1', 'ex-1')).rejects.toThrow(
      'Failed to delete structure example: delete failed'
    );
  });
});
