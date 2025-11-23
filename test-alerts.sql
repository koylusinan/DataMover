-- Test script for proactive monitoring alerts
-- This script creates mock alert events for testing the UI

-- First, get a pipeline ID to test with
-- Replace 'YOUR_PIPELINE_ID' with an actual pipeline ID from your database
-- You can find one with: SELECT id, name FROM pipelines LIMIT 1;

-- Example pipeline ID (you'll need to replace this)
-- For demo, let's use a variable
DO $$
DECLARE
    test_pipeline_id UUID;
BEGIN
    -- Get the first pipeline ID
    SELECT id INTO test_pipeline_id FROM pipelines LIMIT 1;

    IF test_pipeline_id IS NULL THEN
        RAISE NOTICE 'No pipelines found. Please create a pipeline first.';
    ELSE
        RAISE NOTICE 'Using pipeline ID: %', test_pipeline_id;

        -- Create a CRITICAL alert: Connector Failed
        INSERT INTO alert_events (
            pipeline_id,
            alert_type,
            severity,
            message,
            metadata,
            resolved
        ) VALUES (
            test_pipeline_id,
            'CONNECTOR_FAILED',
            'critical',
            'Source connector is FAILED',
            jsonb_build_object(
                'connector_name', 'test-source-connector',
                'connector_type', 'source',
                'error_trace', 'org.apache.kafka.connect.errors.ConnectException: Failed to connect to database',
                'worker_id', 'kafka-connect-1:8083'
            ),
            false
        );

        -- Create a WARNING alert: High Lag
        INSERT INTO alert_events (
            pipeline_id,
            alert_type,
            severity,
            message,
            metadata,
            resolved
        ) VALUES (
            test_pipeline_id,
            'HIGH_LAG',
            'warning',
            'Pipeline lag is 6500ms (threshold: 5000ms)',
            jsonb_build_object(
                'connector_name', 'test-source-connector',
                'lag_ms', 6500,
                'threshold_ms', 5000,
                'poll_rate', 100.5,
                'write_rate', 95.2
            ),
            false
        );

        -- Create a WARNING alert: Throughput Drop
        INSERT INTO alert_events (
            pipeline_id,
            alert_type,
            severity,
            message,
            metadata,
            resolved
        ) VALUES (
            test_pipeline_id,
            'THROUGHPUT_DROP',
            'warning',
            'Throughput dropped 65.3% (from 1000 to 347 rec/min)',
            jsonb_build_object(
                'connector_name', 'test-source-connector',
                'previous_throughput', 1000,
                'current_throughput', 347,
                'drop_percent', 65.3,
                'threshold_percent', 50
            ),
            false
        );

        -- Create an INFO alert: Task Failed
        INSERT INTO alert_events (
            pipeline_id,
            alert_type,
            severity,
            message,
            metadata,
            resolved
        ) VALUES (
            test_pipeline_id,
            'TASK_FAILED',
            'critical',
            '1 sink task(s) FAILED',
            jsonb_build_object(
                'connector_name', 'test-sink-connector',
                'connector_type', 'sink',
                'failed_tasks', jsonb_build_array(
                    jsonb_build_object(
                        'id', 0,
                        'worker_id', 'kafka-connect-1:8083',
                        'trace', 'java.sql.SQLException: Connection timed out'
                    )
                )
            ),
            false
        );

        RAISE NOTICE 'Created 4 test alerts for pipeline %', test_pipeline_id;
        RAISE NOTICE 'You can now test the UI!';
        RAISE NOTICE '';
        RAISE NOTICE 'To view alerts, run: SELECT * FROM alert_events WHERE pipeline_id = ''%'';', test_pipeline_id;
        RAISE NOTICE 'To clean up, run: DELETE FROM alert_events WHERE pipeline_id = ''%'';', test_pipeline_id;
    END IF;
END $$;
