import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, AlertTriangle } from 'lucide-react';

interface OracleSourceSettingsProps {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

interface ParameterCategory {
  id: string;
  title: string;
  description: string;
  parameters: Parameter[];
}

interface Parameter {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select' | 'boolean' | 'textarea';
  defaultValue?: any;
  options?: { value: string; label: string }[];
  description?: string;
}

export function OracleSourceSettings({ config, onChange }: OracleSourceSettingsProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['connection']));
  const [localConfig, setLocalConfig] = useState(config);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);

  const categories: ParameterCategory[] = [
    {
      id: 'connection',
      title: 'Connection & Basic Settings',
      description: 'Database connection and connector identification',
      parameters: [
        {
          key: 'database.hostname',
          label: 'Database Hostname',
          type: 'text',
          defaultValue: 'localhost',
          description: 'Oracle database server hostname or IP',
        },
        {
          key: 'database.port',
          label: 'Database Port',
          type: 'number',
          defaultValue: 1521,
          description: 'Oracle listener port',
        },
        {
          key: 'database.user',
          label: 'Database User',
          type: 'text',
          defaultValue: 'DEBEZIUM',
          description: 'Oracle user with LogMiner privileges',
        },
        {
          key: 'database.password',
          label: 'Database Password',
          type: 'password',
          defaultValue: '',
          description: 'Database password',
        },
        {
          key: 'database.dbname',
          label: 'Database Name (SID/Service)',
          type: 'text',
          defaultValue: 'ORCL',
          description: 'Oracle SID or Service Name',
        },
        {
          key: 'database.server.name',
          label: 'Database Server Name',
          type: 'text',
          defaultValue: 'oracle-server',
          description: 'Logical name for this database server',
        },
        {
          key: 'database.server.id',
          label: 'Database Server ID',
          type: 'text',
          defaultValue: '1001',
          description: 'Unique numeric ID for this server',
        },
        {
          key: 'topic.prefix',
          label: 'Topic Prefix',
          type: 'text',
          defaultValue: 'oracle',
          description: 'Kafka topic prefix (topics will be prefix.schema.table)',
        },
        {
          key: 'tasks.max',
          label: 'Max Tasks',
          type: 'number',
          defaultValue: 1,
          description: 'Number of parallel connector tasks',
        },
        {
          key: 'database.connection.adapter',
          label: 'Connection Adapter',
          type: 'select',
          defaultValue: 'logminer',
          options: [
            { value: 'logminer', label: 'LogMiner' },
            { value: 'xstream', label: 'XStream' },
          ],
          description: 'Oracle CDC adapter to use',
        },
      ],
    },
    {
      id: 'log-mining',
      title: 'Log Mining / Redo Management',
      description: 'Configure Oracle LogMiner and redo log processing',
      parameters: [
        {
          key: 'log.mining.strategy',
          label: 'Log Mining Strategy',
          type: 'select',
          defaultValue: 'online_catalog',
          options: [
            { value: 'online_catalog', label: 'Online Catalog' },
            { value: 'redo_log_catalog', label: 'Redo Log Catalog' },
          ],
          description: 'Strategy for extracting LogMiner data',
        },
        {
          key: 'log.mining.archive.log.only.mode',
          label: 'Archive Log Only Mode',
          type: 'boolean',
          defaultValue: false,
          description: 'Force using only archive logs (true when online redo is not accessible)',
        },
        {
          key: 'log.mining.sleep.time.default',
          label: 'Sleep Time Default (ms)',
          type: 'number',
          defaultValue: 1000,
          description: 'Default polling interval for log mining',
        },
        {
          key: 'log.mining.sleep.time.min',
          label: 'Sleep Time Min (ms)',
          type: 'number',
          defaultValue: 0,
          description: 'Minimum polling interval',
        },
        {
          key: 'log.mining.sleep.time.max',
          label: 'Sleep Time Max (ms)',
          type: 'number',
          defaultValue: 3000,
          description: 'Maximum polling interval',
        },
        {
          key: 'log.mining.batch.size.default',
          label: 'Batch Size Default',
          type: 'number',
          defaultValue: 20000,
          description: 'Default number of redo records per batch',
        },
        {
          key: 'log.mining.batch.size.min',
          label: 'Batch Size Min',
          type: 'number',
          defaultValue: 1000,
          description: 'Minimum number of redo records per batch',
        },
        {
          key: 'log.mining.batch.size.max',
          label: 'Batch Size Max',
          type: 'number',
          defaultValue: 100000,
          description: 'Maximum number of redo records per batch',
        },
        {
          key: 'log.mining.archive.log.only',
          label: 'Archive Log Only',
          type: 'boolean',
          defaultValue: false,
          description: 'Use only archived redo logs',
        },
        {
          key: 'log.mining.archive.log.hours',
          label: 'Archive Log Hours',
          type: 'number',
          defaultValue: 24,
          description: 'Hours of archive logs to query',
        },
        {
          key: 'log.mining.archive.destination.name',
          label: 'Archive Destination Name',
          type: 'text',
          defaultValue: '',
          description: 'Oracle archive destination (e.g., LOG_ARCHIVE_DEST_1)',
        },
        {
          key: 'log.mining.archive.log.minimum.hours',
          label: 'Archive Log Minimum Hours',
          type: 'number',
          defaultValue: 4,
          description: 'Minimum hours to retain archive logs',
        },
        {
          key: 'log.mining.continuous.mine',
          label: 'Continuous Mine',
          type: 'boolean',
          defaultValue: true,
          description: 'Keep LogMiner session open continuously',
        },
        {
          key: 'log.mining.session.max.ms',
          label: 'Session Max (ms)',
          type: 'number',
          defaultValue: 0,
          description: 'Max duration for LogMiner session (0 = unlimited)',
        },
        {
          key: 'log.mining.query.timeout.ms',
          label: 'Query Timeout (ms)',
          type: 'number',
          defaultValue: 180000,
          description: 'Timeout for LogMiner queries',
        },
        {
          key: 'oracle.dictionary.mode',
          label: 'Dictionary Mode',
          type: 'select',
          defaultValue: 'auto',
          options: [
            { value: 'auto', label: 'Auto' },
            { value: 'redo_log', label: 'Redo Log' },
            { value: 'online_catalog', label: 'Online Catalog' },
          ],
          description: 'Source of dictionary information',
        },
      ],
    },
    {
      id: 'snapshot',
      title: 'Snapshot / Initial Load',
      description: 'Configure initial snapshot behavior',
      parameters: [
        {
          key: 'snapshot.mode',
          label: 'Snapshot Mode',
          type: 'select',
          defaultValue: 'initial',
          options: [
            { value: 'initial', label: 'Initial (snapshot + streaming)' },
            { value: 'schema_only', label: 'Schema Only (no data)' },
            { value: 'initial_only', label: 'Initial Only (snapshot only)' },
            { value: 'never', label: 'Never (streaming only)' },
          ],
          description: 'How to perform initial snapshot',
        },
        {
          key: 'snapshot.lock.timeout.ms',
          label: 'Lock Timeout (ms)',
          type: 'number',
          defaultValue: 10000,
          description: 'Timeout for acquiring table locks during snapshot',
        },
        {
          key: 'snapshot.max.threads',
          label: 'Max Threads',
          type: 'number',
          defaultValue: 1,
          description: 'Number of parallel snapshot threads',
        },
        {
          key: 'snapshot.fetch.size',
          label: 'Fetch Size',
          type: 'number',
          defaultValue: 2000,
          description: 'JDBC fetch batch size for snapshot',
        },
        {
          key: 'snapshot.delay.ms',
          label: 'Snapshot Delay (ms)',
          type: 'number',
          defaultValue: 0,
          description: 'Delay before starting snapshot',
        },
      ],
    },
    {
      id: 'filtering',
      title: 'Filtering',
      description: 'Filter which tables and columns to capture',
      parameters: [
        {
          key: 'table.include.list',
          label: 'Table Include List',
          type: 'textarea',
          defaultValue: '',
          description: 'Comma-separated list of tables to include (e.g., SCHEMA.TABLE, SCHEMA.*)',
        },
        {
          key: 'table.exclude.list',
          label: 'Table Exclude List',
          type: 'textarea',
          defaultValue: '',
          description: 'Comma-separated list of tables to exclude',
        },
        {
          key: 'column.exclude.list',
          label: 'Column Exclude List',
          type: 'textarea',
          defaultValue: '',
          description: 'Columns to exclude from events',
        },
        {
          key: 'database.include.list',
          label: 'Database Include List',
          type: 'text',
          defaultValue: '',
          description: 'Filter by database/schema names',
        },
        {
          key: 'database.exclude.list',
          label: 'Database Exclude List',
          type: 'text',
          defaultValue: '',
          description: 'Exclude specific databases/schemas',
        },
      ],
    },
    {
      id: 'data-transformation',
      title: 'Data Transformation & Metadata',
      description: 'Configure data type handling and metadata',
      parameters: [
        {
          key: 'decimal.handling.mode',
          label: 'Decimal Handling',
          type: 'select',
          defaultValue: 'precise',
          options: [
            { value: 'precise', label: 'Precise (BigDecimal)' },
            { value: 'double', label: 'Double' },
            { value: 'string', label: 'String' },
          ],
          description: 'How to represent decimal values',
        },
        {
          key: 'binary.handling.mode',
          label: 'Binary Handling',
          type: 'select',
          defaultValue: 'bytes',
          options: [
            { value: 'bytes', label: 'Bytes' },
            { value: 'base64', label: 'Base64' },
            { value: 'hex', label: 'Hex' },
          ],
          description: 'How to represent binary data',
        },
        {
          key: 'time.precision.mode',
          label: 'Time Precision Mode',
          type: 'select',
          defaultValue: 'adaptive',
          options: [
            { value: 'adaptive', label: 'Adaptive' },
            { value: 'connect', label: 'Connect' },
          ],
          description: 'Time/timestamp precision handling',
        },
        {
          key: 'event.processing.failure.handling.mode',
          label: 'Event Failure Handling',
          type: 'select',
          defaultValue: 'fail',
          options: [
            { value: 'fail', label: 'Fail' },
            { value: 'warn', label: 'Warn' },
            { value: 'ignore', label: 'Ignore' },
          ],
          description: 'How to handle event processing failures',
        },
        {
          key: 'tombstones.on.delete',
          label: 'Tombstones on Delete',
          type: 'boolean',
          defaultValue: true,
          description: 'Emit tombstone messages for delete events',
        },
      ],
    },
    {
      id: 'performance',
      title: 'Performance & Resource Usage',
      description: 'Tune performance and resource consumption',
      parameters: [
        {
          key: 'max.queue.size',
          label: 'Max Queue Size',
          type: 'number',
          defaultValue: 8192,
          description: 'Queue size for buffering events',
        },
        {
          key: 'max.batch.size',
          label: 'Max Batch Size',
          type: 'number',
          defaultValue: 2048,
          description: 'Max records per batch sent to Kafka',
        },
        {
          key: 'poll.interval.ms',
          label: 'Poll Interval (ms)',
          type: 'number',
          defaultValue: 1000,
          description: 'Connector polling interval',
        },
        {
          key: 'producer.override.compression.type',
          label: 'Kafka Compression',
          type: 'select',
          defaultValue: 'snappy',
          options: [
            { value: 'none', label: 'None' },
            { value: 'gzip', label: 'GZIP' },
            { value: 'snappy', label: 'Snappy' },
            { value: 'lz4', label: 'LZ4' },
            { value: 'zstd', label: 'ZSTD' },
          ],
          description: 'Kafka producer compression type',
        },
        {
          key: 'producer.override.max.request.size',
          label: 'Max Request Size (bytes)',
          type: 'number',
          defaultValue: 1048576,
          description: 'Maximum size of producer request',
        },
        {
          key: 'offset.flush.interval.ms',
          label: 'Offset Flush Interval (ms)',
          type: 'number',
          defaultValue: 60000,
          description: 'Frequency of offset commits',
        },
      ],
    },
    {
      id: 'security',
      title: 'Security',
      description: 'SSL and encryption settings',
      parameters: [
        {
          key: 'database.ssl.mode',
          label: 'SSL Mode',
          type: 'select',
          defaultValue: 'disabled',
          options: [
            { value: 'disabled', label: 'Disabled' },
            { value: 'required', label: 'Required' },
            { value: 'verify-ca', label: 'Verify CA' },
            { value: 'verify-full', label: 'Verify Full' },
          ],
          description: 'SSL connection mode',
        },
        {
          key: 'database.ssl.keystore',
          label: 'SSL Keystore Path',
          type: 'text',
          defaultValue: '',
          description: 'Path to SSL keystore file',
        },
        {
          key: 'database.ssl.truststore',
          label: 'SSL Truststore Path',
          type: 'text',
          defaultValue: '',
          description: 'Path to SSL truststore file',
        },
        {
          key: 'database.password.encryption.key',
          label: 'Password Encryption Key',
          type: 'text',
          defaultValue: '',
          description: 'Key for encrypting stored passwords',
        },
      ],
    },
    {
      id: 'heartbeat',
      title: 'Heartbeat / Monitoring',
      description: 'Configure heartbeat and monitoring',
      parameters: [
        {
          key: 'heartbeat.interval.ms',
          label: 'Heartbeat Interval (ms)',
          type: 'number',
          defaultValue: 0,
          description: 'Frequency of heartbeat events (0 = disabled)',
        },
        {
          key: 'heartbeat.action.query',
          label: 'Heartbeat Action Query',
          type: 'textarea',
          defaultValue: '',
          description: 'Custom SQL query for heartbeat monitoring',
        },
        {
          key: 'signal.data.collection',
          label: 'Signal Data Collection',
          type: 'text',
          defaultValue: '',
          description: 'Table for outbox-style signaling',
        },
        {
          key: 'provide.transaction.metadata',
          label: 'Provide Transaction Metadata',
          type: 'boolean',
          defaultValue: false,
          description: 'Include transaction metadata in events',
        },
        {
          key: 'include.schema.changes',
          label: 'Include Schema Changes',
          type: 'boolean',
          defaultValue: false,
          description: 'Include DDL changes in events',
        },
      ],
    },
    {
      id: 'key-value-converters',
      title: 'Key/Value Converters',
      description: 'Configure Kafka message key and value serialization',
      parameters: [
        {
          key: 'key.converter',
          label: 'Key Converter',
          type: 'select',
          defaultValue: 'org.apache.kafka.connect.json.JsonConverter',
          options: [
            { value: 'org.apache.kafka.connect.json.JsonConverter', label: 'JSON Converter' },
            { value: 'io.confluent.connect.avro.AvroConverter', label: 'Avro Converter' },
            { value: 'org.apache.kafka.connect.storage.StringConverter', label: 'String Converter' },
          ],
          description: 'Converter class for message keys',
        },
        {
          key: 'key.converter.schemas.enable',
          label: 'Key Converter Schemas Enable',
          type: 'boolean',
          defaultValue: true,
          description: 'Include schema in key (for JSON converter)',
        },
        {
          key: 'value.converter',
          label: 'Value Converter',
          type: 'select',
          defaultValue: 'org.apache.kafka.connect.json.JsonConverter',
          options: [
            { value: 'org.apache.kafka.connect.json.JsonConverter', label: 'JSON Converter' },
            { value: 'io.confluent.connect.avro.AvroConverter', label: 'Avro Converter' },
            { value: 'org.apache.kafka.connect.storage.StringConverter', label: 'String Converter' },
          ],
          description: 'Converter class for message values',
        },
        {
          key: 'value.converter.schemas.enable',
          label: 'Value Converter Schemas Enable',
          type: 'boolean',
          defaultValue: true,
          description: 'Include schema in value (for JSON converter)',
        },
        {
          key: 'message.key.columns',
          label: 'Message Key Columns',
          type: 'textarea',
          defaultValue: '',
          description: 'Override message key columns (format: SCHEMA.TABLE:COL1,COL2;...)',
        },
      ],
    },
    {
      id: 'kafka-schema-history',
      title: 'Kafka Schema History',
      description: 'Configure Kafka topic for schema history storage',
      parameters: [
        {
          key: 'schema.history.internal',
          label: 'Schema History Internal',
          type: 'select',
          defaultValue: 'io.debezium.storage.kafka.history.KafkaSchemaHistory',
          options: [
            { value: 'io.debezium.storage.kafka.history.KafkaSchemaHistory', label: 'Kafka Schema History' },
            { value: 'io.debezium.storage.file.history.FileSchemaHistory', label: 'File Schema History' },
          ],
          description: 'Schema history storage implementation',
        },
        {
          key: 'schema.history.internal.kafka.bootstrap.servers',
          label: 'Kafka Bootstrap Servers',
          type: 'text',
          defaultValue: 'localhost:9092',
          description: 'Kafka brokers for schema history (comma-separated)',
        },
        {
          key: 'schema.history.internal.kafka.topic',
          label: 'Schema History Topic',
          type: 'text',
          defaultValue: 'schema-changes.connector',
          description: 'Kafka topic name for storing schema history',
        },
        {
          key: 'schema.history.internal.skip.unparseable.ddl',
          label: 'Skip Unparseable DDL',
          type: 'boolean',
          defaultValue: true,
          description: 'Skip DDL statements that cannot be parsed',
        },
        {
          key: 'schema.history.internal.store.only.captured.tables.ddl',
          label: 'Store Only Captured Tables DDL',
          type: 'boolean',
          defaultValue: true,
          description: 'Store DDL only for captured tables',
        },
      ],
    },
    {
      id: 'kafka-sasl-security',
      title: 'Kafka SASL Security',
      description: 'Configure SASL authentication for Kafka (optional)',
      parameters: [
        {
          key: 'schema.history.internal.producer.security.protocol',
          label: 'Producer Security Protocol',
          type: 'select',
          defaultValue: 'PLAINTEXT',
          options: [
            { value: 'PLAINTEXT', label: 'PLAINTEXT' },
            { value: 'SASL_PLAINTEXT', label: 'SASL_PLAINTEXT' },
            { value: 'SASL_SSL', label: 'SASL_SSL' },
            { value: 'SSL', label: 'SSL' },
          ],
          description: 'Security protocol for Kafka producer',
        },
        {
          key: 'schema.history.internal.producer.sasl.mechanism',
          label: 'Producer SASL Mechanism',
          type: 'select',
          defaultValue: 'PLAIN',
          options: [
            { value: 'PLAIN', label: 'PLAIN' },
            { value: 'SCRAM-SHA-256', label: 'SCRAM-SHA-256' },
            { value: 'SCRAM-SHA-512', label: 'SCRAM-SHA-512' },
          ],
          description: 'SASL mechanism for producer',
        },
        {
          key: 'schema.history.internal.producer.sasl.jaas.config',
          label: 'Producer SASL JAAS Config',
          type: 'textarea',
          defaultValue: '',
          description: 'JAAS config string for producer (e.g., org.apache.kafka.common.security.plain.PlainLoginModule required username="user" password="pass";)',
        },
        {
          key: 'schema.history.internal.consumer.security.protocol',
          label: 'Consumer Security Protocol',
          type: 'select',
          defaultValue: 'PLAINTEXT',
          options: [
            { value: 'PLAINTEXT', label: 'PLAINTEXT' },
            { value: 'SASL_PLAINTEXT', label: 'SASL_PLAINTEXT' },
            { value: 'SASL_SSL', label: 'SASL_SSL' },
            { value: 'SSL', label: 'SSL' },
          ],
          description: 'Security protocol for Kafka consumer',
        },
        {
          key: 'schema.history.internal.consumer.sasl.mechanism',
          label: 'Consumer SASL Mechanism',
          type: 'select',
          defaultValue: 'PLAIN',
          options: [
            { value: 'PLAIN', label: 'PLAIN' },
            { value: 'SCRAM-SHA-256', label: 'SCRAM-SHA-256' },
            { value: 'SCRAM-SHA-512', label: 'SCRAM-SHA-512' },
          ],
          description: 'SASL mechanism for consumer',
        },
        {
          key: 'schema.history.internal.consumer.sasl.jaas.config',
          label: 'Consumer SASL JAAS Config',
          type: 'textarea',
          defaultValue: '',
          description: 'JAAS config string for consumer',
        },
      ],
    },
  ];

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleParameterChange = (key: string, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const handleDeleteTable = (table: string) => {
    setTableToDelete(table);
    setShowDeleteModal(true);
  };

  const confirmDeleteTable = () => {
    if (!tableToDelete) return;

    const currentTables = (localConfig['table.include.list'] || '').split(',').map((t: string) => t.trim()).filter(Boolean);
    const updatedTables = currentTables.filter((t: string) => t !== tableToDelete);

    handleParameterChange('table.include.list', updatedTables.join(','));
    setShowDeleteModal(false);
    setTableToDelete(null);
  };

  const renderParameter = (param: Parameter) => {
    const value = localConfig[param.key] ?? param.defaultValue;

    switch (param.type) {
      case 'boolean':
        return (
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => handleParameterChange(param.key, e.target.checked)}
              className="mt-1 rounded"
            />
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {param.label}
              </label>
              {param.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {param.description}
                </p>
              )}
            </div>
          </div>
        );

      case 'select':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {param.label}
            </label>
            <select
              value={value}
              onChange={(e) => handleParameterChange(param.key, e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              {param.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {param.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {param.description}
              </p>
            )}
          </div>
        );

      case 'textarea':
        if (param.key === 'table.include.list') {
          const tables = (value || '').split(',').map((t: string) => t.trim()).filter(Boolean);
          return (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {param.label}
              </label>
              {tables.length > 0 ? (
                <div className="space-y-2 mb-2">
                  {tables.map((table: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{table}</span>
                      <button
                        onClick={() => handleDeleteTable(table)}
                        className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Remove table"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <textarea
                value={value}
                onChange={(e) => handleParameterChange(param.key, e.target.value)}
                rows={3}
                placeholder="SCHEMA.TABLE1,SCHEMA.TABLE2,..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
              {param.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {param.description}
                </p>
              )}
            </div>
          );
        }

        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {param.label}
            </label>
            <textarea
              value={value}
              onChange={(e) => handleParameterChange(param.key, e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm"
            />
            {param.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {param.description}
              </p>
            )}
          </div>
        );

      case 'number':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {param.label}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleParameterChange(param.key, Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            {param.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {param.description}
              </p>
            )}
          </div>
        );

      case 'password':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {param.label}
            </label>
            <input
              type="password"
              value={value}
              onChange={(e) => handleParameterChange(param.key, e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            {param.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {param.description}
              </p>
            )}
          </div>
        );

      default:
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {param.label}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => handleParameterChange(param.key, e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            {param.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {param.description}
              </p>
            )}
          </div>
        );
    }
  };

  return (
    <>
      <div className="space-y-4">
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          return (
            <div
              key={category.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-between"
              >
                <div className="text-left">
                  <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {category.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {category.description}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {isExpanded && (
                <div className="p-6 bg-white dark:bg-gray-800 space-y-4">
                  {category.parameters.map((param) => (
                    <div key={param.key}>{renderParameter(param)}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showDeleteModal && tableToDelete && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setShowDeleteModal(false)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Remove Table from Pipeline
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    You are about to remove <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{tableToDelete}</span> from the source configuration.
                  </p>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Impact on Sink/Destination
                    </h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                      <li>Data from this table will no longer be replicated</li>
                      <li>Existing data in the destination will remain unchanged</li>
                      <li>The destination table will not be dropped automatically</li>
                      <li>You may need to manually clean up the destination table if required</li>
                    </ul>
                  </div>

                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Are you sure you want to proceed?
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteTable}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Remove Table
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
