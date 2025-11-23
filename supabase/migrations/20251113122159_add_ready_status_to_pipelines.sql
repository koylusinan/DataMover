/*
  # Add 'ready' Status to Pipelines

  ## Summary
  Adds 'ready' status to the allowed pipeline status values. This status indicates
  a pipeline is configured and ready to be started.

  ## Changes Made
  1. Status Values
    - Add 'ready' to the allowed status check constraint
    - Pipeline lifecycle: draft → ready → running → (seeding/incremental/idle/error/paused)

  ## Notes
  - 'ready' indicates pipeline is fully configured but not yet started
  - User can manually start the pipeline from this state
*/

-- Drop the old constraint
ALTER TABLE pipelines DROP CONSTRAINT IF EXISTS pipelines_status_check;

-- Add new constraint with 'ready' status included
ALTER TABLE pipelines ADD CONSTRAINT pipelines_status_check 
  CHECK (status = ANY (ARRAY['draft'::text, 'ready'::text, 'running'::text, 'seeding'::text, 'incremental'::text, 'idle'::text, 'error'::text, 'paused'::text]));

-- Update comment
COMMENT ON COLUMN pipelines.status IS 'Pipeline status: draft (initial), ready (configured), running (active), seeding (snapshot), incremental (CDC), idle (stopped), error (failed), paused (suspended)';
