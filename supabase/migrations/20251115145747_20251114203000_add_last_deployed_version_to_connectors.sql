/*
  # Add last_deployed_version to pipeline_connectors

  1. Changes
    - Add `last_deployed_version` column to `pipeline_connectors` table
    - This tracks which version of a registry connector is currently deployed
    - Backfill existing connectors with their current registry_version from config

  2. Notes
    - This enables tracking connector version deployments
    - Used for showing "Update Available" badges when newer versions exist
*/

ALTER TABLE pipeline_connectors
  ADD COLUMN IF NOT EXISTS last_deployed_version integer;

UPDATE pipeline_connectors
SET last_deployed_version = COALESCE((config->>'registry_version')::integer, last_deployed_version)
WHERE last_deployed_version IS NULL;