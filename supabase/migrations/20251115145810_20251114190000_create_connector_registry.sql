/*
  # Create Connector Registry

  1. New Tables
    - `connectors`
      - `id` (uuid, primary key)
      - `name` (text, unique, NOT NULL) - Logical connector name
      - `kind` (text, NOT NULL) - 'source' or 'sink'
      - `class` (text, NOT NULL) - Fully qualified connector class name
      - `owner_id` (uuid) - User who owns this connector
      - `metadata` (jsonb) - Additional metadata
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `connector_versions`
      - `id` (uuid, primary key)
      - `connector_id` (uuid, foreign key to connectors)
      - `version` (integer, NOT NULL) - Version number
      - `config` (jsonb, NOT NULL) - Connector configuration
      - `schema_version` (text) - Schema version for validation
      - `checksum` (char(64), NOT NULL) - SHA256 hash of config
      - `created_by` (uuid) - User who created this version
      - `created_at` (timestamptz)
      - `is_active` (boolean) - Whether this version is active
      - `policy_warnings` (jsonb) - Policy validation warnings
      - Unique constraint on (connector_id, version)

    - `deployments`
      - `id` (uuid, primary key)
      - `connector_version_id` (uuid, foreign key to connector_versions)
      - `environment` (text, NOT NULL) - Deployment environment
      - `connect_cluster_url` (text, NOT NULL) - Kafka Connect cluster URL
      - `status` (text, NOT NULL) - Deployment status
      - `status_msg` (text) - Status message
      - `deployed_at` (timestamptz) - When deployed
      - `created_by` (uuid) - User who created deployment
      - `created_at` (timestamptz)
      - Unique constraint on (connector_version_id, environment, connect_cluster_url)

  2. Security
    - No RLS policies - managed by backend service

  3. Indexes
    - GIN index on connector_versions.config for fast JSON queries
    - Partial index on connector_versions for active versions
*/

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