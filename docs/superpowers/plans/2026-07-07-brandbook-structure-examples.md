# Brandbook e Exemplos de Estrutura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single per-account Brandbook (identity of who's producing the posts) and per-profile structure-example files (`.md`/`.txt`), both feeding into the Redator and Revisor pipeline stages, with full CRUD API routes and frontend UI.

**Architecture:** Two new Supabase tables (`brandbook` — a singleton row upserted via a fixed id; `profile_structure_examples` — up to 5 rows per config profile) with their own repository/schema modules, following the exact patterns already established by `configProfiles`. The orchestrator fetches both once per run (outside the `runStage` try/catch, same as `createExecution`) and threads them into the Redator and Reviewer stage calls only — the other 4 stages are untouched.

**Tech Stack:** Same as the rest of the project — Next.js App Router, TypeScript, Vercel AI SDK, Supabase, Zod, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-07-brandbook-structure-examples-design.md`

---

## File Structure

```
supabase/
  migrations/
    0002_brandbook_and_examples.sql

src/
  lib/
    pipeline/
      types.ts                              # MODIFY: add Brandbook interface
      stages/
        writer.ts                           # MODIFY: accept brandbook + structureExamples
        writer.test.ts                      # MODIFY
        reviewer.ts                         # MODIFY: accept brandbook
        reviewer.test.ts                    # MODIFY
      orchestrator.ts                       # MODIFY: fetch + thread brandbook/examples
      orchestrator.test.ts                  # MODIFY
    brandbook/
      schema.ts
      schema.test.ts
      repository.ts
      repository.test.ts
    configProfiles/
      structureExamples/
        schema.ts
        schema.test.ts
        repository.ts
        repository.test.ts

app/
  api/
    brandbook/
      route.ts                              # GET, PUT
      route.test.ts
    config-profiles/
      [id]/
        examples/
          route.ts                          # GET, POST
          route.test.ts
          [exampleId]/
            route.ts                        # DELETE
            route.test.ts

  brandbook/
    page.tsx                                # new page
  perfis/
    page.tsx                                # MODIFY: render StructureExamplesSection per profile

src/
  components/
    StructureExamples.tsx                   # new component
    Nav.tsx                                 # MODIFY: add Brandbook link
```

---

### Task 1: Supabase migration for Brandbook and structure examples

**Files:**
- Create: `supabase/migrations/0002_brandbook_and_examples.sql`

- [ ] **Step 1: Write the migration**

```sql
create table brandbook (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  company text not null,
  industry text not null,
  bio text not null default '',
  brand_values text not null default '',
  voice_references text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profile_structure_examples (
  id uuid primary key default gen_random_uuid(),
  config_profile_id uuid not null references config_profiles(id),
  filename text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index profile_structure_examples_config_profile_id_idx on profile_structure_examples(config_profile_id);
```

**Note:** the column is named `brand_values` (not `values`) because `VALUES` is a reserved keyword in PostgreSQL — using it unquoted as a column name would break in some query contexts. The application layer maps `brand_values` (DB) to `values` (TypeScript), the same pattern already used for `tone_of_voice` ↔ `toneOfVoice`.

**Note:** `brandbook` is designed as a singleton table — the application always reads/writes a single row with a fixed, hardcoded id (see Task 3). The `default gen_random_uuid()` on `id` is effectively unused in practice since the app always specifies `id` explicitly on upsert, but it's kept for schema consistency with every other table in this project.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0002_brandbook_and_examples.sql
git commit -m "feat: add brandbook and profile_structure_examples migration"
```

---

### Task 2: Add Brandbook type to pipeline types

**Files:**
- Modify: `src/lib/pipeline/types.ts`

- [ ] **Step 1: Add the `Brandbook` interface**

In `src/lib/pipeline/types.ts`, add this interface anywhere after the existing `Fact` interface (before `PipelineState`):

```ts
export interface Brandbook {
  id: string;
  name: string;
  role: string;
  company: string;
  industry: string;
  bio: string;
  values: string;
  voiceReferences: string;
}
```

The full file should now read exactly as follows (unchanged parts included for reference — only the `Brandbook` interface is new):

```ts
export type StageName = 'theme' | 'research' | 'angle' | 'writer' | 'hook' | 'reviewer';

export interface ConfigProfile {
  id: string;
  name: string;
  toneOfVoice: Record<string, unknown>;
  objective: string;
  niche: string;
  template: Record<string, unknown>;
  modelOverrides: Partial<Record<StageName, string>>;
}

export interface Fact {
  claim: string;
  sources: { title: string; url: string }[];
  confidence: 'high' | 'low';
}

export interface Brandbook {
  id: string;
  name: string;
  role: string;
  company: string;
  industry: string;
  bio: string;
  values: string;
  voiceReferences: string;
}

export interface PipelineState {
  theme?: string;
  themeRationale?: string;
  facts?: Fact[];
  thesis?: string;
  pov?: string;
  draft?: string;
  finalPost?: string;
  hookVariations?: string[];
  reviewNotes?: string[];
  reviewPassed?: boolean;
}

export class StageError extends Error {
  executionId?: string;

  constructor(
    public stage: StageName,
    public cause: unknown
  ) {
    super(`Stage "${stage}" failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'StageError';
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. No test file changes needed here — `Brandbook` is a plain interface with no runtime logic, matching the existing precedent that `ConfigProfile`/`Fact`/`PipelineState` have no dedicated tests (only `StageError`'s message-formatting logic is tested in `types.test.ts`, which is untouched by this task).

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/types.ts
git commit -m "feat: add Brandbook type to pipeline types"
```

---

### Task 3: Brandbook schema

**Files:**
- Create: `src/lib/brandbook/schema.ts`
- Test: `src/lib/brandbook/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { brandbookInputSchema } from './schema';

describe('brandbookInputSchema', () => {
  it('accepts a minimal valid brandbook and fills in defaults', () => {
    const result = brandbookInputSchema.parse({
      name: 'Ana Silva',
      role: 'Head de Engenharia',
      company: 'Acme',
      industry: 'devops',
    });

    expect(result.bio).toBe('');
    expect(result.values).toBe('');
    expect(result.voiceReferences).toBe('');
  });

  it('rejects a brandbook missing required fields', () => {
    const result = brandbookInputSchema.safeParse({ name: 'Ana Silva' });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/brandbook/schema.test.ts`
Expected: FAIL with "Cannot find module './schema'"

- [ ] **Step 3: Write the implementation**

```ts
import { z } from 'zod';

export const brandbookInputSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  company: z.string().min(1),
  industry: z.string().min(1),
  bio: z.string().default(''),
  values: z.string().default(''),
  voiceReferences: z.string().default(''),
});

export type BrandbookInput = z.infer<typeof brandbookInputSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/brandbook/schema.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/brandbook/schema.ts src/lib/brandbook/schema.test.ts
git commit -m "feat: add brandbook input schema"
```

---

### Task 4: Brandbook repository

**Files:**
- Create: `src/lib/brandbook/repository.ts`
- Test: `src/lib/brandbook/repository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBrandbook, upsertBrandbook } from './repository';

function mockSelectEqMaybeSingle(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, eq } as unknown as SupabaseClient & { eq: typeof eq };
}

function mockUpsertSelectSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const upsert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ upsert });
  return { from, upsert } as unknown as SupabaseClient & { upsert: typeof upsert };
}

const row = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Ana Silva',
  role: 'Head de Engenharia',
  company: 'Acme',
  industry: 'devops',
  bio: 'Bio aqui',
  brand_values: 'Transparência acima de tudo',
  voice_references: '#buildinpublic',
};

describe('getBrandbook', () => {
  it('returns the mapped brandbook when it exists', async () => {
    const supabase = mockSelectEqMaybeSingle(row);

    const result = await getBrandbook(supabase);

    expect(result).toEqual({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Ana Silva',
      role: 'Head de Engenharia',
      company: 'Acme',
      industry: 'devops',
      bio: 'Bio aqui',
      values: 'Transparência acima de tudo',
      voiceReferences: '#buildinpublic',
    });
    expect(supabase.eq).toHaveBeenCalledWith('id', '00000000-0000-0000-0000-000000000001');
  });

  it('returns null when no brandbook exists yet', async () => {
    const supabase = mockSelectEqMaybeSingle(null);

    const result = await getBrandbook(supabase);

    expect(result).toBeNull();
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockSelectEqMaybeSingle(null, { message: 'connection refused' });

    await expect(getBrandbook(supabase)).rejects.toThrow('Failed to get brandbook: connection refused');
  });
});

describe('upsertBrandbook', () => {
  it('upserts using the fixed singleton id and maps the returned row', async () => {
    const supabase = mockUpsertSelectSingle(row);

    const result = await upsertBrandbook(supabase, {
      name: 'Ana Silva',
      role: 'Head de Engenharia',
      company: 'Acme',
      industry: 'devops',
      bio: 'Bio aqui',
      values: 'Transparência acima de tudo',
      voiceReferences: '#buildinpublic',
    });

    expect(result.name).toBe('Ana Silva');
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Ana Silva',
        brand_values: 'Transparência acima de tudo',
        voice_references: '#buildinpublic',
      }),
      { onConflict: 'id' }
    );
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockUpsertSelectSingle(null, { message: 'insert failed' });

    await expect(
      upsertBrandbook(supabase, {
        name: 'x',
        role: 'y',
        company: 'z',
        industry: 'w',
        bio: '',
        values: '',
        voiceReferences: '',
      })
    ).rejects.toThrow('Failed to save brandbook: insert failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/brandbook/repository.test.ts`
Expected: FAIL with "Cannot find module './repository'"

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/brandbook/repository.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/brandbook/repository.ts src/lib/brandbook/repository.test.ts
git commit -m "feat: add brandbook repository"
```

---

### Task 5: API route — /api/brandbook

**Files:**
- Create: `app/api/brandbook/route.ts`
- Test: `app/api/brandbook/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT } from './route';
import * as repository from '@/lib/brandbook/repository';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/brandbook/repository');
vi.mock('@/lib/supabase/client');

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue(
    {} as ReturnType<typeof supabaseClient.createSupabaseClient>
  );
});

const brandbook = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Ana Silva',
  role: 'Head de Engenharia',
  company: 'Acme',
  industry: 'devops',
  bio: '',
  values: '',
  voiceReferences: '',
};

describe('GET /api/brandbook', () => {
  it('returns null when no brandbook exists yet', async () => {
    vi.mocked(repository.getBrandbook).mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toBeNull();
  });

  it('returns the brandbook when it exists', async () => {
    vi.mocked(repository.getBrandbook).mockResolvedValue(brandbook);

    const response = await GET();
    const body = await response.json();

    expect(body.name).toBe('Ana Silva');
  });
});

describe('PUT /api/brandbook', () => {
  it('saves and returns the brandbook', async () => {
    vi.mocked(repository.upsertBrandbook).mockResolvedValue(brandbook);

    const request = new Request('http://localhost/api/brandbook', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Ana Silva', role: 'Head de Engenharia', company: 'Acme', industry: 'devops' }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe('Ana Silva');
  });

  it('returns 400 for an invalid body', async () => {
    const request = new Request('http://localhost/api/brandbook', {
      method: 'PUT',
      body: JSON.stringify({ name: '' }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/brandbook/route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/brandbook/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/brandbook/route.ts app/api/brandbook/route.test.ts
git commit -m "feat: add /api/brandbook route"
```

---

### Task 6: Structure examples schema

**Files:**
- Create: `src/lib/configProfiles/structureExamples/schema.ts`
- Test: `src/lib/configProfiles/structureExamples/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { structureExampleInputSchema } from './schema';

describe('structureExampleInputSchema', () => {
  it('accepts a .md filename with content', () => {
    const result = structureExampleInputSchema.safeParse({ filename: 'exemplo.md', content: '# Título' });

    expect(result.success).toBe(true);
  });

  it('accepts a .txt filename with content', () => {
    const result = structureExampleInputSchema.safeParse({ filename: 'exemplo.txt', content: 'texto' });

    expect(result.success).toBe(true);
  });

  it('rejects a filename that is not .md or .txt', () => {
    const result = structureExampleInputSchema.safeParse({ filename: 'exemplo.png', content: 'texto' });

    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    const result = structureExampleInputSchema.safeParse({ filename: 'exemplo.md', content: '' });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/configProfiles/structureExamples/schema.test.ts`
Expected: FAIL with "Cannot find module './schema'"

- [ ] **Step 3: Write the implementation**

```ts
import { z } from 'zod';

export const structureExampleInputSchema = z.object({
  filename: z
    .string()
    .min(1)
    .refine((name) => name.endsWith('.md') || name.endsWith('.txt'), {
      message: 'filename must end with .md or .txt',
    }),
  content: z.string().min(1),
});

export type StructureExampleInput = z.infer<typeof structureExampleInputSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/configProfiles/structureExamples/schema.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/configProfiles/structureExamples/schema.ts src/lib/configProfiles/structureExamples/schema.test.ts
git commit -m "feat: add structure example input schema"
```

---

### Task 7: Structure examples repository

**Files:**
- Create: `src/lib/configProfiles/structureExamples/repository.ts`
- Test: `src/lib/configProfiles/structureExamples/repository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listStructureExamples, createStructureExample, deleteStructureExample } from './repository';

function mockSelectEq(data: unknown, error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, eq } as unknown as SupabaseClient & { eq: typeof eq };
}

function mockInsertSelectSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return { from, insert } as unknown as SupabaseClient & { insert: typeof insert };
}

function mockDeleteEqSelect(data: unknown, error: unknown = null) {
  const select = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ select });
  const del = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ delete: del });
  return { from, delete: del, eq } as unknown as SupabaseClient & { delete: typeof del; eq: typeof eq };
}

const row = {
  id: 'ex-1',
  config_profile_id: 'cfg-1',
  filename: 'exemplo.md',
  content: '# Título\n\nCorpo curto.',
};

describe('listStructureExamples', () => {
  it('returns the mapped list for a profile', async () => {
    const supabase = mockSelectEq([row]);

    const result = await listStructureExamples(supabase, 'cfg-1');

    expect(result).toEqual([
      { id: 'ex-1', configProfileId: 'cfg-1', filename: 'exemplo.md', content: '# Título\n\nCorpo curto.' },
    ]);
    expect(supabase.eq).toHaveBeenCalledWith('config_profile_id', 'cfg-1');
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockSelectEq(null, { message: 'connection refused' });

    await expect(listStructureExamples(supabase, 'cfg-1')).rejects.toThrow(
      'Failed to list structure examples: connection refused'
    );
  });
});

describe('createStructureExample', () => {
  it('inserts and maps the row', async () => {
    const supabase = mockInsertSelectSingle(row);

    const result = await createStructureExample(supabase, 'cfg-1', {
      filename: 'exemplo.md',
      content: '# Título\n\nCorpo curto.',
    });

    expect(result.id).toBe('ex-1');
    expect(supabase.insert).toHaveBeenCalledWith({
      config_profile_id: 'cfg-1',
      filename: 'exemplo.md',
      content: '# Título\n\nCorpo curto.',
    });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockInsertSelectSingle(null, { message: 'insert failed' });

    await expect(
      createStructureExample(supabase, 'cfg-1', { filename: 'x.md', content: 'y' })
    ).rejects.toThrow('Failed to create structure example: insert failed');
  });
});

describe('deleteStructureExample', () => {
  it('returns true when a row was deleted', async () => {
    const supabase = mockDeleteEqSelect([{ id: 'ex-1' }]);

    const result = await deleteStructureExample(supabase, 'ex-1');

    expect(result).toBe(true);
    expect(supabase.eq).toHaveBeenCalledWith('id', 'ex-1');
  });

  it('returns false when nothing matched the id', async () => {
    const supabase = mockDeleteEqSelect([]);

    const result = await deleteStructureExample(supabase, 'missing');

    expect(result).toBe(false);
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockDeleteEqSelect(null, { message: 'delete failed' });

    await expect(deleteStructureExample(supabase, 'ex-1')).rejects.toThrow(
      'Failed to delete structure example: delete failed'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/configProfiles/structureExamples/repository.test.ts`
Expected: FAIL with "Cannot find module './repository'"

- [ ] **Step 3: Write the implementation**

```ts
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

export async function deleteStructureExample(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await supabase.from('profile_structure_examples').delete().eq('id', id).select();

  if (error) throw new Error(`Failed to delete structure example: ${error.message}`);
  return (data ?? []).length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/configProfiles/structureExamples/repository.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/configProfiles/structureExamples/repository.ts src/lib/configProfiles/structureExamples/repository.test.ts
git commit -m "feat: add structure examples repository"
```

---

### Task 8: API route — config profile structure examples collection

**Files:**
- Create: `app/api/config-profiles/[id]/examples/route.ts`
- Test: `app/api/config-profiles/[id]/examples/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import * as repository from '@/lib/configProfiles/structureExamples/repository';
import * as profilesRepository from '@/lib/configProfiles/repository';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/configProfiles/structureExamples/repository');
vi.mock('@/lib/configProfiles/repository');
vi.mock('@/lib/supabase/client');

const profile = {
  id: 'cfg-1',
  name: 'Voz de DevOps',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue(
    {} as ReturnType<typeof supabaseClient.createSupabaseClient>
  );
  vi.mocked(profilesRepository.getConfigProfile).mockResolvedValue(profile);
});

describe('GET /api/config-profiles/[id]/examples', () => {
  it('lists the examples for a profile', async () => {
    vi.mocked(repository.listStructureExamples).mockResolvedValue([
      { id: 'ex-1', configProfileId: 'cfg-1', filename: 'exemplo.md', content: 'texto' },
    ]);

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'cfg-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
  });
});

describe('POST /api/config-profiles/[id]/examples', () => {
  it('creates an example and returns 201', async () => {
    vi.mocked(repository.listStructureExamples).mockResolvedValue([]);
    vi.mocked(repository.createStructureExample).mockResolvedValue({
      id: 'ex-1',
      configProfileId: 'cfg-1',
      filename: 'exemplo.md',
      content: '# Título',
    });

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ filename: 'exemplo.md', content: '# Título' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'cfg-1' }) });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe('ex-1');
    expect(repository.createStructureExample).toHaveBeenCalledWith(expect.anything(), 'cfg-1', {
      filename: 'exemplo.md',
      content: '# Título',
    });
  });

  it('returns 400 when the body is invalid', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ filename: 'exemplo.png', content: '# Título' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'cfg-1' }) });

    expect(response.status).toBe(400);
  });

  it('returns 404 when the config profile does not exist', async () => {
    vi.mocked(profilesRepository.getConfigProfile).mockResolvedValue(null);

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ filename: 'exemplo.md', content: '# Título' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'missing' }) });

    expect(response.status).toBe(404);
  });

  it('returns 400 when the profile already has 5 examples', async () => {
    vi.mocked(repository.listStructureExamples).mockResolvedValue([
      { id: 'ex-1', configProfileId: 'cfg-1', filename: 'a.md', content: 'a' },
      { id: 'ex-2', configProfileId: 'cfg-1', filename: 'b.md', content: 'b' },
      { id: 'ex-3', configProfileId: 'cfg-1', filename: 'c.md', content: 'c' },
      { id: 'ex-4', configProfileId: 'cfg-1', filename: 'd.md', content: 'd' },
      { id: 'ex-5', configProfileId: 'cfg-1', filename: 'e.md', content: 'e' },
    ]);

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ filename: 'f.md', content: 'f' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'cfg-1' }) });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/api/config-profiles/[id]/examples/route.test.ts"`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/api/config-profiles/[id]/examples/route.test.ts"`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/api/config-profiles/[id]/examples/route.ts" "app/api/config-profiles/[id]/examples/route.test.ts"
git commit -m "feat: add config profile structure examples collection route"
```

---

### Task 9: API route — delete a structure example

**Files:**
- Create: `app/api/config-profiles/[id]/examples/[exampleId]/route.ts`
- Test: `app/api/config-profiles/[id]/examples/[exampleId]/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from './route';
import * as repository from '@/lib/configProfiles/structureExamples/repository';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/configProfiles/structureExamples/repository');
vi.mock('@/lib/supabase/client');

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue(
    {} as ReturnType<typeof supabaseClient.createSupabaseClient>
  );
});

describe('DELETE /api/config-profiles/[id]/examples/[exampleId]', () => {
  it('deletes the example and returns ok', async () => {
    vi.mocked(repository.deleteStructureExample).mockResolvedValue(true);

    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'cfg-1', exampleId: 'ex-1' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(repository.deleteStructureExample).toHaveBeenCalledWith(expect.anything(), 'ex-1');
  });

  it('returns 404 when the example does not exist', async () => {
    vi.mocked(repository.deleteStructureExample).mockResolvedValue(false);

    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'cfg-1', exampleId: 'missing' }),
    });

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "app/api/config-profiles/[id]/examples/[exampleId]/route.test.ts"`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "app/api/config-profiles/[id]/examples/[exampleId]/route.test.ts"`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/api/config-profiles/[id]/examples/[exampleId]/route.ts" "app/api/config-profiles/[id]/examples/[exampleId]/route.test.ts"
git commit -m "feat: add delete structure example route"
```

---

### Task 10: Redator stage — accept Brandbook and structure examples

**Files:**
- Modify: `src/lib/pipeline/stages/writer.ts`
- Modify: `src/lib/pipeline/stages/writer.test.ts`

- [ ] **Step 1: Update the test file**

Replace the full contents of `src/lib/pipeline/stages/writer.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { runWriter } from './writer';
import { StageError, type ConfigProfile } from '../types';
import * as ai from 'ai';

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: vi.fn() };
});

const baseConfig: ConfigProfile = {
  id: 'cfg-1',
  name: 'Test',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

const baseInput = {
  thesis: 't',
  pov: 'p',
  facts: [],
  template: {},
  toneOfVoice: {},
  brandbook: null,
  structureExamples: [],
};

describe('runWriter', () => {
  it('returns the draft text from the model', async () => {
    vi.mocked(ai.generateText).mockResolvedValueOnce({
      text: 'Rascunho do post...',
    } as Awaited<ReturnType<typeof ai.generateText>>);

    const result = await runWriter(baseInput, baseConfig);

    expect(result.draft).toBe('Rascunho do post...');
  });

  it('includes the brandbook identity in the prompt when present', async () => {
    vi.mocked(ai.generateText).mockResolvedValueOnce({
      text: 'Rascunho',
    } as Awaited<ReturnType<typeof ai.generateText>>);

    await runWriter(
      {
        ...baseInput,
        brandbook: {
          id: 'bb-1',
          name: 'Ana Silva',
          role: 'Head de Engenharia',
          company: 'Acme',
          industry: 'devops',
          bio: 'Bio aqui',
          values: 'Transparência acima de tudo',
          voiceReferences: '#buildinpublic',
        },
      },
      baseConfig
    );

    const call = vi.mocked(ai.generateText).mock.calls[0][0];
    expect(call.prompt).toContain('Ana Silva');
    expect(call.prompt).toContain('Transparência acima de tudo');
  });

  it('includes structure examples in the prompt when present', async () => {
    vi.mocked(ai.generateText).mockResolvedValueOnce({
      text: 'Rascunho',
    } as Awaited<ReturnType<typeof ai.generateText>>);

    await runWriter({ ...baseInput, structureExamples: ['# Título curto\n\n- ponto 1\n- ponto 2'] }, baseConfig);

    const call = vi.mocked(ai.generateText).mock.calls[0][0];
    expect(call.prompt).toContain('ponto 1');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateText).mockRejectedValueOnce(new Error('overloaded'));

    await expect(runWriter(baseInput, baseConfig)).rejects.toThrow(StageError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/stages/writer.test.ts`
Expected: FAIL — `runWriter`'s current signature doesn't accept `brandbook`/`structureExamples`, so TypeScript will reject the test file (or, if it runs anyway via loose typing, the "includes the brandbook identity" and "includes structure examples" tests will fail because the current prompt never mentions them).

- [ ] **Step 3: Update the implementation**

Replace the full contents of `src/lib/pipeline/stages/writer.ts` with:

```ts
import { generateText } from 'ai';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type Brandbook, type ConfigProfile, type Fact } from '../types';

export interface WriterResult {
  draft: string;
}

function formatBrandbook(brandbook: Brandbook | null): string {
  if (!brandbook) return 'Nenhum.';
  return `Nome: ${brandbook.name}\nCargo: ${brandbook.role}\nEmpresa: ${brandbook.company}\nSetor: ${brandbook.industry}\nBio: ${brandbook.bio}\nValores: ${brandbook.values}\nReferências de voz: ${brandbook.voiceReferences}`;
}

function formatStructureExamples(examples: string[]): string {
  if (examples.length === 0) return 'Nenhum.';
  return examples.map((example, i) => `Exemplo ${i + 1}:\n${example}`).join('\n\n');
}

export async function runWriter(
  input: {
    thesis: string;
    pov: string;
    facts: Fact[];
    template: Record<string, unknown>;
    toneOfVoice: Record<string, unknown>;
    brandbook: Brandbook | null;
    structureExamples: string[];
  },
  config: ConfigProfile
): Promise<WriterResult> {
  try {
    const { text } = await generateText({
      model: openrouter(resolveModel('writer', config.modelOverrides)),
      prompt: `Escreva o rascunho de um post de LinkedIn.\n\nTese: ${input.thesis}\nPonto de vista: ${input.pov}\nFatos de apoio: ${JSON.stringify(input.facts)}\nTemplate/estrutura: ${JSON.stringify(input.template)}\nTom de voz: ${JSON.stringify(input.toneOfVoice)}\n\nIdentidade de quem escreve (Brandbook):\n${formatBrandbook(input.brandbook)}\n\nExemplos de estrutura para seguir como referência de FORMATAÇÃO (parágrafos, bullets, quebras de linha) — não copie o conteúdo, só o padrão estrutural:\n${formatStructureExamples(input.structureExamples)}\n\nEscreva apenas o corpo do post, sem título nem comentários.`,
    });
    return { draft: text };
  } catch (cause) {
    throw new StageError('writer', cause);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/stages/writer.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/stages/writer.ts src/lib/pipeline/stages/writer.test.ts
git commit -m "feat: thread brandbook and structure examples into the Redator stage"
```

---

### Task 11: Revisor stage — accept Brandbook

**Files:**
- Modify: `src/lib/pipeline/stages/reviewer.ts`
- Modify: `src/lib/pipeline/stages/reviewer.test.ts`

- [ ] **Step 1: Update the test file**

Replace the full contents of `src/lib/pipeline/stages/reviewer.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { runReviewer } from './reviewer';
import { StageError, type ConfigProfile } from '../types';
import * as ai from 'ai';

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateObject: vi.fn() };
});

const baseConfig: ConfigProfile = {
  id: 'cfg-1',
  name: 'Test',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

const baseInput = {
  finalPost: 'Post original',
  objective: 'gerar autoridade',
  toneOfVoice: {},
  brandbook: null,
};

describe('runReviewer', () => {
  it('returns the reviewed post with notes and a passed flag', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { finalPost: 'Post revisado', notes: ['Cortado trecho redundante'], passed: true },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    const result = await runReviewer(baseInput, baseConfig);

    expect(result.passed).toBe(true);
    expect(result.finalPost).toBe('Post revisado');
  });

  it('includes the brandbook values in the prompt when present', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { finalPost: 'Post revisado', notes: [], passed: true },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    await runReviewer(
      {
        ...baseInput,
        brandbook: {
          id: 'bb-1',
          name: 'Ana Silva',
          role: 'Head de Engenharia',
          company: 'Acme',
          industry: 'devops',
          bio: 'Bio aqui',
          values: 'Transparência acima de tudo',
          voiceReferences: '#buildinpublic',
        },
      },
      baseConfig
    );

    const call = vi.mocked(ai.generateObject).mock.calls[0][0];
    expect(call.prompt).toContain('Transparência acima de tudo');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateObject).mockRejectedValueOnce(new Error('invalid schema'));

    await expect(runReviewer(baseInput, baseConfig)).rejects.toThrow(StageError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/stages/reviewer.test.ts`
Expected: FAIL — `runReviewer`'s current signature doesn't accept `brandbook`, so the "includes the brandbook values" test fails (the prompt never mentions it).

- [ ] **Step 3: Update the implementation**

Replace the full contents of `src/lib/pipeline/stages/reviewer.ts` with:

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type Brandbook, type ConfigProfile } from '../types';

const reviewSchema = z.object({
  finalPost: z.string(),
  notes: z.array(z.string()),
  passed: z.boolean(),
});

export interface ReviewerResult {
  finalPost: string;
  notes: string[];
  passed: boolean;
}

function formatBrandbook(brandbook: Brandbook | null): string {
  if (!brandbook) return 'Nenhum.';
  return `Nome: ${brandbook.name}\nCargo: ${brandbook.role}\nEmpresa: ${brandbook.company}\nSetor: ${brandbook.industry}\nValores: ${brandbook.values}\nReferências de voz: ${brandbook.voiceReferences}`;
}

export async function runReviewer(
  input: {
    finalPost: string;
    objective: string;
    toneOfVoice: Record<string, unknown>;
    brandbook: Brandbook | null;
  },
  config: ConfigProfile
): Promise<ReviewerResult> {
  try {
    const { object } = await generateObject({
      model: openrouter(resolveModel('reviewer', config.modelOverrides)),
      schema: reviewSchema,
      prompt: `Revise este post de LinkedIn:\n\n${input.finalPost}\n\nObjetivo do post: ${input.objective}\nTom de voz esperado: ${JSON.stringify(input.toneOfVoice)}\n\nIdentidade de quem publica (Brandbook):\n${formatBrandbook(input.brandbook)}\n\nCorte qualquer trecho redundante ou "gordura", garanta que a voz combina com o tom esperado e com os valores/posicionamento do Brandbook (quando houver), e valide se o post cumpre o objetivo. Retorne o post final revisado em "finalPost" (reescreva se necessário), uma lista de observações em "notes", e "passed" como true se o post está pronto para publicar ou false se ainda precisa de ajustes.`,
    });
    return object;
  } catch (cause) {
    throw new StageError('reviewer', cause);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/stages/reviewer.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/stages/reviewer.ts src/lib/pipeline/stages/reviewer.test.ts
git commit -m "feat: thread brandbook into the Revisor stage"
```

---

### Task 12: Orchestrator — fetch and thread Brandbook and structure examples

**Files:**
- Modify: `src/lib/pipeline/orchestrator.ts`
- Modify: `src/lib/pipeline/orchestrator.test.ts`

- [ ] **Step 1: Update the test file**

Replace the full contents of `src/lib/pipeline/orchestrator.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runPipeline } from './orchestrator';
import { StageError, type ConfigProfile } from './types';
import * as repository from './repository';
import * as brandbookRepository from '../brandbook/repository';
import * as structureExamplesRepository from '../configProfiles/structureExamples/repository';
import { runThemeStrategist } from './stages/themeStrategist';
import { runResearcher } from './stages/researcher';
import { runAngleDefiner } from './stages/angleDefiner';
import { runWriter } from './stages/writer';
import { runHookEditor } from './stages/hookEditor';
import { runReviewer } from './stages/reviewer';

vi.mock('./repository');
vi.mock('../brandbook/repository');
vi.mock('../configProfiles/structureExamples/repository');
vi.mock('./stages/themeStrategist');
vi.mock('./stages/researcher');
vi.mock('./stages/angleDefiner');
vi.mock('./stages/writer');
vi.mock('./stages/hookEditor');
vi.mock('./stages/reviewer');

const baseConfig: ConfigProfile = {
  id: 'cfg-1',
  name: 'Test',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

const fakeSupabase = {} as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repository.createExecution).mockResolvedValue({
    id: 'exec-1',
    configProfileId: 'cfg-1',
    inputTheme: null,
    status: 'running',
    failedStage: null,
    errorMessage: null,
  });
  vi.mocked(repository.saveStageResult).mockResolvedValue(undefined);
  vi.mocked(repository.markExecutionFailed).mockResolvedValue(undefined);
  vi.mocked(repository.markExecutionSuccess).mockResolvedValue(undefined);
  vi.mocked(repository.saveGeneratedPost).mockResolvedValue(undefined);
  vi.mocked(brandbookRepository.getBrandbook).mockResolvedValue(null);
  vi.mocked(structureExamplesRepository.listStructureExamples).mockResolvedValue([]);
});

describe('runPipeline happy path', () => {
  it('runs all 6 stages in order and returns the final result', async () => {
    vi.mocked(runThemeStrategist).mockResolvedValue({ theme: 'Observabilidade', rationale: 'r' });
    vi.mocked(runResearcher).mockResolvedValue({ facts: [{ claim: 'x', sources: [], confidence: 'high' }] });
    vi.mocked(runAngleDefiner).mockResolvedValue({ thesis: 't', pov: 'p' });
    vi.mocked(runWriter).mockResolvedValue({ draft: 'rascunho' });
    vi.mocked(runHookEditor).mockResolvedValue({ finalPost: 'post com gancho', hookVariations: ['A', 'B'] });
    vi.mocked(runReviewer).mockResolvedValue({ finalPost: 'post revisado', notes: [], passed: true });

    const result = await runPipeline(fakeSupabase, baseConfig);

    expect(result.executionId).toBe('exec-1');
    expect(result.finalPost).toBe('post revisado');
    expect(result.hookVariations).toEqual(['A', 'B']);
    expect(repository.saveStageResult).toHaveBeenCalledTimes(6);
    expect(repository.markExecutionSuccess).toHaveBeenCalledWith(fakeSupabase, 'exec-1');
  });

  it('fetches the brandbook and structure examples and passes them to the writer and reviewer stages', async () => {
    const brandbook = {
      id: 'bb-1',
      name: 'Ana Silva',
      role: 'Head de Engenharia',
      company: 'Acme',
      industry: 'devops',
      bio: 'Bio aqui',
      values: 'Transparência acima de tudo',
      voiceReferences: '#buildinpublic',
    };
    vi.mocked(brandbookRepository.getBrandbook).mockResolvedValue(brandbook);
    vi.mocked(structureExamplesRepository.listStructureExamples).mockResolvedValue([
      { id: 'ex-1', configProfileId: 'cfg-1', filename: 'a.md', content: 'conteudo A' },
    ]);
    vi.mocked(runThemeStrategist).mockResolvedValue({ theme: 'Observabilidade', rationale: 'r' });
    vi.mocked(runResearcher).mockResolvedValue({ facts: [] });
    vi.mocked(runAngleDefiner).mockResolvedValue({ thesis: 't', pov: 'p' });
    vi.mocked(runWriter).mockResolvedValue({ draft: 'rascunho' });
    vi.mocked(runHookEditor).mockResolvedValue({ finalPost: 'post com gancho', hookVariations: ['A'] });
    vi.mocked(runReviewer).mockResolvedValue({ finalPost: 'post revisado', notes: [], passed: true });

    await runPipeline(fakeSupabase, baseConfig);

    expect(structureExamplesRepository.listStructureExamples).toHaveBeenCalledWith(fakeSupabase, 'cfg-1');
    expect(runWriter).toHaveBeenCalledWith(
      expect.objectContaining({ brandbook, structureExamples: ['conteudo A'] }),
      baseConfig
    );
    expect(runReviewer).toHaveBeenCalledWith(expect.objectContaining({ brandbook }), baseConfig);
  });
});

describe('runPipeline failure path', () => {
  it('stops at the failing stage, marks the execution as failed, and attaches the executionId', async () => {
    vi.mocked(runThemeStrategist).mockResolvedValue({ theme: 'Observabilidade', rationale: 'r' });
    vi.mocked(runResearcher).mockResolvedValue({ facts: [] });
    vi.mocked(runAngleDefiner).mockResolvedValue({ thesis: 't', pov: 'p' });
    vi.mocked(runWriter).mockRejectedValue(new Error('boom'));

    try {
      await runPipeline(fakeSupabase, baseConfig);
      expect.unreachable('runPipeline should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(StageError);
      expect((error as StageError).stage).toBe('writer');
      expect((error as StageError).executionId).toBe('exec-1');
    }

    expect(repository.saveStageResult).toHaveBeenCalledTimes(3);
    expect(repository.markExecutionFailed).toHaveBeenCalledWith(
      fakeSupabase,
      'exec-1',
      'writer',
      expect.stringContaining('boom')
    );
    expect(runHookEditor).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/orchestrator.test.ts`
Expected: FAIL — the new "fetches the brandbook and structure examples" test fails because `runPipeline` doesn't call `getBrandbook`/`listStructureExamples` yet, and the mocked modules aren't imported by `orchestrator.ts` yet either.

- [ ] **Step 3: Update the implementation**

Replace the full contents of `src/lib/pipeline/orchestrator.ts` with:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConfigProfile, PipelineState, StageName } from './types';
import { StageError } from './types';
import { runThemeStrategist } from './stages/themeStrategist';
import { runResearcher } from './stages/researcher';
import { runAngleDefiner } from './stages/angleDefiner';
import { runWriter } from './stages/writer';
import { runHookEditor } from './stages/hookEditor';
import { runReviewer } from './stages/reviewer';
import { resolveModel } from './defaultModels';
import {
  createExecution,
  saveStageResult,
  markExecutionFailed,
  markExecutionSuccess,
  saveGeneratedPost,
} from './repository';
import { getBrandbook } from '../brandbook/repository';
import { listStructureExamples } from '../configProfiles/structureExamples/repository';

export interface PipelineResult {
  executionId: string;
  finalPost: string;
  hookVariations: string[];
  trace: PipelineState;
}

export async function runPipeline(
  supabase: SupabaseClient,
  config: ConfigProfile,
  inputTheme?: string
): Promise<PipelineResult> {
  const execution = await createExecution(supabase, config.id, inputTheme ?? null);
  const brandbook = await getBrandbook(supabase);
  const structureExamples = (await listStructureExamples(supabase, config.id)).map((example) => example.content);
  const state: PipelineState = {};

  async function runStage<T>(stage: StageName, fn: () => Promise<T>, input: unknown): Promise<T> {
    const start = Date.now();
    try {
      const output = await fn();
      await saveStageResult(
        supabase,
        execution.id,
        stage,
        input,
        output,
        resolveModel(stage, config.modelOverrides),
        Date.now() - start
      );
      return output;
    } catch (cause) {
      const stageError = cause instanceof StageError ? cause : new StageError(stage, cause);
      stageError.executionId = execution.id;
      await markExecutionFailed(supabase, execution.id, stageError.stage, stageError.message);
      throw stageError;
    }
  }

  const themeResult = await runStage(
    'theme',
    () => runThemeStrategist({ theme: inputTheme, niche: config.niche, objective: config.objective }, config),
    { theme: inputTheme, niche: config.niche }
  );
  state.theme = themeResult.theme;
  state.themeRationale = themeResult.rationale;

  const researchResult = await runStage(
    'research',
    () => runResearcher({ theme: state.theme! }, config),
    { theme: state.theme }
  );
  state.facts = researchResult.facts;

  const angleResult = await runStage(
    'angle',
    () => runAngleDefiner({ theme: state.theme!, facts: state.facts! }, config),
    { theme: state.theme, facts: state.facts }
  );
  state.thesis = angleResult.thesis;
  state.pov = angleResult.pov;

  const writerResult = await runStage(
    'writer',
    () =>
      runWriter(
        {
          thesis: state.thesis!,
          pov: state.pov!,
          facts: state.facts!,
          template: config.template,
          toneOfVoice: config.toneOfVoice,
          brandbook,
          structureExamples,
        },
        config
      ),
    { thesis: state.thesis, pov: state.pov }
  );
  state.draft = writerResult.draft;

  const hookResult = await runStage('hook', () => runHookEditor({ draft: state.draft! }, config), {
    draft: state.draft,
  });
  state.finalPost = hookResult.finalPost;
  state.hookVariations = hookResult.hookVariations;

  const reviewResult = await runStage(
    'reviewer',
    () =>
      runReviewer(
        { finalPost: state.finalPost!, objective: config.objective, toneOfVoice: config.toneOfVoice, brandbook },
        config
      ),
    { finalPost: state.finalPost }
  );
  state.finalPost = reviewResult.finalPost;
  state.reviewNotes = reviewResult.notes;
  state.reviewPassed = reviewResult.passed;

  await saveGeneratedPost(supabase, execution.id, state.finalPost!, state.hookVariations ?? []);
  await markExecutionSuccess(supabase, execution.id);

  return {
    executionId: execution.id,
    finalPost: state.finalPost!,
    hookVariations: state.hookVariations ?? [],
    trace: state,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/orchestrator.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 4b: Type-check and full suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: all test files pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/orchestrator.ts src/lib/pipeline/orchestrator.test.ts
git commit -m "feat: fetch brandbook and structure examples in the orchestrator"
```

---

### Task 13: Navigation — add Brandbook link

**Files:**
- Modify: `src/components/Nav.tsx`

- [ ] **Step 1: Add the Brandbook link**

In `src/components/Nav.tsx`, find:

```ts
const LINKS = [
  { href: "/", label: "Início" },
  { href: "/perfis", label: "Perfis" },
  { href: "/gerar", label: "Gerar post" },
];
```

Replace with:

```ts
const LINKS = [
  { href: "/", label: "Início" },
  { href: "/brandbook", label: "Brandbook" },
  { href: "/perfis", label: "Perfis" },
  { href: "/gerar", label: "Gerar post" },
];
```

No other changes to this file — the existing `LINKS.map(...)` rendering and active-link logic already handle any number of entries.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Nav.tsx
git commit -m "feat: add Brandbook link to navigation"
```

---

### Task 14: Brandbook page

**Files:**
- Create: `app/brandbook/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { useEffect, useState, type FormEvent } from "react";

interface Brandbook {
  id: string;
  name: string;
  role: string;
  company: string;
  industry: string;
  bio: string;
  values: string;
  voiceReferences: string;
}

export default function BrandbookPage() {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [bio, setBio] = useState("");
  const [values, setValues] = useState("");
  const [voiceReferences, setVoiceReferences] = useState("");

  useEffect(() => {
    fetch("/api/brandbook")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((brandbook: Brandbook | null) => {
        if (brandbook) {
          setName(brandbook.name);
          setRole(brandbook.role);
          setCompany(brandbook.company);
          setIndustry(brandbook.industry);
          setBio(brandbook.bio);
          setValues(brandbook.values);
          setVoiceReferences(brandbook.voiceReferences);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/brandbook", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role, company, industry, bio, values, voiceReferences }),
    });

    setSaving(false);

    if (!res.ok) {
      setError("Não deu para salvar o Brandbook. Confira os campos obrigatórios.");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  if (!loaded) {
    return (
      <main>
        <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Carregando…</div>
      </main>
    );
  }

  return (
    <main>
      <div className="rise" style={{ marginBottom: 32 }}>
        <span className="pill-badge pill-badge--ink" style={{ marginBottom: 14 }}>
          <span className="badge-dot" />
          Config Layer
        </span>
        <h1 style={{ fontSize: 38, marginTop: 14 }}>Brandbook</h1>
        <p style={{ color: "var(--ink-soft)", marginTop: 8, maxWidth: 520 }}>
          A identidade de quem produz os posts. Todos os perfis de voz usam
          esse mesmo Brandbook para moldar estrutura e tom.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card rise" style={{ padding: 28, maxWidth: 640 }}>
        <div className="form-grid-2" style={{ marginBottom: 20 }}>
          <div>
            <label className="field-label">Nome</label>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Cargo</label>
            <input className="field-input" value={role} onChange={(e) => setRole(e.target.value)} required />
          </div>
        </div>

        <div className="form-grid-2" style={{ marginBottom: 20 }}>
          <div>
            <label className="field-label">Empresa</label>
            <input className="field-input" value={company} onChange={(e) => setCompany(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Setor</label>
            <input className="field-input" value={industry} onChange={(e) => setIndustry(e.target.value)} required />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Biografia e trajetória</label>
          <textarea className="field-input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="field-label">Valores e posicionamento</label>
          <textarea className="field-input" rows={3} value={values} onChange={(e) => setValues(e.target.value)} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label className="field-label">Referências de voz</label>
          <textarea
            className="field-input"
            rows={2}
            placeholder="Expressões recorrentes, hashtags, frases de assinatura"
            value={voiceReferences}
            onChange={(e) => setVoiceReferences(e.target.value)}
          />
        </div>

        {error && <div style={{ color: "#a13a3a", fontSize: 13.5, marginBottom: 16 }}>{error}</div>}

        <button className="btn btn--ink" type="submit" disabled={saving}>
          {saving ? "Salvando…" : saved ? "Salvo ✓" : "Salvar Brandbook"}
        </button>
      </form>
    </main>
  );
}
```

This reuses the `field-label`/`field-input`/`form-grid-2`/`card`/`btn`/`pill-badge` classes already defined in `app/globals.css` — no CSS changes needed for this task.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/brandbook/page.tsx
git commit -m "feat: add Brandbook page"
```

---

### Task 15: Structure examples UI on the Perfis page

**Files:**
- Create: `src/components/StructureExamples.tsx`
- Modify: `app/perfis/page.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useState, type ChangeEvent } from "react";

interface StructureExample {
  id: string;
  filename: string;
}

export function StructureExamplesSection({ profileId }: { profileId: string }) {
  const [examples, setExamples] = useState<StructureExample[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch(`/api/config-profiles/${profileId}/examples`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setExamples)
      .catch(() => setExamples([]));
  }

  useEffect(load, [profileId]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);

    const content = await file.text();

    const res = await fetch(`/api/config-profiles/${profileId}/examples`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, content }),
    });

    setUploading(false);

    if (!res.ok) {
      setError("Não deu para enviar esse arquivo. Confira se é .md ou .txt e se o limite de 5 não foi atingido.");
      return;
    }

    load();
  }

  async function handleDelete(exampleId: string) {
    await fetch(`/api/config-profiles/${profileId}/examples/${exampleId}`, { method: "DELETE" });
    load();
  }

  const atLimit = (examples?.length ?? 0) >= 5;

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
      <div className="field-label" style={{ marginBottom: 10 }}>
        Exemplos de estrutura ({examples?.length ?? 0}/5)
      </div>

      {examples && examples.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {examples.map((example) => (
            <div
              key={example.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}
            >
              <span style={{ color: "var(--ink-soft)" }}>{example.filename}</span>
              <button
                onClick={() => handleDelete(example.id)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, padding: 0 }}
              >
                remover
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ color: "#a13a3a", fontSize: 12, marginBottom: 8 }}>{error}</div>}

      <label
        className="btn btn--ghost"
        style={{
          width: "100%",
          fontSize: 12.5,
          padding: "9px 16px",
          opacity: atLimit || uploading ? 0.5 : 1,
          pointerEvents: atLimit || uploading ? "none" : "auto",
        }}
      >
        {uploading ? "Enviando…" : atLimit ? "Limite atingido" : "+ Anexar exemplo (.md/.txt)"}
        <input type="file" accept=".md,.txt" onChange={handleFile} style={{ display: "none" }} />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the Perfis page**

In `app/perfis/page.tsx`, add the import at the top of the file, alongside the existing imports:

```ts
import { StructureExamplesSection } from "@/components/StructureExamples";
```

Then, inside the profile card rendering, add `<StructureExamplesSection profileId={profile.id} />` right after the "Gerar com este perfil" link. Find this block:

```tsx
              <a href={`/gerar?perfil=${profile.id}`} className="btn btn--ghost" style={{ width: "100%" }}>
                Gerar com este perfil
              </a>
            </div>
          ))}
```

Replace with:

```tsx
              <a href={`/gerar?perfil=${profile.id}`} className="btn btn--ghost" style={{ width: "100%" }}>
                Gerar com este perfil
              </a>
              <StructureExamplesSection profileId={profile.id} />
            </div>
          ))}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/StructureExamples.tsx app/perfis/page.tsx
git commit -m "feat: add structure examples UI to the Perfis page"
```

---

### Task 16: Full test suite and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all test files pass, including the 8 new/modified ones from this plan (brandbook schema, brandbook repository, brandbook route, structure examples schema, structure examples repository, structure examples collection route, structure example delete route, writer, reviewer, orchestrator).

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test with the dev server**

This requires real credentials in `.env.local` and the migrations from `supabase/migrations/0001_init.sql` AND `supabase/migrations/0002_brandbook_and_examples.sql` applied to that Supabase project.

Run: `npm run dev`, then in a browser:
1. Visit `/brandbook`, fill in the form, save — reload the page and confirm the fields persist.
2. Visit `/perfis`, pick an existing profile (or create one), attach a `.md` file as a structure example, confirm it appears in the list, then remove it.
3. Visit `/gerar`, run a generation against a profile that has a Brandbook and at least one structure example attached, and confirm the generated post reads consistently with the Brandbook's tone/values (this step depends on real OpenRouter/Tavily/Supabase credentials, same limitation noted in the original plan's Task 21).

- [ ] **Step 4: Commit** (only if manual verification required fixes)

If Step 3 surfaces a bug, fix it, add/adjust a test that would have caught it, and commit:

```bash
git add -A
git commit -m "fix: <description of what manual verification caught>"
```

---

## Self-Review Notes

- **Spec coverage:** every section of the design spec has a corresponding task — data model (Tasks 1, 6), Brandbook CRUD (Tasks 3-5), structure examples CRUD (Tasks 6-9), pipeline integration limited to Redator/Revisor only (Tasks 10-12, with the other 4 stages explicitly untouched), frontend (Tasks 13-15), error handling (400/404 cases covered in Tasks 5, 8, 9), and testing conventions matching the established repository/route patterns throughout.
- **Type consistency:** `Brandbook` (Task 2) is defined once in `src/lib/pipeline/types.ts` and reused verbatim by `writer.ts`, `reviewer.ts`, and `orchestrator.ts` (Tasks 10-12) — field names (`values`, `voiceReferences`) match between the type, the repository's `mapRow`, and every stage's `formatBrandbook` helper. `StructureExample`/`StructureExampleInput` (Tasks 6-7) are defined once and reused by the API routes (Tasks 8-9) with no renamed duplicates.
- **No placeholders:** every step contains complete, runnable code — no TODOs or "similar to Task N" shortcuts.
