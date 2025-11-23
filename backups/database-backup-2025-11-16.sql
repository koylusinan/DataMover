-- Database Backup - 2025-11-16
-- Generated at: 2025-11-16

-- ============================================
-- USER PROFILES
-- ============================================

INSERT INTO user_profiles (id, email, full_name, role, is_active, created_at, updated_at, last_login_at)
VALUES
  ('93748edf-fe49-4cdb-a089-60ffb211d0d2', 'admin@example.com', 'System Administrator', 'admin', true, '2025-11-16 13:32:51.219486+00', '2025-11-16 13:53:14.6689+00', '2025-11-16 13:53:14.462+00');

-- ============================================
-- PIPELINES
-- ============================================

INSERT INTO pipelines (id, user_id, name, source_type, source_config, destination_type, destination_config, mode, frequency_minutes, status, created_at, updated_at, schedule_config)
VALUES
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '00000000-0000-0000-0000-000000000001', 'Oracle to Postgres CDC', 'oracle', '{"ssl": false, "host": "10.120.2.121", "port": 1521, "username": "DEBEZIUM", "database_name": "CBPROD"}', 'postgres', '{"ssl": false, "host": "localhost", "port": 5432, "schema": "public", "database": "target_db", "username": "postgres"}', 'log', 30, 'running', '2025-11-10 10:00:00+00', '2025-11-15 12:00:00+00', '{"type": "preset", "value": "2h"}'),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '00000000-0000-0000-0000-000000000001', 'PostgreSQL to Snowflake', 'postgres', '{"ssl": true, "host": "pg.example.com", "port": 5432, "username": "etl_user", "database_name": "production"}', 'snowflake', '{"schema": "PUBLIC", "account": "xy12345", "database": "ANALYTICS", "warehouse": "COMPUTE_WH"}', 'batch', 360, 'running', '2025-11-11 14:30:00+00', '2025-11-15 10:00:00+00', '{"type": "preset", "value": "6h"}'),
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '00000000-0000-0000-0000-000000000001', 'SQL Server to BigQuery', 'sqlserver', '{"ssl": false, "host": "mssql.example.com", "port": 1433, "username": "replication", "database_name": "ecommerce"}', 'bigquery', '{"dataset": "raw_data", "location": "US", "project_id": "my-gcp-project"}', 'batch', 30, 'running', '2025-11-12 08:00:00+00', '2025-11-15 22:09:05.985+00', '{"type": "preset", "value": "1h"}'),
  ('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', '00000000-0000-0000-0000-000000000001', 'SQL Server to Postgres', 'sqlserver', '{"ssl": false, "host": "mssql.example.com", "port": 1433, "username": "replicator", "database_name": "sales_db"}', 'postgres', '{"ssl": false, "host": "postgres.example.com", "port": 5432, "schema": "public", "database": "warehouse", "username": "postgres"}', 'log', 30, 'running', '2025-11-13 16:00:00+00', '2025-11-15 22:30:14.667+00', '{"type": "preset", "value": "6h"}'),
  ('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', '00000000-0000-0000-0000-000000000001', 'Oracle Financial Data', 'oracle', '{"ssl": true, "host": "oracle-prod.example.com", "port": 1521, "username": "DEBEZIUM", "database_name": "FINDB"}', 'kafka', '{"compression": "gzip", "topic_prefix": "finance", "bootstrap_servers": "kafka.example.com:9092"}', 'log', 30, 'running', '2025-11-14 11:00:00+00', '2025-11-15 22:16:18.673+00', '{"type": "preset", "value": "30m"}');

-- ============================================
-- USER ACTIVITY LOGS
-- ============================================

INSERT INTO user_activity_logs (id, user_id, action_type, action_description, resource_type, resource_id, metadata, created_at)
VALUES
  ('97810723-6753-4312-bd89-9bdb1673f22f', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.create', 'Created pipeline: Oracle to Postgres CDC', 'pipeline', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '{"source": "oracle", "destination": "postgres"}', '2025-11-10 10:00:00+00'),
  ('c04f967e-e5ed-477f-aee6-eca6fa636ece', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.start', 'Started pipeline: Oracle to Postgres CDC', 'pipeline', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '{"status": "running"}', '2025-11-10 10:05:00+00'),
  ('c846ea1b-b1d4-420a-8e88-7e8e1a428767', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.create', 'Created pipeline: PostgreSQL to Snowflake', 'pipeline', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '{"source": "postgres", "destination": "snowflake"}', '2025-11-11 14:30:00+00'),
  ('97885854-9dc8-48ad-b1d2-e51d4b0b4466', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.start', 'Started pipeline: PostgreSQL to Snowflake', 'pipeline', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '{"status": "running"}', '2025-11-11 14:35:00+00'),
  ('7e39b84a-d2fe-442b-bb63-c84072507acb', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.create', 'Created pipeline: SQL Server to BigQuery', 'pipeline', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '{"source": "sqlserver", "destination": "bigquery"}', '2025-11-12 08:00:00+00'),
  ('a10b028d-dd29-4fcd-9aec-1ce0b41fffe0', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.update', 'Updated configuration for SQL Server to BigQuery', 'pipeline', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '{"changed_fields": ["schedule", "batch_size"]}', '2025-11-12 10:30:00+00'),
  ('4cee444a-c873-4e47-8ce9-2a8dd32347f9', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.start', 'Started pipeline: SQL Server to BigQuery', 'pipeline', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '{"status": "running"}', '2025-11-12 11:00:00+00'),
  ('311c6da2-d98d-4075-ad21-bbfe0abe5e99', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.create', 'Created pipeline: SQL Server to Postgres', 'pipeline', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', '{"source": "sqlserver", "destination": "postgres"}', '2025-11-13 16:00:00+00'),
  ('8e0ebba4-29f7-4eeb-a062-f805d599883d', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.stop', 'Stopped pipeline: PostgreSQL to Snowflake', 'pipeline', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '{"reason": "maintenance", "status": "stopped"}', '2025-11-13 18:00:00+00'),
  ('d2051b86-2e96-440e-bc25-607d015aaa70', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.create', 'Created pipeline: Oracle Financial Data', 'pipeline', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', '{"source": "oracle", "destination": "kafka"}', '2025-11-14 11:00:00+00'),
  ('08b6bcf3-e833-4c66-9322-e83ec3d34449', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.start', 'Started pipeline: Oracle Financial Data', 'pipeline', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', '{"status": "running"}', '2025-11-14 11:05:00+00'),
  ('c57428a5-a141-4765-aff3-7a871eaa0dce', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.update', 'Updated schema mapping for Oracle to Postgres CDC', 'pipeline', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '{"changed_fields": ["table_mappings"]}', '2025-11-14 15:30:00+00'),
  ('eb60744c-db4c-4f81-af7d-6be70a4fe8b0', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'auth.login', 'User logged in', NULL, NULL, '{"ip": "192.168.1.100", "user_agent": "Mozilla/5.0"}', '2025-11-15 09:00:00+00'),
  ('81d2d1e0-134f-450a-89da-d65c5825102f', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.stop', 'Stopped pipeline: SQL Server to BigQuery', 'pipeline', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '{"reason": "completed", "status": "stopped"}', '2025-11-15 12:00:00+00'),
  ('76d7682e-5cef-4a91-97be-5043fdb511c5', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.start', 'Started pipeline: SQL Server to Postgres', 'pipeline', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', '{"status": "running"}', '2025-11-15 14:00:00+00'),
  ('926950f4-2ea7-421b-86cf-f09e96adf4b4', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.update', 'Updated schedule for Oracle Financial Data', 'pipeline', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', '{"changed_fields": ["schedule_config"]}', '2025-11-15 16:30:00+00'),
  ('3e7bd0cd-91f9-47cb-a025-7d576caba320', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'auth.login', 'User logged in', NULL, NULL, '{"ip": "192.168.1.100", "user_agent": "Mozilla/5.0"}', '2025-11-16 07:30:00+00'),
  ('243902e0-475e-459c-893f-4356dae81022', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'auth.login', 'User logged in', NULL, NULL, '{"ip": "192.168.1.100", "user_agent": "Mozilla/5.0"}', '2025-11-16 08:00:00+00'),
  ('b27d7b16-5e57-427c-bebe-5b7fdf1a05dc', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'user.view', 'Viewed admin dashboard', 'user', '93748edf-fe49-4cdb-a089-60ffb211d0d2', '{"page": "admin"}', '2025-11-16 08:15:00+00'),
  ('0755ee68-8904-48bb-b7fb-1cb8b57470a2', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'pipeline.view', 'Viewed pipeline details: Oracle to Postgres CDC', 'pipeline', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '{"duration_seconds": 45}', '2025-11-16 08:30:00+00');

-- ============================================
-- BACKUP SUMMARY
-- ============================================
-- Tables backed up:
--   - user_profiles: 1 record
--   - pipelines: 5 records
--   - user_activity_logs: 20 records
--   - connection_configs: 0 records
--
-- Total records: 26
-- Backup date: 2025-11-16
-- ============================================
