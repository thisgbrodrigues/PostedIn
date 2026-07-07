import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseClient(): SupabaseClient {
  const url = process.env.https://xfhexbrrqwtqyaxeqeyw.supabase.co;
  const key = process.env.sb_secret_w0wwoHTViM1GQvuKU-IW4A_CPjeGKXZ;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  return createClient(url, key);
}
