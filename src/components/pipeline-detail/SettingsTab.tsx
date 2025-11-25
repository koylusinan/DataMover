import { useEffect, useMemo, useState } from 'react';
import { Save, ChevronDown, ChevronRight, Edit2, RefreshCw, AlertTriangle, Info, AlertCircle, Download, ArrowRight } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { DatabaseLogoIcon } from '../ui/DatabaseLogos';
import { OracleSourceSettings } from './OracleSourceSettings';
import { PostgresSourceSettings } from './PostgresSourceSettings';
import { MySQLSourceSettings } from './MySQLSourceSettings';
import { DestinationSettings } from './DestinationSettings';
import { supabase } from '../../lib/supabase';
import { createConnectorVersion, activateConnectorVersion } from '../../lib/registry';

interface RegistryMetadata {
  registry_connector?: string;
  registry_version?: number;
  checksum?: string;
  [key: string]: unknown;
}

interface Connector {
  id: string;
  name: string;
  type: 'source' | 'sink';
  connector_class: string;
  status: string;
  config?: Record<string, unknown>;
  registry_meta?: RegistryMetadata | null;
  resolved_config?: Record<string, unknown>;
}

interface Pipeline {
  id: string;
  name: string;
  source_type: string;
  destination_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  source_connector?: Connector;
  sink_connector?: Connector;
}

interface PipelineTable {
  id: string;
  schema_name: string;
  table_name: string;
  included: boolean;
  stats?: Record<string, unknown> | null;
  deletable?: boolean;
}

interface LogEntry {
  id: string;
  timestamp: string;
  severity: 'error' | 'warn' | 'info';
  message: string;
  context?: Record<string, unknown>;
  workerId?: string;
}

interface SettingsTabProps {
  pipeline: Pipeline;
  onUpdate?: () => void;
}

export function SettingsTab({ pipeline, onUpdate }: SettingsTabProps) {
  const { showToast } = useToast();
  const { user, logActivity } = useAuth();
  const [activeSection, setActiveSection] = useState<'setup' | 'logs'>('setup');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [logsSearchQuery, setLogsSearchQuery] = useState('');
  const [logsSeverityFilter, setLogsSeverityFilter] = useState<string>('all');

  const resolveConnectorConfig = (connector?: Connector) =>
    connector?.resolved_config ||
    (connector?.registry_meta as any)?.snapshot_config ||
    (connector?.config as any)?.snapshot_config ||
    connector?.config ||
    {};

  const cleanConfigForPending = (config: Record<string, any>) => {
    return Object.keys(config).reduce((acc, key) => {
      if (!['checksum', 'connector_class', 'snapshot_config', 'registry_version', 'registry_connector', 'resolved_config'].includes(key)) {
        // Mask only connection.password field
        if (key === 'connection.password') {
          acc[key] = '********';
        } else {
          acc[key] = config[key];
        }
      }
      return acc;
    }, {} as Record<string, any>);
  };

  const [sourceConfig, setSourceConfig] = useState(resolveConnectorConfig(pipeline.source_connector));
  const [destinationConfig, setDestinationConfig] = useState(resolveConnectorConfig(pipeline.sink_connector));
  const [originalSourceConfig, setOriginalSourceConfig] = useState(resolveConnectorConfig(pipeline.source_connector));
  const [originalDestinationConfig, setOriginalDestinationConfig] = useState(resolveConnectorConfig(pipeline.sink_connector));
  const [isSaving, setIsSaving] = useState(false);
  const [sourceTables, setSourceTables] = useState<PipelineTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const derivedTables = useMemo(() => deriveDisplayTables(sourceTables, sourceConfig), [sourceTables, sourceConfig]);

  useEffect(() => {
    const resolved = resolveConnectorConfig(pipeline.source_connector);
    setSourceConfig(resolved);
    setOriginalSourceConfig(resolved);
  }, [pipeline.source_connector]);

  useEffect(() => {
    const resolved = resolveConnectorConfig(pipeline.sink_connector);
    setDestinationConfig(resolved);
    setOriginalDestinationConfig(resolved);
  }, [pipeline.sink_connector]);

  useEffect(() => {
    const loadTables = async () => {
      if (!pipeline.id) return;
      setTablesLoading(true);
      const { data, error } = await supabase
        .from('pipeline_objects')
        .select('id, schema_name, table_name, included, stats')
        .eq('pipeline_id', pipeline.id)
        .order('schema_name', { ascending: true })
        .order('table_name', { ascending: true });

      if (!error && data) {
        setSourceTables(data as PipelineTable[]);
      } else {
        setSourceTables([]);
      }

      setTablesLoading(false);
    };

    loadTables();
  }, [pipeline.id]);

  // Fetch logs from backend
  const fetchLogs = async (silent = false) => {
    if (!silent) {
      setLogsLoading(true);
    }

    const backendUrl = import.meta.env.VITE_DEBEZIUM_BACKEND_URL;
    if (!backendUrl) {
      console.error('Debezium Backend URL not configured');
      setLogsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/pipelines/${pipeline.id}/logs`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      if (!silent) {
        setLogsLoading(false);
      }
    }
  };

  // Initial fetch for logs when logs section is active
  useEffect(() => {
    if (activeSection === 'logs') {
      fetchLogs();
    }
  }, [activeSection, pipeline.id]);

  // Auto-refresh logs every 5 seconds when logs section is active
  useEffect(() => {
    if (activeSection === 'logs' && pipeline.status !== 'stopped' && pipeline.status !== 'deleted') {
      const interval = setInterval(() => {
        fetchLogs(true); // Silent refresh
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [activeSection, pipeline.status, pipeline.id]);

  const hasSourceChanges = !configsEqual(sourceConfig, originalSourceConfig);
  const hasDestinationChanges = !configsEqual(destinationConfig, originalDestinationConfig);
  const hasChanges = hasSourceChanges || hasDestinationChanges;

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warn':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700';
    }
  };

  const downloadLogs = () => {
    const logsToDownload = filteredLogs.length > 0 ? filteredLogs : logs;
    const logsText = logsToDownload
      .map((log) => {
        return `[${formatTimestamp(log.timestamp)}] [${log.severity.toUpperCase()}] ${log.message}${
          log.workerId ? ` (Worker: ${log.workerId})` : ''
        }${log.context ? `\nContext: ${JSON.stringify(log.context)}` : ''}`;
      })
      .join('\n\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-${pipeline.id}-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(logsSearchQuery.toLowerCase());
    const matchesSeverity = logsSeverityFilter === 'all' || log.severity === logsSeverityFilter;
    return matchesSearch && matchesSeverity;
  });

  const getConfigChanges = (oldConfig: Record<string, unknown>, newConfig: Record<string, unknown>) => {
    const changes: Array<{ field: string; old_value: unknown; new_value: unknown }> = [];
    const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);

    for (const key of allKeys) {
      const oldVal = oldConfig[key];
      const newVal = newConfig[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: key,
          old_value: oldVal,
          new_value: newVal
        });
      }
    }

    return changes;
  };

  const renderSourceConfigSummary = () => {
    const fields = [
      { label: 'Database Host', key: 'database.hostname' },
      { label: 'Database Port', key: 'database.port' },
      { label: 'Database User', key: 'database.user' },
      { label: 'Database Password', key: 'database.password', mask: true },
      { label: 'Database Name', key: 'database.dbname' },
      { label: 'Publication Key', key: 'publication.name' },
      { label: 'Replication Slot', key: 'slot.name' },
      { label: 'Enable log monitoring', key: 'errors.log.enable', type: 'boolean' },
      { label: 'Use SSH', key: 'ssh_tunnel', type: 'boolean' },
      { label: 'Use SSL', key: 'use_ssl', type: 'boolean' },
    ];

    return (
      <div className="grid grid-cols-4 gap-0">
        {fields.map((field, index) => {
          let value = sourceConfig[field.key];
          if (field.mask && value) {
            value = '********';
          } else if (field.type === 'boolean') {
            value = value === true || value === 'true' ? 'Yes' : 'No';
          }
          const isLastInRow = (index + 1) % 4 === 0;
          return (
            <div
              key={field.key}
              className={`flex flex-col gap-1 p-4 border-b border-gray-200 dark:border-gray-700 ${
                !isLastInRow ? 'border-r border-gray-200 dark:border-gray-700' : ''
              }`}
            >
              <span className="text-xs text-gray-500 dark:text-gray-400">{field.label}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {value !== undefined && value !== null && value !== '' ? String(value) : 'Not set'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDestinationConfigSummary = () => {
    const fields = [
      { label: 'Account URL', key: 'connection.url' },
      { label: 'Warehouse', key: 'warehouse' },
      { label: 'Database Name', key: 'database' },
      { label: 'Database User', key: 'connection.username' },
      { label: 'Database Password', key: 'connection.password', mask: true },
      { label: 'Authentication type', key: 'authenticator' },
      { label: 'Always quote table names', key: 'quote.sql.identifiers' },
    ];

    return (
      <div className="grid grid-cols-4 gap-0">
        {fields.map((field, index) => {
          let value = destinationConfig[field.key];
          if (field.mask && value) {
            value = '********';
          }
          const isLastInRow = (index + 1) % 4 === 0;
          return (
            <div
              key={field.key}
              className={`flex flex-col gap-1 p-4 border-b border-gray-200 dark:border-gray-700 ${
                !isLastInRow ? 'border-r border-gray-200 dark:border-gray-700' : ''
              }`}
            >
              <span className="text-xs text-gray-500 dark:text-gray-400">{field.label}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {value !== undefined && value !== null && value !== '' ? String(value) : 'Not set'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const changes: string[] = [];
      const changeDetails: Record<string, any> = {
        pipeline_name: pipeline.name,
        connectors: []
      };

      if (pipeline.source_connector?.id && hasSourceChanges) {
        const { error } = await supabase
          .from('pipeline_connectors')
          .update({
            pending_config: cleanConfigForPending(sourceConfig),
            has_pending_changes: true,
            pending_config_updated_by: user?.id,
            pending_config_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', pipeline.source_connector.id);

        if (error) throw error;
        changes.push('source');

        const configChanges = getConfigChanges(originalSourceConfig, sourceConfig);
        changeDetails.connectors.push({
          type: 'source',
          name: pipeline.source_connector.name,
          connector_class: pipeline.source_connector.connector_class,
          changes: configChanges
        });
      }

      if (pipeline.sink_connector?.id && hasDestinationChanges) {
        const { error } = await supabase
          .from('pipeline_connectors')
          .update({
            pending_config: cleanConfigForPending(destinationConfig),
            has_pending_changes: true,
            pending_config_updated_by: user?.id,
            pending_config_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', pipeline.sink_connector.id);

        if (error) throw error;
        changes.push('destination');

        const configChanges = getConfigChanges(originalDestinationConfig, destinationConfig);
        changeDetails.connectors.push({
          type: 'sink',
          name: pipeline.sink_connector.name,
          connector_class: pipeline.sink_connector.connector_class,
          changes: configChanges
        });
      }

      if (changes.length > 0) {
        const allChanges: Record<string, { old: any; new: any }> = {};

        changeDetails.connectors.forEach((conn: any) => {
          conn.changes.forEach((change: any) => {
            const fieldKey = `${conn.type}.${change.field}`;
            allChanges[fieldKey] = {
              old: change.old_value,
              new: change.new_value
            };
          });
        });

        await logActivity(
          'pipeline.update',
          `Updated ${changes.join(' and ')} settings for pipeline: ${pipeline.name}`,
          'pipeline',
          pipeline.id,
          {
            ...changeDetails,
            changes: allChanges
          }
        );
      }

      setOriginalSourceConfig(sourceConfig);
      setOriginalDestinationConfig(destinationConfig);
      showToast('success', 'Settings saved successfully!', 'Changes are pending deployment');

      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('error', 'Failed to save settings', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };


  const renderOverview = () => {
    return (
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-3 shadow-sm">
        <div className="flex items-center justify-between">
          {/* Left: Pipeline Info and Database Flow */}
          <div className="flex items-center gap-4">
            {/* Pipeline Name and ID */}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {pipeline.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ID: {pipeline.id}
              </span>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>

            {/* Database Flow */}
            <div className="flex items-center gap-3">
              <DatabaseLogoIcon
                connectorClass={pipeline.source_connector?.connector_class}
                sourceType={pipeline.source_type}
                className="w-8 h-8"
              />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {pipeline.source_type}
              </span>
              <ArrowRight className="w-5 h-5 text-gray-400 mx-1" />
              <DatabaseLogoIcon
                connectorClass={pipeline.sink_connector?.connector_class}
                sourceType={pipeline.destination_type}
                className="w-8 h-8"
              />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {pipeline.destination_type}
              </span>
            </div>
          </div>

          {/* Right: Status, Created at, Updated at */}
          <div className="flex items-center gap-4 text-sm">
            {/* Pipeline Status */}
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                pipeline.status === 'running' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                pipeline.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                pipeline.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {pipeline.status.toUpperCase()}
              </span>
            </div>

            {/* Created at */}
            <div>
              <span className="text-gray-600 dark:text-gray-400">Created: </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatDate(pipeline.created_at)}
              </span>
            </div>

            {/* Updated at */}
            <div>
              <span className="text-gray-600 dark:text-gray-400">Updated: </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatDate(pipeline.updated_at)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const sections = [
    { id: 'setup', label: 'Pipeline Setup' },
    { id: 'logs', label: 'Logs' }
  ];

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 sticky top-4">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as 'setup' | 'logs')}
              className={`w-full px-4 py-2 text-left rounded-lg font-medium transition-colors mb-1 ${
                activeSection === section.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative">
        <div className="h-full overflow-auto">
          {/* Overview Section - Always visible and sticky */}
          {renderOverview()}

          {activeSection === 'setup' && (
            <div className="space-y-4">

              {/* Configure Source Section */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div
                  onClick={() => toggleSection('source')}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <DatabaseLogoIcon
                        connectorClass={pipeline.source_connector?.connector_class}
                        sourceType={pipeline.source_type}
                        className="w-10 h-10 flex-shrink-0"
                      />
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Configure Source</h3>
                          {pipeline.source_connector?.has_pending_changes && (
                            <span className="px-2 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
                              SRC Updated
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {pipeline.source_connector?.name || pipeline.source_type || 'Source Connector'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!expandedSections.has('source')) {
                            toggleSection('source');
                          }
                        }}
                        className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      {expandedSections.has('source') ? (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                  </div>
                </div>

                {!expandedSections.has('source') && (
                  <div className="px-6 py-4 bg-white dark:bg-gray-800">
                    {renderSourceConfigSummary()}
                  </div>
                )}

                {expandedSections.has('source') && (
                  <div className="px-6 py-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    {renderSourceSettings(pipeline, sourceConfig, setSourceConfig)}

                    <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Tables in Pipeline
                        </h4>
                        {tablesLoading && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        This view is for information only. Table selection is configured during pipeline creation.
                      </p>

                      {derivedTables.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {derivedTables.map((table) => (
                            <div
                              key={table.id}
                              className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <DatabaseLogoIcon
                                  connectorClass={pipeline.source_connector?.connector_class}
                                  sourceType={pipeline.source_type}
                                  className="w-8 h-8 flex-shrink-0"
                                />
                                <span className="font-mono text-gray-900 dark:text-gray-100">
                                  {table.schema_name}.{table.table_name}
                                </span>
                                {!table.included && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                    Excluded
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {tablesLoading ? 'Loading tables...' : 'No tables have been selected for this pipeline yet.'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Destination Configuration Section */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div
                  onClick={() => toggleSection('destination')}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <DatabaseLogoIcon
                        connectorClass={pipeline.sink_connector?.connector_class}
                        sourceType={pipeline.destination_type}
                        className="w-10 h-10 flex-shrink-0"
                      />
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Destination Configuration</h3>
                          {pipeline.sink_connector?.has_pending_changes && (
                            <span className="px-2 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
                              DST Updated
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {pipeline.sink_connector?.name || pipeline.destination_type || 'Destination Connector'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!expandedSections.has('destination')) {
                            toggleSection('destination');
                          }
                        }}
                        className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      {expandedSections.has('destination') ? (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                  </div>
                </div>

                {!expandedSections.has('destination') && (
                  <div className="px-6 py-4 bg-white dark:bg-gray-800">
                    {renderDestinationConfigSummary()}
                  </div>
                )}

                {expandedSections.has('destination') && (
                  <div className="px-6 py-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <DestinationSettings
                      config={destinationConfig}
                      onChange={setDestinationConfig}
                    />
                  </div>
                )}
              </div>

              {/* Save All Changes Button */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveAll}
                    disabled={isSaving || !hasChanges}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save All Changes'}
                  </button>

                  <button
                    onClick={() => {
                      setSourceConfig(originalSourceConfig);
                      setDestinationConfig(originalDestinationConfig);
                    }}
                    disabled={isSaving}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'logs' && (
            <div className="space-y-4">
              {/* Logs Filters */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search logs..."
                        value={logsSearchQuery}
                        onChange={(e) => setLogsSearchQuery(e.target.value)}
                        className="pl-3 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-64"
                      />
                    </div>

                    <select
                      value={logsSeverityFilter}
                      onChange={(e) => setLogsSeverityFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="all">All Levels</option>
                      <option value="error">Error</option>
                      <option value="warn">Warning</option>
                      <option value="info">Info</option>
                    </select>
                  </div>

                  <button
                    onClick={downloadLogs}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Logs
                  </button>
                </div>
              </div>

              {/* Logs List */}
              <div className="space-y-3">
                {logsLoading && filteredLogs.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                    <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Loading logs...</p>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                    <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">No logs available</p>
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-all ${getSeverityColor(log.severity)}`}
                    >
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(log.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 uppercase">
                              {log.severity}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-gray-200">{log.message}</p>
                          {log.workerId && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Worker: {log.workerId}</p>
                          )}
                          {log.context && (
                            <button className="text-xs text-blue-600 dark:text-blue-400 mt-2 hover:underline flex items-center gap-1">
                              View context
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setSelectedLog(null)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Log Details</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Message</div>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedLog.message}</p>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Timestamp</div>
                <p className="text-sm text-gray-900 dark:text-gray-100">{formatTimestamp(selectedLog.timestamp)}</p>
              </div>
              {selectedLog.context && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Context</div>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-xs text-gray-900 dark:text-gray-100 overflow-auto">
                    {JSON.stringify(selectedLog.context, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function renderSourceSettings(
  pipeline: Pipeline,
  sourceConfig: Record<string, unknown>,
  setSourceConfig: (config: Record<string, unknown>) => void
) {
  const type = (pipeline.source_type || '').toLowerCase();

  if (type === 'oracle') {
    return (
      <OracleSourceSettings
        config={sourceConfig}
        onChange={setSourceConfig}
      />
    );
  }

  if (type === 'postgres' || type === 'postgresql') {
    return (
      <PostgresSourceSettings
        config={sourceConfig}
        onChange={setSourceConfig}
      />
    );
  }

  if (type === 'mysql') {
    return (
      <MySQLSourceSettings
        config={sourceConfig}
        onChange={setSourceConfig}
      />
    );
  }

  return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      Settings for {pipeline.source_type || 'this source'} are not yet configured
    </div>
  );
}

function deriveDisplayTables(tables: PipelineTable[], sourceConfig: Record<string, unknown>): PipelineTable[] {
  if (tables.length > 0) {
    return tables.map((table) => ({ ...table, deletable: true }));
  }

  const includeList = (sourceConfig['table.include.list'] as string) || '';
  if (!includeList) return [];

  return includeList
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry, index) => {
      const [schema, table] = entry.includes('.') ? entry.split('.') : ['public', entry];
      return {
        id: `config-${index}`,
        schema_name: schema,
        table_name: table,
        included: true,
        deletable: false,
      } as PipelineTable;
    });
}

async function syncConnectorIncludeList(connector: Connector | undefined, remainingTables: PipelineTable[]) {
  if (!connector?.id) return '';
  const includeList = remainingTables
    .map((table) => `${table.schema_name}.${table.table_name}`)
    .join(', ');

  const nextConfig = {
    ...(connector.config || {}),
    'table.include.list': includeList,
  };

  await persistConnectorRegistryConfig(connector, nextConfig);

  return includeList;
}

async function persistConnectorRegistryConfig(connector: Connector, config: Record<string, unknown>) {
  if (!connector?.id) return;
  const registryName =
    connector.registry_meta?.registry_connector ||
    (connector.config as any)?.registry_connector ||
    formatRegistryConnectorName(connector.name, connector.id);

  let versionResponse: any = null;

  try {
    versionResponse = await createConnectorVersion({
      name: registryName,
      kind: connector.type,
      connectorClass: connector.connector_class,
      config,
    });
    await activateConnectorVersion(registryName, versionResponse.version.version);
  } catch (error) {
    console.warn('Registry API not available, updating Supabase only:', error);
  }

  await supabase
    .from('pipeline_connectors')
    .update({
      config: {
        registry_connector: registryName,
        registry_version: versionResponse?.version?.version || connector.config?.registry_version || '1',
        checksum: versionResponse?.version?.checksum || connector.config?.checksum || '',
        connector_class: connector.connector_class,
        snapshot_config: config,
      },
    })
    .eq('id', connector.id);
}

function configsEqual(a: Record<string, unknown>, b: Record<string, unknown>) {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

function formatRegistryConnectorName(name: string | undefined, connectorId: string) {
  const base = (name || 'connector').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const suffix = connectorId.slice(0, 8);
  return `${base || 'connector'}-${suffix}`;
}
