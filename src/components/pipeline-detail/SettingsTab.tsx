import { useEffect, useMemo, useState } from 'react';
import { Save, Download, Upload, X } from 'lucide-react';
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

interface SettingsTabProps {
  pipeline: Pipeline;
  onUpdate?: () => void;
}

export function SettingsTab({ pipeline, onUpdate }: SettingsTabProps) {
  const { showToast } = useToast();
  const { user, logActivity } = useAuth();
  const [activeSection, setActiveSection] = useState<'source' | 'destination' | 'transformations' | 'errors' | 'operations'>('source');
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonConfig, setJsonConfig] = useState('{}');
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

  const hasSourceChanges = !configsEqual(sourceConfig, originalSourceConfig);
  const hasDestinationChanges = !configsEqual(destinationConfig, originalDestinationConfig);
  const hasChanges = hasSourceChanges || hasDestinationChanges;

  const sections = [
    { id: 'source' as const, label: 'Source Settings' },
    { id: 'destination' as const, label: 'Destination Settings' },
    { id: 'transformations' as const, label: 'Transformations (SMT)' },
    { id: 'errors' as const, label: 'Error Management' },
    { id: 'operations' as const, label: 'Operations' },
  ];

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


  return (
    <>
    <div className="flex gap-6">
      <div className="w-64 flex-shrink-0">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === section.id
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-6">
        {activeSection === 'source' && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-4 mb-6">
              <DatabaseLogoIcon
                connectorClass={pipeline.source_connector?.connector_class}
                sourceType={pipeline.source_type}
                className="w-14 h-14 flex-shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Source Settings</h3>
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
              <div className="text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Connector Class</div>
                <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {pipeline.source_connector?.connector_class || 'Not configured'}
                </div>
              </div>
            </div>

            {renderSourceSettings(pipeline, sourceConfig, setSourceConfig)}

            <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Tables in Pipeline
                </h4>
                {tablesLoading && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Loading…</span>
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
                  {tablesLoading ? 'Loading tables…' : 'No tables have been selected for this pipeline yet.'}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'destination' && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-4 mb-6">
              <DatabaseLogoIcon
                connectorClass={pipeline.sink_connector?.connector_class}
                sourceType={pipeline.destination_type}
                className="w-14 h-14 flex-shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Destination Settings</h3>
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
              <div className="text-right">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Connector Class</div>
                <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {pipeline.sink_connector?.connector_class || 'Not configured'}
                </div>
              </div>
            </div>

            <DestinationSettings
              config={destinationConfig}
              onChange={setDestinationConfig}
            />
          </div>
        )}

        {activeSection === 'transformations' && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Single Message Transformations</h3>

            <div className="space-y-4">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">ExtractNewRecordState</h4>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Enabled</span>
                  </label>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Unwraps Debezium event structure to extract only the new record state
                </p>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">drop.tombstones</label>
                  <input
                    type="text"
                    defaultValue="true"
                    className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
                  />
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">RegexRouter</h4>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Enabled</span>
                  </label>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Route records to different topics based on regex pattern
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">regex</label>
                    <input
                      type="text"
                      defaultValue="([^.]+)\\.([^.]+)\\.([^.]+)"
                      className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">replacement</label>
                    <input
                      type="text"
                      defaultValue="$2_$3"
                      className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Test SMT with Sample Event
              </button>
            </div>
          </div>
        )}

        {activeSection === 'errors' && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Error Management</h3>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Error Tolerance
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="tolerance" className="text-blue-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">None (fail immediately)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="tolerance" defaultChecked className="text-blue-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">All (send to DLQ)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dead Letter Queue Topic
                </label>
                <input
                  type="text"
                  defaultValue="dlq-pipeline-errors"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Include error context in headers
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Log error messages
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Auto-restart after N failures
                </label>
                <input
                  type="number"
                  defaultValue="3"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  0 = disabled, connector will stop on error
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'operations' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Control Operations</h3>

              <div className="grid grid-cols-2 gap-4">
                <button className="px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium">
                  Pause All Connectors
                </button>
                <button className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                  Resume All Connectors
                </button>
                <button className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium">
                  Restart All Tasks
                </button>
                <button className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                  Restart All Connectors
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Configuration Management</h3>

              <div className="space-y-4">
                <button
                  onClick={() => {
                    const config = {
                      source: { connector_class: 'io.debezium.connector.oracle.OracleConnector' },
                      sink: { connector_class: 'io.debezium.connector.jdbc.JdbcSinkConnector' },
                    };
                    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'pipeline-config.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Export Configuration (JSON)
                </button>
                <button
                  onClick={() => setShowJsonEditor(true)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Import Configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {showJsonEditor && (
          <>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowJsonEditor(false)} />
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Import Configuration</h3>
                <button
                  onClick={() => setShowJsonEditor(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Upload JSON File
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const content = event.target?.result as string;
                          setJsonConfig(content);
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-300"
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Or paste your JSON configuration below. You can edit it directly before importing.
                </p>
                <textarea
                  value={jsonConfig}
                  onChange={(e) => setJsonConfig(e.target.value)}
                  className="w-full h-96 px-4 py-3 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
                  placeholder='{\n  "connector.class": "io.debezium.connector.oracle.OracleConnector",\n  "tasks.max": "1",\n  ...\n}'
                />
              </div>
              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                  onClick={() => {
                    try {
                      JSON.parse(jsonConfig);
                      alert('Configuration imported successfully!');
                      setShowJsonEditor(false);
                    } catch (e) {
                      alert('Invalid JSON: ' + (e as Error).message);
                    }
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Import & Apply
                </button>
                <button
                  onClick={() => setShowJsonEditor(false)}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSaveAll}
            disabled={isSaving || !hasChanges}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </button>


          <button
            disabled={isSaving}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
    </>
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
