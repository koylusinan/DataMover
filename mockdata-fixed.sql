-- =============================================================================
-- FIXED MOCK DATA SQL - Compatible with Latest Schema
-- =============================================================================

-- Clear existing data
TRUNCATE TABLE alert_preferences CASCADE;
TRUNCATE TABLE alert_recipients CASCADE;
TRUNCATE TABLE pipeline_logs CASCADE;
TRUNCATE TABLE job_runs CASCADE;
TRUNCATE TABLE pipeline_table_objects CASCADE;
TRUNCATE TABLE pipeline_objects CASCADE;
TRUNCATE TABLE pipeline_connectors CASCADE;
TRUNCATE TABLE pipelines CASCADE;
TRUNCATE TABLE user_profiles CASCADE;

-- USER PROFILES (viewer -> read_only)
INSERT INTO user_profiles (id, email, full_name, role, is_active, created_at, updated_at, last_login_at) VALUES
('93748edf-fe49-4cdb-a089-60ffb211d0d2', 'admin@example.com', 'System Administrator', 'admin', true, '2025-11-16 13:32:51+00', '2025-11-17 15:43:02+00', '2025-11-17 15:43:01+00'),
('317832e3-cb75-46f1-a0e7-c2b94c0418d5', 'sinan.koylu@gmail.com', 'Sinan', 'maintainer', true, '2025-11-16 20:13:38+00', '2025-11-16 20:13:38+00', NULL),
('00000000-0000-0000-0000-000000000001', 'viewer@example.com', 'Guest Viewer', 'read_only', true, '2025-11-10 10:00:00+00', '2025-11-17 10:00:00+00', '2025-11-17 09:00:00+00');

-- PIPELINES
INSERT INTO pipelines (id, user_id, name, source_type, source_config, destination_type, destination_config, mode, frequency_minutes, status, created_at, updated_at, schedule_config) VALUES
('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'Oracle to Postgres CDC', 'oracle',
'{"ssl": false, "host": "10.120.2.121", "port": 1521, "username": "DEBEZIUM", "database_name": "CBPROD"}',
'postgres',
'{"ssl": false, "host": "localhost", "port": 5432, "schema": "public", "database": "target_db", "username": "postgres"}',
'log', 30, 'running', '2025-11-10 10:00:00+00', '2025-11-16 22:49:23+00', '{"type": "preset", "value": "2h"}'),

('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'PostgreSQL to Snowflake', 'postgres',
'{"ssl": true, "host": "pg.example.com", "port": 5432, "username": "etl_user", "database_name": "production"}',
'snowflake',
'{"schema": "PUBLIC", "account": "xy12345", "database": "ANALYTICS", "warehouse": "COMPUTE_WH"}',
'batch', 360, 'running', '2025-11-11 14:30:00+00', '2025-11-15 10:00:00+00', '{"type": "preset", "value": "6h"}'),

('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'SQL Server to BigQuery', 'sqlserver',
'{"ssl": false, "host": "mssql.example.com", "port": 1433, "username": "replication", "database_name": "ecommerce"}',
'bigquery',
'{"dataset": "raw_data", "location": "US", "project_id": "my-gcp-project"}',
'batch', 30, 'paused', '2025-11-12 08:00:00+00', '2025-11-15 22:09:05+00', '{"type": "preset", "value": "1h"}'),

('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'SQL Server to Postgres', 'sqlserver',
'{"ssl": false, "host": "mssql.example.com", "port": 1433, "username": "replicator", "database_name": "sales_db"}',
'postgres',
'{"ssl": false, "host": "postgres.example.com", "port": 5432, "schema": "public", "database": "warehouse", "username": "postgres"}',
'log', 30, 'draft', '2025-11-13 16:00:00+00', '2025-11-15 22:30:14+00', '{"type": "preset", "value": "6h"}'),

('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'Oracle HR Database to PostgreSQL', 'oracle',
'{"host": "oracle-prod.company.com", "port": 1521, "username": "dbuser", "service_name": "HRPROD"}',
'postgres',
'{"host": "postgres-warehouse.company.com", "port": 5432, "database": "analytics", "username": "etl_user"}',
'log', 30, 'running', '2025-11-14 11:00:00+00', '2025-11-17 14:24:24+00', '{"type": "preset", "value": "30m"}');

-- PIPELINE CONNECTORS (removed deployed_at column)
INSERT INTO pipeline_connectors (id, pipeline_id, name, type, connector_class, config, status, tasks_max, created_at, updated_at, last_deployed_version, pending_config, has_pending_changes, last_deployed_at) VALUES

-- Connectors for Pipeline 1 (Oracle to Postgres CDC)
('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'oracle-cdc-source', 'source', 'io.debezium.connector.oracle.OracleConnector',
'{"tasks.max": "1", "topic.prefix": "oracle_cdc", "database.port": 1522, "database.user": "c##dbzuser", "snapshot.mode": "initial", "connector.class": "io.debezium.connector.oracle.OracleConnector", "database.dbname": "ORCLCDB", "database.hostname": "127.0.0.1", "database.password": "dbz", "database.pdb.name": "ORCLPDB1", "table.include.list": "FINANCIAL.TRANSACTIONS,FINANCIAL.ACCOUNTS,FINANCIAL.CUSTOMERS"}',
'running', 1, '2025-11-10 10:05:00+00', '2025-11-17 09:37:46+00', 1, NULL, false, '2025-11-17 09:38:13+00'),

('11111111-1111-1111-1111-111111111112', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'kafka-financial-sink', 'sink', 'io.debezium.connector.jdbc.JdbcSinkConnector',
'{"topics": "oracle_cdc.FINANCIAL.TRANSACTIONS", "pk.mode": "record_key", "tasks.max": "1", "auto.create": "true", "connection.url": "jdbc:postgresql://127.0.0.1:5432/cdc_target"}',
'running', 1, '2025-11-10 10:05:00+00', '2025-11-17 09:37:47+00', NULL, NULL, false, NULL),

-- Connectors for Pipeline 2 (PostgreSQL to Snowflake)
('22222222-2222-2222-2222-222222222221', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'postgres-source', 'source', 'io.debezium.connector.postgresql.PostgresConnector',
'{"slot.name": "debezium_snowflake", "tasks.max": "1", "plugin.name": "pgoutput", "topic.prefix": "postgres_snowflake", "database.port": 5433, "database.user": "postgres"}',
'running', 1, '2025-11-11 14:35:00+00', '2025-11-16 15:58:09+00', 1, NULL, false, '2025-11-16 15:58:45+00'),

('22222222-2222-2222-2222-222222222222', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'snowflake-sink', 'sink', 'com.snowflake.kafka.connector.SnowflakeSinkConnector',
'{"topics": "postgres_snowflake.public.users", "tasks.max": "1"}',
'running', 1, '2025-11-11 14:35:00+00', '2025-11-15 10:00:00+00', NULL, NULL, false, NULL);

-- PIPELINE OBJECTS
INSERT INTO pipeline_objects (id, pipeline_id, schema_name, table_name, included, stats) VALUES
('dc6bd3c7-241c-402e-b7ca-d7ec9b8f6f61', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'HR', 'EMPLOYEES', true, '{"size": "1.8 MB", "row_count": 3500}'),
('ed8a63cc-a9ab-4216-927f-5552718cebdb', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'HR', 'DEPARTMENTS', true, '{"size": "120 KB", "row_count": 45}'),
('35d2fac3-5857-4c90-81c9-031efe7da8d8', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'public', 'users', true, '{"row_count": 12000}'),
('3bd91504-9ec3-4488-bcfc-dfb4769befdf', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'public', 'events', true, '{"row_count": 350000}');

-- PIPELINE TABLE OBJECTS
INSERT INTO pipeline_table_objects (id, pipeline_id, source_connector_id, sink_connector_id, schema_name, table_name, status, row_count, size_estimate, created_at, updated_at) VALUES
('fa64428d-ac5b-40c2-860c-dac320c6eda2', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', 'HR', 'EMPLOYEES', 'streaming', 15000, '120 MB', '2025-11-15 22:22:35+00', '2025-11-15 22:22:35+00'),
('db0dc713-8859-4b68-b046-271c77cb3c71', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', 'HR', 'DEPARTMENTS', 'streaming', 250, '8 MB', '2025-11-15 22:22:35+00', '2025-11-15 22:22:35+00');

-- JOB RUNS
INSERT INTO job_runs (id, pipeline_id, kind, started_at, finished_at, status, latency_ms, summary) VALUES
('f403ef6f-bf64-49ec-9222-c6298fddb7c2', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'precheck', '2025-11-12 15:24:49+00', '2025-11-12 15:25:01+00', 'success', 12450, '{"warnings": 1, "checks_passed": 8}'),
('fa8c49a7-be5d-4390-a79f-7ab2b8bef0f4', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'seed', '2025-11-12 16:24:49+00', '2025-11-12 19:24:49+00', 'success', 10800000, '{"rows_synced": 119642, "tables_completed": 4}');

-- PIPELINE LOGS
INSERT INTO pipeline_logs (pipeline_id, run_id, ts, level, message, context) VALUES
('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', NULL, '2025-11-17 15:08:04+00', 'info', 'Incremental sync started', '{"trigger": "scheduled"}'),
('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', NULL, '2025-11-17 15:08:09+00', 'info', 'Connected to Oracle source', '{"host": "oracle-prod.company.com"}');

-- ALERT RECIPIENTS (fixed channels: array format)
INSERT INTO alert_recipients (id, user_id, email, created_at, is_external, recipient_user_id, pipeline_id, channels) VALUES
('9e737887-f1cc-48b3-b1cf-fc6168c1735c', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'sinan.koylu@gmail.com', '2025-11-16 22:01:32+00', false, '317832e3-cb75-46f1-a0e7-c2b94c0418d5', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', ARRAY['email']),
('b432c6be-9378-43bb-aeb4-04fdc61b8d90', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'sinan.koylu@gmail.com', '2025-11-17 10:45:46+00', false, '317832e3-cb75-46f1-a0e7-c2b94c0418d5', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', ARRAY['email']);

-- ALERT PREFERENCES (removed recipient_id column)
INSERT INTO alert_preferences (id, user_id, pipeline_connectivity_email, pipeline_job_failures_email, pipeline_id, updated_at) VALUES
('2b9cc2be-d901-4887-a0d3-b053bf5d9ea3', '93748edf-fe49-4cdb-a089-60ffb211d0d2', true, true, NULL, '2025-11-16 20:58:04+00'),
('8c4697b2-c4f3-4e5a-8908-d4ff94ae09e8', '317832e3-cb75-46f1-a0e7-c2b94c0418d5', false, false, NULL, '2025-11-16 23:05:51+00');


