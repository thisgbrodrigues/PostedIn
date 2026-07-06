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
