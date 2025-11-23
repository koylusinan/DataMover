import { useState, useEffect, useMemo, memo, useRef, useCallback } from 'react';
import { Search, Database, RefreshCw, Eye, AlertTriangle, CheckCircle, Clock, X, Play, Pause, RotateCw, Sparkles, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DatabaseLogoIcon } from '../ui/DatabaseLogos';
import { DeploymentDiffModal } from '../ui/DeploymentDiffModal';
import { getActiveConnectorConfig } from '../../lib/registry';

interface TaskInfo {
  id: string;
  task_number: number;
  status: 'running' | 'paused' | 'failed';
  worker_id: string;
  lag: string;
  throughput: string;
  type: 'source' | 'sink';
  connector_name: string;
}

interface TableObject {
  id: string;
  schema_name: string;
  table_name: string;
  status: 'snapshotting' | 'streaming' | 'paused' | 'error';
  last_event_timestamp: string;
  row_count: number;
  size_estimate: string;
  last_sync_time: string;
  source_topic: string;
  partition_count: number;
  destination_table: string;
  snapshot_progress?: number;
  error_message?: string;
  tasks?: TaskInfo[];
}

interface Connector {
  id: string;
  name: string;
  type: 'source' | 'sink';
  connector_class: string;
  config: Record<string, unknown>;
  resolved_config?: Record<string, unknown>;
  status: string;
  tasks_max: number;
  has_pending_changes?: boolean;
  pending_config?: Record<string, unknown>;
}

interface ConnectorStatus {
  name: string;
  connector: {
    state: string;
    worker_id: string;
  };
  tasks: Array<{ id: number; state: string; worker_id: string }>;
}

interface ObjectsTabProps {
  pipelineId: string;
  pipelineStatus: string;
  sourceType?: string;
  destinationType?: string;
  onPipelineStatusChange?: () => void;
  refreshTrigger?: number;
  connectorStatuses?: {
    source: ConnectorStatus | null;
    sink: ConnectorStatus | null;
  };
}

export const ObjectsTab = memo(function ObjectsTab({ pipelineId, pipelineStatus, sourceType, destinationType, onPipelineStatusChange, refreshTrigger, connectorStatuses }: ObjectsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [schemaFilter, setSchemaFilter] = useState<string>('all');
  const [selectedTable, setSelectedTable] = useState<TableObject | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [diffConnector, setDiffConnector] = useState<Connector | null>(null);
  const [viewConnector, setViewConnector] = useState<Connector | null>(null);
  const [tables, setTables] = useState<TableObject[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [increasedTables, setIncreasedTables] = useState<Set<string>>(new Set());
  const previousValuesRef = useRef<Record<string, { row_count: number; size_estimate: string }>>({});

  // Auto-update selectedTable when connectorStatuses changes (for real-time task status updates in modal)
  // This ensures the modal shows live task status immediately
  useEffect(() => {
    if (selectedTable && connectorStatuses) {
      // Compute fresh connectorTasks from connectorStatuses
      const freshTasks: TaskInfo[] = [];

      if (connectorStatuses.source?.tasks) {
        connectorStatuses.source.tasks.forEach((task: any) => {
          freshTasks.push({
            id: `${connectorStatuses.source.name}-${task.id}`,
            task_number: task.id,
            status: task.state === 'RUNNING' ? 'running' : task.state === 'PAUSED' ? 'paused' : 'failed',
            worker_id: task.worker_id || '',
            lag: '0',
            throughput: '0',
            type: 'source' as const,
            connector_name: connectorStatuses.source.name
          });
        });
      }

      if (connectorStatuses.sink?.tasks) {
        connectorStatuses.sink.tasks.forEach((task: any) => {
          freshTasks.push({
            id: `${connectorStatuses.sink.name}-${task.id}`,
            task_number: task.id,
            status: task.state === 'RUNNING' ? 'running' : task.state === 'PAUSED' ? 'paused' : 'failed',
            worker_id: task.worker_id || '',
            lag: '0',
            throughput: '0',
            type: 'sink' as const,
            connector_name: connectorStatuses.sink.name
          });
        });
      }

      console.log('🔄 Updating selectedTable with fresh tasks:', freshTasks.map(t => `${t.type}-${t.task_number}:${t.status}`).join(', '));

      // Update selectedTable with fresh tasks
      setSelectedTable(prevTable => {
        if (!prevTable) return prevTable;
        return {
          ...prevTable,
          tasks: freshTasks
        };
      });
    }
  }, [connectorStatuses, selectedTable?.id]); // Re-run when connectorStatuses changes or modal opens

  const maskSensitiveFields = (config: Record<string, unknown>): Record<string, unknown> => {
    // Only mask actual sensitive fields, not fields that just contain these words
    const exactSensitiveKeys = [
      'connection.password',
      'database.password',
      'password',
      'jaas.config',
      'apikey',
      'api.key',
      'secret',
      'token',
      'auth.token'
    ];
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      const lowerKey = key.toLowerCase();
      // Check if the key exactly matches or ends with a sensitive key
      const isSensitive = exactSensitiveKeys.some(sensitive =>
        lowerKey === sensitive || lowerKey.endsWith(`.${sensitive}`)
      );

      if (isSensitive && typeof value === 'string' && value.length > 0) {
        masked[key] = '********';
      } else {
        masked[key] = value;
      }
    }

    return masked;
  };

  const handleConnectorPause = async (connectorName: string) => {
    try {
      const response = await fetch(`http://localhost:5002/api/connectors/${connectorName}/pause`, {
        method: 'POST'
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to pause connector');
      }

      // Aggressive refetch: Poll connector statuses rapidly to catch fast state changes
      const rapidRefetch = () => {
        fetchData(true);
        // Notify parent to refresh pipeline detail page status (which will update connectorStatuses prop)
        if (onPipelineStatusChange) {
          onPipelineStatusChange();
        }
      };

      // Immediate refetch
      rapidRefetch();

      // Then refetch 3 more times with 1-second intervals to catch Kafka Connect updates
      setTimeout(() => rapidRefetch(), 1000);
      setTimeout(() => rapidRefetch(), 2000);
      setTimeout(() => rapidRefetch(), 3000);
    } catch (error: any) {
      console.error(`Failed to pause connector:`, error);
      alert(`Failed to pause connector: ${error.message}`);
    }
  };

  const handleConnectorResume = async (connectorName: string) => {
    try {
      const response = await fetch(`http://localhost:5002/api/connectors/${connectorName}/resume`, {
        method: 'POST'
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to resume connector');
      }

      // Aggressive refetch: Poll connector statuses rapidly to catch fast state changes
      const rapidRefetch = () => {
        fetchData(true);
        // Notify parent to refresh pipeline detail page status (which will update connectorStatuses prop)
        if (onPipelineStatusChange) {
          onPipelineStatusChange();
        }
      };

      // Immediate refetch
      rapidRefetch();

      // Then refetch 3 more times with 1-second intervals to catch Kafka Connect updates
      setTimeout(() => rapidRefetch(), 1000);
      setTimeout(() => rapidRefetch(), 2000);
      setTimeout(() => rapidRefetch(), 3000);
    } catch (error: any) {
      console.error(`Failed to resume connector:`, error);
      alert(`Failed to resume connector: ${error.message}`);
    }
  };

  const handleTaskRestart = async (connectorName: string, taskNumber: number) => {
    try {
      const response = await fetch(`http://localhost:5002/api/connectors/${connectorName}/tasks/${taskNumber}/restart`, {
        method: 'POST'
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to restart task');
      }

      // Aggressive refetch: Poll connector statuses rapidly to catch fast state changes
      const rapidRefetch = () => {
        fetchData(true);
        // Notify parent to refresh pipeline detail page status (which will update connectorStatuses prop)
        if (onPipelineStatusChange) {
          onPipelineStatusChange();
        }
      };

      // Immediate refetch
      rapidRefetch();

      // Then refetch 3 more times with 1-second intervals to catch Kafka Connect updates
      setTimeout(() => rapidRefetch(), 1000);
      setTimeout(() => rapidRefetch(), 2000);
      setTimeout(() => rapidRefetch(), 3000);
    } catch (error: any) {
      console.error(`Failed to restart task:`, error);
      alert(`Failed to restart task: ${error.message}`);
    }
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    console.log('🔍 Fetching data for pipeline:', pipelineId);

    const [{ data: connectorsData, error: connectorsError }, { data: tablesData, error: tablesError }] = await Promise.all([
      supabase
        .from('pipeline_connectors')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('type', { ascending: true }),
      supabase
        .from('pipeline_objects')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('schema_name', { ascending: true })
        .order('table_name', { ascending: true }),
    ]);

    console.log('📦 Connectors data:', connectorsData);
    console.log('❌ Connectors error:', connectorsError);
    console.log('📊 Tables data:', tablesData);
    console.log('❌ Tables error:', tablesError);

    if (connectorsError) {
      console.error('Connectors fetch error:', connectorsError);
    }
    if (tablesError) {
      console.error('Tables fetch error:', tablesError);
    }

    let enrichedConnectors: Connector[] = [];
    if (connectorsData) {
      console.log('🔧 Enriching connectors, count:', connectorsData.length);
      enrichedConnectors = await Promise.all(
        connectorsData.map(async (conn) => {
          let resolved = conn.config || {};
          const registryName = conn.config?.registry_connector as string | undefined;
          if (registryName) {
            try {
              const configFromRegistry = await getActiveConnectorConfig(registryName);
              if (configFromRegistry) {
                resolved = configFromRegistry;
              }
            } catch (error) {
              console.warn('Failed to fetch registry config for', registryName, error);
            }
            if (resolved === conn.config) {
              resolved = (conn.config?.snapshot_config as Record<string, unknown>) || resolved;
            }
          }
          return { ...conn, resolved_config: resolved } as Connector;
        })
      );
      console.log('✅ Enriched connectors:', enrichedConnectors);
      setConnectors(enrichedConnectors);
    } else {
      console.log('⚠️ No connectors data received');
    }

    // Extract task information from connectorStatuses prop (same data source as progress bar)
    let connectorTasks: TaskInfo[] = [];

    if (connectorStatuses) {
      const allTasks: TaskInfo[] = [];

      console.log('🔍 ObjectsTab: connectorStatuses.source:', connectorStatuses.source);
      console.log('🔍 ObjectsTab: connectorStatuses.sink:', connectorStatuses.sink);

      if (connectorStatuses.source?.tasks) {
        console.log('✅ ObjectsTab: Source tasks found:', connectorStatuses.source.tasks.length);
        connectorStatuses.source.tasks.forEach((task: any) => {
          console.log('  📋 Source task:', task.id, 'state:', task.state);
          allTasks.push({
            id: `${connectorStatuses.source.name}-${task.id}`,
            task_number: task.id,
            status: task.state === 'RUNNING' ? 'running' : task.state === 'PAUSED' ? 'paused' : 'failed',
            worker_id: task.worker_id || '',
            lag: '0',
            throughput: '0',
            type: 'source' as const,
            connector_name: connectorStatuses.source.name
          });
        });
      } else {
        console.log('❌ ObjectsTab: No source tasks found');
      }

      if (connectorStatuses.sink?.tasks) {
        console.log('✅ ObjectsTab: Sink tasks found:', connectorStatuses.sink.tasks.length);
        connectorStatuses.sink.tasks.forEach((task: any) => {
          console.log('  📋 Sink task:', task.id, 'state:', task.state);
          allTasks.push({
            id: `${connectorStatuses.sink.name}-${task.id}`,
            task_number: task.id,
            status: task.state === 'RUNNING' ? 'running' : task.state === 'PAUSED' ? 'paused' : 'failed',
            worker_id: task.worker_id || '',
            lag: '0',
            throughput: '0',
            type: 'sink' as const,
            connector_name: connectorStatuses.sink.name
          });
        });
      } else {
        console.log('❌ ObjectsTab: No sink tasks found');
      }

      connectorTasks = allTasks;

      console.log('🔄 ObjectsTab: Total tasks:', connectorTasks.length);
      console.log('📊 ObjectsTab: All tasks:', connectorTasks.map(t => `${t.type}-${t.task_number}:${t.status}`).join(', '));
    }

    if (tablesData && tablesData.length > 0) {
      const sourceConnector = enrichedConnectors.find(c => c.type === 'source');
      const effectiveConfig = sourceConnector?.resolved_config || sourceConnector?.config || {};
      const topicPrefix = (effectiveConfig['topic.prefix'] as string) || 'topic';

      // Fetch real-time table stats from source database
      let realTimeStats: Record<string, { rowCount: number; sizeEstimate: string }> = {};
      const backendUrl = import.meta.env.VITE_BACKEND_URL;

      console.log('📊 Fetching real-time stats - backendUrl:', backendUrl, 'sourceConnector:', sourceConnector?.type);

      if (backendUrl && sourceConnector) {
        try {
          const sourceConfig = sourceConnector.resolved_config || sourceConnector.config || {};

          // Determine connectionType from connector class
          const connectorClass = sourceConfig['connector.class'] as string || '';
          let connectionType = 'postgresql'; // default
          if (connectorClass.includes('oracle')) {
            connectionType = 'oracle';
          } else if (connectorClass.includes('postgresql')) {
            connectionType = 'postgresql';
          }

          console.log('📊 Source config keys:', Object.keys(sourceConfig));
          console.log('📊 Connector class:', connectorClass, '→ connectionType:', connectionType);

          // Map Debezium config field names to backend expected field names
          let dbHost = sourceConfig['database.hostname'] as string;

          // If host is a Docker container name, replace with localhost since backend runs on host machine
          const dockerHosts = ['pg-debezium', 'postgres', 'oracle-xe'];
          if (dockerHosts.includes(dbHost)) {
            dbHost = 'localhost';
          }

          const mappedConfig: Record<string, any> = {
            connectionType,
            host: dbHost,
            port: parseInt(sourceConfig['database.port'] as string, 10),
            database: sourceConfig['database.dbname'] as string,
            username: sourceConfig['database.user'] as string,
            password: sourceConfig['database.password'] as string,
            schemaName: sourceConfig['database.schema'] as string || 'public',
          };

          console.log('📊 Mapped config:', mappedConfig);
          console.log('📊 Calling /api/list-tables');

          const response = await fetch(`${backendUrl}/api/list-tables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mappedConfig),
          });

          console.log('📊 Response status:', response.status);

          if (response.ok) {
            const data = await response.json();
            console.log('📊 Response data:', data);

            if (data.success && Array.isArray(data.tables)) {
              console.log('📊 Processing', data.tables.length, 'tables');
              data.tables.forEach((t: any) => {
                const key = `${t.schema}.${t.table}`;
                realTimeStats[key] = {
                  rowCount: t.rowCount || 0,
                  sizeEstimate: t.sizeEstimate || '0 B'
                };
                console.log('📊 Table stats:', key, '→', realTimeStats[key]);
              });
            } else {
              console.warn('📊 Invalid response format:', data);
            }
          } else {
            const errorText = await response.text();
            console.error('📊 Backend error:', response.status, errorText);
          }
        } catch (error) {
          console.error('📊 Failed to fetch real-time table stats:', error);
        }
      } else {
        console.warn('📊 Missing backendUrl or sourceConnector:', { backendUrl, hasSourceConnector: !!sourceConnector });
      }

      const newIncreased = new Set<string>();

      console.log('📊 Real-time stats available:', Object.keys(realTimeStats).length, 'tables');
      console.log('📊 Tables to map:', tablesData.length);

      const mappedTables: TableObject[] = tablesData.map((row) => {
        const tableKey = `${row.schema_name}.${row.table_name}`;
        const realStats = realTimeStats[tableKey];
        const row_count = realStats?.rowCount ?? 0;
        const size_estimate = realStats?.sizeEstimate ?? '0 B';

        console.log(`📊 Mapping table ${tableKey}: realStats=${!!realStats}, row_count=${row_count}, size=${size_estimate}`);

        // Check if values increased
        const prevValues = previousValuesRef.current[tableKey];
        if (prevValues && (row_count > prevValues.row_count || size_estimate !== prevValues.size_estimate)) {
          newIncreased.add(tableKey);
          console.log(`📊 ✅ Increase detected for ${tableKey}:`, prevValues, '→', { row_count, size_estimate });
        }

        // Store current values
        previousValuesRef.current[tableKey] = { row_count, size_estimate };

        return {
          id: row.id,
          schema_name: row.schema_name,
          table_name: row.table_name,
          status: 'streaming', // Will be computed dynamically in displayTables
          last_event_timestamp: new Date().toISOString(),
          row_count,
          size_estimate,
          last_sync_time: new Date().toISOString(),
          source_topic: `${topicPrefix}.${row.schema_name}.${row.table_name}`,
          partition_count: 1,
          destination_table: `${row.schema_name}_${row.table_name}`,
          snapshot_progress: row.included ? 100 : 0,
          tasks: connectorTasks,
        };
      });

      setTables(mappedTables);
      setIncreasedTables(newIncreased);

      // Clear increased indicators after 5 seconds
      if (newIncreased.size > 0) {
        setTimeout(() => {
          setIncreasedTables(new Set());
        }, 5000);
      }
    } else {
      const sourceConnector = enrichedConnectors.find(c => c.type === 'source');
      const sinkConnector = enrichedConnectors.find(c => c.type === 'sink');
      const fallbackTables = buildTablesFromConfig(sourceConnector, sinkConnector, pipelineId);
      // Add tasks to fallback tables as well (status will be computed dynamically in displayTables)
      const fallbackTablesWithTasks = fallbackTables.map(table => ({
        ...table,
        status: 'streaming' as const, // Will be computed dynamically in displayTables
        tasks: connectorTasks
      }));
      setTables(fallbackTablesWithTasks);
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId]); // Note: connectorStatuses not in deps to prevent re-creating fetchData on every status change

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh table stats every 5 seconds when pipeline is running or paused
  useEffect(() => {
    if (pipelineStatus !== 'running' && pipelineStatus !== 'paused') return;

    const interval = setInterval(() => {
      fetchData(true); // Silent refresh to prevent jitter
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [pipelineStatus, fetchData]);

  // Note: We don't refresh on connectorStatuses change because it causes blink
  // connectorStatuses is already displayed via props, no need to re-fetch
  // Auto-refresh above (every 5s) keeps data in sync

  // Extract tasks from connectorStatuses prop (INSTANT UPDATE - no async delay!)
  const connectorTasks: TaskInfo[] = useMemo(() => {
    if (!connectorStatuses) return [];

    const allTasks: TaskInfo[] = [];

    if (connectorStatuses.source?.tasks) {
      connectorStatuses.source.tasks.forEach((task: any) => {
        console.log('🔍 Source task state:', task.state, 'id:', task.id);
        const mappedStatus = task.state === 'RUNNING' ? 'running' : task.state === 'PAUSED' ? 'paused' : 'failed';
        console.log('  → Mapped to:', mappedStatus);
        allTasks.push({
          id: `${connectorStatuses.source.name}-${task.id}`,
          task_number: task.id,
          status: mappedStatus,
          worker_id: task.worker_id || '',
          lag: '0',
          throughput: '0',
          type: 'source' as const,
          connector_name: connectorStatuses.source.name
        });
      });
    }

    if (connectorStatuses.sink?.tasks) {
      connectorStatuses.sink.tasks.forEach((task: any) => {
        console.log('🔍 Sink task state:', task.state, 'id:', task.id);
        const mappedStatus = task.state === 'RUNNING' ? 'running' : task.state === 'PAUSED' ? 'paused' : 'failed';
        console.log('  → Mapped to:', mappedStatus);
        allTasks.push({
          id: `${connectorStatuses.sink.name}-${task.id}`,
          task_number: task.id,
          status: mappedStatus,
          worker_id: task.worker_id || '',
          lag: '0',
          throughput: '0',
          type: 'sink' as const,
          connector_name: connectorStatuses.sink.name
        });
      });
    }

    console.log('⚡ INSTANT tasks update from connectorStatuses:', allTasks.map(t => `${t.type}-${t.task_number}:${t.status}`).join(', '));
    console.log('⚡ Full tasks array:', JSON.stringify(allTasks, null, 2));
    return allTasks;
  }, [connectorStatuses]);

  // Calculate table status dynamically based on tasks (same source as progress bar)
  const displayTables: TableObject[] = useMemo(() => {
    return tables.map(table => {
      // Inject latest tasks from connectorStatuses (INSTANT!)
      const tableWithLatestTasks = {
        ...table,
        tasks: connectorTasks // Use live tasks from connectorStatuses
      };

      if (!tableWithLatestTasks.tasks || tableWithLatestTasks.tasks.length === 0) {
        return tableWithLatestTasks;
      }

      // Determine status based on this table's tasks
      // Logic: Any task failed → error, Any task paused → paused, ALL tasks running → streaming
      const hasFailedTask = tableWithLatestTasks.tasks.some(task => task.status === 'failed');
      const anyPaused = tableWithLatestTasks.tasks.some(task => task.status === 'paused');
      const allRunning = tableWithLatestTasks.tasks.every(task => task.status === 'running');

      let computedStatus: 'streaming' | 'paused' | 'error' = 'paused';
      if (hasFailedTask) {
        computedStatus = 'error';
      } else if (anyPaused) {
        computedStatus = 'paused';
      } else if (allRunning) {
        computedStatus = 'streaming';
      }

      return {
        ...tableWithLatestTasks,
        status: computedStatus, // Dynamically computed from tasks
      };
    });
  }, [tables, connectorTasks]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'streaming':
        return <CheckCircle className="w-4 h-4" />;
      case 'snapshotting':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'paused':
        return <Clock className="w-4 h-4" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'streaming':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'snapshotting':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Memoize filtered tables to prevent recalculation on every render
  const filteredTables = useMemo(() => {
    return displayTables.filter((table) => {
      const matchesSearch =
        table.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        table.schema_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || table.status === statusFilter;
      const matchesSchema = schemaFilter === 'all' || table.schema_name === schemaFilter;
      return matchesSearch && matchesStatus && matchesSchema;
    });
  }, [displayTables, searchQuery, statusFilter, schemaFilter]);

  // Memoize schemas, sourceConnectors, and sinkConnectors to prevent recalculation
  const schemas = useMemo(() => Array.from(new Set(tables.map((t) => t.schema_name))), [tables]);
  const sourceConnectors = useMemo(() => connectors.filter(c => c.type === 'source'), [connectors]);
  const sinkConnectors = useMemo(() => connectors.filter(c => c.type === 'sink'), [connectors]);

  if (loading) {
    return <div className="p-8 text-gray-600 dark:text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Connectors Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Connectors
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Source Connectors */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Source Connectors</h4>
            {sourceConnectors.map(connector => (
              <div key={connector.id} className="relative">
                <div
                  className="w-full p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
                  onClick={() => {
                    setViewConnector(connector);
                    setShowConfigModal(true);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <DatabaseLogoIcon
                        connectorClass={connector.connector_class}
                        className="w-14 h-14 flex-shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">{connector.name}</div>
                          {connector.has_pending_changes && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDiffConnector(connector);
                                setShowDiffModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs font-medium rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/40 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" />
                              Updated
                            </button>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{connector.connector_class.split('.').pop()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sink Connectors */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Sink Connectors</h4>
            {sinkConnectors.map(connector => (
              <div key={connector.id} className="relative">
                <div
                  className="w-full p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
                  onClick={() => {
                    setViewConnector(connector);
                    setShowConfigModal(true);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <DatabaseLogoIcon
                        connectorClass={connector.connector_class}
                        className="w-14 h-14 flex-shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">{connector.name}</div>
                          {connector.has_pending_changes && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDiffConnector(connector);
                                setShowDiffModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs font-medium rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/40 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" />
                              Updated
                            </button>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{connector.connector_class.split('.').pop()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tables</h3>
          <button
            onClick={fetchData}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh tables"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="streaming">Streaming</option>
            <option value="snapshotting">Snapshotting</option>
            <option value="paused">Paused</option>
            <option value="error">Error</option>
          </select>
          <select
            value={schemaFilter}
            onChange={(e) => setSchemaFilter(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Schemas</option>
            {schemas.map((schema) => (
              <option key={schema} value={schema}>
                {schema}
              </option>
            ))}
          </select>
        </div>

        {/* Tables Table */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Table
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Connector
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rows
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Destination
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tasks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTables.map((table) => (
                <tr
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <DatabaseLogoIcon
                        connectorClass={sourceConnectors[0]?.connector_class}
                        sourceType={sourceType}
                        className="w-8 h-8 flex-shrink-0"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {table.table_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{table.schema_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <DatabaseLogoIcon
                        connectorClass={sourceConnectors[0]?.connector_class}
                        sourceType={sourceType}
                        className="w-12 h-12 flex-shrink-0"
                      />
                      <span className="text-2xl text-gray-400 dark:text-gray-500 font-light">→</span>
                      <DatabaseLogoIcon
                        connectorClass={sinkConnectors[0]?.connector_class}
                        sourceType={destinationType}
                        className="w-12 h-12 flex-shrink-0"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(table.status)}`}
                      >
                        {getStatusIcon(table.status)}
                        {table.status}
                      </span>
                      {table.status === 'snapshotting' && table.snapshot_progress !== undefined && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${table.snapshot_progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {table.snapshot_progress}%
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {formatTimestamp(table.last_event_timestamp)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    <div className="flex items-center gap-1.5">
                      <span>{table.row_count.toLocaleString()}</span>
                      {increasedTables.has(`${table.schema_name}.${table.table_name}`) && (
                        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 animate-bounce" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <span>{table.size_estimate}</span>
                      {increasedTables.has(`${table.schema_name}.${table.table_name}`) && (
                        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 animate-bounce" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                      {table.destination_table}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {table.partition_count} partitions
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {table.tasks && table.tasks.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        {table.tasks.map((task) => (
                          <div
                            key={task.id}
                            className={`px-2.5 py-1 rounded text-xs font-medium ${
                              task.status === 'running'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : task.status === 'paused'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            }`}
                            title={`${task.type === 'source' ? 'Source' : 'Sink'}: ${task.connector_name}\nTask ${task.task_number}\nWorker: ${task.worker_id}`}
                          >
                            {task.type === 'source' ? 'SRC' : 'SINK'}-{task.task_number}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">No tasks</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Config View Modal */}
      {showConfigModal && viewConnector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfigModal(false)}></div>

          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col m-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {viewConnector.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Current Configuration
                </p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto font-mono">
                {JSON.stringify(maskSensitiveFields(viewConnector.resolved_config || viewConnector.config), null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff Modal */}
      {showDiffModal && diffConnector && (
        <DeploymentDiffModal
          connectorName={diffConnector.name}
          connectorType={diffConnector.type}
          currentConfig={maskSensitiveFields(diffConnector.config)}
          pendingConfig={maskSensitiveFields(diffConnector.pending_config || {})}
          onDeploy={async () => {
            try {
              const backendUrl = import.meta.env.VITE_DEBEZIUM_BACKEND_URL || 'http://localhost:5002';
              const response = await fetch(`${backendUrl}/api/connectors/${diffConnector.id}/deploy-pending`, {
                method: 'POST'
              });

              const result = await response.json();

              if (!result.success) {
                throw new Error(result.error || 'Failed to deploy changes');
              }

              setShowDiffModal(false);
              setDiffConnector(null);
              fetchData();

              window.dispatchEvent(new CustomEvent('pipeline-updated', {
                detail: { pipelineId }
              }));
            } catch (error) {
              console.error('Deploy error:', error);
              alert(`Failed to deploy changes: ${error.message}`);
            }
          }}
          onDismiss={async () => {
            try {
              const { error } = await supabase
                .from('pipeline_connectors')
                .update({
                  pending_config: null,
                  has_pending_changes: false
                })
                .eq('id', diffConnector.id);

              if (error) throw error;

              setShowDiffModal(false);
              setDiffConnector(null);
              fetchData();
            } catch (error) {
              console.error('Dismiss error:', error);
              alert('Failed to dismiss changes');
            }
          }}
          onClose={() => {
            setShowDiffModal(false);
            setDiffConnector(null);
          }}
        />
      )}

      {/* Table Detail Modal */}
      {selectedTable && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedTable(null)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {selectedTable.schema_name}.{selectedTable.table_name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Table Details</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTable(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status and Progress */}
              <div className="flex items-center gap-4">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(
                  // Use task status if available, otherwise use table status
                  selectedTable.tasks && selectedTable.tasks.length > 0
                    ? selectedTable.tasks[0].status
                    : selectedTable.status
                )}`}>
                  {getStatusIcon(
                    selectedTable.tasks && selectedTable.tasks.length > 0
                      ? selectedTable.tasks[0].status
                      : selectedTable.status
                  )}
                  {selectedTable.tasks && selectedTable.tasks.length > 0
                    ? selectedTable.tasks[0].status
                    : selectedTable.status}
                </span>
                {selectedTable.status === 'snapshotting' && selectedTable.snapshot_progress !== undefined && (
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${selectedTable.snapshot_progress}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {selectedTable.snapshot_progress}%
                    </span>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {selectedTable.error_message && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-red-900 dark:text-red-200">Error</h4>
                      <p className="text-sm text-red-800 dark:text-red-300 mt-1">{selectedTable.error_message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Row Count</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                    {selectedTable.row_count.toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Size</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                    {selectedTable.size_estimate}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Partitions</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                    {selectedTable.partition_count}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Tasks</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                    {selectedTable.tasks?.length || 0}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Source Topic</div>
                  <div className="text-sm font-mono text-gray-900 dark:text-gray-100 mt-1">
                    {selectedTable.source_topic}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Destination Table</div>
                  <div className="text-sm font-mono text-gray-900 dark:text-gray-100 mt-1">
                    {selectedTable.destination_table}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Last Event</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {formatTimestamp(selectedTable.last_event_timestamp)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Last Sync</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {formatTimestamp(selectedTable.last_sync_time)}
                  </div>
                </div>
              </div>

              {/* Tasks */}
              {selectedTable.tasks && selectedTable.tasks.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Tasks</h4>
                  <div className="space-y-2">
                    {selectedTable.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded text-xs font-medium ${
                            task.status === 'running'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : task.status === 'paused'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {task.type === 'source' ? 'Source' : 'Sink'} Task {task.task_number}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {task.worker_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Lag:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">{task.lag}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Throughput:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">{task.throughput}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-700 pl-4">
                            {task.status === 'paused' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConnectorResume(task.connector_name);
                                }}
                                className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                                title="Resume Connector"
                              >
                                <Play className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConnectorPause(task.connector_name);
                                }}
                                className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-colors"
                                title="Pause Connector"
                              >
                                <Pause className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTaskRestart(task.connector_name, task.task_number);
                              }}
                              className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                              title="Restart Task"
                            >
                              <RotateCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => alert('Preview data - Under development')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview Data
                </button>
                <button
                  onClick={() => alert('Re-snapshot - Under development')}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Re-snapshot
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

function buildTablesFromConfig(sourceConnector?: Connector, sinkConnector?: Connector, pipelineId?: string): TableObject[] {
  const sourceConfig = sourceConnector?.resolved_config || sourceConnector?.config || {};
  const sinkConfig = sinkConnector?.resolved_config || sinkConnector?.config || {};
  const includeList = sourceConfig['table.include.list'] as string | undefined;
  let tableNames: string[] = [];

  if (includeList) {
    tableNames = includeList
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  if (tableNames.length === 0) {
    const topics = sinkConfig['topics'] as string | undefined;
    if (topics) {
      tableNames = topics
        .split(',')
        .map((topic) => topic.trim())
        .filter(Boolean)
        .map((topic) => {
          const parts = topic.split('.');
          if (parts.length >= 3) {
            return `${parts[1]}.${parts[2]}`;
          }
          return topic;
        });
    }
  }

  const topicPrefix = (sourceConfig['topic.prefix'] as string) || 'topic';

  return tableNames.map((fullName, idx) => {
    const [schema, table] = fullName.includes('.') ? fullName.split('.') : ['public', fullName];
    return {
      id: `${pipelineId || 'config'}-${idx}`,
      schema_name: schema,
      table_name: table,
      status: 'streaming',
      last_event_timestamp: new Date().toISOString(),
      row_count: 0,
      size_estimate: '0 B',
      last_sync_time: new Date().toISOString(),
      source_topic: `${topicPrefix}.${schema}.${table}`,
      partition_count: 1,
      destination_table: `${schema}_${table}`,
      snapshot_progress: 0,
      tasks: [],
    } as TableObject;
  });
}
