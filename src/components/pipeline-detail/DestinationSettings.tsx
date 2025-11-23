import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const JDBC_PREFIX = 'jdbc:postgresql://';

interface ParsedJdbcDetails {
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
}

const parseJdbcUrl = (url?: string): ParsedJdbcDetails | null => {
  if (!url || typeof url !== 'string' || !url.startsWith(JDBC_PREFIX)) {
    return null;
  }

  const withoutPrefix = url.slice(JDBC_PREFIX.length);
  const [hostPortPart = '', pathAndQuery = ''] = withoutPrefix.split('/', 2);
  const [databasePart = '', queryPart = ''] = pathAndQuery.split('?', 2);
  const [hostPart, portPart] = hostPortPart.split(':', 2);

  const numericPort = portPart ? Number(portPart) : undefined;
  const params = new URLSearchParams(queryPart);
  const schemaParam =
    params.get('currentSchema') ||
    params.get('current_schema') ||
    params.get('search_path') ||
    undefined;

  return {
    host: hostPart?.trim() || undefined,
    port: Number.isNaN(numericPort) ? undefined : numericPort,
    database: databasePart ? decodeURIComponent(databasePart) : undefined,
    schema: schemaParam || undefined,
  };
};

interface DestinationSettingsProps {
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

export function DestinationSettings({ config, onChange }: DestinationSettingsProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['connection']));
  const [localConfig, setLocalConfig] = useState(config);
  const connectionUrl = localConfig['connection.url'] as string | undefined;

  useEffect(() => {
    const parsed = parseJdbcUrl(connectionUrl);
    if (!parsed) return;

    setLocalConfig((prev) => {
      const updates: Record<string, any> = {};

      if (parsed.host && prev.host !== parsed.host) {
        updates.host = parsed.host;
      }

      const currentPort = typeof prev.port === 'string' ? Number(prev.port) : prev.port;
      if (parsed.port && currentPort !== parsed.port) {
        updates.port = parsed.port;
      }

      if (parsed.database && prev.database !== parsed.database) {
        updates.database = parsed.database;
      }

      if (parsed.schema && prev.schema !== parsed.schema) {
        updates.schema = parsed.schema;
      }

      if (Object.keys(updates).length === 0) {
        return prev;
      }

      const newConfig = { ...prev, ...updates };
      onChange(newConfig);
      return newConfig;
    });
  }, [connectionUrl, onChange]);

  const categories: ParameterCategory[] = [
    {
      id: 'connection',
      title: 'Connection Settings',
      description: 'Database connection configuration',
      parameters: [
        {
          key: 'connection.url',
          label: 'Connection URL',
          type: 'text',
          defaultValue: 'jdbc:postgresql://127.0.0.1:5432/LOCALDN',
          description: 'JDBC connection URL',
        },
        {
          key: 'host',
          label: 'Host',
          type: 'text',
          defaultValue: '127.0.0.1',
          description: 'Hostname or IP of the PostgreSQL sink',
        },
        {
          key: 'port',
          label: 'Port',
          type: 'number',
          defaultValue: 5432,
          description: 'Database port (default 5432)',
        },
        {
          key: 'database',
          label: 'Database',
          type: 'text',
          defaultValue: 'LOCALDN',
          description: 'Target database name',
        },
        {
          key: 'schema',
          label: 'Schema',
          type: 'text',
          defaultValue: 'public',
          description: 'Default schema for table creation',
        },
        {
          key: 'connection.username',
          label: 'Username',
          type: 'text',
          defaultValue: 'debezium',
          description: 'Database username',
        },
        {
          key: 'connection.password',
          label: 'Password',
          type: 'password',
          defaultValue: 'debezium',
          description: 'Database password',
        },
        {
          key: 'connection.pool.size',
          label: 'Connection Pool Size',
          type: 'number',
          defaultValue: 5,
          description: 'Maximum number of database connections in the pool',
        },
      ],
    },
    {
      id: 'insert-mode',
      title: 'Insert Mode & Behavior',
      description: 'Configure how data is inserted into destination',
      parameters: [
        {
          key: 'insert.mode',
          label: 'Insert Mode',
          type: 'select',
          defaultValue: 'upsert',
          options: [
            { value: 'insert', label: 'Insert' },
            { value: 'upsert', label: 'Upsert' },
            { value: 'update', label: 'Update' },
          ],
          description: 'How to handle incoming records',
        },
        {
          key: 'delete.enabled',
          label: 'Handle Deletes',
          type: 'boolean',
          defaultValue: true,
          description: 'Process delete events from source',
        },
        {
          key: 'pk.mode',
          label: 'Primary Key Mode',
          type: 'select',
          defaultValue: 'record_key',
          options: [
            { value: 'none', label: 'None' },
            { value: 'record_key', label: 'Record Key' },
            { value: 'record_value', label: 'Record Value' },
            { value: 'kafka', label: 'Kafka' },
          ],
          description: 'How to determine primary keys for upsert/delete',
        },
        {
          key: 'pk.fields',
          label: 'Primary Key Fields',
          type: 'text',
          defaultValue: 'id',
          description: 'Comma-separated list of PK fields (required for upsert/delete)',
        },
        {
          key: 'delete.handling.mode',
          label: 'Delete Handling Mode',
          type: 'select',
          defaultValue: 'rewrite',
          options: [
            { value: 'rewrite', label: 'Rewrite (physical delete)' },
            { value: 'none', label: 'None (ignore deletes)' },
          ],
          description: 'How to handle delete events (tombstones)',
        },
      ],
    },
    {
      id: 'table-naming',
      title: 'Table & Column Mapping',
      description: 'Configure table and column name handling',
      parameters: [
        {
          key: 'table.name.format',
          label: 'Table Name Format',
          type: 'text',
          defaultValue: '${topic}',
          description: 'Format string for table names (e.g., public.${topic})',
        },
        {
          key: 'sanitize.table.names',
          label: 'Sanitize Table Names',
          type: 'boolean',
          defaultValue: true,
          description: 'Convert to lowercase and replace special chars',
        },
        {
          key: 'sanitize.field.names',
          label: 'Sanitize Field Names',
          type: 'boolean',
          defaultValue: true,
          description: 'Convert column names to lowercase',
        },
        {
          key: 'quote.sql.identifiers',
          label: 'Quote SQL Identifiers',
          type: 'select',
          defaultValue: 'never',
          options: [
            { value: 'always', label: 'Always' },
            { value: 'never', label: 'Never' },
          ],
          description: 'Quote table/column names for case-sensitive objects',
        },
        {
          key: 'fields.whitelist',
          label: 'Fields Whitelist',
          type: 'text',
          defaultValue: '',
          description: 'Comma-separated list of columns to include (empty = all)',
        },
        {
          key: 'fields.blacklist',
          label: 'Fields Blacklist',
          type: 'text',
          defaultValue: '',
          description: 'Comma-separated list of columns to exclude',
        },
      ],
    },
    {
      id: 'performance',
      title: 'Batch & Performance',
      description: 'Tune destination connector performance',
      parameters: [
        {
          key: 'batch.size',
          label: 'Batch Size',
          type: 'number',
          defaultValue: 500,
          description: 'Records per batch commit (300-1000 for Postgres)',
        },
        {
          key: 'insert.batch.max.rows',
          label: 'Insert Batch Max Rows',
          type: 'number',
          defaultValue: 1000,
          description: 'Max rows in single INSERT statement',
        },
        {
          key: 'max.retries',
          label: 'Max Retries',
          type: 'number',
          defaultValue: 10,
          description: 'Retry count for deadlock/connection errors',
        },
        {
          key: 'retry.backoff.ms',
          label: 'Retry Backoff (ms)',
          type: 'number',
          defaultValue: 3000,
          description: 'Delay between retry attempts',
        },
        {
          key: 'tasks.max',
          label: 'Max Tasks',
          type: 'number',
          defaultValue: 1,
          description: 'Number of parallel sink tasks',
        },
      ],
    },
    {
      id: 'schema-evolution',
      title: 'Schema Evolution & Data Types',
      description: 'Auto-create tables and handle data type conversions',
      parameters: [
        {
          key: 'auto.create',
          label: 'Auto Create Tables',
          type: 'boolean',
          defaultValue: true,
          description: 'Automatically create tables if they don\'t exist',
        },
        {
          key: 'auto.evolve',
          label: 'Auto Evolve Schema',
          type: 'boolean',
          defaultValue: true,
          description: 'Automatically add new columns',
        },
        {
          key: 'validate.non.null',
          label: 'Validate Non-Null',
          type: 'boolean',
          defaultValue: false,
          description: 'Check table existence when auto.create=false',
        },
        {
          key: 'schema.evolution',
          label: 'Schema Evolution',
          type: 'select',
          defaultValue: 'basic',
          options: [
            { value: 'none', label: 'None' },
            { value: 'basic', label: 'Basic' },
          ],
          description: 'Schema evolution strategy',
        },
        {
          key: 'decimal.handling.mode',
          label: 'Decimal Handling',
          type: 'select',
          defaultValue: 'precise',
          options: [
            { value: 'precise', label: 'Precise (BigDecimal)' },
            { value: 'string', label: 'String' },
            { value: 'double', label: 'Double' },
          ],
          description: 'How to handle DECIMAL/NUMERIC columns in Postgres',
        },
        {
          key: 'numeric.mapping',
          label: 'Numeric Mapping',
          type: 'select',
          defaultValue: 'best_fit',
          options: [
            { value: 'best_fit', label: 'Best Fit' },
            { value: 'best_fit_eager_double', label: 'Best Fit Eager Double' },
            { value: 'precision_only', label: 'Precision Only' },
          ],
          description: 'JDBC to Postgres numeric type mapping',
        },
        {
          key: 'time.precision.mode',
          label: 'Time Precision Mode',
          type: 'select',
          defaultValue: 'adaptive',
          options: [
            { value: 'connect', label: 'Connect' },
            { value: 'adaptive', label: 'Adaptive (microsecond support)' },
          ],
          description: 'Timestamp precision handling',
        },
        {
          key: 'debezium.format.value.schemas.enable',
          label: 'Debezium Value Schemas',
          type: 'boolean',
          defaultValue: true,
          description: 'Enable Debezium-specific value schema processing',
        },
      ],
    },
    {
      id: 'kafka-consumer',
      title: 'Kafka Consumer & Topics',
      description: 'Configure Kafka consumer behavior and topic subscriptions',
      parameters: [
        {
          key: 'topics',
          label: 'Topics',
          type: 'text',
          defaultValue: '',
          description: 'Comma-separated list of Kafka topics to consume (e.g., denizim.public.customers)',
        },
        {
          key: 'consumer.override.auto.offset.reset',
          label: 'Auto Offset Reset',
          type: 'select',
          defaultValue: 'earliest',
          options: [
            { value: 'earliest', label: 'Earliest' },
            { value: 'latest', label: 'Latest' },
            { value: 'none', label: 'None' },
          ],
          description: 'What to do when no initial offset exists',
        },
      ],
    },
    {
      id: 'transforms',
      title: 'Topic Routing & Transforms',
      description: 'Configure Single Message Transforms (SMT) for topic routing',
      parameters: [
        {
          key: 'transforms',
          label: 'Transform List',
          type: 'text',
          defaultValue: '',
          description: 'Comma-separated list of transform aliases (e.g., route)',
        },
        {
          key: 'transforms.route.type',
          label: 'Route Transform Type',
          type: 'text',
          defaultValue: 'org.apache.kafka.connect.transforms.RegexRouter',
          description: 'SMT class for routing (typically RegexRouter)',
        },
        {
          key: 'transforms.route.regex',
          label: 'Route Regex Pattern',
          type: 'text',
          defaultValue: '([^.]+)\\.([^.]+)\\.(.*)',
          description: 'Regex pattern to match topic names (e.g., ([^.]+)\\.([^.]+)\\.(.*))',
        },
        {
          key: 'transforms.route.replacement',
          label: 'Route Replacement',
          type: 'text',
          defaultValue: '$1_$2_$3',
          description: 'Replacement pattern for table names (e.g., $1_$2_$3)',
        },
      ],
    },
    {
      id: 'retry-dlq',
      title: 'Error Handling & DLQ',
      description: 'Configure retry logic and dead letter queue',
      parameters: [
        {
          key: 'errors.tolerance',
          label: 'Error Tolerance',
          type: 'select',
          defaultValue: 'none',
          options: [
            { value: 'none', label: 'None (fail immediately)' },
            { value: 'all', label: 'All (send to DLQ)' },
          ],
          description: 'How to handle errors',
        },
        {
          key: 'errors.deadletterqueue.topic.name',
          label: 'DLQ Topic Name',
          type: 'text',
          defaultValue: 'dlq-sink-errors',
          description: 'Dead letter queue topic name',
        },
        {
          key: 'errors.deadletterqueue.topic.replication.factor',
          label: 'DLQ Replication Factor',
          type: 'number',
          defaultValue: 1,
          description: 'Replication factor for DLQ topic',
        },
        {
          key: 'errors.deadletterqueue.context.headers.enable',
          label: 'DLQ Context Headers',
          type: 'boolean',
          defaultValue: true,
          description: 'Include error context in DLQ headers',
        },
        {
          key: 'errors.log.enable',
          label: 'Log Errors',
          type: 'boolean',
          defaultValue: true,
          description: 'Log error messages to console',
        },
        {
          key: 'errors.log.include.messages',
          label: 'Log Error Messages',
          type: 'boolean',
          defaultValue: true,
          description: 'Include full error messages in logs',
        },
        {
          key: 'errors.retry.timeout',
          label: 'Retry Timeout (ms)',
          type: 'number',
          defaultValue: 0,
          description: 'Max time to retry failed operations (0 = disabled)',
        },
        {
          key: 'errors.retry.delay.max.ms',
          label: 'Max Retry Delay (ms)',
          type: 'number',
          defaultValue: 60000,
          description: 'Maximum delay between retries',
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

  const renderParameter = (param: Parameter) => {
    const value = localConfig[param.key] ?? param.defaultValue;

    switch (param.type) {
      case 'boolean':
        // Ensure boolean values are properly converted from strings
        const boolValue = typeof value === 'string'
          ? value === 'true'
          : Boolean(value);

        return (
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={boolValue}
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
  );
}
