import type { SupabaseClient } from '@supabase/supabase-js';
import type { BrandbookInput } from './schema';
import type { Brandbook } from '../pipeline/types';

// Fixed id for the single brandbook row this app ever reads/writes. Using a
// constant id lets upsertBrandbook do one atomic upsert instead of a
// check-then-insert-or-update sequence.
const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

interface BrandbookRow {
  id: string;
  name: string;
  role: string;
  company: string;
  industry: string;
  bio: string;
  brand_values: string;
  voice_references: string;
}

function mapRow(row: BrandbookRow): Brandbook {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    company: row.company,
    industry: row.industry,
    bio: row.bio,
    values: row.brand_values,
    voiceReferences: row.voice_references,
  };
}

export async function getBrandbook(supabase: SupabaseClient): Promise<Brandbook | null> {
  const { data, error } = await supabase.from('brandbook').select().eq('id', SINGLETON_ID).maybeSingle();

  if (error) throw new Error(`Failed to get brandbook: ${error.message}`);
  return data ? mapRow(data) : null;
}

export async function upsertBrandbook(supabase: SupabaseClient, input: BrandbookInput): Promise<Brandbook> {
  const { data, error } = await supabase
    .from('brandbook')
    .upsert(
      {
        id: SINGLETON_ID,
        name: input.name,
        role: input.role,
        company: input.company,
        industry: input.industry,
        bio: input.bio,
        brand_values: input.values,
        voice_references: input.voiceReferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to save brandbook: ${error.message}`);
  return mapRow(data);
}
