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
