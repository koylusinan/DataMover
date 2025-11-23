-- Connector registry core tables

create table if not exists public.connectors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('source', 'sink')),
  class text not null,
  owner_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connector_versions (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null references public.connectors(id) on delete cascade,
  version integer not null,
  config jsonb not null,
  schema_version text not null default 'v1',
  checksum char(64) not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  is_active boolean not null default false,
  policy_warnings jsonb not null default '[]'::jsonb,
  unique (connector_id, version)
);

create index if not exists connector_versions_config_gin
  on public.connector_versions using gin (config jsonb_path_ops);

create index if not exists connector_versions_active_idx
  on public.connector_versions (connector_id)
  where is_active;

create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  connector_version_id uuid not null references public.connector_versions(id) on delete cascade,
  environment text not null,
  connect_cluster_url text not null,
  status text not null check (status in ('pending', 'deployed', 'paused', 'error')),
  status_msg text,
  deployed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (connector_version_id, environment, connect_cluster_url)
);

comment on table public.connectors is 'Logical connector definition (source or sink).';
comment on table public.connector_versions is 'Versioned configuration payloads for connectors.';
comment on table public.deployments is 'Deployment attempts of connector versions to Kafka Connect clusters.';
