import type { SupabaseClient } from '@supabase/supabase-js';
import type { StructureExampleInput } from './schema';

export const MAX_STRUCTURE_EXAMPLES_PER_PROFILE = 5;

export interface StructureExample {
  id: string;
  configProfileId: string;
  filename: string;
  content: string;
}

interface StructureExampleRow {
  id: string;
  config_profile_id: string;
  filename: string;
  content: string;
}

function mapRow(row: StructureExampleRow): StructureExample {
  return {
    id: row.id,
    configProfileId: row.config_profile_id,
    filename: row.filename,
    content: row.content,
  };
}

export async function listStructureExamples(
  supabase: SupabaseClient,
  configProfileId: string
): Promise<StructureExample[]> {
  const { data, error } = await supabase
    .from('profile_structure_examples')
    .select()
    .eq('config_profile_id', configProfileId);

  if (error) throw new Error(`Failed to list structure examples: ${error.message}`);
  return (data ?? []).map(mapRow);
}

export async function createStructureExample(
  supabase: SupabaseClient,
  configProfileId: string,
  input: StructureExampleInput
): Promise<StructureExample> {
  const { data, error } = await supabase
    .from('profile_structure_examples')
    .insert({
      config_profile_id: configProfileId,
      filename: input.filename,
      content: input.content,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create structure example: ${error.message}`);
  return mapRow(data);
}

export async function deleteStructureExample(
  supabase: SupabaseClient,
  configProfileId: string,
  id: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profile_structure_examples')
    .delete()
    .eq('config_profile_id', configProfileId)
    .eq('id', id)
    .select();

  if (error) throw new Error(`Failed to delete structure example: ${error.message}`);
  return (data ?? []).length > 0;
}
