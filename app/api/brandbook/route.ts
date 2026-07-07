import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/client';
import { brandbookInputSchema } from '@/lib/brandbook/schema';
import { getBrandbook, upsertBrandbook } from '@/lib/brandbook/repository';

export async function GET() {
  const supabase = createSupabaseClient();
  const brandbook = await getBrandbook(supabase);
  return NextResponse.json(brandbook);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = brandbookInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseClient();
  const brandbook = await upsertBrandbook(supabase, parsed.data);
  return NextResponse.json(brandbook);
}
