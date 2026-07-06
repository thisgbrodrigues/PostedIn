import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/client';
import { configProfileInputSchema } from '@/lib/configProfiles/schema';
import { getConfigProfile, updateConfigProfile } from '@/lib/configProfiles/repository';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseClient();
  const profile = await getConfigProfile(supabase, id);

  if (!profile) {
    return NextResponse.json({ error: 'Config profile not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = configProfileInputSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseClient();
  const profile = await updateConfigProfile(supabase, id, parsed.data);
  return NextResponse.json(profile);
}
