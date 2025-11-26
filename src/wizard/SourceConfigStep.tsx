import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Info, ChevronDown, AlertTriangle, CheckCircle2, XCircle, X, MessageSquare } from 'lucide-react';
import { CodeBlockWithCopy } from '../components/ui/CodeBlockWithCopy';
import { useToast } from '../components/ui/Toast';
import { ValidationResults } from '../components/ValidationResults';
import { supabase } from '../lib/supabase';
import { useTestConnection, type TestConnectionRequest } from '../hooks/useTestConnection';
import { createConnectorVersion, activateConnectorVersion } from '../lib/registry';
import { ValidationResult } from '../types';

interface SourceConfigStepProps {
  sourceType: string;
}

interface SourceFormData {
  name: string;
  host: string;
  port: number;
  database_name: string;
  service_name: string;
  schema_name: string;
  username: string;
  password: string;
  ssh_tunnel: boolean;
  use_ssl: boolean;
  poll_interval: number;
  query_fetch_size: number;
  long_transaction_window: number;
  load_all_schemas: boolean;
  online_catalog: boolean;
  archive_log_only: boolean;
  load_historical_data: boolean;
  merge_tables: boolean;
  include_new_tables: boolean;
  drop_slot_on_stop: boolean;
  enable_log_monitoring: boolean;
  max_wal_size: number;
  alert_threshold: number;
  log_monitoring_slack: boolean;
}

function formatSourceConnectorName(name?: string) {
  const base = (name ?? 'source').trim();
  return base.toLowerCase().endsWith('_source') ? base : `${base}_source`;
}

function resolveLocalOracleHost(host: string, port: number) {
  if (host === 'oracle-xe') {
    return { host: '127.0.0.1', port: 1521 };
  }
  return { host, port };
}

export function SourceConfigStep({ sourceType }: SourceConfigStepProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { testConnection, testing, result } = useTestConnection();
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [currentValidationStep, setCurrentValidationStep] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showRedoLogSettings, setShowRedoLogSettings] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [existingSources, setExistingSources] = useState<any[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [formData, setFormData] = useState<SourceFormData>({
    name: '',
    host: '',
    port: sourceType === 'oracle' ? 1521 : sourceType === 'postgres' ? 5432 : 1433,
    database_name: '',
    service_name: '',
    schema_name: sourceType === 'sqlserver' ? 'dbo' : 'public',
    username: '',
    password: '',
    ssh_tunnel: false,
    use_ssl: false,
    poll_interval: 500,
    query_fetch_size: 10000,
    long_transaction_window: 5,
    load_all_schemas: false,
    online_catalog: false,
    archive_log_only: false,
    load_historical_data: false,
    merge_tables: false,
    include_new_tables: false,
    drop_slot_on_stop: true,
    enable_log_monitoring: false,
    max_wal_size: 1024,
    alert_threshold: 80,
    log_monitoring_slack: false,
  });

  function mapSourceTypeToConnectionType(type: string): TestConnectionRequest['connectionType'] {
    if (type === 'postgres') return 'postgresql';
    if (type === 'sqlserver') return 'sqlserver';
    return type as TestConnectionRequest['connectionType'];
  }

  useEffect(() => {
    const loadExistingSources = async () => {
      const { data } = await supabase
        .from('pipelines')
        .select('id, name, source_type, source_config')
        .eq('source_type', sourceType)
        .order('created_at', { ascending: false });

      if (data) {
        setExistingSources(data);
      }
    };

    const loadResumeData = async () => {
      const params = new URLSearchParams(location.search);
      const resumeId = params.get('resume');

      if (resumeId) {
        const { data: pipeline } = await supabase
          .from('pipelines')
          .select('id, name, source_type, source_config')
          .eq('id', resumeId)
          .maybeSingle();

        if (pipeline && pipeline.source_config) {
          const config = pipeline.source_config;
          setFormData({
            name: pipeline.name,
            host: config.host || '',
            port: config.port || (sourceType === 'oracle' ? 1521 : sourceType === 'postgres' ? 5432 : 1433),
            database_name: config.database_name || '',
            service_name: config.service_name || '',
            schema_name: config.schema_name || (sourceType === 'sqlserver' ? 'dbo' : 'public'),
            username: config.username || '',
            password: '',
            ssh_tunnel: config.ssh_tunnel || false,
            use_ssl: config.use_ssl || false,
            poll_interval: config.poll_interval || 500,
            query_fetch_size: config.query_fetch_size || 10000,
            long_transaction_window: config.long_transaction_window || 5,
            load_all_schemas: config.load_all_schemas || false,
            online_catalog: config.online_catalog || false,
            archive_log_only: config.archive_log_only || false,
            load_historical_data: config.load_historical_data || false,
            merge_tables: config.merge_tables || false,
            include_new_tables: config.include_new_tables || false,
          });
        }
      }
    };

    loadExistingSources();
    loadResumeData();
  }, [sourceType, location.search]);

  const handleCopyFrom = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sourceId = e.target.value;
    setSelectedSourceId(sourceId);

    if (!sourceId) {
      return;
    }

    const source = existingSources.find(s => s.id === sourceId);
    if (source && source.source_config) {
      const config = source.source_config;
      setFormData({
        name: `${source.name} (Copy)`,
        host: config.host || '',
        port: config.port || (sourceType === 'oracle' ? 1521 : sourceType === 'postgres' ? 5432 : 1433),
        database_name: config.database_name || '',
        service_name: config.service_name || '',
        schema_name: config.schema_name || (sourceType === 'sqlserver' ? 'dbo' : 'public'),
        username: config.username || '',
        password: '',
        ssh_tunnel: config.ssh_tunnel || false,
        use_ssl: config.use_ssl || false,
        poll_interval: config.poll_interval || 500,
        query_fetch_size: config.query_fetch_size || 10000,
        long_transaction_window: config.long_transaction_window || 5,
        load_all_schemas: config.load_all_schemas || false,
        online_catalog: config.online_catalog || false,
        archive_log_only: config.archive_log_only || false,
        load_historical_data: config.load_historical_data || false,
        merge_tables: config.merge_tables || false,
        include_new_tables: config.include_new_tables || false,
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : ['port', 'poll_interval', 'query_fetch_size', 'long_transaction_window', 'max_wal_size', 'alert_threshold'].includes(name) ? parseInt(value) || 0 : value,
    }));
  };

  const handleTestConnection = async () => {
    if (!formData.host.trim()) {
      showToast('error', 'Host is required');
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

    if (
      sourceType === 'oracle' &&
      !formData.service_name.trim() &&
      !formData.database_name.trim()
    ) {
      showToast('error', 'Oracle kaynakları için Service Name ya da Database Name gerekli');
      return;
    }

    setIsValidating(true);
    setValidationResults([]);

    const steps = ['hostname', 'host', 'database', 'credentials', 'permissions', 'configurations'];
    const results: ValidationResult[] = [];

    for (const step of steps) {
      setCurrentValidationStep(step);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const connectionPayload: TestConnectionRequest = {
      connectionType: mapSourceTypeToConnectionType(sourceType),
      host: formData.host,
      port: formData.port,
      username: formData.username,
      password: formData.password,
      ssl: formData.use_ssl,
    };

    if (sourceType === 'oracle') {
      const resolved = resolveLocalOracleHost(formData.host, formData.port);
      connectionPayload.host = resolved.host;
      connectionPayload.port = resolved.port;
      connectionPayload.serviceName = formData.service_name;
    } else {
      connectionPayload.database = formData.database_name;
    }

    const result = await testConnection(connectionPayload);

    if (result.success) {
      steps.forEach(step => {
        results.push({
          check_name: step.charAt(0).toUpperCase() + step.slice(1),
          status: 'passed',
          message: `${step.charAt(0).toUpperCase() + step.slice(1)} validation passed`,
          details: {},
        });
      });
      showToast('success', 'Connection successful!', result.message);
    } else {
      const failedStep = result.error?.toLowerCase().includes('database') ? 'database' :
                         result.error?.toLowerCase().includes('password') || result.error?.toLowerCase().includes('credential') ? 'credentials' :
                         result.error?.toLowerCase().includes('permission') ? 'permissions' :
                         'host';

      steps.forEach(step => {
        if (steps.indexOf(step) < steps.indexOf(failedStep)) {
          results.push({
            check_name: step.charAt(0).toUpperCase() + step.slice(1),
            status: 'passed',
            message: `${step.charAt(0).toUpperCase() + step.slice(1)} validation passed`,
            details: {},
          });
        } else if (step === failedStep) {
          results.push({
            check_name: step.charAt(0).toUpperCase() + step.slice(1),
            status: 'failed',
            message: result.error || 'Validation failed',
            details: {},
          });
        } else {
          results.push({
            check_name: step.charAt(0).toUpperCase() + step.slice(1),
            status: 'passed',
            message: '',
            details: {},
          });
        }
      });
      showToast('error', 'Connection failed', result.error);
    }

    setValidationResults(results);
    setIsValidating(false);
    setCurrentValidationStep('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('error', 'Pipeline name is required');
      return;
    }

    if (!formData.host.trim()) {
      showToast('error', 'Host is required');
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

    if (
      sourceType === 'oracle' &&
      !formData.service_name.trim() &&
      !formData.database_name.trim()
    ) {
      showToast('error', 'Oracle kaynakları için Service Name ya da Database Name gerekli');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const pipelineData = {
        user_id: user?.id || '00000000-0000-0000-0000-000000000000',
        name: formData.name,
        source_type: sourceType,
        source_config: {
          host: formData.host,
          port: formData.port,
          database_name: formData.database_name,
          username: formData.username,
          ssl: formData.use_ssl,
        },
        status: 'draft',
        enable_log_monitoring: formData.enable_log_monitoring,
        max_wal_size: formData.max_wal_size,
        alert_threshold: formData.alert_threshold,
        log_monitoring_slack: formData.log_monitoring_slack,
      };

      const { data: pipeline, error } = await supabase
        .from('pipelines')
        .insert(pipelineData)
        .select()
        .maybeSingle();

      if (error) {
        showToast('error', 'Failed to create pipeline', error.message);
        return;
      }

      if (!pipeline) {
        showToast('error', 'Failed to create pipeline');
        return;
      }

      const connectorConfig = buildSourceConnectorConfig(sourceType, formData);
      const registryConnectorName = formatSourceConnectorName(formData.name);

      console.log('Creating connector version with config:', {
        name: registryConnectorName,
        kind: 'source',
        connectorClass: connectorConfig.connector_class,
        config: connectorConfig.config,
      });

      const versionResponse = await createConnectorVersion({
        name: registryConnectorName,
        kind: 'source',
        connectorClass: connectorConfig.connector_class,
        config: connectorConfig.config,
        ownerId: user?.id,
        createdBy: user?.id,
      });

      await activateConnectorVersion(registryConnectorName, versionResponse.version.version);

      const connectorData = {
        pipeline_id: pipeline.id,
        name: registryConnectorName,
        type: 'source',
        connector_class: connectorConfig.connector_class,
        config: {
          registry_connector: registryConnectorName,
          registry_version: versionResponse.version.version,
          checksum: versionResponse.version.checksum,
          connector_class: connectorConfig.connector_class,
          snapshot_config: connectorConfig.config,
        },
        status: 'running',
        tasks_max: 1,
        last_deployed_version: versionResponse.version.version,
      };

      const { error: connectorError } = await supabase
        .from('pipeline_connectors')
        .insert(connectorData);

      if (connectorError) {
        showToast('error', 'Failed to create source connector', connectorError.message);
        return;
      }

      showToast('success', 'Source configuration saved');

      const sourceConnection: TestConnectionRequest = {
        connectionType: mapSourceTypeToConnectionType(sourceType),
        host: formData.host,
        port: formData.port,
        username: formData.username,
        password: formData.password,
        ssl: formData.use_ssl,
      };

      if (sourceType === 'oracle') {
        const resolved = resolveLocalOracleHost(formData.host, formData.port);
        sourceConnection.host = resolved.host;
        sourceConnection.port = resolved.port;
        sourceConnection.serviceName = formData.service_name;
      } else {
        sourceConnection.database = formData.database_name;
        sourceConnection.schemaName = formData.schema_name;
      }

      const navigationState = {
        ...location.state,
        pipelineId: pipeline.id,
        sourceType,
        sourceConnection,
      };

      navigate('/pipelines/new/objects', { state: navigationState });
    } catch (error) {
      showToast('error', 'An error occurred', 'Please try again');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceDisplayName = () => {
    const names: Record<string, string> = {
      oracle: 'Oracle',
      postgres: 'PostgreSQL',
      sqlserver: 'SQL Server',
    };
    return names[sourceType] || sourceType;
  };

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
          Configure your {getSourceDisplayName()} Source
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Follow the guide on the right to set up your Source
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Copy from</label>
              <select
                value={selectedSourceId}
                onChange={handleCopyFrom}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="">Existing Sources</option>
                {existingSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Draft saved</span>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3 flex items-start gap-3 border-l-4 border-l-blue-500">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                There are <strong>Prerequisites</strong> that you must ensure to set up this Source for your Pipeline.{' '}
                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  Learn more →
                </a>
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pipeline Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder={`${getSourceDisplayName()} Pipeline`}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">A unique name for your Pipeline</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Database Host <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="host"
                value={formData.host}
                onChange={handleChange}
                required
                placeholder="10.123.1.001 or db.example.com"
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Database Port <span className="text-red-500">*</span>
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
                Database User <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="dbuser"
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Database Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Enter database password"
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

          {sourceType === 'oracle' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Service Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="service_name"
                value={formData.service_name}
                onChange={handleChange}
                required
                placeholder="ORCLPDB1"
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
              />
            </div>
          )}

          {sourceType !== 'oracle' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Database Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="database_name"
                  value={formData.database_name}
                  onChange={handleChange}
                  required
                  placeholder="mydb"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  The name of the database you want to ingest data from
                </p>
              </div>

              {(sourceType === 'postgres' || sourceType === 'sqlserver') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Schema Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="schema_name"
                    value={formData.schema_name}
                    onChange={handleChange}
                    required
                    placeholder={sourceType === 'sqlserver' ? 'dbo' : 'public'}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    The name of the schema you want to ingest data from
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Please open access to the {sourceType === 'postgres' ? 'PostgreSQL' : sourceType === 'oracle' ? 'Oracle' : 'database'} port from DataMove's IP addresses{' '}
              <span className="font-mono text-red-600 dark:text-red-400 font-semibold">{sourceType === 'postgres' ? '13.228.214.171' : '13.228.214.171'}</span> and{' '}
              <span className="font-mono text-red-600 dark:text-red-400 font-semibold">{sourceType === 'postgres' ? '52.77.50.136' : '52.77.56.136'}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative inline-block w-11 h-6 mt-1">
                <input
                  type="checkbox"
                  name="ssh_tunnel"
                  checked={formData.ssh_tunnel}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Connect Through SSH</div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Connect securely through an SSH tunnel if your database is not publicly accessible.
                </p>
              </div>
            </label>

            {(sourceType === 'postgres' || sourceType === 'oracle') && (
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative inline-block w-11 h-6 mt-1">
                  <input
                    type="checkbox"
                    name="use_ssl"
                    checked={formData.use_ssl}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Use SSL</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Connect over an SSL-encrypted connection
                  </p>
                </div>
              </label>
            )}
          </div>

          {(sourceType === 'postgres' || sourceType === 'sqlserver') && (
            <div className="rounded">
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="w-full px-0 py-3 flex items-center gap-2 text-left"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Advanced Settings</span>
              </button>

              {showAdvancedSettings && (
                <div className="pl-6 space-y-3 mt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative inline-block w-11 h-6 mt-0.5">
                      <input
                        type="checkbox"
                        name="load_historical_data"
                        checked={formData.load_historical_data}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Load Historical Data</div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {sourceType === 'sqlserver'
                          ? 'Applicable for Pipelines created with Change Tracking or Table mode. If this option is enabled, the entire table data is fetched during the first run of the Pipeline. If disabled, DataMove loads only the records written to your database after the Pipeline was created.'
                          : 'If this option is enabled, the entire table data is fetched during the first run of the Pipeline. If disabled, DataMove loads only the records written to your database after the Pipeline was created.'
                        }
                      </p>
                    </div>
                  </label>

                  {sourceType === 'postgres' && (
                    <>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative inline-block w-11 h-6 mt-0.5">
                          <input
                            type="checkbox"
                            name="merge_tables"
                            checked={formData.merge_tables}
                            onChange={handleChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Merge Tables</div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            If enabled, DataMove merges tables having the same name from different schemas while loading data to the Destination.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative inline-block w-11 h-6 mt-0.5">
                          <input
                            type="checkbox"
                            name="drop_slot_on_stop"
                            checked={formData.drop_slot_on_stop}
                            onChange={handleChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Drop Replication Slot on Stop</div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            If enabled, PostgreSQL replication slot will be dropped when the connector stops or is deleted. This ensures clean restore operations.
                          </p>
                        </div>
                      </label>
                    </>
                  )}

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative inline-block w-11 h-6 mt-0.5">
                      <input
                        type="checkbox"
                        name="include_new_tables"
                        checked={formData.include_new_tables}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Include New Tables in the Pipeline</div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {sourceType === 'sqlserver'
                          ? 'Applicable for all ingestion modes except Custom SQL. If enabled, DataMove automatically ingests from any tables created or restored after the Pipeline is created.'
                          : 'If enabled, DataMove automatically ingests data from tables created in the Source after the Pipeline has been built. These may include completely new tables or previously deleted tables that have been re-created in the Source.'
                        }
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          )}

          {sourceType === 'oracle' && (
            <>
              <div className="rounded">
                <button
                  type="button"
                  onClick={() => setShowRedoLogSettings(!showRedoLogSettings)}
                  className="w-full px-0 py-3 flex items-center gap-2 text-left"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showRedoLogSettings ? 'rotate-180' : ''}`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Redo Log Advanced Settings</span>
                </button>

                {showRedoLogSettings && (
                  <div className="pl-6 space-y-4 mt-2">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-yellow-900 dark:text-yellow-100 mb-3">
                            Improper configurations of the redo log settings may impact your database performance. We recommend that you contact Support before making any changes.
                          </p>
                          <button
                            type="button"
                            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            CONTACT SUPPORT
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Poll Interval (in ms) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          name="poll_interval"
                          value={formData.poll_interval}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          The delay (in milliseconds) between checks for new transactions in redo logs. Applicable only if pipeline is in streaming mode.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Query Fetch Size <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          name="query_fetch_size"
                          value={formData.query_fetch_size}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          The maximum number of rows that DataMove must fetch from the logs in each cycle.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Long Transaction Window (in mins) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="long_transaction_window"
                        value={formData.long_transaction_window}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        The duration for which DataMove must traverse back from the latest transaction to fetch the data from a long-running transaction.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative inline-block w-11 h-6 mt-0.5">
                          <input
                            type="checkbox"
                            name="load_all_schemas"
                            checked={formData.load_all_schemas}
                            onChange={handleChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Load All Schemas</div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            If enabled, DataMove loads data from all the schemas defined on the selected host.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative inline-block w-11 h-6 mt-0.5">
                          <input
                            type="checkbox"
                            name="online_catalog"
                            checked={formData.online_catalog}
                            onChange={handleChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Online Catalog</div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            If enabled, DataMove retrieves the latest schema information on tables and columns from the specified Oracle database.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <div className="relative inline-block w-11 h-6 mt-0.5">
                          <input
                            type="checkbox"
                            name="archive_log_only"
                            checked={formData.archive_log_only}
                            onChange={handleChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Archive Log Only</div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            If enabled, DataMove ingests data only from archived logs.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="w-full px-0 py-3 flex items-center gap-2 text-left"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Advanced Settings</span>
                </button>

                {showAdvancedSettings && (
                  <div className="pl-6 space-y-3 mt-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative inline-block w-11 h-6 mt-0.5">
                        <input
                          type="checkbox"
                          name="load_historical_data"
                          checked={formData.load_historical_data}
                          onChange={handleChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Load Historical Data</div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          If disabled, DataMove loads only the data that is written to your database after the time of creation of the Pipeline.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative inline-block w-11 h-6 mt-0.5">
                        <input
                          type="checkbox"
                          name="merge_tables"
                          checked={formData.merge_tables}
                          onChange={handleChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Merge Tables</div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          If enabled, DataMove merges tables having the same name from different schemas while loading data to the Destination.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative inline-block w-11 h-6 mt-0.5">
                        <input
                          type="checkbox"
                          name="include_new_tables"
                          checked={formData.include_new_tables}
                          onChange={handleChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Include New Tables in the Pipeline</div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          If enabled, DataMove automatically ingests from any tables created or restored after the Pipeline is created.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Log Monitoring
            </h4>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="space-y-4">
                {/* Enable Log Monitoring Toggle */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative inline-block w-11 h-6 mt-0.5">
                    <input
                      type="checkbox"
                      name="enable_log_monitoring"
                      checked={formData.enable_log_monitoring}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable Log Monitoring</div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Enable or disable log monitoring for your Source
                    </p>
                  </div>
                </label>

                {/* Show configuration when enabled */}
                {formData.enable_log_monitoring && (
                  <div className="pl-14 space-y-4 border-t border-blue-200 dark:border-blue-800 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Max WAL Size (MB)
                        </label>
                        <input
                          type="number"
                          name="max_wal_size"
                          value={formData.max_wal_size}
                          onChange={handleChange}
                          min="0"
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Alert Threshold (%)
                        </label>
                        <input
                          type="number"
                          name="alert_threshold"
                          value={formData.alert_threshold}
                          onChange={handleChange}
                          min="0"
                          max="100"
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="log-monitoring-slack"
                        name="log_monitoring_slack"
                        checked={formData.log_monitoring_slack}
                        onChange={handleChange}
                        className="mt-1 rounded"
                      />
                      <div className="flex-1">
                        <label
                          htmlFor="log-monitoring-slack"
                          className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
                        >
                          Send Slack Notifications
                        </label>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Receive alert notifications over Slack when the WAL size exceeds the specified alert threshold value
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic">
                Note: This setting does not affect the connector configuration
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowTestModal(true);
                  handleTestConnection();
                }}
                disabled={testing || !formData.host || !formData.username || !formData.password}
                className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Test Connection
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLoading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="w-[600px] bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Prerequisites</h3>

        {sourceType === 'sqlserver' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="mt-0.5">✓</div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  The SQL Server is running.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-0.5">✓</div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  SQL Server version is 12 or higher.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-0.5">✓</div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  TCP/IP Protocol is enabled with TCP port as 1433.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-0.5">✓</div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>VIEW CHANGE TRACKING</strong> and <strong>ALTER DATABASE</strong> privileges are granted to the database user, if Pipeline Mode is Change Tracking or Table, and Query mode is Change Tracking.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-0.5">✓</div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>SELECT</strong> privileges are granted to the database user.
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> We recommend that you create a database user for configuring your SQL Server Source in DataMove. However, if you already have one, refer to section Grant privileges to the user.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Step 1: Enable TCP/IP Protocol</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                You need to configure the SQL Server instance with TCP port value 1433 to enable DataMove to connect to your MS SQL Server.
              </p>

              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Enable the TCP/IP port</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-4 ml-4">
                <li>• Open the SQL Server Configuration Manager.</li>
                <li>• In the left navigation pane under SQL Server Network Configuration, click Protocols for &lt;MS SQL Server Instance Name&gt;. The default instance name is MSSQLSERVER.</li>
                <li>• In the right pane, right click the TCP/IP Protocol Name, and select Enable (if not enabled already) in the Status field.</li>
                <li>• Click OK to acknowledge the dialogue box that warns you to restart the services for the changes to take effect.</li>
              </ul>

              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. Verify the TCP/IP port</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-4 ml-4">
                <li>• Right-click the TCP/IP Protocol Name, and select Properties.</li>
                <li>• In the TCP/IP Properties window, click the IP Addresses tab.</li>
                <li>• In the IPAII section, ensure the TCP Port value is 1433, which is the default port for MS SQL Server.</li>
                <li>• Click OK to acknowledge the dialogue box that warns you to restart the services for the changes to take effect.</li>
                <li>• Click OK, and exit the TCP/IP Properties window.</li>
              </ul>

              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">3. Restart the MS SQL Server instance</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-4">
                <li>• In the left navigation pane, click SQL Server Services.</li>
                <li>• In the right pane, right-click your &lt;MS SQL Server Instance Name&gt;, and select Restart.</li>
              </ul>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Step 2: Enable Change Tracking</h4>
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> This step is valid only for Pipelines with Change Tracking as their ingestion mode.
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                The Change Tracking mechanism captures the database changes. To enable or disable change tracking, the database user must have the ALTER DATABASE privilege.
              </p>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Enable change tracking at the database level:
              </p>
              <CodeBlockWithCopy
                code={`ALTER DATABASE <database_name> SET CHANGE_TRACKING = ON
(CHANGE_RETENTION = 3 DAYS, AUTO_CLEANUP = ON)`}
                title="Enable Database-Level Change Tracking"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-4">
                The CHANGE_RETENTION value specifies the duration for which change tracking information is retained. DataMove recommends that you set the CHANGE_RETENTION value to 3 DAYS.
              </p>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Enable change tracking at the table level:
              </p>
              <CodeBlockWithCopy
                code="ALTER TABLE <schema_name>.<table> ENABLE CHANGE_TRACKING"
                title="Enable Table-Level Change Tracking"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Repeat this step for each table you want to replicate using Change Tracking.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> DataMove does not support Change Data Capture (CDC) for SQL Server.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Step 3: Create a Database User and Grant Privileges</h4>

              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Create a database user (Optional)</p>
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> Skip this step if you are using an existing database user.
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Connect to your SQL Server database as an admin user with an SQL client tool, such as sqlcmd:
              </p>
              <CodeBlockWithCopy
                code={`USE <database>;

CREATE LOGIN <username> WITH PASSWORD = '<password>';
CREATE USER <username> FOR LOGIN <username>;`}
                title="Create Database User"
              />

              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4">2. Grant privileges to the user</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                The database user must have the following privileges: <strong>SELECT</strong>, <strong>VIEW CHANGE TRACKING</strong> (if ingestion mode is Change Tracking).
              </p>
              <CodeBlockWithCopy
                code="GRANT SELECT ON DATABASE::<database> TO <username>;"
                title="Grant SELECT at Database Level"
              />
              <CodeBlockWithCopy
                code="GRANT SELECT ON SCHEMA::<schema_name> TO <username>;"
                title="Grant SELECT at Schema Level"
              />

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 mt-4">
                If the ingestion mode is Change Tracking, grant the VIEW CHANGE TRACKING privilege at the schema or table level:
              </p>
              <CodeBlockWithCopy
                code="GRANT VIEW CHANGE TRACKING ON SCHEMA::<schema_name> TO <username>;"
                title="Grant VIEW CHANGE TRACKING (Schema Level)"
              />
              <CodeBlockWithCopy
                code="GRANT VIEW CHANGE TRACKING ON OBJECT::<schema_name>.<table_name> TO <username>;"
                title="Grant VIEW CHANGE TRACKING (Table Level)"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Replace placeholder values (e.g., &lt;username&gt; with hevo)
              </p>
            </div>
          </div>
        )}

        {sourceType === 'oracle' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Oracle database version is 11 or above. You can retrieve the version with:
              </p>
              <CodeBlockWithCopy
                code="SELECT BANNER_FULL FROM V$VERSION WHERE BANNER_FULL LIKE 'Oracle Database%';"
                title="Check Oracle Version"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                SELECT permissions are granted to the database user.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Note:</strong> Redo Log-based replication is enabled when the ingestion mode is RedoLog and the database user has SYSDBA privileges.
              </p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Step 1: Create Database User and Grant Privileges</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Connect as DBA using SQL Developer or any other SQL client tool and create a user with necessary permissions:
              </p>
              <CodeBlockWithCopy
                code={`-- Create a Database User
CREATE USER <username> IDENTIFIED BY <password>;

-- Grant Privileges to the Database User
GRANT SELECT ANY DICTIONARY to <username>;
GRANT CREATE SESSION, ALTER SESSION TO <username>;
GRANT SELECT ON ALL_VIEWS TO <username>;
GRANT SELECT ON <schema_name>.<table_name> TO <username>;

-- Grant Privileges on Metadata tables
GRANT SELECT ON DATABASE_PROPERTIES TO <username>;
GRANT SELECT ON ALL_OBJECTS TO <username>;
GRANT SELECT ON ALL_TABLES TO <username>;
GRANT SELECT ON ALL_TAB_COLUMNS TO <username>;
GRANT SELECT ON ALL_CONSTRAINTS TO <username>;
GRANT SELECT ON ALL_CONS_COLUMNS TO <username>;

-- Grant Permission to run LogMiner
GRANT LOGMINING TO <username>;
GRANT SELECT ON SYS.V_$DATABASE TO <username>;
GRANT SELECT ON SYS.V_$LOG TO <username>;
GRANT SELECT ON SYS.V_$LOGFILE TO <username>;
GRANT SELECT ON SYS.V_$ARCHIVED_LOG TO <username>;
GRANT SELECT ON SYS.V_$LOGMNR_CONTENTS TO <username>;
GRANT SELECT ON SYS.V_$ARCHIVE_DEST_STATUS TO <username>;
GRANT EXECUTE ON SYS.DBMS_LOGMNR TO <username>;
GRANT EXECUTE ON SYS.DBMS_LOGMNR_D TO <username>;`}
                title="Create User & Grant Privileges"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Replace placeholder values (e.g., &lt;username&gt; with hevo)
              </p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Step 2: Set up Redo Logs for Replication</h4>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Enable Archive Log</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Check if archive log is enabled:
              </p>
              <CodeBlockWithCopy
                code="SELECT LOG_MODE FROM V$DATABASE;"
                title="Check Archive Log Mode"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 mb-2">
                Returns ARCHIVELOG (enabled) or NOARCHIVELOG (disabled). If disabled, enable it:
              </p>
              <CodeBlockWithCopy
                code={`SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;`}
                title="Enable Archive Log"
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">2. Configure Retention Policy</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Connect to RMAN and check retention policy:
              </p>
              <CodeBlockWithCopy
                code={`RMAN
CONNECT TARGET <database_username>;

SELECT VALUE FROM V$RMAN_CONFIGURATION WHERE NAME = 'RETENTION POLICY';`}
                title="Check Retention Policy"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 mb-3">
                If less than 3 days, configure to at least 3 days (72 hours):
              </p>
              <CodeBlockWithCopy
                code="CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 3 DAYS;"
                title="Set Retention Policy"
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">3. Enable Supplemental Logging</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Check if supplemental logging is enabled:
              </p>
              <CodeBlockWithCopy
                code='SELECT SUPPLEMENTAL_LOG_DATA_MIN FROM "V$DATABASE";'
                title="Check Supplemental Logging"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 mb-2">
                Returns YES (enabled) or NO (disabled). If NO, enable at database level:
              </p>
              <CodeBlockWithCopy
                code="ALTER DATABASE ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;"
                title="Enable Supplemental Logging"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 mb-2">
                For table-level logging, check status:
              </p>
              <CodeBlockWithCopy
                code={`SELECT COUNT(*) FROM ALL_LOG_GROUPS
    WHERE LOG_GROUP_TYPE='ALL COLUMN LOGGING'
    AND OWNER= '<group_name>'
    AND TABLE_NAME='<table_name>';`}
                title="Check Table-Level Logging"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 mb-2">
                If result is zero, enable for specific table:
              </p>
              <CodeBlockWithCopy
                code="ALTER TABLE <SCHEMA_NAME>.<TABLE_NAME> ADD SUPPLEMENTAL LOG DATA (ALL) COLUMNS;"
                title="Enable Table-Level Logging"
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">4. Check PGA/SGA Memory Settings</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Check PGA memory initialization parameters:
              </p>
              <CodeBlockWithCopy
                code={`SELECT NAME, VALUE/1024/1024 as VALUE_MB
    FROM V$PARAMETER
    WHERE NAME IN ('pga_aggregate_limit', 'pga_aggregate_target');`}
                title="Check PGA Settings"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 mb-3">
                Monitor current PGA memory usage:
              </p>
              <CodeBlockWithCopy
                code={`SELECT NAME, VALUE, UNIT
    FROM V$PGASTAT
    WHERE NAME IN ('total PGA inuse','total PGA allocated');`}
                title="Monitor PGA Usage"
              />
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  <strong>Oracle Buffers:</strong> LogMiner uses in-memory Oracle buffers to cache transactions. Long-running transactions can increase PGA memory consumption and lead to OOM errors. Set PGA_AGGREGATE_LIMIT appropriately based on your workload.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">5. Configure PGA Aggregate Limit</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Set PGA limit to prevent out-of-memory errors:
              </p>
              <CodeBlockWithCopy
                code="ALTER SYSTEM SET pga_aggregate_limit = <new value> SCOPE=BOTH;"
                title="Set PGA Limit"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Units: K (kilobytes), M (megabytes), G (gigabytes). Example: 1G
              </p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Step 3: Retrieve Service Name</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Get the service name (alias) for your Oracle database:
              </p>
              <CodeBlockWithCopy
                code="SELECT NAME FROM V$DATABASE;"
                title="Get Service Name"
              />
            </div>
          </div>
        )}

        {sourceType === 'postgres' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                IP address or host name of your PostgreSQL server is available.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The PostgreSQL version is 9.5 or higher, up to 17.x.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Log-based incremental replication is enabled if ingestion mode is Logical Replication.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Note:</strong> DataMove currently does not support logical replication on read replicas.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                DataMove's IP addresses are whitelisted.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                SELECT, USAGE, and CONNECT privileges are granted to the database user.
              </p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Step 1: Set up Log-based Incremental Replication</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                DataMove supports data ingestion replication from PostgreSQL servers via Write Ahead Logs (WALs) set at the logical level.
              </p>

              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Update the PostgreSQL database configuration file</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Modify the PostgreSQL configuration file, postgresql.conf:
              </p>
              <CodeBlockWithCopy
                code={`max_replication_slots = 10
max_wal_senders = 10
wal_level = logical
wal_sender_timeout = 0`}
                title="postgresql.conf Settings"
              />

              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4">2. Update the client authentication file</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                In the pg_hba.conf file, assign permission to the database user:
              </p>
              <CodeBlockWithCopy
                code={`local replication <database_user> peer
host replication <database_user> 127.0.0.1/0 md5
host replication <database_user> ::1/0 md5`}
                title="pg_hba.conf Settings"
              />

              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4">3. Enable access to WALs</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Restart the PostgreSQL server and provide your database user access to the WAL:
              </p>
              <CodeBlockWithCopy
                code="sudo systemctl restart postgresql.service"
                title="Restart PostgreSQL"
              />
              <CodeBlockWithCopy
                code="alter role <database_user> with replication;"
                title="Grant Replication Access"
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Step 2: Whitelist DataMove's IP Addresses</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Add the DataMove IP addresses for your region in the postgresql.conf and pg_hba.conf files:
              </p>
              <CodeBlockWithCopy
                code="host    all             user_name           0.0.0.0/0              md5"
                title="Whitelist IPs"
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Step 3: Create a Database User and Grant Privileges</h4>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Create a database user (Optional)</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Connect to your PostgreSQL database instance as a root user:
              </p>
              <CodeBlockWithCopy
                code="CREATE USER <database_username> WITH LOGIN PASSWORD '<password>';"
                title="Create User"
              />

              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4">2. Grant privileges to the user</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Run the following commands to grant privileges to the database user:
              </p>
              <CodeBlockWithCopy
                code={`GRANT CONNECT ON DATABASE <database_name> TO <database_username>;
GRANT USAGE ON SCHEMA <schema_name> TO <database_username>;
GRANT SELECT ON ALL TABLES IN SCHEMA <schema_name> TO <database_username>;`}
                title="Grant Privileges"
              />
              <CodeBlockWithCopy
                code="ALTER DEFAULT PRIVILEGES IN SCHEMA <schema_name> GRANT SELECT ON TABLES TO <database_username>;"
                title="Alter Default Privileges"
              />
            </div>
          </div>
        )}
      </div>

      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Test Connection
              </h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ValidationResults
                results={validationResults}
                connectionName={formData.name || 'Source Connection'}
                isValidating={isValidating}
                currentStep={currentValidationStep}
                onRetry={handleTestConnection}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ConnectorConfigResult {
  connector_class: string;
  config: Record<string, unknown>;
}

function buildSourceConnectorConfig(sourceType: string, form: SourceFormData): ConnectorConfigResult {
  if (sourceType === 'oracle') {
    return buildOracleConnectorConfig(form);
  }

  if (sourceType === 'postgres') {
    return buildPostgresConnectorConfig(form);
  }

  return {
    connector_class: 'io.debezium.connector.sqlserver.SqlServerConnector',
    config: {
      name: formatSourceConnectorName(form.name),
      'tasks.max': '1',
      'database.hostname': form.host,
      'database.port': String(form.port || 1433),
      'database.user': form.username,
      'database.password': form.password || '',
      'database.dbname': form.database_name,
      'database.schema': form.schema_name || 'dbo',
      'table.include.list': '',
      'tombstones.on.delete': 'false',
      'include.schema.changes': 'false',
    },
  };
}

function buildOracleConnectorConfig(form: SourceFormData): ConnectorConfigResult {
  // Use pipeline name directly as topic prefix
  const topicPrefix = createTopicPrefix(form.name, 'pipeline');
  const serverName = form.service_name || form.database_name || `${topicPrefix}-server`;

  return {
    connector_class: 'io.debezium.connector.oracle.OracleConnector',
    config: {
      name: formatSourceConnectorName(form.name),
      'tasks.max': '1',
      'database.server.name': serverName,
      'database.hostname': form.host,
      'database.port': String(form.port || 1521),
      'database.user': form.username,
      'database.password': form.password || '',
      'database.dbname': form.service_name || form.database_name || serverName,
      'database.out.server.name': `${serverName}-xout`,
      'database.connection.adapter': 'logminer',
      'database.schema': form.schema_name || 'INVENTORY',
      'database.history.kafka.bootstrap.servers': 'kafka:9092',
      'database.history.kafka.topic': 'schema-changes.inventory',
      'snapshot.mode': 'initial',
      'snapshot.lock.timeout.ms': '5000',
      'snapshot.fetch.size': String(form.query_fetch_size || 2000),
      'snapshot.delay.ms': '0',
      'connector.class': 'io.debezium.connector.oracle.OracleConnector',
      'topic.prefix': topicPrefix,
      'table.include.list': '',
      'log.mining.strategy': form.online_catalog ? 'online_catalog' : 'redo_log_catalog',
      'log.mining.continuous.mine': 'true',
      'log.mining.sleep.time.default': '1000',
      'decimal.handling.mode': 'double',
      'time.precision.mode': 'adaptive',
      'tombstones.on.delete': 'false',
      'include.schema.changes': 'false',
      use_ssl: form.use_ssl,
      ssh_tunnel: form.ssh_tunnel,
    },
  };
}

function buildPostgresConnectorConfig(form: SourceFormData): ConnectorConfigResult {
  // Use pipeline name directly as topic prefix
  // Debezium will create topics as: {topic.prefix}.{schema}.{table}
  // Example: belgium_finance.public.teams
  const topicPrefix = createTopicPrefix(form.name, 'pipeline');

  // Generate unique server ID based on pipeline name hash
  const serverId = Math.abs(topicPrefix.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0) % 9000) + 1000; // Range: 1000-9999

  return {
    connector_class: 'io.debezium.connector.postgresql.PostgresConnector',
    config: {
      name: formatSourceConnectorName(form.name),
      'connector.class': 'io.debezium.connector.postgresql.PostgresConnector',
      'database.hostname': form.host,
      'database.port': String(form.port || 5432),
      'database.user': form.username,
      'database.password': form.password || '',
      'database.dbname': form.database_name,
      'database.schema': form.schema_name || 'public',
      'database.server.name': topicPrefix,
      'database.server.id': String(serverId),
      'topic.prefix': topicPrefix,
      'table.include.list': '',
      'plugin.name': 'pgoutput',
      'publication.name': 'dbz_publication',
      'slot.name': `${topicPrefix}_slot`,
      'slot.drop.on.stop': form.drop_slot_on_stop ? 'true' : 'false',
      'snapshot.mode': 'initial',
      'decimal.handling.mode': 'double',
      'tombstones.on.delete': 'false',
      'include.schema.changes': 'false',
      'tasks.max': '1',
      'key.converter': 'org.apache.kafka.connect.json.JsonConverter',
      'key.converter.schemas.enable': 'true',
      'value.converter': 'org.apache.kafka.connect.json.JsonConverter',
      'value.converter.schemas.enable': 'true',
      'errors.tolerance': 'all',
      'errors.log.enable': 'true',
      'errors.log.include.messages': 'true',
      'errors.deadletterqueue.topic.name': `${topicPrefix}-source-dlq`,
      'errors.deadletterqueue.context.headers.enable': 'true',
      'errors.deadletterqueue.topic.replication.factor': '1',
      use_ssl: form.use_ssl,
      ssh_tunnel: form.ssh_tunnel,
    },
  };
}

function createTopicPrefix(name: string, fallback: string) {
  if (!name) return fallback;
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')  // Use underscore instead of hyphen for PostgreSQL slot compatibility
    .replace(/^_+|_+$/g, '');      // Remove leading/trailing underscores
  return normalized || fallback;
}
