-- Add restore_count column to pipelines table
-- This tracks how many times a pipeline has been restored from soft-delete
-- Used to generate unique database.server.name suffixes (e.g., _r1, _r2, _r3)

ALTER TABLE pipelines
ADD COLUMN IF NOT EXISTS restore_count INTEGER NOT NULL DEFAULT 0
CHECK (restore_count >= 0);

-- Add comment
COMMENT ON COLUMN pipelines.restore_count IS 'Number of times this pipeline has been restored from soft-delete. Used to generate unique database.server.name suffixes (_r1, _r2, etc.)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pipelines_restore_count ON pipelines(restore_count);
