import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { CodeBlockWithCopy } from '../components/ui/CodeBlockWithCopy';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import { createConnectorVersion, activateConnectorVersion } from '../lib/registry';

interface DestinationStepProps {
  pipelineId?: string;
}

export function DestinationStep({ pipelineId: propPipelineId }: DestinationStepProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const state = location.state as { pipelineId?: string };
  const pipelineId = propPipelineId || state.pipelineId;

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sanitizeNames, setSanitizeNames] = useState(true);
  const [formData, setFormData] = useState({
    host: '',
    port: 5432,
    database: '',
    schema: 'public',
    username: '',
    password: '',
    ssl: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : name === 'port' ? parseInt(value) || 0 : value,
    }));
  };

  const sanitizeName = (name: string): string => {
    if (!sanitizeNames) return name;
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  };

  const formatSinkConnectorName = (): string => {
    const base = sanitizeName(formData.database || 'destination');
    const suffix = pipelineId?.slice(0, 8) || 'local';
    return `${base}_${suffix}_sink`;
  };

  const buildRegistrySinkConfig = () => {
    const topicPlaceholder = '${topic}';
    const sanitizedSchema = formData.schema || 'public';
    const sinkName = formatSinkConnectorName();
    return {
      name: sinkName,
      'connector.class': 'io.debezium.connector.jdbc.JdbcSinkConnector',
      'tasks.max': '1',
      topics: 'placeholder',
      'connection.url': `jdbc:postgresql://${formData.host}:${formData.port}/${formData.database}`,
      'connection.username': formData.username,
      'connection.password': formData.password,
      'connection.pool.size': '10',
      'auto.create': 'true',
      'schema.evolution': 'basic',
      'insert.mode': 'upsert',
      'primary.key.mode': 'record_value',
      'primary.key.fields': 'id',
      'delete.enabled': 'false',
      transforms: 'route',
      'transforms.route.type': 'org.apache.kafka.connect.transforms.RegexRouter',
      'transforms.route.regex': '([^.]+)\\.([^.]+)\\.(.*)',
      'transforms.route.replacement': '$1_$2_$3',
      'key.converter': 'org.apache.kafka.connect.json.JsonConverter',
      'key.converter.schemas.enable': 'true',
      'value.converter': 'org.apache.kafka.connect.json.JsonConverter',
      'value.converter.schemas.enable': 'true',
      'debezium.format.value.schemas.enable': 'true',
      'errors.tolerance': 'all',
      'errors.log.enable': 'true',
      'errors.log.include.messages': 'true',
      'errors.deadletterqueue.topic.name': `${sinkName}-dlq`,
      'errors.deadletterqueue.topic.replication.factor': '1',
      'errors.deadletterqueue.context.headers.enable': 'true',
      'consumer.override.auto.offset.reset': 'earliest',
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.host.trim()) {
      showToast('error', 'Host is required');
      return;
    }

    if (!formData.database.trim()) {
      showToast('error', 'Database is required');
      return;
    }

    if (!formData.username.trim()) {
      showToast('error', 'Username is required');
      return;
    }

    if (!formData.password.trim()) {
      showToast('error', 'Password is required');
      return;
    }

    if (!pipelineId) {
      showToast('error', 'Pipeline ID is missing');
      return;
    }

    setIsLoading(true);

    try {
      // Get source connector config to determine topic prefix
      const { data: sourceConnector } = await supabase
        .from('pipeline_connectors')
        .select('config, connector_class')
        .eq('pipeline_id', pipelineId)
        .eq('type', 'source')
        .maybeSingle();

      let topicPrefix = sanitizeName(formData.database || 'pipeline_topic');

      if (sourceConnector?.config) {
        let sourceConfig = sourceConnector.config as any;

        // If using registry, fetch actual config from registry
        if (sourceConfig.registry_connector) {
          const { getActiveConnectorConfig } = await import('../lib/registry');
          const registryConfig = await getActiveConnectorConfig(sourceConfig.registry_connector);
          if (registryConfig) {
            sourceConfig = registryConfig;
            console.log('[DestinationStep] Loaded source config from registry:', sourceConfig.registry_connector);
          }
        }

        // Get topic prefix from source config
        const configTopicPrefix = sourceConfig['topic.prefix'] || sourceConfig['database.server.name'];
        if (configTopicPrefix) {
          // For JDBC Sink, use regex pattern with 'topics.regex' instead of 'topics'
          // Kafka topic names cannot contain wildcards, but regex can match patterns
          topicPrefix = `${configTopicPrefix}\\..*`;
          console.log('[DestinationStep] Using source topic prefix regex:', topicPrefix);
        } else {
          console.warn('[DestinationStep] No topic.prefix or database.server.name found in source config');
        }
      }

      const destinationConfig = {
        host: formData.host,
        port: formData.port,
        database: formData.database,
        schema: formData.schema,
        username: formData.username,
        ssl: formData.ssl,
        sanitize_names: sanitizeNames,
      };

      const { error: updateError } = await supabase
        .from('pipelines')
        .update({
          destination_type: 'postgres',
          destination_config: destinationConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pipelineId);

      if (updateError) {
        showToast('error', 'Failed to save destination', updateError.message);
        return;
      }

      const registryConnectorName = formatSinkConnectorName();
      let sinkConnectorConfig = buildRegistrySinkConfig();

      // Keep 'topics' for schema validation, add 'topics.regex' for actual use
      // Backend will remove 'topics' and keep 'topics.regex' during deployment
      sinkConnectorConfig['topics.regex'] = topicPrefix;

      console.log('[DestinationStep] Sink config topics:', sinkConnectorConfig.topics);
      console.log('[DestinationStep] Sink config topics.regex:', sinkConnectorConfig['topics.regex']);

      const versionResponse = await createConnectorVersion({
        name: registryConnectorName,
        kind: 'sink',
        connectorClass: 'io.debezium.connector.jdbc.JdbcSinkConnector',
        config: sinkConnectorConfig,
        ownerId: pipelineId || null,
      });

      await activateConnectorVersion(registryConnectorName, versionResponse.version.version);

      const connectorData = {
        pipeline_id: pipelineId,
        name: registryConnectorName,
        type: 'sink',
        connector_class: 'io.debezium.connector.jdbc.JdbcSinkConnector',
        config: {
          registry_connector: registryConnectorName,
          registry_version: versionResponse.version.version,
          checksum: versionResponse.version.checksum,
          connector_class: 'io.debezium.connector.jdbc.JdbcSinkConnector',
          snapshot_config: sinkConnectorConfig,
        },
        status: 'running',
        tasks_max: 1,
        last_deployed_version: versionResponse.version.version,
      };

      const { error: connectorError } = await supabase
        .from('pipeline_connectors')
        .insert(connectorData);

      if (connectorError) {
        showToast('error', 'Failed to create destination connector', connectorError.message);
        return;
      }

      showToast('success', 'Destination configuration saved');
      navigate('/pipelines/new/schedule', { state: location.state });
    } catch (error) {
      showToast('error', 'An error occurred', 'Please try again');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const exampleNames = [
    { original: 'User Accounts', sanitized: sanitizeName('User Accounts') },
    { original: 'Sales Data', sanitized: sanitizeName('Sales Data') },
    { original: 'Product-Info', sanitized: sanitizeName('Product-Info') },
  ];

  return (
    <div className="flex h-full">
      <div className="flex-1 p-8 overflow-y-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm mb-6"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Configure PostgreSQL Destination
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Set up your destination database where data will be replicated
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              Ensure your PostgreSQL destination meets the <span className="font-semibold">Prerequisites</span> listed on the right.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Host <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="host"
                value={formData.host}
                onChange={handleChange}
                required
                placeholder="localhost or pg.example.com"
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Port <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="port"
                value={formData.port}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Database <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="database"
                value={formData.database}
                onChange={handleChange}
                required
                placeholder="analytics"
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Schema <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="schema"
                value={formData.schema}
                onChange={handleChange}
                required
                placeholder="public"
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="pguser"
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Enter password"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10 text-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="ssl"
                checked={formData.ssl}
                onChange={handleChange}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Use SSL Connection</span>
            </label>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sanitizeNames}
                  onChange={(e) => setSanitizeNames(e.target.checked)}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    Sanitize Table and Column Names
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Convert names to lowercase and replace spaces with underscores for PostgreSQL compatibility
                  </p>

                  {sanitizeNames && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Preview:</p>
                      {exampleNames.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{item.original}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className="font-mono text-blue-600 dark:text-blue-400">{item.sanitized}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </form>
      </div>

      <div className="w-[600px] bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Prerequisites</h3>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">1. PostgreSQL Database Available</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Ensure you have a PostgreSQL instance (version 10+) running and accessible
            </p>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">2. Create Destination User</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Create a dedicated user with appropriate write permissions
            </p>
            <CodeBlockWithCopy
              code={`-- Create user
CREATE USER <username> WITH PASSWORD '<strong_password>';

-- Grant database connection
GRANT CONNECT ON DATABASE <database> TO <username>;

-- Grant schema usage and creation rights
GRANT USAGE, CREATE ON SCHEMA <schema> TO <username>;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA <schema> TO <username>;
GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA <schema> TO <username>;

-- Grant future table permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA <schema>
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO <username>;
ALTER DEFAULT PRIVILEGES IN SCHEMA <schema>
  GRANT SELECT, USAGE ON SEQUENCES TO <username>;`}
              title="Create User and Grant Permissions"
            />
          </div>

          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">3. Verify Schema Access</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Test that the user can create tables in the target schema
            </p>
            <CodeBlockWithCopy
              code={`-- Test table creation
CREATE TABLE <schema>._bookkeeping_test (id SERIAL PRIMARY KEY, created_at TIMESTAMP DEFAULT NOW());

-- If successful, drop the test table
DROP TABLE <schema>._bookkeeping_test;`}
              title="Test Schema Access"
            />
          </div>

          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">4. Network Access</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ensure your PostgreSQL server is accessible from our region. Check your firewall rules and pg_hba.conf settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
