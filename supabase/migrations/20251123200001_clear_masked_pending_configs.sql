/*
  # Fix Masked Pending Configs

  ## Changes
  - Update pending_config to restore real values from config
  - Only keep connection.password masked
  - Reset has_pending_changes to false

  ## Purpose
  Fix old masked pending configurations by restoring real values
  from config, keeping only connection.password masked
*/

-- Create a function to merge configs and keep only connection.password masked
CREATE OR REPLACE FUNCTION fix_masked_pending_config()
RETURNS void AS $$
DECLARE
  connector_record RECORD;
  new_pending_config jsonb;
  config_key text;
  config_value jsonb;
BEGIN
  -- Loop through all connectors with masked pending configs
  FOR connector_record IN
    SELECT id, config, pending_config
    FROM pipeline_connectors
    WHERE pending_config IS NOT NULL
      AND pending_config::text LIKE '%"********"%'
  LOOP
    -- Start with empty config
    new_pending_config := '{}'::jsonb;

    -- Copy all values from pending_config, replacing masked values with real ones from config
    FOR config_key, config_value IN
      SELECT key, value
      FROM jsonb_each(connector_record.pending_config)
    LOOP
      -- If the value is masked (********), get the real value from config
      IF config_value::text = '"********"' THEN
        -- Get real value from config, but keep connection.password masked
        IF config_key = 'connection.password' OR config_key = 'database.password' OR config_key = 'password' THEN
          new_pending_config := new_pending_config || jsonb_build_object(config_key, '********');
        ELSE
          -- Get the real value from config
          IF connector_record.config ? config_key THEN
            new_pending_config := new_pending_config || jsonb_build_object(config_key, connector_record.config->config_key);
          ELSE
            -- If not in config, remove from pending_config
            NULL;
          END IF;
        END IF;
      ELSE
        -- Value is not masked, keep it as is
        new_pending_config := new_pending_config || jsonb_build_object(config_key, config_value);
      END IF;
    END LOOP;

    -- Update the connector with fixed pending_config
    UPDATE pipeline_connectors
    SET
      pending_config = new_pending_config,
      has_pending_changes = false
    WHERE id = connector_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT fix_masked_pending_config();

-- Drop the function after use
DROP FUNCTION fix_masked_pending_config();

COMMENT ON TABLE pipeline_connectors IS 'Updated to restore real values in pending configurations';
