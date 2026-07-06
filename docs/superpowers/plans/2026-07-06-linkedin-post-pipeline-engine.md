# Motor de Geração de Posts para LinkedIn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pipeline engine that turns a theme (or niche) into a finished LinkedIn post — Config Layer, Orchestrator, and the 6-stage pipeline (Theme Strategist, Researcher agent, Angle Definer, Writer, Hook Editor, Reviewer) — exposed via a Next.js API, persisted in Supabase, routed through OpenRouter.

**Architecture:** A Next.js (App Router) app where `POST /api/generate` synchronously runs `runPipeline()`, an orchestrator that calls 6 stage functions in sequence, persisting each stage's result to Supabase and failing fast (no retry) on the first error. Five stages are single structured LLM calls (via OpenRouter through the AI SDK); the Researcher stage is a real agent that plans searches, calls the Tavily API, and synthesizes cited facts. Config profiles (tone, template, niche, objective, per-stage model overrides) are CRUD resources backed by Supabase.

**Tech Stack:** Next.js (App Router, TypeScript), Vercel AI SDK, `@openrouter/ai-sdk-provider`, Supabase (`@supabase/supabase-js`), Tavily search API, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-04-linkedin-post-pipeline-design.md`

---

## File Structure

```
package.json
tsconfig.json
next.config.mjs
vitest.config.ts
.env.example
.gitignore
app/
  layout.tsx
  page.tsx
  api/
    config-profiles/
      route.ts                      # POST, GET (collection)
      route.test.ts
      [id]/
        route.ts                    # GET, PATCH (single)
        route.test.ts
    generate/
      route.ts                      # POST /api/generate
      route.test.ts
src/
  lib/
    supabase/
      client.ts
      client.test.ts
    openrouter.ts
    tavily.ts
    tavily.test.ts
    configProfiles/
      schema.ts
      schema.test.ts
      repository.ts
      repository.test.ts
    pipeline/
      types.ts
      types.test.ts
      defaultModels.ts
      defaultModels.test.ts
      repository.ts
      repository.test.ts
      orchestrator.ts
      orchestrator.test.ts
      stages/
        themeStrategist.ts
        themeStrategist.test.ts
        researcher.ts
        researcher.test.ts
        angleDefiner.ts
        angleDefiner.test.ts
        writer.ts
        writer.test.ts
        hookEditor.ts
        hookEditor.test.ts
        reviewer.ts
        reviewer.test.ts
supabase/
  migrations/
    0001_init.sql
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "postdin-pipeline-engine",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Install runtime dependencies**

Run: `npm install next react react-dom ai @openrouter/ai-sdk-provider @supabase/supabase-js zod`
Expected: dependencies added to `package.json`, `node_modules` created, no errors.

- [ ] **Step 3: Install dev dependencies**

Run: `npm install -D typescript @types/node @types/react vitest vite-tsconfig-paths`
Expected: devDependencies added, no errors.

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 6: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 7: Create `.env.example`**

```
OPENROUTER_API_KEY=
TAVILY_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 8: Create `.gitignore`**

```
node_modules
.next
.env
.env.local
```

- [ ] **Step 9: Create `app/layout.tsx`**

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 10: Create `app/page.tsx`**

```tsx
export default function Home() {
  return <main>Motor de geração de posts para LinkedIn — API em /api/generate</main>;
}
```

- [ ] **Step 11: Verify the scaffold builds**

Run: `npm run build`
Expected: build completes successfully (creates `.next/`), no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs vitest.config.ts .env.example .gitignore app/layout.tsx app/page.tsx
git commit -m "chore: scaffold Next.js + TypeScript + Vitest project"
```

---

### Task 2: Supabase schema migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Write the migration**

```sql
create extension if not exists "pgcrypto";

create table config_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tone_of_voice jsonb not null default '{}'::jsonb,
  objective text not null,
  niche text not null,
  template jsonb not null default '{}'::jsonb,
  model_overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table pipeline_executions (
  id uuid primary key default gen_random_uuid(),
  config_profile_id uuid not null references config_profiles(id),
  input_theme text,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  failed_stage text check (failed_stage in ('theme', 'research', 'angle', 'writer', 'hook', 'reviewer')),
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table stage_results (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references pipeline_executions(id),
  stage_name text not null check (stage_name in ('theme', 'research', 'angle', 'writer', 'hook', 'reviewer')),
  input jsonb not null,
  output jsonb not null,
  model_used text not null,
  duration_ms integer not null,
  created_at timestamptz not null default now()
);

create table generated_posts (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references pipeline_executions(id),
  final_post text not null,
  hook_variations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index stage_results_execution_id_idx on stage_results(execution_id);
create index pipeline_executions_config_profile_id_idx on pipeline_executions(config_profile_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add initial Supabase schema migration"
```

**Note:** applying this migration to a real Supabase project (via `supabase db push`, the Supabase CLI, or the `apply_migration` MCP tool) and filling in `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is required before the API can run end-to-end — this is a one-time environment setup step, not part of the automated task sequence below (those tasks are all testable with mocks, no live database needed).

---

### Task 3: Supabase client wrapper

**Files:**
- Create: `src/lib/supabase/client.ts`
- Test: `src/lib/supabase/client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({ mocked: true }),
}));

import { createSupabaseClient } from './client';
import { createClient } from '@supabase/supabase-js';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('createSupabaseClient', () => {
  it('throws when SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are missing', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createSupabaseClient()).toThrow('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  });

  it('creates a client when env vars are present', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const client = createSupabaseClient();

    expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'service-role-key');
    expect(client).toEqual({ mocked: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/supabase/client.test.ts`
Expected: FAIL with "Cannot find module './client'" (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  return createClient(url, key);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/supabase/client.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/client.ts src/lib/supabase/client.test.ts
git commit -m "feat: add Supabase client wrapper"
```

---

### Task 4: Pipeline core types

**Files:**
- Create: `src/lib/pipeline/types.ts`
- Test: `src/lib/pipeline/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { StageError } from './types';

describe('StageError', () => {
  it('formats the message using the cause error message', () => {
    const error = new StageError('writer', new Error('rate limited'));

    expect(error.message).toBe('Stage "writer" failed: rate limited');
    expect(error.stage).toBe('writer');
    expect(error.executionId).toBeUndefined();
  });

  it('formats the message using String(cause) when cause is not an Error', () => {
    const error = new StageError('hook', 'timeout');

    expect(error.message).toBe('Stage "hook" failed: timeout');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/types.test.ts`
Expected: FAIL with "Cannot find module './types'"

- [ ] **Step 3: Write the implementation**

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/types.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/types.ts src/lib/pipeline/types.test.ts
git commit -m "feat: add pipeline core types (ConfigProfile, Fact, PipelineState, StageError)"
```

---

### Task 5: Default stage models and model resolution

**Files:**
- Create: `src/lib/pipeline/defaultModels.ts`
- Test: `src/lib/pipeline/defaultModels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_STAGE_MODELS, resolveModel } from './defaultModels';

describe('resolveModel', () => {
  it('returns the override when present', () => {
    expect(resolveModel('writer', { writer: 'openai/gpt-5.2' })).toBe('openai/gpt-5.2');
  });

  it('falls back to the default stage model when no override is given', () => {
    expect(resolveModel('writer', {})).toBe(DEFAULT_STAGE_MODELS.writer);
  });

  it('falls back to the default when overrides is undefined', () => {
    expect(resolveModel('theme', undefined)).toBe(DEFAULT_STAGE_MODELS.theme);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/defaultModels.test.ts`
Expected: FAIL with "Cannot find module './defaultModels'"

- [ ] **Step 3: Write the implementation**

```ts
import type { StageName } from './types';

// Defaults chosen for cost/quality fit per task; swap freely as the
// OpenRouter catalog evolves — nothing else in the codebase depends on
// these specific IDs.
export const DEFAULT_STAGE_MODELS: Record<StageName, string> = {
  theme: 'anthropic/claude-sonnet-5',
  research: 'anthropic/claude-haiku-4-5',
  angle: 'anthropic/claude-sonnet-5',
  writer: 'anthropic/claude-sonnet-5',
  hook: 'anthropic/claude-sonnet-5',
  reviewer: 'anthropic/claude-sonnet-5',
};

export function resolveModel(stage: StageName, overrides?: Partial<Record<StageName, string>>): string {
  return overrides?.[stage] ?? DEFAULT_STAGE_MODELS[stage];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/defaultModels.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/defaultModels.ts src/lib/pipeline/defaultModels.test.ts
git commit -m "feat: add default stage models and model resolution"
```

---

### Task 6: OpenRouter provider setup

**Files:**
- Create: `src/lib/openrouter.ts`

- [ ] **Step 1: Write the implementation**

```ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// apiKey is intentionally possibly undefined here — createOpenRouter's own
// loadApiKey falls back to reading OPENROUTER_API_KEY itself and throws a
// clear "OpenRouter API key is missing" error at call time if it's unset.
// Don't coerce to '' — that skips the fallback and turns a missing key into
// an opaque 401 instead of that clear error.
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/openrouter.ts
git commit -m "feat: add OpenRouter provider setup"
```

---

### Task 7: Tavily search tool

**Files:**
- Create: `src/lib/tavily.ts`
- Test: `src/lib/tavily.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tavilySearch } from './tavily';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
  process.env = { ...originalEnv, TAVILY_API_KEY: 'test-key' };
});

afterEach(() => {
  process.env = originalEnv;
  global.fetch = originalFetch;
});

describe('tavilySearch', () => {
  it('returns mapped search results on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ title: 'A', url: 'https://a.com', content: 'texto' }] }),
    }) as unknown as typeof fetch;

    const results = await tavilySearch('observabilidade');

    expect(results).toEqual([{ title: 'A', url: 'https://a.com', content: 'texto' }]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when the response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    await expect(tavilySearch('observabilidade')).rejects.toThrow('Tavily search failed with status 500');
  });

  it('throws when TAVILY_API_KEY is missing', async () => {
    delete process.env.TAVILY_API_KEY;

    await expect(tavilySearch('observabilidade')).rejects.toThrow('TAVILY_API_KEY must be set');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tavily.test.ts`
Expected: FAIL with "Cannot find module './tavily'"

- [ ] **Step 3: Write the implementation**

```ts
export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
}

export async function tavilySearch(query: string): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY must be set');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 5 }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  const data = await response.json();
  return (data.results ?? []).map((result: { title: string; url: string; content: string }) => ({
    title: result.title,
    url: result.url,
    content: result.content,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tavily.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tavily.ts src/lib/tavily.test.ts
git commit -m "feat: add Tavily search client"
```

---

### Task 8: Stage 1 — Estrategista de Tema

**Files:**
- Create: `src/lib/pipeline/stages/themeStrategist.ts`
- Test: `src/lib/pipeline/stages/themeStrategist.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { runThemeStrategist } from './themeStrategist';
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

describe('runThemeStrategist', () => {
  it('returns the given theme without calling the LLM when a theme is provided', async () => {
    const result = await runThemeStrategist(
      { theme: 'CI/CD para times pequenos', niche: 'devops', objective: 'gerar autoridade' },
      baseConfig
    );

    expect(result.theme).toBe('CI/CD para times pequenos');
    expect(ai.generateObject).not.toHaveBeenCalled();
  });

  it('generates a theme from niche and objective when no theme is provided', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { theme: 'Observabilidade em microsserviços', rationale: 'É uma dor comum no nicho.' },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    const result = await runThemeStrategist({ niche: 'devops', objective: 'gerar autoridade' }, baseConfig);

    expect(result.theme).toBe('Observabilidade em microsserviços');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateObject).mockRejectedValueOnce(new Error('rate limited'));

    await expect(
      runThemeStrategist({ niche: 'devops', objective: 'gerar autoridade' }, baseConfig)
    ).rejects.toThrow(StageError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/stages/themeStrategist.test.ts`
Expected: FAIL with "Cannot find module './themeStrategist'"

- [ ] **Step 3: Write the implementation**

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile } from '../types';

const themeSchema = z.object({
  theme: z.string(),
  rationale: z.string(),
});

export interface ThemeStrategistResult {
  theme: string;
  rationale: string;
}

export async function runThemeStrategist(
  input: { theme?: string; niche: string; objective: string },
  config: ConfigProfile
): Promise<ThemeStrategistResult> {
  if (input.theme) {
    return { theme: input.theme, rationale: 'Tema fornecido diretamente pelo usuário.' };
  }

  try {
    const { object } = await generateObject({
      model: openrouter(resolveModel('theme', config.modelOverrides)),
      schema: themeSchema,
      prompt: `Você é um estrategista de conteúdo para LinkedIn. Dado o nicho "${input.niche}" e o objetivo "${input.objective}", proponha UM tema específico e interessante para um post, e explique em uma frase por que esse tema funciona para esse nicho e objetivo.`,
    });
    return object;
  } catch (cause) {
    throw new StageError('theme', cause);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/stages/themeStrategist.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/stages/themeStrategist.ts src/lib/pipeline/stages/themeStrategist.test.ts
git commit -m "feat: add Estrategista de Tema stage"
```

---

### Task 9: Stage 2 — Pesquisador (agente com Tavily)

**Files:**
- Create: `src/lib/pipeline/stages/researcher.ts`
- Test: `src/lib/pipeline/stages/researcher.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { runResearcher } from './researcher';
import { StageError, type ConfigProfile } from '../types';
import * as ai from 'ai';
import { tavilySearch } from '../../tavily';

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateObject: vi.fn() };
});
vi.mock('../../tavily');

const baseConfig: ConfigProfile = {
  id: 'cfg-1',
  name: 'Test',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

describe('runResearcher', () => {
  it('plans searches, calls Tavily for each query, and synthesizes facts with sources', async () => {
    vi.mocked(ai.generateObject)
      .mockResolvedValueOnce({
        object: { queries: ['observabilidade microsserviços 2026', 'custo de downtime devops'] },
      } as Awaited<ReturnType<typeof ai.generateObject>>)
      .mockResolvedValueOnce({
        object: {
          facts: [
            {
              claim: 'Downtime custa em média X por hora para times pequenos',
              sources: [{ title: 'Fonte A', url: 'https://a.com' }],
              confidence: 'high',
            },
          ],
        },
      } as Awaited<ReturnType<typeof ai.generateObject>>);

    vi.mocked(tavilySearch).mockResolvedValue([{ title: 'Fonte A', url: 'https://a.com', content: 'conteúdo' }]);

    const result = await runResearcher({ theme: 'Observabilidade' }, baseConfig);

    expect(tavilySearch).toHaveBeenCalledTimes(2);
    expect(result.facts[0].confidence).toBe('high');
    expect(result.facts[0].sources[0].url).toBe('https://a.com');
  });

  it('throws a StageError when the search tool fails', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { queries: ['q1', 'q2'] },
    } as Awaited<ReturnType<typeof ai.generateObject>>);
    vi.mocked(tavilySearch).mockRejectedValue(new Error('network error'));

    await expect(runResearcher({ theme: 'Observabilidade' }, baseConfig)).rejects.toThrow(StageError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/stages/researcher.test.ts`
Expected: FAIL with "Cannot find module './researcher'"

- [ ] **Step 3: Write the implementation**

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile, type Fact } from '../types';
import { tavilySearch } from '../../tavily';

const querySchema = z.object({ queries: z.array(z.string()).min(2).max(4) });

const factsSchema = z.object({
  facts: z.array(
    z.object({
      claim: z.string(),
      sources: z.array(z.object({ title: z.string(), url: z.string() })),
      confidence: z.enum(['high', 'low']),
    })
  ),
});

export interface ResearcherResult {
  facts: Fact[];
}

export async function runResearcher(input: { theme: string }, config: ConfigProfile): Promise<ResearcherResult> {
  try {
    const model = openrouter(resolveModel('research', config.modelOverrides));

    const { object: plan } = await generateObject({
      model,
      schema: querySchema,
      prompt: `Planeje de 2 a 4 buscas na web para reunir dados, exemplos e estatísticas reais sobre o tema: "${input.theme}". Cada busca deve ser uma query curta e específica.`,
    });

    const searchResults = await Promise.all(plan.queries.map((query) => tavilySearch(query)));
    const flatResults = searchResults.flat();

    const { object } = await generateObject({
      model,
      schema: factsSchema,
      prompt: `Com base nestes resultados de busca:\n${JSON.stringify(flatResults)}\n\nExtraia de 3 a 6 fatos, dados ou estatísticas relevantes sobre "${input.theme}". Para cada fato, cite a(s) fonte(s) (título e url) usadas. Se não houver uma fonte confiável para sustentar uma alegação, marque confidence como "low"; caso contrário, "high".`,
    });

    return object;
  } catch (cause) {
    throw new StageError('research', cause);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/stages/researcher.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/stages/researcher.ts src/lib/pipeline/stages/researcher.test.ts
git commit -m "feat: add Pesquisador agent stage (Tavily-backed)"
```

---

### Task 10: Stage 3 — Definidor de Ângulo

**Files:**
- Create: `src/lib/pipeline/stages/angleDefiner.ts`
- Test: `src/lib/pipeline/stages/angleDefiner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { runAngleDefiner } from './angleDefiner';
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

describe('runAngleDefiner', () => {
  it('returns the thesis and pov from the model', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { thesis: 'Observabilidade é subestimada em times pequenos', pov: 'Times pequenos sofrem mais com isso' },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    const result = await runAngleDefiner({ theme: 'Observabilidade', facts: [] }, baseConfig);

    expect(result.thesis).toBe('Observabilidade é subestimada em times pequenos');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateObject).mockRejectedValueOnce(new Error('timeout'));

    await expect(runAngleDefiner({ theme: 'Observabilidade', facts: [] }, baseConfig)).rejects.toThrow(StageError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/stages/angleDefiner.test.ts`
Expected: FAIL with "Cannot find module './angleDefiner'"

- [ ] **Step 3: Write the implementation**

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile, type Fact } from '../types';

const angleSchema = z.object({ thesis: z.string(), pov: z.string() });

export interface AngleDefinerResult {
  thesis: string;
  pov: string;
}

export async function runAngleDefiner(
  input: { theme: string; facts: Fact[] },
  config: ConfigProfile
): Promise<AngleDefinerResult> {
  try {
    const { object } = await generateObject({
      model: openrouter(resolveModel('angle', config.modelOverrides)),
      schema: angleSchema,
      prompt: `Tema: "${input.theme}"\nFatos disponíveis: ${JSON.stringify(input.facts)}\n\nDefina uma tese (thesis) específica e um ponto de vista (pov) claro e defensável para um post de LinkedIn sobre esse tema, usando os fatos acima como apoio.`,
    });
    return object;
  } catch (cause) {
    throw new StageError('angle', cause);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/stages/angleDefiner.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/stages/angleDefiner.ts src/lib/pipeline/stages/angleDefiner.test.ts
git commit -m "feat: add Definidor de Ângulo stage"
```

---

### Task 11: Stage 4 — Redator

**Files:**
- Create: `src/lib/pipeline/stages/writer.ts`
- Test: `src/lib/pipeline/stages/writer.test.ts`

- [ ] **Step 1: Write the failing test**

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

describe('runWriter', () => {
  it('returns the draft text from the model', async () => {
    vi.mocked(ai.generateText).mockResolvedValueOnce({
      text: 'Rascunho do post...',
    } as Awaited<ReturnType<typeof ai.generateText>>);

    const result = await runWriter({ thesis: 't', pov: 'p', facts: [], template: {}, toneOfVoice: {} }, baseConfig);

    expect(result.draft).toBe('Rascunho do post...');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateText).mockRejectedValueOnce(new Error('overloaded'));

    await expect(
      runWriter({ thesis: 't', pov: 'p', facts: [], template: {}, toneOfVoice: {} }, baseConfig)
    ).rejects.toThrow(StageError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/stages/writer.test.ts`
Expected: FAIL with "Cannot find module './writer'"

- [ ] **Step 3: Write the implementation**

```ts
import { generateText } from 'ai';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile, type Fact } from '../types';

export interface WriterResult {
  draft: string;
}

export async function runWriter(
  input: {
    thesis: string;
    pov: string;
    facts: Fact[];
    template: Record<string, unknown>;
    toneOfVoice: Record<string, unknown>;
  },
  config: ConfigProfile
): Promise<WriterResult> {
  try {
    const { text } = await generateText({
      model: openrouter(resolveModel('writer', config.modelOverrides)),
      prompt: `Escreva o rascunho de um post de LinkedIn.\n\nTese: ${input.thesis}\nPonto de vista: ${input.pov}\nFatos de apoio: ${JSON.stringify(input.facts)}\nTemplate/estrutura: ${JSON.stringify(input.template)}\nTom de voz: ${JSON.stringify(input.toneOfVoice)}\n\nEscreva apenas o corpo do post, sem título nem comentários.`,
    });
    return { draft: text };
  } catch (cause) {
    throw new StageError('writer', cause);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/stages/writer.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/stages/writer.ts src/lib/pipeline/stages/writer.test.ts
git commit -m "feat: add Redator stage"
```

---

### Task 12: Stage 5 — Editor de Gancho

**Files:**
- Create: `src/lib/pipeline/stages/hookEditor.ts`
- Test: `src/lib/pipeline/stages/hookEditor.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { runHookEditor } from './hookEditor';
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

describe('runHookEditor', () => {
  it('returns the final post and hook variations', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { finalPost: 'Gancho novo\n\nResto do post...', hookVariations: ['Gancho A', 'Gancho B'] },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    const result = await runHookEditor({ draft: 'Gancho velho\n\nResto do post...' }, baseConfig);

    expect(result.hookVariations).toHaveLength(2);
    expect(result.finalPost).toBe('Gancho novo\n\nResto do post...');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateObject).mockRejectedValueOnce(new Error('bad request'));

    await expect(runHookEditor({ draft: 'x' }, baseConfig)).rejects.toThrow(StageError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/stages/hookEditor.test.ts`
Expected: FAIL with "Cannot find module './hookEditor'"

- [ ] **Step 3: Write the implementation**

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile } from '../types';

const hookSchema = z.object({
  finalPost: z.string(),
  hookVariations: z.array(z.string()).min(2).max(3),
});

export interface HookEditorResult {
  finalPost: string;
  hookVariations: string[];
}

export async function runHookEditor(input: { draft: string }, config: ConfigProfile): Promise<HookEditorResult> {
  try {
    const { object } = await generateObject({
      model: openrouter(resolveModel('hook', config.modelOverrides)),
      schema: hookSchema,
      prompt: `Este é o rascunho de um post de LinkedIn:\n\n${input.draft}\n\nReescreva SOMENTE as 2-3 primeiras linhas (o gancho), mantendo o resto do post idêntico, para maximizar o "ver mais" no feed. Retorne o post completo com o novo gancho em "finalPost", e gere de 2 a 3 variações alternativas do gancho em "hookVariations" (só as primeiras linhas de cada variação, não o post inteiro).`,
    });
    return object;
  } catch (cause) {
    throw new StageError('hook', cause);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/stages/hookEditor.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/stages/hookEditor.ts src/lib/pipeline/stages/hookEditor.test.ts
git commit -m "feat: add Editor de Gancho stage"
```

---

### Task 13: Stage 6 — Revisor/Crítico

**Files:**
- Create: `src/lib/pipeline/stages/reviewer.ts`
- Test: `src/lib/pipeline/stages/reviewer.test.ts`

- [ ] **Step 1: Write the failing test**

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

describe('runReviewer', () => {
  it('returns the reviewed post with notes and a passed flag', async () => {
    vi.mocked(ai.generateObject).mockResolvedValueOnce({
      object: { finalPost: 'Post revisado', notes: ['Cortado trecho redundante'], passed: true },
    } as Awaited<ReturnType<typeof ai.generateObject>>);

    const result = await runReviewer(
      { finalPost: 'Post original', objective: 'gerar autoridade', toneOfVoice: {} },
      baseConfig
    );

    expect(result.passed).toBe(true);
    expect(result.finalPost).toBe('Post revisado');
  });

  it('throws a StageError when the LLM call fails', async () => {
    vi.mocked(ai.generateObject).mockRejectedValueOnce(new Error('invalid schema'));

    await expect(
      runReviewer({ finalPost: 'x', objective: 'gerar autoridade', toneOfVoice: {} }, baseConfig)
    ).rejects.toThrow(StageError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/stages/reviewer.test.ts`
Expected: FAIL with "Cannot find module './reviewer'"

- [ ] **Step 3: Write the implementation**

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '../../openrouter';
import { resolveModel } from '../defaultModels';
import { StageError, type ConfigProfile } from '../types';

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

export async function runReviewer(
  input: { finalPost: string; objective: string; toneOfVoice: Record<string, unknown> },
  config: ConfigProfile
): Promise<ReviewerResult> {
  try {
    const { object } = await generateObject({
      model: openrouter(resolveModel('reviewer', config.modelOverrides)),
      schema: reviewSchema,
      prompt: `Revise este post de LinkedIn:\n\n${input.finalPost}\n\nObjetivo do post: ${input.objective}\nTom de voz esperado: ${JSON.stringify(input.toneOfVoice)}\n\nCorte qualquer trecho redundante ou "gordura", garanta que a voz combina com o tom esperado, e valide se o post cumpre o objetivo. Retorne o post final revisado em "finalPost" (reescreva se necessário), uma lista de observações em "notes", e "passed" como true se o post está pronto para publicar ou false se ainda precisa de ajustes.`,
    });
    return object;
  } catch (cause) {
    throw new StageError('reviewer', cause);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/stages/reviewer.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/stages/reviewer.ts src/lib/pipeline/stages/reviewer.test.ts
git commit -m "feat: add Revisor/Crítico stage"
```

---

### Task 14: Pipeline persistence repository

**Files:**
- Create: `src/lib/pipeline/repository.ts`
- Test: `src/lib/pipeline/repository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createExecution,
  saveStageResult,
  markExecutionFailed,
  markExecutionSuccess,
  saveGeneratedPost,
} from './repository';

function mockInsertSelectSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return { from, insert } as unknown as SupabaseClient & { insert: typeof insert };
}

function mockInsert(error: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ insert });
  return { from, insert } as unknown as SupabaseClient & { insert: typeof insert };
}

function mockUpdateEq(error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ error });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from, update, eq } as unknown as SupabaseClient & { update: typeof update; eq: typeof eq };
}

describe('createExecution', () => {
  it('inserts a running execution and maps the returned row', async () => {
    const supabase = mockInsertSelectSingle({
      id: 'exec-1',
      config_profile_id: 'cfg-1',
      input_theme: null,
      status: 'running',
      failed_stage: null,
      error_message: null,
    });

    const result = await createExecution(supabase, 'cfg-1', null);

    expect(result).toEqual({
      id: 'exec-1',
      configProfileId: 'cfg-1',
      inputTheme: null,
      status: 'running',
      failedStage: null,
      errorMessage: null,
    });
    expect(supabase.from).toHaveBeenCalledWith('pipeline_executions');
    expect(supabase.insert).toHaveBeenCalledWith({
      config_profile_id: 'cfg-1',
      input_theme: null,
      status: 'running',
    });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockInsertSelectSingle(null, { message: 'connection refused' });

    await expect(createExecution(supabase, 'cfg-1', null)).rejects.toThrow(
      'Failed to create execution: connection refused'
    );
  });
});

describe('saveStageResult', () => {
  it('inserts the stage result row', async () => {
    const supabase = mockInsert();

    await saveStageResult(
      supabase,
      'exec-1',
      'theme',
      { niche: 'devops' },
      { theme: 'x', rationale: 'y' },
      'anthropic/claude-sonnet-5',
      1200
    );

    expect(supabase.from).toHaveBeenCalledWith('stage_results');
    expect(supabase.insert).toHaveBeenCalledWith({
      execution_id: 'exec-1',
      stage_name: 'theme',
      input: { niche: 'devops' },
      output: { theme: 'x', rationale: 'y' },
      model_used: 'anthropic/claude-sonnet-5',
      duration_ms: 1200,
    });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockInsert({ message: 'insert failed' });

    await expect(saveStageResult(supabase, 'exec-1', 'theme', {}, {}, 'model', 100)).rejects.toThrow(
      'Failed to save stage result: insert failed'
    );
  });
});

describe('markExecutionFailed', () => {
  it('updates status to failed with stage and error message', async () => {
    const supabase = mockUpdateEq();

    await markExecutionFailed(supabase, 'exec-1', 'writer', 'boom');

    expect(supabase.from).toHaveBeenCalledWith('pipeline_executions');
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failed_stage: 'writer',
        error_message: 'boom',
      })
    );
    expect(supabase.eq).toHaveBeenCalledWith('id', 'exec-1');
  });
});

describe('markExecutionSuccess', () => {
  it('updates status to success', async () => {
    const supabase = mockUpdateEq();

    await markExecutionSuccess(supabase, 'exec-1');

    expect(supabase.from).toHaveBeenCalledWith('pipeline_executions');
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    expect(supabase.eq).toHaveBeenCalledWith('id', 'exec-1');
  });
});

describe('saveGeneratedPost', () => {
  it('inserts the generated post row', async () => {
    const supabase = mockInsert();

    await saveGeneratedPost(supabase, 'exec-1', 'Meu post final', ['Gancho A', 'Gancho B']);

    expect(supabase.from).toHaveBeenCalledWith('generated_posts');
    expect(supabase.insert).toHaveBeenCalledWith({
      execution_id: 'exec-1',
      final_post: 'Meu post final',
      hook_variations: ['Gancho A', 'Gancho B'],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline/repository.test.ts`
Expected: FAIL with "Cannot find module './repository'"

- [ ] **Step 3: Write the implementation**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StageName } from './types';

export interface Execution {
  id: string;
  configProfileId: string;
  inputTheme: string | null;
  status: 'running' | 'success' | 'failed';
  failedStage: StageName | null;
  errorMessage: string | null;
}

export async function createExecution(
  supabase: SupabaseClient,
  configProfileId: string,
  inputTheme: string | null
): Promise<Execution> {
  const { data, error } = await supabase
    .from('pipeline_executions')
    .insert({ config_profile_id: configProfileId, input_theme: inputTheme, status: 'running' })
    .select()
    .single();

  if (error) throw new Error(`Failed to create execution: ${error.message}`);

  return {
    id: data.id,
    configProfileId: data.config_profile_id,
    inputTheme: data.input_theme,
    status: data.status,
    failedStage: data.failed_stage,
    errorMessage: data.error_message,
  };
}

export async function saveStageResult(
  supabase: SupabaseClient,
  executionId: string,
  stageName: StageName,
  input: unknown,
  output: unknown,
  modelUsed: string,
  durationMs: number
): Promise<void> {
  const { error } = await supabase.from('stage_results').insert({
    execution_id: executionId,
    stage_name: stageName,
    input,
    output,
    model_used: modelUsed,
    duration_ms: durationMs,
  });

  if (error) throw new Error(`Failed to save stage result: ${error.message}`);
}

export async function markExecutionFailed(
  supabase: SupabaseClient,
  executionId: string,
  failedStage: StageName,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('pipeline_executions')
    .update({
      status: 'failed',
      failed_stage: failedStage,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq('id', executionId);

  if (error) throw new Error(`Failed to mark execution as failed: ${error.message}`);
}

export async function markExecutionSuccess(supabase: SupabaseClient, executionId: string): Promise<void> {
  const { error } = await supabase
    .from('pipeline_executions')
    .update({ status: 'success', finished_at: new Date().toISOString() })
    .eq('id', executionId);

  if (error) throw new Error(`Failed to mark execution as success: ${error.message}`);
}

export async function saveGeneratedPost(
  supabase: SupabaseClient,
  executionId: string,
  finalPost: string,
  hookVariations: string[]
): Promise<void> {
  const { error } = await supabase.from('generated_posts').insert({
    execution_id: executionId,
    final_post: finalPost,
    hook_variations: hookVariations,
  });

  if (error) throw new Error(`Failed to save generated post: ${error.message}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline/repository.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/repository.ts src/lib/pipeline/repository.test.ts
git commit -m "feat: add pipeline persistence repository"
```

---

### Task 15: Orchestrator

**Files:**
- Create: `src/lib/pipeline/orchestrator.ts`
- Test: `src/lib/pipeline/orchestrator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runPipeline } from './orchestrator';
import { StageError, type ConfigProfile } from './types';
import * as repository from './repository';
import { runThemeStrategist } from './stages/themeStrategist';
import { runResearcher } from './stages/researcher';
import { runAngleDefiner } from './stages/angleDefiner';
import { runWriter } from './stages/writer';
import { runHookEditor } from './stages/hookEditor';
import { runReviewer } from './stages/reviewer';

vi.mock('./repository');
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
Expected: FAIL with "Cannot find module './orchestrator'"

- [ ] **Step 3: Write the implementation**

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
        { finalPost: state.finalPost!, objective: config.objective, toneOfVoice: config.toneOfVoice },
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
Expected: PASS (2 tests)

- [ ] **Step 4b: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. `PipelineState.finalPost` is optional (`string | undefined`), so both call sites above need the `!` assertion — by this point in the sequential flow `finalPost` is always set (assigned by the hook stage, then overwritten by the reviewer stage), but TypeScript can't infer that across the `await` boundaries, so the assertions are required for `tsc` to pass even though the tests already pass without them.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/orchestrator.ts src/lib/pipeline/orchestrator.test.ts
git commit -m "feat: add pipeline orchestrator"
```

---

### Task 16: Config profile schema

**Files:**
- Create: `src/lib/configProfiles/schema.ts`
- Test: `src/lib/configProfiles/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { configProfileInputSchema, configProfileUpdateSchema } from './schema';

describe('configProfileInputSchema', () => {
  it('accepts a minimal valid profile and fills in defaults', () => {
    const result = configProfileInputSchema.parse({
      name: 'Devops Voice',
      objective: 'gerar autoridade',
      niche: 'devops',
    });

    expect(result.toneOfVoice).toEqual({});
    expect(result.template).toEqual({});
    expect(result.modelOverrides).toEqual({});
  });

  it('rejects a profile missing required fields', () => {
    const result = configProfileInputSchema.safeParse({ name: 'Devops Voice' });

    expect(result.success).toBe(false);
  });

  it('rejects empty-string model override values', () => {
    const result = configProfileInputSchema.safeParse({
      name: 'Devops Voice',
      objective: 'gerar autoridade',
      niche: 'devops',
      modelOverrides: { theme: '' },
    });

    expect(result.success).toBe(false);
  });
});

describe('configProfileUpdateSchema', () => {
  it('accepts a partial update without filling in defaults for omitted fields', () => {
    const result = configProfileUpdateSchema.parse({ name: 'Nova voz' });

    expect(result).toEqual({ name: 'Nova voz' });
  });

  it('rejects empty-string model override values in a partial update', () => {
    const result = configProfileUpdateSchema.safeParse({ modelOverrides: { theme: '' } });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/configProfiles/schema.test.ts`
Expected: FAIL with "Cannot find module './schema'"

- [ ] **Step 3: Write the implementation**

```ts
import { z } from 'zod';

// z.record() requires an explicit key schema in this project's installed
// Zod version (v4) — v3's single-argument z.record(valueType) overload with
// an implicit string key no longer exists.
const toneOfVoiceSchema = z.record(z.string(), z.unknown());
const templateSchema = z.record(z.string(), z.unknown());
const modelOverridesSchema = z.record(z.string(), z.string().min(1));

// No .default() here on purpose — this base shape backs both schemas below.
// configProfileUpdateSchema.partial() must leave an omitted field genuinely
// absent (undefined) rather than filled in with {}, since a PATCH treats any
// non-undefined field as "set this," and a filled-in default would silently
// overwrite existing data on every partial update.
const configProfileBaseSchema = z.object({
  name: z.string().min(1),
  toneOfVoice: toneOfVoiceSchema,
  objective: z.string().min(1),
  niche: z.string().min(1),
  template: templateSchema,
  modelOverrides: modelOverridesSchema,
});

export const configProfileInputSchema = configProfileBaseSchema.extend({
  toneOfVoice: toneOfVoiceSchema.default({}),
  template: templateSchema.default({}),
  modelOverrides: modelOverridesSchema.default({}),
});

export type ConfigProfileInput = z.infer<typeof configProfileInputSchema>;

export const configProfileUpdateSchema = configProfileBaseSchema.partial();

export type ConfigProfileUpdate = z.infer<typeof configProfileUpdateSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/configProfiles/schema.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/configProfiles/schema.ts src/lib/configProfiles/schema.test.ts
git commit -m "feat: add config profile input schema"
```

---

### Task 17: Config profile repository

**Files:**
- Create: `src/lib/configProfiles/repository.ts`
- Test: `src/lib/configProfiles/repository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { createConfigProfile, listConfigProfiles, getConfigProfile, updateConfigProfile } from './repository';

function mockInsertSelectSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return { from, insert } as unknown as SupabaseClient & { insert: typeof insert };
}

function mockSelect(data: unknown, error: unknown = null) {
  const select = vi.fn().mockResolvedValue({ data, error });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as SupabaseClient;
}

function mockSelectEqMaybeSingle(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from, eq } as unknown as SupabaseClient & { eq: typeof eq };
}

function mockUpdateEqSelectSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from, update, eq } as unknown as SupabaseClient & { update: typeof update; eq: typeof eq };
}

const row = {
  id: 'cfg-1',
  name: 'Devops Voice',
  tone_of_voice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  model_overrides: {},
};

describe('createConfigProfile', () => {
  it('inserts and maps the row', async () => {
    const supabase = mockInsertSelectSingle(row);

    const result = await createConfigProfile(supabase, {
      name: 'Devops Voice',
      toneOfVoice: {},
      objective: 'gerar autoridade',
      niche: 'devops',
      template: {},
      modelOverrides: {},
    });

    expect(result.id).toBe('cfg-1');
    expect(supabase.insert).toHaveBeenCalledWith({
      name: 'Devops Voice',
      tone_of_voice: {},
      objective: 'gerar autoridade',
      niche: 'devops',
      template: {},
      model_overrides: {},
    });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = mockInsertSelectSingle(null, { message: 'duplicate name' });

    await expect(
      createConfigProfile(supabase, {
        name: 'x',
        toneOfVoice: {},
        objective: 'o',
        niche: 'n',
        template: {},
        modelOverrides: {},
      })
    ).rejects.toThrow('Failed to create config profile: duplicate name');
  });
});

describe('listConfigProfiles', () => {
  it('returns the mapped list', async () => {
    const supabase = mockSelect([row]);

    const result = await listConfigProfiles(supabase);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cfg-1');
  });
});

describe('getConfigProfile', () => {
  it('returns the mapped profile when found', async () => {
    const supabase = mockSelectEqMaybeSingle(row);

    const result = await getConfigProfile(supabase, 'cfg-1');

    expect(result?.id).toBe('cfg-1');
    expect(supabase.eq).toHaveBeenCalledWith('id', 'cfg-1');
  });

  it('returns null when not found', async () => {
    const supabase = mockSelectEqMaybeSingle(null);

    const result = await getConfigProfile(supabase, 'missing');

    expect(result).toBeNull();
  });
});

describe('updateConfigProfile', () => {
  it('updates the profile and returns the mapped row', async () => {
    const supabase = mockUpdateEqSelectSingle({ ...row, name: 'Nova voz' });

    const result = await updateConfigProfile(supabase, 'cfg-1', { name: 'Nova voz' });

    expect(result.name).toBe('Nova voz');
    expect(supabase.update).toHaveBeenCalledWith({ name: 'Nova voz' });
    expect(supabase.eq).toHaveBeenCalledWith('id', 'cfg-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/configProfiles/repository.test.ts`
Expected: FAIL with "Cannot find module './repository'"

- [ ] **Step 3: Write the implementation**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConfigProfileInput, ConfigProfileUpdate } from './schema';
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
  input: ConfigProfileUpdate
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/configProfiles/repository.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/configProfiles/repository.ts src/lib/configProfiles/repository.test.ts
git commit -m "feat: add config profile repository"
```

---

### Task 18: API route — config profiles collection

**Files:**
- Create: `app/api/config-profiles/route.ts`
- Test: `app/api/config-profiles/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import * as repository from '@/lib/configProfiles/repository';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/configProfiles/repository');
vi.mock('@/lib/supabase/client');

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue({} as ReturnType<typeof supabaseClient.createSupabaseClient>);
});

describe('POST /api/config-profiles', () => {
  it('creates a config profile and returns 201', async () => {
    vi.mocked(repository.createConfigProfile).mockResolvedValue({
      id: 'cfg-1',
      name: 'Devops Voice',
      toneOfVoice: {},
      objective: 'gerar autoridade',
      niche: 'devops',
      template: {},
      modelOverrides: {},
    });

    const request = new Request('http://localhost/api/config-profiles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Devops Voice', objective: 'gerar autoridade', niche: 'devops' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe('cfg-1');
  });

  it('returns 400 when the body is invalid', async () => {
    const request = new Request('http://localhost/api/config-profiles', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

describe('GET /api/config-profiles', () => {
  it('lists all config profiles', async () => {
    vi.mocked(repository.listConfigProfiles).mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/config-profiles/route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/config-profiles/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/config-profiles/route.ts app/api/config-profiles/route.test.ts
git commit -m "feat: add config profiles collection API route"
```

---

### Task 19: API route — config profile by id

**Files:**
- Create: `app/api/config-profiles/[id]/route.ts`
- Test: `app/api/config-profiles/[id]/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from './route';
import * as repository from '@/lib/configProfiles/repository';
import * as supabaseClient from '@/lib/supabase/client';

vi.mock('@/lib/configProfiles/repository');
vi.mock('@/lib/supabase/client');

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue({} as ReturnType<typeof supabaseClient.createSupabaseClient>);
});

const profile = {
  id: 'cfg-1',
  name: 'Devops Voice',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

describe('GET /api/config-profiles/[id]', () => {
  it('returns the profile when found', async () => {
    vi.mocked(repository.getConfigProfile).mockResolvedValue(profile);

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'cfg-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe('cfg-1');
  });

  it('returns 404 when not found', async () => {
    vi.mocked(repository.getConfigProfile).mockResolvedValue(null);

    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) });

    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/config-profiles/[id]', () => {
  it('updates and returns the profile', async () => {
    vi.mocked(repository.updateConfigProfile).mockResolvedValue({ ...profile, name: 'Nova voz' });

    const request = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ name: 'Nova voz' }) });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'cfg-1' }) });
    const body = await response.json();

    expect(body.name).toBe('Nova voz');
    // Guards against regressing to configProfileInputSchema.partial(), which
    // would have filled in toneOfVoice/template/modelOverrides defaults here.
    expect(repository.updateConfigProfile).toHaveBeenCalledWith(expect.anything(), 'cfg-1', { name: 'Nova voz' });
  });

  it('returns 400 for an invalid body', async () => {
    const request = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ name: '' }) });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'cfg-1' }) });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/config-profiles/[id]/route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Write the implementation**

```ts
import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/client';
import { configProfileUpdateSchema } from '@/lib/configProfiles/schema';
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
  // Uses configProfileUpdateSchema (not configProfileInputSchema.partial())
  // because .partial() does not strip .default() — an omitted field would
  // otherwise be silently filled with {} and overwrite existing data on update.
  const parsed = configProfileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseClient();
  const profile = await updateConfigProfile(supabase, id, parsed.data);
  return NextResponse.json(profile);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/config-profiles/[id]/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/api/config-profiles/[id]/route.ts" "app/api/config-profiles/[id]/route.test.ts"
git commit -m "feat: add config profile by-id API route"
```

---

### Task 20: API route — /api/generate

**Files:**
- Create: `app/api/generate/route.ts`
- Test: `app/api/generate/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import * as repository from '@/lib/configProfiles/repository';
import * as supabaseClient from '@/lib/supabase/client';
import * as orchestrator from '@/lib/pipeline/orchestrator';
import { StageError } from '@/lib/pipeline/types';

vi.mock('@/lib/configProfiles/repository');
vi.mock('@/lib/supabase/client');
vi.mock('@/lib/pipeline/orchestrator');

const profile = {
  id: 'cfg-1',
  name: 'Devops Voice',
  toneOfVoice: {},
  objective: 'gerar autoridade',
  niche: 'devops',
  template: {},
  modelOverrides: {},
};

beforeEach(() => {
  vi.mocked(supabaseClient.createSupabaseClient).mockReturnValue({} as ReturnType<typeof supabaseClient.createSupabaseClient>);
});

describe('POST /api/generate', () => {
  it('returns 400 when configProfileId is missing', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify({}) });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when theme is present but not a string', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ configProfileId: 'cfg-1', theme: 123 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 404 when the config profile does not exist', async () => {
    vi.mocked(repository.getConfigProfile).mockResolvedValue(null);

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ configProfileId: 'missing' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(404);
  });

  it('runs the pipeline and returns the result on success', async () => {
    vi.mocked(repository.getConfigProfile).mockResolvedValue(profile);
    vi.mocked(orchestrator.runPipeline).mockResolvedValue({
      executionId: 'exec-1',
      finalPost: 'Post final',
      hookVariations: ['A', 'B'],
      trace: {},
    });

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ configProfileId: 'cfg-1', theme: 'Observabilidade' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.finalPost).toBe('Post final');
  });

  it('returns 500 with the failed stage when the pipeline throws a StageError', async () => {
    vi.mocked(repository.getConfigProfile).mockResolvedValue(profile);
    const stageError = new StageError('writer', new Error('boom'));
    stageError.executionId = 'exec-1';
    vi.mocked(orchestrator.runPipeline).mockRejectedValue(stageError);

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ configProfileId: 'cfg-1' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.failedStage).toBe('writer');
    expect(body.executionId).toBe('exec-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/generate/route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/generate/route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/generate/route.ts app/api/generate/route.test.ts
git commit -m "feat: add /api/generate route"
```

---

### Task 21: Full test suite and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all test files pass (17 test files, no failures).

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test with the dev server**

This requires real credentials in `.env.local` (`OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) and the migration from Task 2 applied to that Supabase project.

Run: `npm run dev`, then in another terminal:

```bash
curl -X POST http://localhost:3000/api/config-profiles \
  -H "Content-Type: application/json" \
  -d '{"name":"Devops Voice","objective":"gerar autoridade","niche":"devops"}'
```

Expected: `201` with a JSON body containing a generated `id`. Copy that `id`, then:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"configProfileId":"<id from previous step>","theme":"Observabilidade para times pequenos"}'
```

Expected: `200` with `finalPost`, `hookVariations`, and a `trace` containing all 6 stages. Verify in the Supabase dashboard that `pipeline_executions`, `stage_results`, and `generated_posts` rows were created.

- [ ] **Step 4: Commit** (only if manual verification required fixes)

If Step 3 surfaces a bug, fix it, add/adjust a test that would have caught it, and commit:

```bash
git add -A
git commit -m "fix: <description of what manual verification caught>"
```

---

## Self-Review Notes

- **Spec coverage:** Config Layer (`config_profiles` + repository + CRUD routes), Orchestrator (state machine, fail-fast, per-stage persistence), all 6 stages (including the Researcher agent with Tavily), OpenRouter-based model resolution with per-stage defaults/overrides, synchronous `/api/generate` with full trace, and error handling (`StageError`, `failedStage` in the 500 response) are all covered by Tasks 1–20. Streaming, retries, and third-party SaaS agents are explicitly out of scope per the spec and are not present in this plan.
- **Type consistency:** `StageName`, `ConfigProfile`, `Fact`, and `PipelineState` are defined once in `src/lib/pipeline/types.ts` (Task 4) and reused as-is by every stage, the repository, and the orchestrator — no renamed duplicates.
- **No placeholders:** every step above contains complete, runnable code — no TODOs or "similar to Task N" shortcuts.
