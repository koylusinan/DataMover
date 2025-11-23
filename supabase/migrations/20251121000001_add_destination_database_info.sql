/*
  # Add Database Information to Connection Configs

  This migration adds columns to track database information for connections.

  ## Changes
  - Add database_version column
  - Add last_connection_check column
  - Add connection_status column
  - Add total_tables column
  - Add database_size column
*/

-- Add new columns to connection_configs table
ALTER TABLE connection_configs
ADD COLUMN IF NOT EXISTS database_version TEXT,
ADD COLUMN IF NOT EXISTS last_connection_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'inactive' CHECK (connection_status IN ('active', 'inactive', 'error')),
ADD COLUMN IF NOT EXISTS total_tables INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS database_size BIGINT DEFAULT 0;

-- Add index on connection_status for faster filtering
CREATE INDEX IF NOT EXISTS idx_connection_configs_connection_status ON connection_configs(connection_status);
