import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/client';
import { getConfigProfile } from '@/lib/configProfiles/repository';
import { runPipeline } from '@/lib/pipeline/orchestrator';
import { StageError } from '@/lib/pipeline/types';

export async function POST(request: Request) {
  const body = await request.json();

  if (typeof body.configProfileId !== 'string') {
    return NextResponse.json({ error: 'configProfileId is required' }, { status: 400 });
  }

  if (body.theme !== undefined && typeof body.theme !== 'string') {
    return NextResponse.json({ error: 'theme must be a string' }, { status: 400 });
  }

  const supabase = createSupabaseClient();
  const profile = await getConfigProfile(supabase, body.configProfileId);

  if (!profile) {
    return NextResponse.json({ error: 'Config profile not found' }, { status: 404 });
  }

  try {
    const result = await runPipeline(supabase, profile, body.theme);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StageError) {
      return NextResponse.json(
        { executionId: error.executionId, error: error.message, failedStage: error.stage },
        { status: 500 }
      );
    }
    throw error;
  }
}
