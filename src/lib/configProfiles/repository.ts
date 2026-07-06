import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConfigProfileInput } from './schema';
import type { ConfigProfile } from '../pipeline/types';

interface ConfigProfileRow {
  id: string;
  name: string;
  tone_of_voice: Record<string, unknown>;
  objective: string;
  niche: string;
  template: Record<string, unknown>;
  model_overrides: Record<string, string>;
}

function mapRow(row: ConfigProfileRow): ConfigProfile {
  return {
    id: row.id,
    name: row.name,
    toneOfVoice: row.tone_of_voice,
    objective: row.objective,
    niche: row.niche,
    template: row.template,
    modelOverrides: row.model_overrides,
  };
}

export async function createConfigProfile(
  supabase: SupabaseClient,
  input: ConfigProfileInput
): Promise<ConfigProfile> {
  const { data, error } = await supabase
    .from('config_profiles')
    .insert({
      name: input.name,
      tone_of_voice: input.toneOfVoice,
      objective: input.objective,
      niche: input.niche,
      template: input.template,
      model_overrides: input.modelOverrides,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create config profile: ${error.message}`);
  return mapRow(data);
}

export async function listConfigProfiles(supabase: SupabaseClient): Promise<ConfigProfile[]> {
  const { data, error } = await supabase.from('config_profiles').select();

  if (error) throw new Error(`Failed to list config profiles: ${error.message}`);
  return (data ?? []).map(mapRow);
}

export async function getConfigProfile(supabase: SupabaseClient, id: string): Promise<ConfigProfile | null> {
  const { data, error } = await supabase.from('config_profiles').select().eq('id', id).maybeSingle();

  if (error) throw new Error(`Failed to get config profile: ${error.message}`);
  return data ? mapRow(data) : null;
}

export async function updateConfigProfile(
  supabase: SupabaseClient,
  id: string,
  input: Partial<ConfigProfileInput>
): Promise<ConfigProfile> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.toneOfVoice !== undefined) patch.tone_of_voice = input.toneOfVoice;
  if (input.objective !== undefined) patch.objective = input.objective;
  if (input.niche !== undefined) patch.niche = input.niche;
  if (input.template !== undefined) patch.template = input.template;
  if (input.modelOverrides !== undefined) patch.model_overrides = input.modelOverrides;

  const { data, error } = await supabase.from('config_profiles').update(patch).eq('id', id).select().single();

  if (error) throw new Error(`Failed to update config profile: ${error.message}`);
  return mapRow(data);
}
