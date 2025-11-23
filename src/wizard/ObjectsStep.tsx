import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ChevronRight, ChevronDown, Database, Table, Loader2, CheckSquare, Square, Eye } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import type { TestConnectionRequest } from '../hooks/useTestConnection';
import { createConnectorVersion, activateConnectorVersion, getActiveConnectorConfig } from '../lib/registry';

interface TableInfo {
  schema: string;
  table: string;
  rowCount: number;
  sizeEstimate: string;
  lastModified: string;
}

async function updateConnectorTables(pipelineId: string | undefined, selectedTables: string[]) {
  if (!pipelineId) return;
  const includeList = selectedTables
    .map((key) => key.split('.'))
    .map(([schema, table]) => `${schema}.${table}`)
    .join(',');

  console.log('[updateConnectorTables] Selected tables:', selectedTables);
  console.log('[updateConnectorTables] Generated includeList:', includeList);

  const { data: connector } = await supabase
    .from('pipeline_connectors')
    .select('id, config, connector_class')
    .eq('pipeline_id', pipelineId)
    .eq('type', 'source')
    .maybeSingle();

  if (!connector) {
    console.warn('[updateConnectorTables] No connector found for pipeline:', pipelineId);
    return;
  }

  console.log('[updateConnectorTables] Connector config:', connector.config);

  const registryMeta = (connector.config as any)?.registry_connector ? (connector.config as any) : null;
  let baseConfig = (connector.config as Record<string, unknown>) || {};

  if (registryMeta?.registry_connector) {
    console.log('[updateConnectorTables] Using registry connector:', registryMeta.registry_connector);
    baseConfig = (await getActiveConnectorConfig(registryMeta.registry_connector)) || {};
    console.log('[updateConnectorTables] Base config from registry:', baseConfig);
  }

  const updatedConfig = {
    ...baseConfig,
    'table.include.list': includeList,
  };

  console.log('[updateConnectorTables] Updated config with table.include.list:', updatedConfig['table.include.list']);

  if (registryMeta?.registry_connector) {
    console.log('[updateConnectorTables] Creating new connector version...');
    const versionResponse = await createConnectorVersion({
      name: registryMeta.registry_connector,
      kind: 'source',
      connectorClass: connector.connector_class,
      config: updatedConfig,
    });
    console.log('[updateConnectorTables] Created version:', versionResponse.version.version);

    await activateConnectorVersion(registryMeta.registry_connector, versionResponse.version.version);
    console.log('[updateConnectorTables] Activated version:', versionResponse.version.version);

    await supabase
      .from('pipeline_connectors')
      .update({
        config: {
          ...registryMeta,
          registry_version: versionResponse.version.version,
          checksum: versionResponse.version.checksum,
        },
      })
      .eq('id', connector.id);
  } else {
    console.log('[updateConnectorTables] Updating connector config directly (no registry)');
    await supabase
      .from('pipeline_connectors')
      .update({ config: updatedConfig })
      .eq('id', connector.id);
  }

  console.log('[updateConnectorTables] Update complete');
}

interface SchemaGroup {
  name: string;
  tables: TableInfo[];
  expanded: boolean;
  selected: boolean;
  indeterminate: boolean;
}

interface ObjectsStepState {
  pipelineId?: string;
  sourceType?: string;
  sourceConnection?: TestConnectionRequest;
}

export function ObjectsStep() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const state = (location.state as ObjectsStepState) || {};
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoMapping, setAutoMapping] = useState(true);
  const [schemas, setSchemas] = useState<SchemaGroup[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<any>(null);

  useEffect(() => {
    loadSchemaData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.pipelineId, state?.sourceConnection]);

  const loadSchemaData = async () => {
    setIsLoading(true);

    try {
      let tableData: TableInfo[] = [];

      if (backendUrl && state?.sourceConnection) {
        const response = await fetch(`${backendUrl}/api/list-tables`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...state.sourceConnection,
            serviceName: state.sourceConnection.serviceName || state.sourceConnection.database,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to load source schemas');
        }

        const data = await response.json();
        if (data.success && Array.isArray(data.tables)) {
          tableData = data.tables;
        } else if (!data.success) {
          throw new Error(data.error || 'Failed to load source schemas');
        }
      }

      if (tableData.length === 0 && state?.pipelineId) {
        const { data, error } = await supabase
          .from('pipeline_objects')
          .select('schema_name, table_name, stats')
          .eq('pipeline_id', state.pipelineId)
          .order('schema_name', { ascending: true })
          .order('table_name', { ascending: true });

        if (error) {
          throw error;
        }

        tableData = (data || []).map((row) => ({
          schema: row.schema_name,
          table: row.table_name,
          rowCount: (row.stats as any)?.row_count || 0,
          sizeEstimate: (row.stats as any)?.size_estimate || '',
          lastModified: (row.stats as any)?.last_modified || '',
        }));
      }

      if (!tableData || tableData.length === 0) {
        setSchemas([]);
        return;
      }

      const grouped = tableData.reduce<Record<string, TableInfo[]>>((acc, table) => {
        if (!acc[table.schema]) {
          acc[table.schema] = [];
        }
        acc[table.schema].push(table);
        return acc;
      }, {});

      const schemaGroups: SchemaGroup[] = Object.entries(grouped).map(([name, tables]) => ({
        name,
        tables,
        expanded: true,
        selected: false,
        indeterminate: false,
      }));

      setSchemas(schemaGroups);

      // Load previously selected tables from connector config
      if (state?.pipelineId) {
        const { data: connector } = await supabase
          .from('pipeline_connectors')
          .select('config')
          .eq('pipeline_id', state.pipelineId)
          .eq('type', 'source')
          .maybeSingle();

        if (connector?.config) {
          const config = connector.config as any;
          const tableIncludeList = config['table.include.list'] || '';

          if (tableIncludeList) {
            const previouslySelected = tableIncludeList.split(',').map((t: string) => t.trim());
            setSelectedTables(new Set(previouslySelected));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load schema data', error);
      showToast('error', 'Failed to load schema data', error instanceof Error ? error.message : 'Unknown error');
      setSchemas([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSchema = (schemaName: string) => {
    setSchemas(prev =>
      prev.map(s =>
        s.name === schemaName ? { ...s, expanded: !s.expanded } : s
      )
    );
  };

  const toggleSchemaSelection = (schemaName: string) => {
    const schema = schemas.find(s => s.name === schemaName);
    if (!schema) return;

    const schemaTableKeys = schema.tables.map(t => `${t.schema}.${t.table}`);

    setSelectedTables(prev => {
      const newSet = new Set(prev);
      const allSelected = schemaTableKeys.every(key => newSet.has(key));

      if (allSelected) {
        schemaTableKeys.forEach(key => newSet.delete(key));
      } else {
        schemaTableKeys.forEach(key => newSet.add(key));
      }

      return newSet;
    });
  };

  const toggleTableSelection = (table: TableInfo) => {
    const key = `${table.schema}.${table.table}`;
    setSelectedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSchemas = useMemo(() => {
    return schemas
      .map((schema) => {
        const schemaTableKeys = schema.tables.map((t) => `${t.schema}.${t.table}`);
        const selectedCount = schemaTableKeys.filter((key) => selectedTables.has(key)).length;

        const filteredTables = schema.tables.filter((t) => {
          if (!normalizedQuery) return true;
          const searchable = `${t.schema}.${t.table}`.toLowerCase();
          return (
            searchable.includes(normalizedQuery) ||
            t.schema.toLowerCase().includes(normalizedQuery) ||
            t.table.toLowerCase().includes(normalizedQuery)
          );
        });

        return {
          ...schema,
          tables: filteredTables,
          selected: selectedCount === schemaTableKeys.length && schemaTableKeys.length > 0,
          indeterminate: selectedCount > 0 && selectedCount < schemaTableKeys.length,
        };
      })
      .filter((schema) => schema.tables.length > 0);
  }, [schemas, selectedTables, normalizedQuery]);

  const handleCheckConfiguration = async () => {
    if (selectedTables.size === 0) {
      showToast('warning', 'No tables selected', 'Please select at least one table to check');
      return;
    }

    if (!state.pipelineId) {
      showToast('error', 'Pipeline ID is missing');
      return;
    }

    setIsLoading(true);
    try {
      // Get source connector config
      const { data: connector } = await supabase
        .from('pipeline_connectors')
        .select('config, connector_class')
        .eq('pipeline_id', state.pipelineId)
        .eq('type', 'source')
        .maybeSingle();

      if (!connector) {
        showToast('error', 'Source connector not found');
        return;
      }

      let sourceConfig = (connector.config as any) || {};

      // If using registry, fetch actual config
      if (sourceConfig.registry_connector) {
        const activeConfig = await getActiveConnectorConfig(sourceConfig.registry_connector);
        if (activeConfig) {
          sourceConfig = activeConfig;
        }
      }

      // Build table.include.list
      const includeList = Array.from(selectedTables)
        .map((key) => key.split('.'))
        .map(([schema, table]) => `${schema}.${table}`)
        .join(',');

      // Create preview config
      const configPreview = {
        ...sourceConfig,
        'table.include.list': includeList,
      };

      // Remove sensitive data
      if (configPreview['database.password']) {
        configPreview['database.password'] = '********';
      }
      if (configPreview.password) {
        configPreview.password = '********';
      }

      setPreviewConfig(configPreview);
      setShowConfigModal(true);
    } catch (error) {
      showToast('error', 'Failed to generate config', (error as Error).message);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    if (selectedTables.size === 0) {
      showToast('warning', 'No tables selected', 'Please select at least one table to continue');
      return;
    }

    if (!state.pipelineId) {
      showToast('error', 'Pipeline ID is missing');
      return;
    }

    setIsLoading(true);
    try {
      const objectsToInsert = Array.from(selectedTables).map(key => {
        const [schema, table] = key.split('.');
        const tableInfo = schemas
          .find(s => s.name === schema)
          ?.tables.find(t => t.table === table);

        return {
          pipeline_id: state.pipelineId,
          schema_name: schema,
          table_name: table,
          included: true,
          stats: {
            row_count: tableInfo?.rowCount || 0,
            size_estimate: tableInfo?.sizeEstimate || '',
            last_modified: tableInfo?.lastModified || '',
          },
        };
      });

      const { error } = await supabase
        .from('pipeline_objects')
        .upsert(objectsToInsert, {
          onConflict: 'pipeline_id,schema_name,table_name',
        });

      if (error) {
        showToast('error', 'Failed to save selections', error.message);
        return;
      }

      await updateConnectorTables(state.pipelineId, Array.from(selectedTables));

      showToast('success', `${selectedTables.size} tables selected`);
      navigate('/pipelines/new/destination-type', { state: location.state });
    } catch (error) {
      showToast('error', 'An error occurred', 'Please try again');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = selectedTables.size;
  const totalTables = schemas.reduce((sum, s) => sum + s.tables.length, 0);

  return (
    <div className="flex h-full relative overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Fixed Header Section */}
        <div className="flex-shrink-0 p-8 pb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm mb-6"
          >
            ← Back
          </button>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Select Objects to Sync
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Choose which schemas and tables you want to replicate to your destination
          </p>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search schemas or tables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedCount}</span> of {totalTables} tables selected
            </div>
            <button
              type="button"
              onClick={() => {
                if (selectedCount === totalTables) {
                  setSelectedTables(new Set());
                } else {
                  const allKeys = schemas.flatMap(s =>
                    s.tables.map(t => `${t.schema}.${t.table}`)
                  );
                  setSelectedTables(new Set(allKeys));
                }
              }}
              disabled={totalTables === 0}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedCount === totalTables ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        {/* Scrollable Table List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-8 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : filteredSchemas.length === 0 ? (
              <div className="py-12 text-center text-gray-600 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                No tables found. Run object discovery or ensure the source connection details are correct.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSchemas.map((schema) => (
                  <div key={schema.name} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => toggleSchemaSelection(schema.name)}
                        className="flex-shrink-0"
                      >
                        {schema.indeterminate ? (
                          <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                            <div className="w-2.5 h-0.5 bg-white" />
                          </div>
                        ) : schema.selected ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleSchema(schema.name)}
                        className="flex items-center gap-2 flex-1"
                        aria-expanded={schema.expanded}
                      >
                        {schema.expanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <Database className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{schema.name}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({schema.tables.length} tables)
                        </span>
                      </button>
                    </div>

                    {schema.expanded && (
                      <div className="bg-white dark:bg-gray-900">
                        {schema.tables.map((table) => {
                          const key = `${table.schema}.${table.table}`;
                          const isSelected = selectedTables.has(key);

                          return (
                            <div
                              key={key}
                              className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-t border-gray-100 dark:border-gray-800"
                            >
                              <button
                                type="button"
                                onClick={() => toggleTableSelection(table)}
                                className="flex-shrink-0"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5 text-blue-600" />
                                ) : (
                                  <Square className="w-5 h-5 text-gray-400" />
                                )}
                              </button>

                              <Table className="w-4 h-4 text-gray-400 flex-shrink-0" />

                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-gray-100">{table.table}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {table.rowCount.toLocaleString()} rows • {table.sizeEstimate} • Modified {table.lastModified}
                                </p>
                              </div>

                              <button
                                type="button"
                                className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer Button */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-6">
          <button
            type="button"
            onClick={handleCheckConfiguration}
            disabled={isLoading || selectedCount === 0}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Check Configuration
          </button>
        </div>
      </div>

      {/* Configuration Preview Modal */}
      {showConfigModal && previewConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Source Connector Configuration Preview
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Review the configuration before continuing. The <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">table.include.list</code> shows your selected tables.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(previewConfig, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Back to Table Selection
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfigModal(false);
                  handleContinue();
                }}
                disabled={isLoading}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue to Destination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right Sidebar */}
      <div className="w-[500px] bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Object Selection Settings</h3>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="auto-mapping"
                checked={autoMapping}
                onChange={(e) => setAutoMapping(e.target.checked)}
                className="mt-1 w-4 h-4"
              />
              <div className="flex-1">
                <label htmlFor="auto-mapping" className="font-medium text-gray-900 dark:text-gray-100 cursor-pointer block mb-1">
                  Auto-Mapping
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically map source columns to destination columns based on name and type compatibility.
                  Turn off to manually configure column mappings.
                </p>
              </div>
            </div>
          </div>

          {!autoMapping && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Manual mapping will be available in the next step after selecting your destination.
              </p>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Selection Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Schemas:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {new Set(Array.from(selectedTables).map(k => k.split('.')[0])).size}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Tables:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{selectedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Estimated Size:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {(() => {
                    let totalMB = 0;
                    selectedTables.forEach(key => {
                      const [schema, table] = key.split('.');
                      const tableInfo = schemas
                        .find(s => s.name === schema)
                        ?.tables.find(t => t.table === table);
                      if (tableInfo) {
                        const size = tableInfo.sizeEstimate;
                        if (size.includes('MB')) {
                          totalMB += parseFloat(size);
                        } else if (size.includes('KB')) {
                          totalMB += parseFloat(size) / 1024;
                        }
                      }
                    });
                    return totalMB > 0 ? `${totalMB.toFixed(2)} MB` : '< 1 MB';
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
