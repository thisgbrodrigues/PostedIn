import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/client';
import { configProfileInputSchema } from '@/lib/configProfiles/schema';
import { createConfigProfile, listConfigProfiles } from '@/lib/configProfiles/repository';

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = configProfileInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseClient();
  const profile = await createConfigProfile(supabase, parsed.data);
  return NextResponse.json(profile, { status: 201 });
}

export async function GET() {
  const supabase = createSupabaseClient();
  const profiles = await listConfigProfiles(supabase);
  return NextResponse.json(profiles);
}
