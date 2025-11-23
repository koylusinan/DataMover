-- =============================================================================
-- MOCK DATA SQL - Complete Database Seed
-- =============================================================================
-- This file contains all mock data for the CDCStream application
-- Generated: 2025-11-17
-- =============================================================================

-- Clear existing data (in reverse order of dependencies)
TRUNCATE TABLE alert_preferences CASCADE;
TRUNCATE TABLE alert_recipients CASCADE;
TRUNCATE TABLE pipeline_logs CASCADE;
TRUNCATE TABLE job_runs CASCADE;
TRUNCATE TABLE pipeline_table_objects CASCADE;
TRUNCATE TABLE pipeline_objects CASCADE;
TRUNCATE TABLE pipeline_connectors CASCADE;
TRUNCATE TABLE pipelines CASCADE;
TRUNCATE TABLE user_profiles CASCADE;

-- =============================================================================
-- USER PROFILES
-- =============================================================================
INSERT INTO user_profiles (id, email, full_name, role, is_active, created_at, updated_at, last_login_at) VALUES
('93748edf-fe49-4cdb-a089-60ffb211d0d2', 'admin@example.com', 'System Administrator', 'admin', true, '2025-11-16 13:32:51.219486+00', '2025-11-17 15:43:02.099301+00', '2025-11-17 15:43:01.88+00'),
('317832e3-cb75-46f1-a0e7-c2b94c0418d5', 'sinan.koylu@gmail.com', 'sinan', 'maintainer', true, '2025-11-16 20:13:38.594235+00', '2025-11-16 20:13:38.594235+00', NULL),
('00000000-0000-0000-0000-000000000001', 'viewer@example.com', 'Guest Viewer', 'viewer', true, '2025-11-10 10:00:00+00', '2025-11-17 10:00:00+00', '2025-11-17 09:00:00+00');

-- =============================================================================
-- PIPELINES
-- =============================================================================
INSERT INTO pipelines (id, user_id, name, source_type, source_config, destination_type, destination_config, mode, frequency_minutes, status, created_at, updated_at, schedule_config) VALUES

-- Pipeline 1: Oracle to Postgres CDC
('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'Oracle to Postgres CDC', 'oracle',
'{"ssl": false, "host": "10.120.2.121", "port": 1521, "username": "DEBEZIUM", "database_name": "CBPROD"}',
'postgres',
'{"ssl": false, "host": "localhost", "port": 5432, "schema": "public", "database": "target_db", "username": "postgres"}',
'log', 30, 'running', '2025-11-10 10:00:00+00', '2025-11-16 22:49:23.515+00', '{"type": "preset", "value": "2h"}'),

-- Pipeline 2: PostgreSQL to Snowflake
('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'PostgreSQL to Snowflake', 'postgres',
'{"ssl": true, "host": "pg.example.com", "port": 5432, "username": "etl_user", "database_name": "production"}',
'snowflake',
'{"schema": "PUBLIC", "account": "xy12345", "database": "ANALYTICS", "warehouse": "COMPUTE_WH"}',
'batch', 360, 'running', '2025-11-11 14:30:00+00', '2025-11-15 10:00:00+00', '{"type": "preset", "value": "6h"}'),

-- Pipeline 3: SQL Server to BigQuery
('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'SQL Server to BigQuery', 'sqlserver',
'{"ssl": false, "host": "mssql.example.com", "port": 1433, "username": "replication", "database_name": "ecommerce"}',
'bigquery',
'{"dataset": "raw_data", "location": "US", "project_id": "my-gcp-project"}',
'batch', 30, 'running', '2025-11-12 08:00:00+00', '2025-11-15 22:09:05.985+00', '{"type": "preset", "value": "1h"}'),

-- Pipeline 4: SQL Server to Postgres
('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'SQL Server to Postgres', 'sqlserver',
'{"ssl": false, "host": "mssql.example.com", "port": 1433, "username": "replicator", "database_name": "sales_db"}',
'postgres',
'{"ssl": false, "host": "postgres.example.com", "port": 5432, "schema": "public", "database": "warehouse", "username": "postgres"}',
'log', 30, 'running', '2025-11-13 16:00:00+00', '2025-11-15 22:30:14.667+00', '{"type": "preset", "value": "6h"}'),

-- Pipeline 5: Oracle HR Database to PostgreSQL
('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'Oracle HR Database to PostgreSQL', 'oracle',
'{"host": "oracle-prod.company.com", "port": 1521, "username": "dbuser", "service_name": "HRPROD", "connection_string": "oracle-prod.company.com:1521/HRPROD"}',
'kafka',
'{"host": "postgres-warehouse.company.com", "port": 5432, "database": "analytics", "username": "etl_user"}',
'log', 30, 'running', '2025-11-14 11:00:00+00', '2025-11-17 14:24:24.788824+00', '{"type": "preset", "value": "30m"}'),

-- Pipeline 6: PostgreSQL Analytics Sync
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'PostgreSQL Analytics Sync', 'postgres',
'{"host": "postgres-app.company.com", "port": 5432, "database": "app_prod"}',
'postgres',
'{"host": "postgres-warehouse.company.com", "port": 5432, "database": "analytics"}',
'log', 30, 'running', '2025-11-07 15:26:19.093619+00', '2025-11-17 15:21:19.093619+00', '{}'),

-- Pipeline 7: SQL Server Inventory Mirror
('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'SQL Server Inventory Mirror', 'sqlserver',
'{"host": "sqlserver-inv.company.com", "port": 1433, "database": "Inventory"}',
'postgres',
'{"host": "postgres-warehouse.company.com", "port": 5432, "database": "inventory_mirror"}',
'micro-batch', 5, 'running', '2025-11-16 15:26:19.093619+00', '2025-11-17 13:26:19.093619+00', '{}'),

-- Pipeline 8: Oracle Legacy Migration
('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'Oracle Legacy Migration', 'oracle',
'{"host": "oracle-legacy.company.com", "port": 1521, "service_name": "LEGACY"}',
'postgres',
'{"host": "postgres-warehouse.company.com", "port": 5432, "database": "legacy_archive"}',
'batch', 120, 'running', '2025-11-17 14:26:19.093619+00', '2025-11-17 14:56:19.093619+00', '{}'),

-- Pipeline 9: Oracle Sales to Snowflake
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Oracle Sales to Snowflake', 'oracle',
'{"host": "oracle-sales.company.com", "port": 1521, "service_name": "SALESPROD"}',
'postgres',
'{"host": "snowflake.company.com", "warehouse": "ETL_WH"}',
'batch', 60, 'running', '2025-11-15 15:26:19.093619+00', '2025-11-17 15:29:10.72+00', '{}');

-- =============================================================================
-- PIPELINE CONNECTORS
-- =============================================================================
INSERT INTO pipeline_connectors (id, pipeline_id, name, type, connector_class, config, status, tasks_max, created_at, updated_at, last_deployed_version, pending_config, has_pending_changes, last_deployed_at, deployed_at) VALUES

-- Connectors for Pipeline 1 (Oracle to Postgres CDC)
('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'oracle-cdc-source', 'source', 'io.debezium.connector.oracle.OracleConnector',
'{"tasks.max": "1", "topic.prefix": "oracle_cdc", "database.port": 1522, "database.user": "c##dbzuser", "snapshot.mode": "initial", "connector.class": "io.debezium.connector.oracle.OracleConnector", "database.dbname": "ORCLCDB", "database.hostname": "127.0.0.1", "database.password": "dbz", "database.pdb.name": "ORCLPDB1", "table.include.list": "FINANCIAL.TRANSACTIONS,FINANCIAL.ACCOUNTS,FINANCIAL.CUSTOMERS", "log.mining.strategy": "online_catalog", "schema.include.list": "FINANCIAL", "time.precision.mode": "adaptive", "database.server.name": "oracle_cdc_server", "decimal.handling.mode": "double", "database.history.kafka.topic": "schema-changes.oracle_cdc", "database.history.kafka.bootstrap.servers": "127.0.0.1:9092"}',
'running', 1, '2025-11-10 10:05:00+00', '2025-11-17 09:37:46.936+00', 1, NULL, false, '2025-11-17 09:38:13.386+00', NULL),

('11111111-1111-1111-1111-111111111112', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'kafka-financial-sink', 'sink', 'io.debezium.connector.jdbc.JdbcSinkConnector',
'{"topics": "oracle_cdc_server.FINANCIAL.TRANSACTIONS,oracle_cdc_server.FINANCIAL.ACCOUNTS,oracle_cdc_server.FINANCIAL.CUSTOMERS", "pk.mode": "record_key", "tasks.max": "1", "auto.create": "true", "auto.evolve": "true", "insert.mode": "upsert", "connection.url": "jdbc:postgresql://127.0.0.1:5432/cdc_target", "delete.enabled": "true", "connector.class": "io.debezium.connector.jdbc.JdbcSinkConnector", "table.name.format": "${topic}", "connection.password": "postgres", "connection.username": "postgres"}',
'running', 4, '2025-11-10 10:05:00+00', '2025-11-17 09:37:47.148+00', NULL,
'{"host": "127.0.0.1", "port": 5432, "topics": "oracle_cdc_server.FINANCIAL.TRANSACTIONS,oracle_cdc_server.FINANCIAL.ACCOUNTS,oracle_cdc_server.FINANCIAL.CUSTOMERS", "pk.mode": "record_key", "database": "cdc_target", "tasks.max": "1", "auto.create": "true", "auto.evolve": "true", "insert.mode": "upsert", "connection.url": "jdbc:postgresql://127.0.0.1:5432/cdc_target", "delete.enabled": "true", "connector.class": "io.debezium.connector.jdbc.JdbcSinkConnector", "table.name.format": "${topic}", "connection.password": "postgres", "connection.username": "postgres"}',
true, NULL, NULL),

-- Connectors for Pipeline 2 (PostgreSQL to Snowflake)
('22222222-2222-2222-2222-222222222221', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'postgres-source', 'source', 'io.debezium.connector.postgresql.PostgresConnector',
'{"slot.name": "debezium_snowflake", "tasks.max": "1", "plugin.name": "pgoutput", "topic.prefix": "postgres_snowflake", "database.port": 5433, "database.user": "postgres", "snapshot.mode": "initial", "connector.class": "io.debezium.connector.postgresql.PostgresConnector", "database.dbname": "analytics_db", "publication.name": "dbz_publication", "database.hostname": "127.0.0.1", "database.password": "postgres", "table.include.list": "public.users,public.events,public.sessions", "schema.include.list": "public", "time.precision.mode": "adaptive", "database.server.name": "postgres_snowflake", "decimal.handling.mode": "double"}',
'running', 1, '2025-11-11 14:35:00+00', '2025-11-16 15:58:09.095+00', 1, NULL, false, '2025-11-16 15:58:45.473+00', '2025-11-16 15:58:45.473+00'),

('22222222-2222-2222-2222-222222222222', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'snowflake-sink', 'sink', 'com.snowflake.kafka.connector.SnowflakeSinkConnector',
'{"topics": "postgres_snowflake.public.users,postgres_snowflake.public.events,postgres_snowflake.public.sessions", "tasks.max": "1", "key.converter": "org.apache.kafka.connect.json.JsonConverter", "connector.class": "com.snowflake.kafka.connector.SnowflakeSinkConnector", "value.converter": "org.apache.kafka.connect.json.JsonConverter", "buffer.flush.time": "60", "buffer.size.bytes": "5000000", "snowflake.url.name": "myaccount.snowflakecomputing.com", "snowflake.user.name": "kafka_connector_user", "buffer.count.records": "10000", "snowflake.private.key": "MII...", "snowflake.schema.name": "PUBLIC", "snowflake.database.name": "ANALYTICS_DB"}',
'running', 2, '2025-11-11 14:35:00+00', '2025-11-15 10:00:00+00', NULL,
'{"topics": "postgres_snowflake.public.users,postgres_snowflake.public.events,postgres_snowflake.public.sessions", "tasks.max": "1", "key.converter": "org.apache.kafka.connect.json.JsonConverter", "connector.class": "com.snowflake.kafka.connector.SnowflakeSinkConnector", "value.converter": "org.apache.kafka.connect.json.JsonConverter", "buffer.flush.time": "60", "buffer.size.bytes": "5000000", "snowflake.url.name": "myaccount.snowflakecomputing.com", "snowflake.user.name": "kafka_connector_user", "buffer.count.records": "10000", "snowflake.private.key": "MII...", "snowflake.schema.name": "PUBLIC", "snowflake.database.name": "ANALYTICS_DB"}',
true, NULL, NULL),

-- Connectors for Pipeline 3 (SQL Server to BigQuery)
('33333333-3333-3333-3333-333333333331', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'sqlserver-source', 'source', 'io.debezium.connector.sqlserver.SqlServerConnector',
'{"checksum": "", "connector_class": "io.debezium.connector.sqlserver.SqlServerConnector", "snapshot_config": {"checksum": "", "connector_class": "io.debezium.connector.sqlserver.SqlServerConnector", "snapshot_config": {"tasks.max": "1", "topic.prefix": "sqlserver_bigquery", "database.port": "1433", "database.user": "sa", "snapshot.mode": "initial", "connector.class": "io.debezium.connector.sqlserver.SqlServerConnector", "database.dbname": "AnalyticsDB", "database.hostname": "127.0.0.1", "database.password": "YourStrong@Passw0rd", "table.include.list": "dbo.Sessions", "schema.include.list": "dbo", "time.precision.mode": "adaptive", "database.server.name": "sqlserver_bigquery", "decimal.handling.mode": "double", "database.history.kafka.topic": "schema-changes.sqlserver_bigquery", "database.history.kafka.bootstrap.servers": "127.0.0.1:9092"}, "registry_version": "1", "registry_connector": "sqlserver-source-33333333", "table.include.list": ""}, "registry_version": "1", "registry_connector": "sqlserver-source-33333333"}',
'paused', 1, '2025-11-12 08:05:00+00', '2025-11-17 07:44:45.061+00', 1, NULL, false, '2025-11-17 07:38:57.886+00', NULL),

('33333333-3333-3333-3333-333333333332', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'bigquery-sink', 'sink', 'com.wepay.kafka.connect.bigquery.BigQuerySinkConnector',
'{"topics": "sqlserver_bigquery.dbo.Sales,sqlserver_bigquery.dbo.Inventory,sqlserver_bigquery.dbo.Reports", "keyfile": "/path/to/service-account-key.json", "project": "my-gcp-project", "tasks.max": "1", "key.converter": "org.apache.kafka.connect.json.JsonConverter", "defaultDataset": "analytics_dataset", "sanitizeTopics": "true", "connector.class": "com.wepay.kafka.connect.bigquery.BigQuerySinkConnector", "value.converter": "org.apache.kafka.connect.json.JsonConverter", "autoCreateTables": "true", "allowNewBigQueryFields": "true", "allowBigQueryRequiredFieldRelaxation": "true"}',
'paused', 2, '2025-11-12 08:05:00+00', '2025-11-15 11:30:00+00', NULL,
'{"topics": "sqlserver_bigquery.dbo.Sales,sqlserver_bigquery.dbo.Inventory,sqlserver_bigquery.dbo.Reports", "keyfile": "/path/to/service-account-key.json", "project": "my-gcp-project", "tasks.max": "1", "key.converter": "org.apache.kafka.connect.json.JsonConverter", "defaultDataset": "analytics_dataset", "sanitizeTopics": "true", "connector.class": "com.wepay.kafka.connect.bigquery.BigQuerySinkConnector", "value.converter": "org.apache.kafka.connect.json.JsonConverter", "autoCreateTables": "true", "allowNewBigQueryFields": "true", "allowBigQueryRequiredFieldRelaxation": "true"}',
true, NULL, NULL),

-- Connectors for Pipeline 4 (SQL Server to Postgres)
('c99cac80-76cc-413e-8abc-3c14f86c27ef', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'sqlserver-source', 'source', 'io.debezium.connector.sqlserver.SqlServerConnector',
'{"checksum": "", "connector_class": "io.debezium.connector.sqlserver.SqlServerConnector", "snapshot_config": {"tasks.max": "1", "topic.prefix": "sqlserver_postgres", "database.port": "1433", "database.user": "sa", "snapshot.mode": "initial", "connector.class": "io.debezium.connector.sqlserver.SqlServerConnector", "database.dbname": "SourceDB", "database.hostname": "127.0.0.1", "database.password": "YourStrong@Passw0rd", "table.include.list": "dbo.Products, dbo.Users", "schema.include.list": "dbo", "time.precision.mode": "adaptive", "database.server.name": "sqlserver_postgres", "decimal.handling.mode": "double", "database.history.kafka.topic": "schema-changes.sqlserver_postgres", "database.history.kafka.bootstrap.servers": "127.0.0.1:9092"}, "registry_version": "1", "registry_connector": "sqlserver-source-c99cac80"}',
'running', 1, '2025-11-15 22:22:25.568133+00', '2025-11-17 11:11:18.034+00', NULL,
'{"table.include.list": "dbo.Customers, dbo.Inventory, dbo.Products"}',
true, NULL, NULL),

('a79298ff-b97a-445a-9be9-0b2ee21c1010', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'postgres-sink', 'sink', 'io.confluent.connect.jdbc.JdbcSinkConnector',
'{"topics": "sqlserver_postgres.dbo.Orders,sqlserver_postgres.dbo.Products,sqlserver_postgres.dbo.Customers", "pk.mode": "record_key", "tasks.max": "1", "auto.create": "true", "auto.evolve": "true", "insert.mode": "upsert", "connection.url": "jdbc:postgresql://127.0.0.1:5432/target_db", "delete.enabled": "true", "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector", "table.name.format": "${topic}", "connection.password": "postgres", "connection.username": "postgres"}',
'running', 1, '2025-11-15 22:22:25.568133+00', '2025-11-15 22:22:25.568133+00', NULL,
'{"topics": "sqlserver_postgres.dbo.Orders,sqlserver_postgres.dbo.Products,sqlserver_postgres.dbo.Customers", "pk.mode": "record_key", "tasks.max": "1", "auto.create": "true", "auto.evolve": "true", "insert.mode": "upsert", "connection.url": "jdbc:postgresql://127.0.0.1:5432/target_db", "delete.enabled": "true", "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector", "table.name.format": "${topic}", "connection.password": "postgres", "connection.username": "postgres"}',
true, NULL, NULL),

-- Connectors for Pipeline 5 (Oracle HR to PostgreSQL)
('9121f231-58ee-4485-9987-f5bf0ca0d4ea', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'oracle-financial-source', 'source', 'io.debezium.connector.oracle.OracleConnector',
'{"checksum": "", "connector_class": "io.debezium.connector.oracle.OracleConnector", "snapshot_config": {"tasks.max": "1", "topic.prefix": "oracle_financial", "database.port": 1528, "database.user": "c##dbzuser", "snapshot.mode": "initial", "connector.class": "io.debezium.connector.oracle.OracleConnector", "database.dbname": "ORCLCDBX", "database.hostname": "127.0.0.1", "database.password": "dbz", "database.pdb.name": "ORCLPDB1", "table.include.list": "FINANCE.LEDGER, FINANCE.TRANSACTIONS", "log.mining.strategy": "online_catalog", "schema.include.list": "FINANCE", "time.precision.mode": "adaptive", "database.server.name": "oracle_financial", "decimal.handling.mode": "double", "database.history.kafka.topic": "schema-changes.oracle_financial", "database.history.kafka.bootstrap.servers": "127.0.0.1:9092"}, "registry_version": "1", "registry_connector": "oracle-financial-source-9121f231"}',
'running', 1, '2025-11-15 22:22:13.253748+00', '2025-11-17 13:16:49.282+00', 26, NULL, false, '2025-11-17 11:18:59+00', '2025-11-16 18:00:55.678+00'),

('346d2ba6-63fb-4db6-bb1c-01e94b5a0617', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'kafka-financial-sink', 'sink', 'org.apache.kafka.connect.file.FileStreamSinkConnector',
'{"file": "/tmp/oracle-financial-output.txt", "topics": "oracle_financial.FINANCIAL.TRANSACTIONS,oracle_financial.FINANCIAL.ACCOUNTS,oracle_financial.FINANCIAL.BALANCES", "tasks.max": "1", "key.converter": "org.apache.kafka.connect.json.JsonConverter", "connector.class": "org.apache.kafka.connect.file.FileStreamSinkConnector", "value.converter": "org.apache.kafka.connect.json.JsonConverter", "key.converter.schemas.enable": "true", "value.converter.schemas.enable": "true"}',
'running', 1, '2025-11-15 22:22:13.253748+00', '2025-11-16 15:56:33.62+00', NULL, NULL, false, NULL, NULL),

-- Connectors for Pipeline 6 (PostgreSQL Analytics Sync)
('66666666-6666-6666-6666-666666666661', '22222222-2222-2222-2222-222222222222', 'postgres-analytics-source', 'source', 'io.debezium.connector.postgresql.PostgresConnector',
'{"slot.name": "debezium_analytics", "tasks.max": "1", "plugin.name": "pgoutput", "topic.prefix": "postgres_analytics", "database.port": 5432, "database.user": "postgres", "snapshot.mode": "initial", "connector.class": "io.debezium.connector.postgresql.PostgresConnector", "database.dbname": "app_prod", "publication.name": "dbz_publication", "database.hostname": "postgres-app.company.com", "database.password": "postgres", "table.include.list": "public.users,public.orders,public.products", "schema.include.list": "public", "time.precision.mode": "adaptive", "database.server.name": "postgres_analytics", "decimal.handling.mode": "double"}',
'running', 1, '2025-11-07 15:30:00+00', '2025-11-17 15:00:00+00', 1, NULL, false, '2025-11-17 15:00:00+00', NULL),

('66666666-6666-6666-6666-666666666662', '22222222-2222-2222-2222-222222222222', 'postgres-warehouse-sink', 'sink', 'io.debezium.connector.jdbc.JdbcSinkConnector',
'{"topics": "postgres_analytics.public.users,postgres_analytics.public.orders,postgres_analytics.public.products", "pk.mode": "record_key", "tasks.max": "1", "auto.create": "true", "auto.evolve": "true", "insert.mode": "upsert", "connection.url": "jdbc:postgresql://postgres-warehouse.company.com:5432/analytics", "delete.enabled": "true", "connector.class": "io.debezium.connector.jdbc.JdbcSinkConnector", "table.name.format": "${topic}", "connection.password": "postgres", "connection.username": "postgres"}',
'running', 1, '2025-11-07 15:30:00+00', '2025-11-17 15:00:00+00', NULL, NULL, false, NULL, NULL),

-- Connectors for Pipeline 7 (SQL Server Inventory Mirror)
('77777777-7777-7777-7777-777777777771', '33333333-3333-3333-3333-333333333333', 'sqlserver-inventory-source', 'source', 'io.debezium.connector.sqlserver.SqlServerConnector',
'{"tasks.max": "1", "topic.prefix": "sqlserver_inventory", "database.port": "1433", "database.user": "sa", "snapshot.mode": "initial", "connector.class": "io.debezium.connector.sqlserver.SqlServerConnector", "database.dbname": "Inventory", "database.hostname": "sqlserver-inv.company.com", "database.password": "YourStrong@Passw0rd", "table.include.list": "dbo.Items,dbo.Stock,dbo.Warehouses", "schema.include.list": "dbo", "time.precision.mode": "adaptive", "database.server.name": "sqlserver_inventory", "decimal.handling.mode": "double", "database.history.kafka.topic": "schema-changes.sqlserver_inventory", "database.history.kafka.bootstrap.servers": "127.0.0.1:9092"}',
'running', 1, '2025-11-16 15:30:00+00', '2025-11-17 13:00:00+00', 1, NULL, false, '2025-11-17 13:00:00+00', NULL),

('77777777-7777-7777-7777-777777777772', '33333333-3333-3333-3333-333333333333', 'postgres-inventory-sink', 'sink', 'io.debezium.connector.jdbc.JdbcSinkConnector',
'{"topics": "sqlserver_inventory.dbo.Items,sqlserver_inventory.dbo.Stock,sqlserver_inventory.dbo.Warehouses", "pk.mode": "record_key", "tasks.max": "1", "auto.create": "true", "auto.evolve": "true", "insert.mode": "upsert", "connection.url": "jdbc:postgresql://postgres-warehouse.company.com:5432/inventory_mirror", "delete.enabled": "true", "connector.class": "io.debezium.connector.jdbc.JdbcSinkConnector", "table.name.format": "${topic}", "connection.password": "postgres", "connection.username": "postgres"}',
'running', 1, '2025-11-16 15:30:00+00', '2025-11-17 13:00:00+00', NULL, NULL, false, NULL, NULL),

-- Connectors for Pipeline 8 (Oracle Legacy Migration)
('88888888-8888-8888-8888-888888888881', '44444444-4444-4444-4444-444444444444', 'oracle-legacy-source', 'source', 'io.debezium.connector.oracle.OracleConnector',
'{"tasks.max": "1", "topic.prefix": "oracle_legacy", "database.port": 1521, "database.user": "c##dbzuser", "snapshot.mode": "initial", "connector.class": "io.debezium.connector.oracle.OracleConnector", "database.dbname": "ORCLCDB", "database.hostname": "oracle-legacy.company.com", "database.password": "dbz", "database.pdb.name": "ORCLPDB1", "table.include.list": "LEGACY.ORDERS,LEGACY.CUSTOMERS", "log.mining.strategy": "online_catalog", "schema.include.list": "LEGACY", "time.precision.mode": "adaptive", "database.server.name": "oracle_legacy", "decimal.handling.mode": "double", "database.history.kafka.topic": "schema-changes.oracle_legacy", "database.history.kafka.bootstrap.servers": "127.0.0.1:9092"}',
'running', 1, '2025-11-17 14:30:00+00', '2025-11-17 15:00:00+00', 1, NULL, false, '2025-11-17 15:00:00+00', NULL),

('88888888-8888-8888-8888-888888888882', '44444444-4444-4444-4444-444444444444', 'postgres-legacy-sink', 'sink', 'io.debezium.connector.jdbc.JdbcSinkConnector',
'{"topics": "oracle_legacy.LEGACY.ORDERS,oracle_legacy.LEGACY.CUSTOMERS", "pk.mode": "record_key", "tasks.max": "1", "auto.create": "true", "auto.evolve": "true", "insert.mode": "upsert", "connection.url": "jdbc:postgresql://postgres-warehouse.company.com:5432/legacy_archive", "delete.enabled": "true", "connector.class": "io.debezium.connector.jdbc.JdbcSinkConnector", "table.name.format": "${topic}", "connection.password": "postgres", "connection.username": "postgres"}',
'running', 1, '2025-11-17 14:30:00+00', '2025-11-17 15:00:00+00', NULL, NULL, false, NULL, NULL),

-- Connectors for Pipeline 9 (Oracle Sales to Snowflake)
('99999999-9999-9999-9999-999999999991', '11111111-1111-1111-1111-111111111111', 'oracle-sales-source', 'source', 'io.debezium.connector.oracle.OracleConnector',
'{"tasks.max": "1", "topic.prefix": "oracle_sales", "database.port": 1521, "database.user": "c##dbzuser", "snapshot.mode": "initial", "connector.class": "io.debezium.connector.oracle.OracleConnector", "database.dbname": "ORCLCDB", "database.hostname": "oracle-sales.company.com", "database.password": "dbz", "database.pdb.name": "ORCLPDB1", "table.include.list": "SALES.ORDERS,SALES.CUSTOMERS,SALES.PRODUCTS", "log.mining.strategy": "online_catalog", "schema.include.list": "SALES", "time.precision.mode": "adaptive", "database.server.name": "oracle_sales", "decimal.handling.mode": "double", "database.history.kafka.topic": "schema-changes.oracle_sales", "database.history.kafka.bootstrap.servers": "127.0.0.1:9092"}',
'running', 1, '2025-11-15 15:30:00+00', '2025-11-17 15:00:00+00', 1, NULL, false, '2025-11-17 15:00:00+00', NULL),

('99999999-9999-9999-9999-999999999992', '11111111-1111-1111-1111-111111111111', 'postgres-sales-sink', 'sink', 'io.debezium.connector.jdbc.JdbcSinkConnector',
'{"topics": "oracle_sales.SALES.ORDERS,oracle_sales.SALES.CUSTOMERS,oracle_sales.SALES.PRODUCTS", "pk.mode": "record_key", "tasks.max": "1", "auto.create": "true", "auto.evolve": "true", "insert.mode": "upsert", "connection.url": "jdbc:postgresql://snowflake.company.com:5432/warehouse", "delete.enabled": "true", "connector.class": "io.debezium.connector.jdbc.JdbcSinkConnector", "table.name.format": "${topic}", "connection.password": "postgres", "connection.username": "postgres"}',
'running', 1, '2025-11-15 15:30:00+00', '2025-11-17 15:00:00+00', NULL, NULL, false, NULL, NULL);

-- =============================================================================
-- PIPELINE OBJECTS (Tables selected for replication)
-- =============================================================================
INSERT INTO pipeline_objects (id, pipeline_id, schema_name, table_name, included, stats) VALUES

-- Pipeline 1: Oracle to Postgres CDC
('dc6bd3c7-241c-402e-b7ca-d7ec9b8f6f61', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'HR', 'EMPLOYEES', true, '{"size": "1.8 MB", "row_count": 3500}'),
('ed8a63cc-a9ab-4216-927f-5552718cebdb', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'HR', 'DEPARTMENTS', true, '{"size": "120 KB", "row_count": 45}'),
('c74a5b1e-cd79-4b94-808c-eb60cbc85d41', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'HR', 'SALARIES', true, '{"row_count": 8500, "size_estimate": "6 MB"}'),

-- Pipeline 2: PostgreSQL to Snowflake
('35d2fac3-5857-4c90-81c9-031efe7da8d8', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'public', 'users', true, '{"row_count": 12000, "size_estimate": "8 MB"}'),
('3bd91504-9ec3-4488-bcfc-dfb4769befdf', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'public', 'events', true, '{"row_count": 350000, "size_estimate": "180 MB"}'),
('efc1ebce-1391-4eb4-b28d-86135bbcd98b', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'public', 'sessions', true, '{"row_count": 45000, "size_estimate": "32 MB"}'),
('d67007ec-d4dc-41f7-bc5a-e405b0abeb1d', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'public', 'metrics', true, '{"row_count": 95000, "size_estimate": "65 MB"}'),

-- Pipeline 3: SQL Server to BigQuery
('3c5aa8fd-44ea-4c48-bcef-2723e853e492', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'analytics', 'page_views', true, '{"row_count": 500000, "size_estimate": "250 MB"}'),
('7268b947-e424-4a3e-9312-afed468c74ee', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'analytics', 'conversions', true, '{"row_count": 25000, "size_estimate": "15 MB"}'),
('34b5d350-f7d0-4834-b9dd-8d795aa15f8c', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'analytics', 'revenue', true, '{"row_count": 18000, "size_estimate": "8 MB"}'),

-- Pipeline 4: SQL Server to Postgres
('9127a19e-9972-473d-9d91-63d8f5e29258', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'dbo', 'Orders', true, '{"row_count": 15000, "size_estimate": "12 MB"}'),
('168cce25-6103-45f8-be5d-0de46fc8f15d', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'dbo', 'Customers', true, '{"row_count": 3500, "size_estimate": "3 MB"}'),
('19e00640-d6c2-45ef-a250-a207adf30ace', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'dbo', 'Products', true, '{"row_count": 850, "size_estimate": "500 KB"}'),
('7a0bdbd4-f418-4287-abc1-ad58d1e8acdd', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'dbo', 'Inventory', true, '{"row_count": 2200, "size_estimate": "1.5 MB"}'),

-- Pipeline 5: Oracle HR to PostgreSQL
('a3dfe88b-cee3-4950-b51c-7f352afc118b', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'FINANCE', 'TRANSACTIONS', true, '{"row_count": 45000, "last_modified": "2025-11-17T10:00:00Z", "size_estimate": "32 MB"}'),
('d9192e51-e15e-4949-8204-ea502f8057ed', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'FINANCE', 'ACCOUNTS', true, '{"row_count": 5000, "last_modified": "2025-11-17T10:00:00Z", "size_estimate": "4 MB"}'),
('d026d9d7-68b5-40d3-8dd6-98a6ab7cc7e9', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'FINANCE', 'LEDGER', true, '{"row_count": 120000, "last_modified": "2025-11-17T10:00:00Z", "size_estimate": "85 MB"}'),
('a4d8ade5-099e-437e-94ef-d90d97c94326', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'HR', 'EMPLOYEES', true, '{"size_mb": 45.2, "row_count": 15420}'),
('a7c998ca-4d0b-4857-82c8-58607ada525d', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'HR', 'DEPARTMENTS', true, '{"size_mb": 0.5, "row_count": 27}'),
('7e4574c7-2db7-40c2-938f-6ac24d05a7ec', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'HR', 'SALARIES', true, '{"size_mb": 120.8, "row_count": 98765}'),
('9f9cb249-2fca-4ce9-a8f2-f88323776c1f', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'HR', 'JOB_HISTORY', true, '{"size_mb": 12.3, "row_count": 5430}'),

-- Pipeline 6: PostgreSQL Analytics Sync
('66666666-aaaa-aaaa-aaaa-666666666661', '22222222-2222-2222-2222-222222222222', 'public', 'users', true, '{"row_count": 8500, "size_estimate": "5 MB"}'),
('66666666-aaaa-aaaa-aaaa-666666666662', '22222222-2222-2222-2222-222222222222', 'public', 'orders', true, '{"row_count": 25000, "size_estimate": "18 MB"}'),
('66666666-aaaa-aaaa-aaaa-666666666663', '22222222-2222-2222-2222-222222222222', 'public', 'products', true, '{"row_count": 1200, "size_estimate": "800 KB"}'),

-- Pipeline 7: SQL Server Inventory Mirror
('77777777-aaaa-aaaa-aaaa-777777777771', '33333333-3333-3333-3333-333333333333', 'dbo', 'Items', true, '{"row_count": 5500, "size_estimate": "4 MB"}'),
('77777777-aaaa-aaaa-aaaa-777777777772', '33333333-3333-3333-3333-333333333333', 'dbo', 'Stock', true, '{"row_count": 12000, "size_estimate": "8 MB"}'),
('77777777-aaaa-aaaa-aaaa-777777777773', '33333333-3333-3333-3333-333333333333', 'dbo', 'Warehouses', true, '{"row_count": 45, "size_estimate": "100 KB"}'),

-- Pipeline 8: Oracle Legacy Migration (DRAFT - incomplete setup)
('88888888-aaaa-aaaa-aaaa-888888888881', '44444444-4444-4444-4444-444444444444', 'LEGACY', 'ORDERS', true, '{"row_count": 850000, "size_estimate": "1.2 GB"}'),
('88888888-aaaa-aaaa-aaaa-888888888882', '44444444-4444-4444-4444-444444444444', 'LEGACY', 'CUSTOMERS', true, '{"row_count": 45000, "size_estimate": "32 MB"}'),

-- Pipeline 9: Oracle Sales to Snowflake
('99999999-aaaa-aaaa-aaaa-999999999991', '11111111-1111-1111-1111-111111111111', 'SALES', 'ORDERS', true, '{"row_count": 125000, "size_estimate": "95 MB"}'),
('99999999-aaaa-aaaa-aaaa-999999999992', '11111111-1111-1111-1111-111111111111', 'SALES', 'CUSTOMERS', true, '{"row_count": 18000, "size_estimate": "12 MB"}'),
('99999999-aaaa-aaaa-aaaa-999999999993', '11111111-1111-1111-1111-111111111111', 'SALES', 'PRODUCTS', true, '{"row_count": 3500, "size_estimate": "2.5 MB"}');

-- =============================================================================
-- PIPELINE TABLE OBJECTS (Detailed table replication status)
-- =============================================================================
INSERT INTO pipeline_table_objects (id, pipeline_id, source_connector_id, sink_connector_id, schema_name, table_name, status, last_event_timestamp, row_count, size_estimate, last_sync_time, source_topic, partition_count, destination_table, snapshot_progress, error_message, created_at, updated_at) VALUES

-- Pipeline 5: Oracle HR to PostgreSQL
('b83e24ef-e96f-48b1-9636-8a4ac874fd38', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', '9121f231-58ee-4485-9987-f5bf0ca0d4ea', '346d2ba6-63fb-4db6-bb1c-01e94b5a0617', 'FINANCE', 'TRANSACTIONS', 'streaming', '2025-11-15 22:22:13.253748+00', 125000, '1.2 GB', '2025-11-15 22:22:13.253748+00', 'oracle_financial.FINANCE.TRANSACTIONS', 1, 'transactions', 0, NULL, '2025-11-15 22:22:13.253748+00', '2025-11-15 22:22:13.253748+00'),
('415aa919-ce6b-46aa-b398-9167c9199c4d', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', '9121f231-58ee-4485-9987-f5bf0ca0d4ea', '346d2ba6-63fb-4db6-bb1c-01e94b5a0617', 'FINANCE', 'ACCOUNTS', 'streaming', '2025-11-15 22:22:13.253748+00', 45000, '450 MB', '2025-11-15 22:22:13.253748+00', 'oracle_financial.FINANCE.ACCOUNTS', 1, 'accounts', 0, NULL, '2025-11-15 22:22:13.253748+00', '2025-11-15 22:22:13.253748+00'),
('3884bdd1-94f3-45a1-b175-8589d1866d36', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', '9121f231-58ee-4485-9987-f5bf0ca0d4ea', '346d2ba6-63fb-4db6-bb1c-01e94b5a0617', 'FINANCE', 'LEDGER', 'streaming', '2025-11-15 22:22:13.253748+00', 380000, '2.8 GB', '2025-11-15 22:22:13.253748+00', 'oracle_financial.FINANCE.LEDGER', 1, 'ledger', 0, NULL, '2025-11-15 22:22:13.253748+00', '2025-11-15 22:22:13.253748+00'),

-- Pipeline 4: SQL Server to Postgres
('5883891b-3474-4fd6-bb75-87b462daf228', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'c99cac80-76cc-413e-8abc-3c14f86c27ef', 'a79298ff-b97a-445a-9be9-0b2ee21c1010', 'dbo', 'Orders', 'streaming', '2025-11-15 22:22:25.568133+00', 580000, '4.2 GB', '2025-11-15 22:22:25.568133+00', 'sqlserver_prod.dbo.Orders', 1, 'orders', 0, NULL, '2025-11-15 22:22:25.568133+00', '2025-11-15 22:22:25.568133+00'),
('cd58368b-8a74-473d-8916-b6c4f41dfeae', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'c99cac80-76cc-413e-8abc-3c14f86c27ef', 'a79298ff-b97a-445a-9be9-0b2ee21c1010', 'dbo', 'Customers', 'streaming', '2025-11-15 22:22:25.568133+00', 95000, '820 MB', '2025-11-15 22:22:25.568133+00', 'sqlserver_prod.dbo.Customers', 1, 'customers', 0, NULL, '2025-11-15 22:22:25.568133+00', '2025-11-15 22:22:25.568133+00'),
('cc68c3dd-867b-42d4-9925-b7754f7a2c40', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'c99cac80-76cc-413e-8abc-3c14f86c27ef', 'a79298ff-b97a-445a-9be9-0b2ee21c1010', 'dbo', 'Products', 'streaming', '2025-11-15 22:22:25.568133+00', 12500, '180 MB', '2025-11-15 22:22:25.568133+00', 'sqlserver_prod.dbo.Products', 1, 'products', 0, NULL, '2025-11-15 22:22:25.568133+00', '2025-11-15 22:22:25.568133+00'),
('a7bcd1fd-46f6-44c2-a1c2-62f14d85c28e', 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a', 'c99cac80-76cc-413e-8abc-3c14f86c27ef', 'a79298ff-b97a-445a-9be9-0b2ee21c1010', 'dbo', 'Inventory', 'streaming', '2025-11-15 22:22:25.568133+00', 28000, '350 MB', '2025-11-15 22:22:25.568133+00', 'sqlserver_prod.dbo.Inventory', 1, 'inventory', 0, NULL, '2025-11-15 22:22:25.568133+00', '2025-11-15 22:22:25.568133+00'),

-- Pipeline 1: Oracle to Postgres CDC
('fa64428d-ac5b-40c2-860c-dac320c6eda2', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', 'HR', 'EMPLOYEES', 'streaming', '2025-11-15 22:22:35.348612+00', 15000, '120 MB', '2025-11-15 22:22:35.348612+00', 'oracle_hr.HR.EMPLOYEES', 1, 'employees', 0, NULL, '2025-11-15 22:22:35.348612+00', '2025-11-15 22:22:35.348612+00'),
('db0dc713-8859-4b68-b046-271c77cb3c71', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', 'HR', 'DEPARTMENTS', 'streaming', '2025-11-15 22:22:35.348612+00', 250, '8 MB', '2025-11-15 22:22:35.348612+00', 'oracle_hr.HR.DEPARTMENTS', 1, 'departments', 0, NULL, '2025-11-15 22:22:35.348612+00', '2025-11-15 22:22:35.348612+00'),
('798917c3-4998-4a6c-87a6-f2973ee6b49f', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', 'HR', 'SALARIES', 'streaming', '2025-11-15 22:22:35.348612+00', 18000, '95 MB', '2025-11-15 22:22:35.348612+00', 'oracle_hr.HR.SALARIES', 1, 'salaries', 0, NULL, '2025-11-15 22:22:35.348612+00', '2025-11-15 22:22:35.348612+00'),

-- Pipeline 2: PostgreSQL to Snowflake
('53276714-0876-4e92-bdf8-29e0ccecbd99', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '22222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'public', 'users', 'streaming', '2025-11-15 22:22:44.25122+00', 450000, '2.1 GB', '2025-11-15 22:22:44.25122+00', 'postgres_prod.public.users', 1, 'users', 0, NULL, '2025-11-15 22:22:44.25122+00', '2025-11-15 22:22:44.25122+00'),
('eeea807a-26db-4f1e-a53c-ebb0a1447d89', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '22222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'public', 'events', 'streaming', '2025-11-15 22:22:44.25122+00', 8500000, '18.5 GB', '2025-11-15 22:22:44.25122+00', 'postgres_prod.public.events', 1, 'events', 0, NULL, '2025-11-15 22:22:44.25122+00', '2025-11-15 22:22:44.25122+00'),
('3376914b-4b7c-44f1-96e7-0bbfc4534146', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '22222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'public', 'sessions', 'streaming', '2025-11-15 22:22:44.25122+00', 2100000, '5.8 GB', '2025-11-15 22:22:44.25122+00', 'postgres_prod.public.sessions', 1, 'sessions', 0, NULL, '2025-11-15 22:22:44.25122+00', '2025-11-15 22:22:44.25122+00'),
('de0eea18-3450-4f65-9d3a-0cfe5039716f', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '22222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'public', 'metrics', 'streaming', '2025-11-15 22:22:44.25122+00', 12000000, '24.2 GB', '2025-11-15 22:22:44.25122+00', 'postgres_prod.public.metrics', 1, 'metrics', 0, NULL, '2025-11-15 22:22:44.25122+00', '2025-11-15 22:22:44.25122+00'),

-- Pipeline 3: SQL Server to BigQuery
('87183c4d-0982-4697-bfec-782c4ba4d328', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '33333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333332', 'analytics', 'page_views', 'streaming', '2025-11-15 22:22:52.688164+00', 35000000, '68.5 GB', '2025-11-15 22:22:52.688164+00', 'sqlserver_analytics.analytics.page_views', 1, 'page_views', 0, NULL, '2025-11-15 22:22:52.688164+00', '2025-11-15 22:22:52.688164+00'),
('37b8f926-5b36-4255-9607-d7578618dfa0', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '33333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333332', 'analytics', 'conversions', 'streaming', '2025-11-15 22:22:52.688164+00', 1200000, '3.2 GB', '2025-11-15 22:22:52.688164+00', 'sqlserver_analytics.analytics.conversions', 1, 'conversions', 0, NULL, '2025-11-15 22:22:52.688164+00', '2025-11-15 22:22:52.688164+00'),
('002470ae-2136-4259-b1d1-b644948070c0', 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '33333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333332', 'analytics', 'revenue', 'streaming', '2025-11-15 22:22:52.688164+00', 850000, '1.8 GB', '2025-11-15 22:22:52.688164+00', 'sqlserver_analytics.analytics.revenue', 1, 'revenue', 0, NULL, '2025-11-15 22:22:52.688164+00', '2025-11-15 22:22:52.688164+00'),

-- Pipeline 6: PostgreSQL Analytics Sync
('66666666-bbbb-bbbb-bbbb-666666666661', '22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666661', '66666666-6666-6666-6666-666666666662', 'public', 'users', 'streaming', '2025-11-17 15:00:00+00', 8500, '5 MB', '2025-11-17 15:00:00+00', 'postgres_analytics.public.users', 1, 'users', 0, NULL, '2025-11-07 15:30:00+00', '2025-11-17 15:00:00+00'),
('66666666-bbbb-bbbb-bbbb-666666666662', '22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666661', '66666666-6666-6666-6666-666666666662', 'public', 'orders', 'streaming', '2025-11-17 15:00:00+00', 25000, '18 MB', '2025-11-17 15:00:00+00', 'postgres_analytics.public.orders', 1, 'orders', 0, NULL, '2025-11-07 15:30:00+00', '2025-11-17 15:00:00+00'),
('66666666-bbbb-bbbb-bbbb-666666666663', '22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666661', '66666666-6666-6666-6666-666666666662', 'public', 'products', 'streaming', '2025-11-17 15:00:00+00', 1200, '800 KB', '2025-11-17 15:00:00+00', 'postgres_analytics.public.products', 1, 'products', 0, NULL, '2025-11-07 15:30:00+00', '2025-11-17 15:00:00+00'),

-- Pipeline 7: SQL Server Inventory Mirror
('77777777-bbbb-bbbb-bbbb-777777777771', '33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777771', '77777777-7777-7777-7777-777777777772', 'dbo', 'Items', 'streaming', '2025-11-17 15:00:00+00', 5500, '4 MB', '2025-11-17 15:00:00+00', 'sqlserver_inventory.dbo.Items', 1, 'items', 0, NULL, '2025-11-16 15:30:00+00', '2025-11-17 15:00:00+00'),
('77777777-bbbb-bbbb-bbbb-777777777772', '33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777771', '77777777-7777-7777-7777-777777777772', 'dbo', 'Stock', 'streaming', '2025-11-17 15:00:00+00', 12000, '8 MB', '2025-11-17 15:00:00+00', 'sqlserver_inventory.dbo.Stock', 1, 'stock', 0, NULL, '2025-11-16 15:30:00+00', '2025-11-17 15:00:00+00'),
('77777777-bbbb-bbbb-bbbb-777777777773', '33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777771', '77777777-7777-7777-7777-777777777772', 'dbo', 'Warehouses', 'streaming', '2025-11-17 15:00:00+00', 45, '100 KB', '2025-11-17 15:00:00+00', 'sqlserver_inventory.dbo.Warehouses', 1, 'warehouses', 0, NULL, '2025-11-16 15:30:00+00', '2025-11-17 15:00:00+00'),

-- Pipeline 8: Oracle Legacy Migration
('88888888-bbbb-bbbb-bbbb-888888888881', '44444444-4444-4444-4444-444444444444', '88888888-8888-8888-8888-888888888881', '88888888-8888-8888-8888-888888888882', 'LEGACY', 'ORDERS', 'streaming', '2025-11-17 15:00:00+00', 850000, '1.2 GB', '2025-11-17 15:00:00+00', 'oracle_legacy.LEGACY.ORDERS', 1, 'orders', 0, NULL, '2025-11-17 14:30:00+00', '2025-11-17 15:00:00+00'),
('88888888-bbbb-bbbb-bbbb-888888888882', '44444444-4444-4444-4444-444444444444', '88888888-8888-8888-8888-888888888881', '88888888-8888-8888-8888-888888888882', 'LEGACY', 'CUSTOMERS', 'streaming', '2025-11-17 15:00:00+00', 45000, '32 MB', '2025-11-17 15:00:00+00', 'oracle_legacy.LEGACY.CUSTOMERS', 1, 'customers', 0, NULL, '2025-11-17 14:30:00+00', '2025-11-17 15:00:00+00'),

-- Pipeline 9: Oracle Sales to Snowflake
('99999999-bbbb-bbbb-bbbb-999999999991', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', '99999999-9999-9999-9999-999999999992', 'SALES', 'ORDERS', 'streaming', '2025-11-17 15:00:00+00', 125000, '95 MB', '2025-11-17 15:00:00+00', 'oracle_sales.SALES.ORDERS', 1, 'orders', 0, NULL, '2025-11-15 15:30:00+00', '2025-11-17 15:00:00+00'),
('99999999-bbbb-bbbb-bbbb-999999999992', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', '99999999-9999-9999-9999-999999999992', 'SALES', 'CUSTOMERS', 'streaming', '2025-11-17 15:00:00+00', 18000, '12 MB', '2025-11-17 15:00:00+00', 'oracle_sales.SALES.CUSTOMERS', 1, 'customers', 0, NULL, '2025-11-15 15:30:00+00', '2025-11-17 15:00:00+00'),
('99999999-bbbb-bbbb-bbbb-999999999993', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', '99999999-9999-9999-9999-999999999992', 'SALES', 'PRODUCTS', 'streaming', '2025-11-17 15:00:00+00', 3500, '2.5 MB', '2025-11-17 15:00:00+00', 'oracle_sales.SALES.PRODUCTS', 1, 'products', 0, NULL, '2025-11-15 15:30:00+00', '2025-11-17 15:00:00+00');

-- =============================================================================
-- JOB RUNS (Pipeline execution history)
-- =============================================================================
INSERT INTO job_runs (id, pipeline_id, kind, started_at, finished_at, status, latency_ms, summary) VALUES

-- Pipeline 5 job runs
('f403ef6f-bf64-49ec-9222-c6298fddb7c2', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'precheck', '2025-11-12 15:24:49.875264+00', '2025-11-12 15:25:01.875264+00', 'success', 12450, '{"warnings": 1, "checks_failed": 0, "checks_passed": 8}'),
('fa8c49a7-be5d-4390-a79f-7ab2b8bef0f4', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'seed', '2025-11-12 16:24:49.875264+00', '2025-11-12 19:24:49.875264+00', 'success', 10800000, '{"rows_synced": 119642, "tables_completed": 4}'),
('3d6e3da2-b151-4084-999a-ea4547854d5c', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'incremental', '2025-11-17 13:24:49.875264+00', '2025-11-17 13:25:34.875264+00', 'success', 45230, '{"rows_synced": 127, "tables_affected": 3, "changes_detected": 134}'),
('6f70e28e-0aea-4a79-ae8c-74414f522320', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', 'incremental', '2025-11-17 15:07:49.875264+00', '2025-11-17 15:08:21.875264+00', 'success', 32100, '{"rows_synced": 89, "tables_affected": 2, "changes_detected": 95}');

-- =============================================================================
-- PIPELINE LOGS (Recent activity logs)
-- =============================================================================
INSERT INTO pipeline_logs (pipeline_id, run_id, ts, level, message, context) VALUES

-- Recent logs for Pipeline 5
('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', NULL, '2025-11-17 15:08:04.475143+00', 'info', 'Incremental sync started', '{"trigger": "scheduled"}'),
('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', NULL, '2025-11-17 15:08:09.475143+00', 'info', 'Connected to Oracle source', '{"host": "oracle-prod.company.com"}'),
('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', NULL, '2025-11-17 15:08:14.475143+00', 'info', 'Reading change log from HR.EMPLOYEES', '{"scn": "123456789"}'),
('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', NULL, '2025-11-17 15:08:24.475143+00', 'info', 'Synced 45 rows from HR.EMPLOYEES', '{"inserts": 12, "updates": 33}'),
('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', NULL, '2025-11-17 15:08:29.475143+00', 'info', 'Reading change log from HR.SALARIES', '{"scn": "123456790"}'),
('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', NULL, '2025-11-17 15:08:36.475143+00', 'info', 'Synced 44 rows from HR.SALARIES', '{"inserts": 8, "updates": 36}'),
('e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', NULL, '2025-11-17 15:08:36.475143+00', 'info', 'Incremental sync completed successfully', '{"total_rows": 89, "duration_ms": 32100}');

-- =============================================================================
-- ALERT PREFERENCES (User notification settings)
-- =============================================================================
INSERT INTO alert_preferences (id, user_id, pipeline_connectivity_slack, pipeline_connectivity_email, pipeline_connectivity_dashboard, pipeline_job_failures_slack, pipeline_job_failures_email, pipeline_job_failures_dashboard, source_event_types_slack, source_event_types_email, source_event_types_dashboard, failed_events_summary_slack, failed_events_summary_email, failed_events_summary_dashboard, webhooks_slack, webhooks_email, webhooks_dashboard, pipeline_loading_status_slack, pipeline_loading_status_email, pipeline_loading_status_dashboard, source_side_events_slack, source_side_events_email, source_side_events_dashboard, data_spike_alert_slack, data_spike_alert_email, data_spike_alert_dashboard, updated_at, recipient_id, pipeline_id) VALUES

-- Admin user global preferences
('2b9cc2be-d901-4887-a0d3-b053bf5d9ea3', '93748edf-fe49-4cdb-a089-60ffb211d0d2', false, false, true, false, true, true, false, true, true, false, true, true, false, false, true, false, false, true, false, false, true, false, false, false, '2025-11-16 20:58:04.083+00', NULL, NULL),

-- Maintainer user global preferences
('8c4697b2-c4f3-4e5a-8908-d4ff94ae09e8', '317832e3-cb75-46f1-a0e7-c2b94c0418d5', false, false, false, false, false, false, true, true, false, true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, '2025-11-16 23:05:51.737+00', NULL, NULL),

-- Pipeline-specific alert preferences
('4b0093c9-52f6-4bd0-9abf-bafe37f46a3a', '317832e3-cb75-46f1-a0e7-c2b94c0418d5', false, false, false, false, false, false, true, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, '2025-11-16 23:47:12.676742+00', '9e737887-f1cc-48b3-b1cf-fc6168c1735c', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b'),
('97b15d2e-ddb1-42c7-8813-232dd3c1f0cd', '317832e3-cb75-46f1-a0e7-c2b94c0418d5', false, false, false, true, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, '2025-11-17 10:45:56.698803+00', 'b432c6be-9378-43bb-aeb4-04fdc61b8d90', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e');

-- =============================================================================
-- ALERT RECIPIENTS (Email recipients for alerts)
-- =============================================================================
INSERT INTO alert_recipients (id, user_id, email, created_at, created_by, is_external, recipient_user_id, pipeline_id, channels, slack_webhook_url) VALUES

('9e737887-f1cc-48b3-b1cf-fc6168c1735c', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'sinan.koylu@gmail.com', '2025-11-16 22:01:32.533642+00', NULL, false, '317832e3-cb75-46f1-a0e7-c2b94c0418d5', 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b', '["email"]', NULL),
('b432c6be-9378-43bb-aeb4-04fdc61b8d90', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'sinan.koylu@gmail.com', '2025-11-17 10:45:46.995518+00', '93748edf-fe49-4cdb-a089-60ffb211d0d2', false, '317832e3-cb75-46f1-a0e7-c2b94c0418d5', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '["email"]', NULL),
('9bc34a3b-b419-4308-9b75-1eb9e9af8db8', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'sinan.koylu@gmail.com', '2025-11-17 10:45:47.840351+00', '93748edf-fe49-4cdb-a089-60ffb211d0d2', false, '317832e3-cb75-46f1-a0e7-c2b94c0418d5', NULL, '["email"]', NULL),
('564c8500-6ccc-4c25-8b4f-147520a307e1', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'sinan.koylu@gmail.com', '2025-11-17 10:45:47.925984+00', '93748edf-fe49-4cdb-a089-60ffb211d0d2', false, '317832e3-cb75-46f1-a0e7-c2b94c0418d5', NULL, '["email"]', NULL),
('515b9648-0ded-4a6b-8cef-29258c19cfbd', '93748edf-fe49-4cdb-a089-60ffb211d0d2', 'sinan.koylu@gmail.com', '2025-11-17 10:45:48.118053+00', '93748edf-fe49-4cdb-a089-60ffb211d0d2', false, '317832e3-cb75-46f1-a0e7-c2b94c0418d5', NULL, '["email"]', NULL);

-- =============================================================================
-- END OF MOCK DATA
-- =============================================================================
