import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/client';
import { deleteStructureExample } from '@/lib/configProfiles/structureExamples/repository';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; exampleId: string }> }
) {
  const { exampleId } = await params;
  const supabase = createSupabaseClient();
  const deleted = await deleteStructureExample(supabase, exampleId);

  if (!deleted) {
    return NextResponse.json({ error: 'Structure example not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
