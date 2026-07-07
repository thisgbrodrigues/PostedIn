import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/client';
import { structureExampleInputSchema } from '@/lib/configProfiles/structureExamples/schema';
import {
  listStructureExamples,
  createStructureExample,
  MAX_STRUCTURE_EXAMPLES_PER_PROFILE,
} from '@/lib/configProfiles/structureExamples/repository';
import { getConfigProfile } from '@/lib/configProfiles/repository';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseClient();
  const examples = await listStructureExamples(supabase, id);
  return NextResponse.json(examples);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = structureExampleInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseClient();

  const profile = await getConfigProfile(supabase, id);
  if (!profile) {
    return NextResponse.json({ error: 'Config profile not found' }, { status: 404 });
  }

  const existing = await listStructureExamples(supabase, id);
  if (existing.length >= MAX_STRUCTURE_EXAMPLES_PER_PROFILE) {
    return NextResponse.json(
      { error: `A profile can have at most ${MAX_STRUCTURE_EXAMPLES_PER_PROFILE} structure examples` },
      { status: 400 }
    );
  }

  const example = await createStructureExample(supabase, id, parsed.data);
  return NextResponse.json(example, { status: 201 });
}
