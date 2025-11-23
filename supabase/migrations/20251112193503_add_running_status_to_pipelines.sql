/*
  # Add 'running' status to pipelines

  1. Changes
    - Update pipelines.status check constraint to include 'running'
    - Previously allowed: draft, seeding, incremental, idle, error, paused
    - Now allows: draft, running, seeding, incremental, idle, error, paused

  2. Notes
    - This allows pipelines to have a 'running' status for active CDC pipelines
*/

-- Drop the existing constraint
ALTER TABLE pipelines DROP CONSTRAINT IF EXISTS pipelines_status_check;

-- Add the new constraint with 'running' included
ALTER TABLE pipelines ADD CONSTRAINT pipelines_status_check 
  CHECK (status IN ('draft', 'running', 'seeding', 'incremental', 'idle', 'error', 'paused'));
