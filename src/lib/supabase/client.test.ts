import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({ mocked: true }),
}));

import { createSupabaseClient } from './client';
import { createClient } from '@supabase/supabase-js';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('createSupabaseClient', () => {
  it('throws when SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are missing', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createSupabaseClient()).toThrow('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  });

  it('creates a client when env vars are present', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const client = createSupabaseClient();

    expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'service-role-key');
    expect(client).toEqual({ mocked: true });
  });
});
