ALTER TABLE pipeline_connectors
  ADD COLUMN IF NOT EXISTS last_deployed_version integer;

UPDATE pipeline_connectors
SET last_deployed_version = COALESCE((config->>'registry_version')::integer, last_deployed_version)
WHERE last_deployed_version IS NULL;
