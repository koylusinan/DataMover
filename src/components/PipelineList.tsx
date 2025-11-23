import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, LayoutGrid, List, Filter, Database, ArrowRight, Play, Pause, MoreVertical, Clock, CheckCircle, AlertCircle, XCircle, RotateCw, RotateCcw, RefreshCcw, X, ArrowUp, ArrowUpDown, RefreshCw, FileText, Calendar, Settings, Lock, Bell, Rocket, BellRing, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ui/Toast';
import { DatabaseLogoIcon } from './ui/DatabaseLogos';
import { getActiveConnectorConfig, getConnectorVersions, markConnectorDeployed, activateConnectorVersion } from '../lib/registry';
import { deployPipeline } from '../lib/debezium';
import { usePermissions } from '../hooks/usePermissions';
import { DeleteConfirmModal } from './ui/DeleteConfirmModal';
import { RollbackConsoleModal } from './ui/RollbackConsoleModal';
import { useAuth } from '../contexts/AuthContext';
import { useAlerts } from '../hooks/useAlerts';

const formatDiffValue = (value: unknown) => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  return JSON.stringify(value);
};

function flattenToMap(obj: any, prefix = ''): Record<string, string> {
  if (obj === null || obj === undefined) {
    return prefix ? { [prefix]: 'null' } : {};
  }
  if (Array.isArray(obj)) {
    return obj.reduce<Record<string, string>>((acc, value, index) => {
      const key = prefix ? `${prefix}[${index}]` : `[${index}]`;
      Object.assign(acc, flattenToMap(value, key));
      return acc;
    }, {});
  }
  if (typeof obj === 'object') {
    return Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      Object.assign(acc, flattenToMap(value, nextPrefix));
      return acc;
    }, {});
  }
  const serialized = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return prefix ? { [prefix]: serialized } : { value: serialized };
};

const renderDiffLines = (diff: RegistryDiffView | null) => {
  if (!diff) return null;
  const paths = Array.from(
    new Set([...Object.keys(diff.prevFlat), ...Object.keys(diff.currFlat)])
  ).sort();
  if (paths.length === 0) {
    return <div className="text-gray-500">No differences detected.</div>;
  }

  return (
    <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto text-xs font-mono space-y-1">
      <div>{'{'}</div>
      {paths.map((path) => {
        const prev = diff.prevFlat[path];
        const curr = diff.currFlat[path];
        if (prev !== undefined && curr !== undefined) {
          if (prev === curr) {
            return (
              <div key={`same-${path}`} className="text-gray-400">
                {`  "${path}": ${formatDiffValue(curr)}`}
              </div>
            );
          }
          return (
            <div key={`diff-${path}`} className="space-y-0.5">
              <div className="text-red-400">{`- "${path}": ${formatDiffValue(prev)}`}</div>
              <div className="text-green-400">{`+ "${path}": ${formatDiffValue(curr)}`}</div>
            </div>
          );
        }
        if (prev !== undefined) {
          return (
            <div key={`removed-${path}`} className="text-red-400">
              {`- "${path}": ${formatDiffValue(prev)}`}
            </div>
          );
        }
        return (
          <div key={`added-${path}`} className="text-green-400">
            {`+ "${path}": ${formatDiffValue(curr)}`}
          </div>
        );
      })}
      <div>{'}'}</div>
    </div>
  );
};

const renderBadgeDiffLines = (badge: RestoreBadge) => {
  const targetFlat = badge.diff.currFlat || {};
  const prevFlat = badge.diff.prevFlat || {};
  const keys = Array.from(new Set([...Object.keys(targetFlat), ...Object.keys(prevFlat)])).sort();
  if (keys.length === 0) {
    return (
      <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto text-xs font-mono">
        <div>{'{'}</div>
        <div>{'}'}</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto text-xs font-mono space-y-1">
      <div>{'{'}</div>
      {keys.map((path) => {
        const curr = targetFlat[path];
        const prev = prevFlat[path];
        return (
          <div key={`badge-${path}`} className="space-y-0.5">
            {prev !== undefined && curr !== undefined && prev !== curr && (
              <div className="text-red-400">{`- "${path}": ${formatDiffValue(prev)}`}</div>
            )}
            {curr !== undefined && (
              <div className="text-green-400">{`  "${path}": ${formatDiffValue(curr)}`}</div>
            )}
            {curr === undefined && prev !== undefined && (
              <div className="text-red-400">{`- "${path}": ${formatDiffValue(prev)}`}</div>
            )}
          </div>
        );
      })}
      <div>{'}'}</div>
    </div>
  );
};

const summarizeChanges = (
  previous: Record<string, unknown>,
  current: Record<string, unknown>
): { summary: string; details: string[] } => {
  const prevFlat = flattenToMap(previous);
  const currFlat = flattenToMap(current);
  const keys = Array.from(new Set([...Object.keys(prevFlat), ...Object.keys(currFlat)])).filter(
    (key) => prevFlat[key] !== currFlat[key]
  );

  if (keys.length === 0) {
    return {
      summary: 'No changes',
      details: ['No differences detected.'],
    };
  }

  const summaryBase = keys.slice(0, 3).join(', ');
  const summary = keys.length > 3 ? `${summaryBase} (+${keys.length - 3} more)` : summaryBase;
  const details = keys.map((key) => {
    const prev = prevFlat[key];
    const curr = currFlat[key];
    if (prev !== undefined && curr !== undefined) {
      return `${key}: ${formatDiffValue(prev)} -> ${formatDiffValue(curr)}`;
    }
    if (prev !== undefined) {
      return `${key}: removed (${formatDiffValue(prev)})`;
    }
    return `${key}: added ${formatDiffValue(curr)}`;
  });

  return { summary, details };
};

interface Connector {
  id: string;
  name: string;
  type: 'source' | 'sink';
  connector_class: string;
  status: string;
  config?: Record<string, any>;
  registry_meta?: Record<string, any> | null;
  registry_version?: number | null;
  last_deployed_version?: number | null;
  pending_update?: boolean;
  has_pending_changes?: boolean;
  pending_config?: Record<string, any>;
}

interface RegistryDiffView {
  prevFlat: Record<string, string>;
  currFlat: Record<string, string>;
}

interface RestoreRow {
  id: string;
  pipelineId: string;
  connectorId: string;
  registryName: string;
  connectorName: string;
  connectorType: 'source' | 'sink';
  connectorClass: string;
  version: number;
  createdAt: string;
  changedSummary: string;
  changedDetails: string[];
  checksum: string;
  config: Record<string, unknown>;
  previousConfig: Record<string, unknown>;
  currentConfig: Record<string, unknown>;
}

interface RestoreBadge {
  id: string;
  pipelineId: string;
  connectorId: string;
  connectorName?: string;
  connectorType: 'source' | 'sink';
  registryName: string;
  connectorClass?: string;
  version: number;
  checksum?: string;
  stagedConfig: Record<string, unknown>;
  diff: RegistryDiffView;
}

interface Pipeline {
  id: string;
  name: string;
  source_type: string;
  destination_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_sync_time?: string;
  events_ingested?: number;
  events_loaded?: number;
  error_count?: number;
  source_config?: Record<string, unknown>;
  destination_config?: Record<string, unknown>;
  source_connector?: Connector;
  sink_connector?: Connector;
  deleted_at?: string | null;
  backup_retention_hours?: number;
  restore_notification_minutes?: number;
  deletion_time?: string;
  time_remaining?: string;
}

interface PipelineListProps {
  onCreatePipeline: () => void;
}

export function PipelineList({ onCreatePipeline }: PipelineListProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isReadOnly } = usePermissions();
  const { logActivity } = useAuth();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  // Fetch alerts for all pipelines (no auto-refresh, only manual refresh)
  // Set refetchInterval to false to disable automatic polling
  const { data: rawAlerts = [] } = useAlerts({ refetchInterval: false });

  // Stabilize alerts array to prevent unnecessary re-renders
  const allAlerts = useMemo(() => rawAlerts, [JSON.stringify(rawAlerts)]);

  // Helper: Check if pipeline has unresolved alerts
  const getPipelineAlertCount = useMemo(() => {
    return (pipelineId: string) => {
      return allAlerts.filter(alert => alert.pipeline_id === pipelineId).length;
    };
  }, [allAlerts]);

  // Helper: Check if pipeline has critical alerts
  const hasCriticalAlert = (pipelineId: string) => {
    return allAlerts.some(alert => alert.pipeline_id === pipelineId && alert.severity === 'critical');
  };

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [diffModal, setDiffModal] = useState<{
    connectorName: string;
    connectorType: 'source' | 'sink';
    registryVersion: number;
    deployedVersion: number | null;
  } | null>(null);
  const [diffData, setDiffData] = useState<RegistryDiffView | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [restoreModal, setRestoreModal] = useState<{ pipeline: Pipeline; rows: RestoreRow[] } | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreDiffModal, setRestoreDiffModal] = useState<{
    row?: RestoreRow;
    diff: RegistryDiffView;
    title: string;
    subtitle: string;
    connectorName: string;
    connectorType?: 'source' | 'sink';
    mode: 'history' | 'badge';
    pipelineId?: string;
    badgeId?: string;
    badge?: RestoreBadge;
  } | null>(null);
  const [restoreBadges, setRestoreBadges] = useState<Record<string, RestoreBadge[]>>({});
  const [stagingAvailable, setStagingAvailable] = useState(true);
  const [scheduleModal, setScheduleModal] = useState<Pipeline | null>(null);
  const [scheduleType, setScheduleType] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState('6h');
  const [customType, setCustomType] = useState<'interval' | 'daily'>('interval');
  const [customHours, setCustomHours] = useState('4');
  const [dailyTimes, setDailyTimes] = useState<string[]>(['00:00']);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    pipelineId: string | null;
    pipelineName: string;
    isAlreadyDeleted: boolean;
    pipelineStatus: string;
  }>({
    isOpen: false,
    pipelineId: null,
    pipelineName: '',
    isAlreadyDeleted: false,
    pipelineStatus: '',
  });
  const [rollbackModal, setRollbackModal] = useState<{
    isOpen: boolean;
    pipelineId: string | null;
    pipelineName: string;
    timeRemaining: string;
    deletionTime: string;
  }>({
    isOpen: false,
    pipelineId: null,
    pipelineName: '',
    timeRemaining: '',
    deletionTime: '',
  });
  const [deployingPipelineId, setDeployingPipelineId] = useState<string | null>(null);
  const [retentionHours, setRetentionHours] = useState<number>(24); // Default 24 hours

  const mapStagedRestoreRow = (row: any): RestoreBadge => ({
    id: row.id,
    pipelineId: row.pipeline_id,
    connectorId: row.connector_id,
    connectorName: row.connector_name || undefined,
    connectorType: row.connector_type,
    registryName: row.registry_name,
    connectorClass: row.connector_class || undefined,
    version: row.version,
    checksum: row.checksum || undefined,
    stagedConfig: row.staged_config || {},
    diff: {
      prevFlat: row.diff?.prevFlat || {},
      currFlat: row.diff?.currFlat || {},
    },
  });

  const upsertRestoreBadge = (badge: RestoreBadge) => {
    setRestoreBadges((prev) => {
      const list = prev[badge.pipelineId] || [];
      const filtered = list.filter((item) => item.connectorId !== badge.connectorId);
      return {
        ...prev,
        [badge.pipelineId]: [...filtered, badge],
      };
    });
  };

  const removeRestoreBadge = (pipelineId: string, badgeId: string) => {
    setRestoreBadges((prev) => {
      const list = prev[pipelineId] || [];
      const updated = list.filter((item) => item.id !== badgeId);
      if (updated.length === 0) {
        const next = { ...prev };
        delete next[pipelineId];
        return next;
      }
      return {
        ...prev,
        [pipelineId]: updated,
      };
    });
  };

  useEffect(() => {
    loadPipelines(true);

    // Auto-refresh connector statuses every 60 seconds
    const intervalId = setInterval(() => {
      loadPipelines();
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showFilterMenu && !target.closest('.filter-menu-container')) {
        setShowFilterMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);

  const loadPipelines = async (showLoadingState = false, isRefresh = false) => {
    if (isRefresh) {
      // Prevent multiple simultaneous refreshes
      if (isRefreshing) return;
      setIsRefreshing(true);
    } else if (showLoadingState) {
      setIsLoading(true);
    }
    try {
      const [pipelinesRes, connectorsRes, stagingRes] = await Promise.all([
        supabase.from('pipelines').select('*').order('created_at', { ascending: false }),
        supabase
          .from('pipeline_connectors')
          .select('id, name, type, connector_class, status, pipeline_id, config, last_deployed_version, has_pending_changes, pending_config'),
        supabase.from('pipeline_restore_staging').select('*'),
      ]);

      if (pipelinesRes.error) {
        showToast('error', 'Failed to load pipelines', pipelinesRes.error.message);
        return;
      }

      if (stagingRes.error) {
        if (stagingRes.error.message?.includes("Could not find the table 'public.pipeline_restore_staging'")) {
          if (stagingAvailable) {
            showToast('warning', 'Run latest migrations to enable staged restores');
          }
          setStagingAvailable(false);
        } else {
          console.warn('Failed to load restore staging:', stagingRes.error.message);
        }
      } else {
        setStagingAvailable(true);
      }

      const connectors = (connectorsRes.data || []).map((conn: any) => {
        const registryMeta = conn.config?.registry_connector ? conn.config : null;
        const registryVersion = registryMeta?.registry_version
          ? Number(registryMeta.registry_version)
          : null;
        const lastDeployed = conn.last_deployed_version ?? null;
        return {
          ...conn,
          registry_meta: registryMeta,
          registry_version: registryVersion,
          last_deployed_version: conn.last_deployed_version ?? null,
          has_pending_changes: conn.has_pending_changes ?? false,
          pending_config: conn.pending_config,
          pending_update:
            registryVersion !== null &&
            ((lastDeployed === null && registryVersion > 0) || lastDeployed !== registryVersion),
        };
      });

      // Fetch real-time connector statuses from Kafka Connect
      let allConnectorStatuses: Record<string, any> = {};
      try {
        const statusResponse = await fetch('http://localhost:5002/api/pipelines/connectors/statuses');
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          allConnectorStatuses = statusData.statuses || {};
        }
      } catch (error) {
        console.warn('Failed to fetch connector statuses from Kafka Connect', error);
      }

      const formattedData = (pipelinesRes.data || []).map((pipeline: any) => {
        const pipelineConnectors = connectors.filter((c: any) => c.pipeline_id === pipeline.id);
        const pipelineStatuses = allConnectorStatuses[pipeline.id] || { source: null, sink: null };

        // Calculate deletion time and time remaining for deleted pipelines
        let deletion_time, time_remaining;
        if (pipeline.deleted_at) {
          const deletedDate = new Date(pipeline.deleted_at);
          const retentionHours = pipeline.backup_retention_hours || 24;
          const deletionDate = new Date(deletedDate.getTime() + retentionHours * 60 * 60 * 1000);
          deletion_time = deletionDate.toISOString();

          const now = new Date();
          const msRemaining = deletionDate.getTime() - now.getTime();

          if (msRemaining <= 0) {
            time_remaining = 'Expired';
          } else {
            const hours = Math.floor(msRemaining / (1000 * 60 * 60));
            const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
            time_remaining = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          }
        }

        return {
          ...pipeline,
          source_connector: {
            ...pipelineConnectors.find((c: any) => c.type === 'source'),
            status: pipelineStatuses.source,
          },
          sink_connector: {
            ...pipelineConnectors.find((c: any) => c.type === 'sink'),
            status: pipelineStatuses.sink,
          },
          events_ingested: Math.floor(Math.random() * 1000000),
          events_loaded: Math.floor(Math.random() * 1000000),
          error_count: pipeline.status === 'error' ? Math.floor(Math.random() * 10) : 0,
          last_sync_time: new Date(Date.now() - Math.random() * 3600000).toISOString(),
          deletion_time,
          time_remaining
        };
      });

      if (!stagingRes.error) {
        const stagedMap: Record<string, RestoreBadge[]> = {};
        (stagingRes.data || []).forEach((row: any) => {
          const badge = mapStagedRestoreRow(row);
          stagedMap[badge.pipelineId] = [...(stagedMap[badge.pipelineId] || []), badge];
        });
        setRestoreBadges(stagedMap);
      }

      // Update pipelines atomically to prevent flickering
      setPipelines((prev) => {
        // If this is the first load, just set the data
        if (prev.length === 0) {
          return formattedData;
        }

        // Otherwise, merge with existing data to maintain object references
        let hasChanges = false;
        const updatedPipelines = formattedData.map((newPipeline: any) => {
          const existingPipeline = prev.find(p => p.id === newPipeline.id);

          if (!existingPipeline) {
            // New pipeline, return as is
            hasChanges = true;
            return newPipeline;
          }

          // Perform deep comparison of key fields to detect meaningful changes
          const sourceStatusChanged = existingPipeline.source_connector?.status !== newPipeline.source_connector?.status;
          const sinkStatusChanged = existingPipeline.sink_connector?.status !== newPipeline.sink_connector?.status;
          const statusChanged = existingPipeline.status !== newPipeline.status;
          const deletedChanged = existingPipeline.deleted_at !== newPipeline.deleted_at;
          const nameChanged = existingPipeline.name !== newPipeline.name;
          const hasPendingChanged =
            existingPipeline.source_connector?.has_pending_changes !== newPipeline.source_connector?.has_pending_changes ||
            existingPipeline.sink_connector?.has_pending_changes !== newPipeline.sink_connector?.has_pending_changes;
          const pendingUpdateChanged =
            existingPipeline.source_connector?.pending_update !== newPipeline.source_connector?.pending_update ||
            existingPipeline.sink_connector?.pending_update !== newPipeline.sink_connector?.pending_update;

          // If nothing meaningful changed, return the exact same reference to prevent re-render
          if (!sourceStatusChanged && !sinkStatusChanged && !statusChanged &&
              !deletedChanged && !nameChanged && !hasPendingChanged && !pendingUpdateChanged) {
            return existingPipeline;
          }

          // Something changed, mark it and return updated pipeline with preserved values
          hasChanges = true;
          return {
            ...newPipeline,
            // Preserve stable values to prevent unnecessary re-renders
            events_ingested: existingPipeline.events_ingested,
            events_loaded: existingPipeline.events_loaded,
            error_count: existingPipeline.error_count,
            last_sync_time: existingPipeline.last_sync_time,
            deletion_time: existingPipeline.deletion_time ?? newPipeline.deletion_time,
            time_remaining: existingPipeline.time_remaining ?? newPipeline.time_remaining,
          };
        });

        // If nothing changed at all, return the previous state to prevent re-render
        return hasChanges ? updatedPipelines : prev;
      });
    } catch (error) {
      showToast('error', 'An error occurred', 'Please try again');
      console.error(error);
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else if (showLoadingState) {
        setIsLoading(false);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-green-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getConnectorStatus = (connector: any): string => {
    const state = connector?.status?.connector?.state;

    if (!state) return 'UNKNOWN';

    switch (state) {
      case 'RUNNING':
        return 'RUNNING';
      case 'PAUSED':
        return 'PAUSED';
      case 'FAILED':
        return 'FAILED';
      default:
        return state;
    }
  };

  const getConnectorStatusColor = (status: string): string => {
    switch (status) {
      case 'RUNNING':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'PAUSED':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const getConnectorStatusIcon = (status: string): string => {
    switch (status) {
      case 'RUNNING':
        return '●';
      case 'PAUSED':
        return '❚❚';
      case 'FAILED':
        return '✕';
      default:
        return '○';
    }
  };

  const getActualPipelineStatus = (pipeline: Pipeline): string => {
    // If no connectors, return database status
    if (!pipeline.source_connector && !pipeline.sink_connector) {
      return pipeline.status;
    }

    // Check connector states from Kafka Connect
    const sourceState = pipeline.source_connector?.status?.connector?.state;
    const sinkState = pipeline.sink_connector?.status?.connector?.state;

    // If either connector is FAILED, pipeline is in error
    if (sourceState === 'FAILED' || sinkState === 'FAILED') {
      return 'error';
    }

    // If either connector is PAUSED, pipeline is paused
    if (sourceState === 'PAUSED' || sinkState === 'PAUSED') {
      return 'paused';
    }

    // If both are RUNNING, pipeline is running
    if (sourceState === 'RUNNING' && sinkState === 'RUNNING') {
      return 'running';
    }

    // Otherwise, use database status
    return pipeline.status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'ready':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const filteredPipelines = useMemo(() => {
    return pipelines.filter((pipeline) => {
      const matchesSearch = pipeline.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pipeline.source_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pipeline.destination_type?.toLowerCase().includes(searchQuery.toLowerCase());

      const isIncomplete = !pipeline.destination_type || !pipeline.source_connector || !pipeline.sink_connector;

      let matchesStatus = true;
      if (statusFilter === 'all') {
        matchesStatus = true;
      } else if (statusFilter === 'draft') {
        matchesStatus = isIncomplete || pipeline.status === 'draft';
      } else {
        matchesStatus = !isIncomplete && pipeline.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      if (sortOrder === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortOrder === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        return a.name.localeCompare(b.name);
      }
    });
  }, [pipelines, searchQuery, statusFilter, sortOrder]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getLastSyncText = (lastSyncTime?: string) => {
    if (!lastSyncTime) return 'Never';
    const now = new Date();
    const sync = new Date(lastSyncTime);
    const diffMinutes = Math.floor((now.getTime() - sync.getTime()) / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffMinutes < 120) return '1 hour ago';
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
    return `${Math.floor(diffMinutes / 1440)} days ago`;
  };

  const canDeployPipeline = (pipeline: Pipeline) => {
    const hasConnectors = Boolean(
      pipeline.source_type &&
      pipeline.destination_type &&
      pipeline.source_connector &&
      pipeline.sink_connector
    );
    return hasConnectors && (pipeline.status === 'draft' || pipeline.status === 'ready');
  };

  const handlePipelineAction = async (
    e: React.MouseEvent,
    pipelineId: string,
    action: 'deploy' | 'start' | 'pause' | 'stop' | 'restart' | 'restore'
  ) => {
    e.stopPropagation();
    setShowMenu(null);

    if (action === 'restore') {
      const pipeline = pipelines.find((p) => p.id === pipelineId);
      if (pipeline) {
        await handleOpenRestore(e, pipeline);
      }
      return;
    }

    if (action === 'deploy') {
      const pipeline = pipelines.find((p) => p.id === pipelineId);
      if (!pipeline) return;
      if (!canDeployPipeline(pipeline)) {
        showToast('error', 'Cannot deploy pipeline', 'Complete source and destination setup first');
        return;
      }

      try {
        setDeployingPipelineId(pipelineId);
        await deployPipeline(pipelineId);
        await logActivity(
          'pipeline.deploy',
          `Deployed pipeline: ${pipeline.name}`,
          'pipeline',
          pipelineId
        );
        showToast('success', 'Pipeline deployed successfully');
        await loadPipelines();
      } catch (error: any) {
        showToast('error', 'Failed to deploy pipeline', error?.message || 'Debezium backend error');
      } finally {
        setDeployingPipelineId(null);
      }
      return;
    }

    const statusMap = {
      start: 'running',
      pause: 'paused',
      stop: 'ready',
      restart: 'running',
    };

    try {
      const pipeline = pipelines.find((p) => p.id === pipelineId);
      if (!pipeline) {
        showToast('error', 'Pipeline not found');
        return;
      }

      // Control Kafka Connect connectors
      const connectorActions: Array<{ name: string; type: 'source' | 'sink' }> = [];

      if (pipeline.source_connector?.name) {
        connectorActions.push({ name: pipeline.source_connector.name, type: 'source' });
      }
      if (pipeline.sink_connector?.name) {
        connectorActions.push({ name: pipeline.sink_connector.name, type: 'sink' });
      }

      // Map actions to Kafka Connect API calls
      const kafkaConnectAction = {
        start: 'resume',
        pause: 'pause',
        stop: 'pause',
        restart: 'restart',
      }[action];

      // Execute action on all connectors
      const errors: string[] = [];
      for (const connector of connectorActions) {
        try {
          const endpoint = kafkaConnectAction === 'resume'
            ? `/api/connectors/${connector.name}/resume`
            : kafkaConnectAction === 'pause'
            ? `/api/connectors/${connector.name}/pause`
            : `/api/connectors/${connector.name}/restart`;

          const response = await fetch(`http://localhost:5002${endpoint}`, {
            method: 'POST'
          });

          const result = await response.json();
          if (!result.success) {
            errors.push(`${connector.type}: ${result.error || 'Unknown error'}`);
          }
        } catch (error: any) {
          errors.push(`${connector.type}: ${error.message || 'Failed to connect'}`);
        }
      }

      // Update database status
      const { error: dbError } = await supabase
        .from('pipelines')
        .update({ status: statusMap[action], updated_at: new Date().toISOString() })
        .eq('id', pipelineId);

      if (dbError) {
        showToast('error', `Failed to update pipeline status`, dbError.message);
        return;
      }

      await logActivity(
        `pipeline.${action}`,
        `${action.charAt(0).toUpperCase() + action.slice(1)} pipeline: ${pipeline.name}`,
        'pipeline',
        pipelineId
      );

      if (errors.length > 0) {
        showToast('warning', `Pipeline ${action}ed with warnings`, errors.join(', '));
      } else {
        showToast('success', `Pipeline ${action}ed successfully`);
      }

      loadPipelines();
    } catch (error: any) {
      showToast('error', 'An error occurred', error.message);
    }
  };

  const handleMarkDeployed = async () => {
    if (!diffModal) return;
    try {
      await markConnectorDeployed(diffModal.connectorName, diffModal.registryVersion);
      showToast('success', 'Connector marked as deployed');
      setDiffModal(null);
      setDiffData(null);
      await loadPipelines();
    } catch (error) {
      showToast('error', 'Failed to mark deployed', error instanceof Error ? error.message : '');
    }
  };

  const renderConnectorMeta = (
    pipeline: Pipeline,
    connectorType: 'source' | 'sink',
    connector?: Connector
  ) => (
    <>
      {connector?.has_pending_changes && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/pipelines/${pipeline.id}?tab=settings&section=${connectorType}`);
          }}
          className={`ml-3 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
            connectorType === 'source'
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'
              : 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
          }`}
        >
          <AlertCircle className="w-3 h-3" />
          {connectorType === 'source' ? 'SRC' : 'SNK'}
        </button>
      )}
      {pipeline.status === 'running' && stagingAvailable && renderRestoreBadge(pipeline, connector)}
    </>
  );

  const renderRestoreBadge = (pipeline: Pipeline, connector?: Connector) => {
    if (!connector) return null;
    const badge = (restoreBadges[pipeline.id] || []).find(
      (item) => item.connectorId === connector.id
    );
    if (!badge) return null;
    const effectiveBadge = badge.connectorName
      ? badge
      : { ...badge, connectorName: connector.name || badge.registryName };
    return (
      <button
        onClick={(e) => handleOpenRestoreBadge(e, effectiveBadge)}
        className="ml-3 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800"
      >
        <RefreshCcw className="w-3 h-3" />
        New Restore
      </button>
    );
  };

  const renderDiffModal = () => {
    if (!diffModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDiffModal(null)}>
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {diffModal.connectorType === 'source' ? 'Source' : 'Destination'} Connector
              </p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {diffModal.connectorName}
              </h3>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {diffModal.deployedVersion !== null
                ? `v${diffModal.deployedVersion} → v${diffModal.registryVersion}`
                : `Baseline not tracked → v${diffModal.registryVersion}`}
            </div>
          </div>
          <div className="p-6 max-h-[50vh] overflow-auto space-y-4">
            {diffLoading && (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                Loading diff…
              </div>
            )}
            {!diffLoading && diffData && (
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto text-xs font-mono space-y-0.5">
                {renderDiffLines(diffData)}
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setDiffModal(null);
                setDiffData(null);
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Close
            </button>
            <button
              disabled={diffLoading}
              onClick={handleMarkDeployed}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Deploy Update
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderRestoreModal = () => {
    if (!restoreModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeRestoreModal}>
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Restore History</p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {restoreModal.pipeline.name}
              </h3>
            </div>
            <button
              onClick={closeRestoreModal}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-auto">
            {restoreLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                Loading versions…
              </div>
            ) : restoreModal.rows.length === 0 ? (
              <div className="text-center text-gray-500">No registry history found for this pipeline.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-500 dark:text-gray-400">
                    <th className="py-2">Date</th>
                    <th>Connector</th>
                    <th>Type</th>
                    <th>Version</th>
                    <th>Changes</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {restoreModal.rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-gray-200 dark:border-gray-800"
                    >
                      <td className="py-2 text-gray-600 dark:text-gray-300">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{row.connectorName}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-300 capitalize">{row.connectorType}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-300">v{row.version}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-300">{row.changedSummary}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleViewRestoreChanges(row)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <AlertCircle className="w-3 h-3" />
                          View Changes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRestoreDiffModal = () => {
    if (!restoreDiffModal) return null;
    const { row, diff, title, subtitle, connectorName, mode, pipelineId, badgeId, badge } = restoreDiffModal;
    const diffView = mode === 'badge' && badge ? renderBadgeDiffLines(badge) : renderDiffLines(diff);

    const changesCount = mode === 'badge' && badge
      ? Object.keys(badge.diff.prevFlat).filter(k => badge.diff.prevFlat[k] !== badge.diff.currFlat[k]).length +
        Object.keys(badge.diff.currFlat).filter(k => !(k in badge.diff.prevFlat)).length
      : Object.keys(diff?.prevFlat || {}).filter(k => diff?.prevFlat[k] !== diff?.currFlat?.[k]).length;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeRestoreDiffModal}>
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{connectorName}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
              {mode === 'badge' && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {changesCount} {changesCount === 1 ? 'change' : 'changes'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Deploying will update connector settings
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={closeRestoreDiffModal}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 max-h-[70vh] overflow-auto space-y-4">{diffView}</div>
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            {mode === 'badge' && pipelineId && badgeId && badge && (
              <button
                onClick={() => handleDismissBadge(pipelineId, badgeId)}
                className="px-4 py-2 rounded-lg text-sm border border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/30"
              >
                Dismiss
              </button>
            )}
            <button
              onClick={closeRestoreDiffModal}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Close
            </button>
            {mode === 'history' && row && (
              <button
                onClick={() => handleApplyRestore(row)}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
              >
                Apply Restore
              </button>
            )}
            {mode === 'badge' && badge && (
              <button
                onClick={() => handleDeployRestoreBadge(badge)}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
              >
                Deploy
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleOpenRestore = async (e: React.MouseEvent, pipeline: Pipeline) => {
    e.stopPropagation();
    setRestoreLoading(true);
    try {
      const rows: RestoreRow[] = [];
      const connectorsList: Connector[] = [pipeline.source_connector, pipeline.sink_connector].filter(
        (c): c is Connector => Boolean(c?.registry_meta?.registry_connector)
      );

      for (const connector of connectorsList) {
        const registryName = connector.registry_meta?.registry_connector as string;
        if (!registryName) continue;
        const history = await getConnectorVersions(registryName);
        const versions = [...(history.versions || [])]
          .sort((a, b) => Number(b.version) - Number(a.version))
          .slice(0, 10);

        let currentConfig: Record<string, unknown> =
          connector.config?.snapshot_config || connector.config || {};
        const runningVersion = connector.last_deployed_version || connector.registry_version;
        if (registryName && runningVersion) {
          try {
            currentConfig = await getActiveConnectorConfig(registryName, runningVersion);
          } catch (err) {
            console.warn('Failed to fetch current connector config', err);
          }
        }

        for (let i = 0; i < versions.length; i += 1) {
          const current = versions[i];
          const previous = versions[i + 1];
          const { summary, details } = summarizeChanges(previous?.config || {}, current.config || {});
          rows.push({
            id: `${registryName}-${current.version}`,
            pipelineId: pipeline.id,
            connectorId: connector.id,
            registryName,
            connectorName: connector.name,
            connectorType: connector.type,
            connectorClass: connector.connector_class,
            version: current.version,
            createdAt: current.created_at,
            changedSummary: summary,
            changedDetails: details,
            checksum: current.checksum,
            config: current.config,
            previousConfig: previous?.config || {},
            currentConfig,
          });
        }
      }

      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRestoreModal({ pipeline, rows: rows.slice(0, 10) });
    } catch (error) {
      showToast('error', 'Failed to load restore history', error instanceof Error ? error.message : '');
    } finally {
      setRestoreLoading(false);
    }
  };

  const closeRestoreModal = () => {
    setRestoreModal(null);
  };

  const handleViewRestoreChanges = (row: RestoreRow) => {
    const prevFlat = flattenToMap(row.previousConfig || {});
    const currFlat = flattenToMap(row.config || {});
    setRestoreDiffModal({
      row,
      title: 'View Changes',
      subtitle: `v${row.version} • ${new Date(row.createdAt).toLocaleString()} • ${row.connectorType}`,
      connectorName: row.connectorName,
      connectorType: row.connectorType,
      diff: {
        prevFlat,
        currFlat,
      },
      mode: 'history',
    });
  };

  const handleOpenRestoreBadge = (
    e: React.MouseEvent,
    badge: RestoreBadge
  ) => {
    e.stopPropagation();
    if (!stagingAvailable) {
      showToast('error', 'Staged restores unavailable. Please run latest migrations.');
      return;
    }
    setRestoreDiffModal({
      title: 'New Restore',
      subtitle: `v${badge.version} • ${badge.connectorType}`,
      connectorName: badge.connectorName || badge.registryName,
      connectorType: badge.connectorType,
      diff: badge.diff,
      mode: 'badge',
      pipelineId: badge.pipelineId,
      badgeId: badge.id,
      badge,
    });
  };

  const closeRestoreDiffModal = () => setRestoreDiffModal(null);

  const handleDeployRestoreBadge = async (badge: RestoreBadge) => {
    if (!stagingAvailable) {
      showToast('error', 'Staged restores unavailable. Please run latest migrations.');
      return;
    }
    try {
      await activateConnectorVersion(badge.registryName, badge.version);

      const updatedConfig = {
        registry_connector: badge.registryName,
        registry_version: badge.version,
        checksum: badge.checksum,
        connector_class: badge.connectorClass,
        snapshot_config: badge.stagedConfig,
      };

      const { error: updateError } = await supabase
        .from('pipeline_connectors')
        .update({
          config: updatedConfig,
          last_deployed_version: badge.version,
        })
        .eq('id', badge.connectorId);

      if (updateError) {
        throw new Error(`Failed to update connector: ${updateError.message}`);
      }

      await supabase.from('pipeline_restore_staging').delete().eq('id', badge.id);
      removeRestoreBadge(badge.pipelineId, badge.id);

      showToast('success', `Connector restored to v${badge.version}. Refreshing details...`);
      closeRestoreDiffModal();
      await loadPipelines();

      window.dispatchEvent(new CustomEvent('pipeline-updated', { detail: { pipelineId: badge.pipelineId } }));
    } catch (error) {
      showToast('error', 'Deploy failed', error instanceof Error ? error.message : '');
    }
  };

  const handleApplyRestore = async (row: RestoreRow) => {
    if (!stagingAvailable) {
      showToast('error', 'Staged restores unavailable. Please run latest migrations.');
      return;
    }
    const currentSnapshot = row.currentConfig || {};
    const targetSnapshot = row.config || {};
    const badgeDiff: RegistryDiffView = {
      prevFlat: flattenToMap(currentSnapshot),
      currFlat: flattenToMap(targetSnapshot),
    };

    try {
      const { data, error } = await supabase
        .from('pipeline_restore_staging')
        .upsert(
          {
            pipeline_id: row.pipelineId,
            connector_id: row.connectorId,
            connector_name: row.connectorName,
            connector_type: row.connectorType,
            connector_class: row.connectorClass,
            registry_name: row.registryName,
            version: row.version,
            checksum: row.checksum,
            staged_config: targetSnapshot,
            diff: badgeDiff,
          },
          { onConflict: 'pipeline_id,connector_id' }
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      const badge = mapStagedRestoreRow(data);
      upsertRestoreBadge(badge);

      closeRestoreDiffModal();
      showToast('info', 'Restore staged. Deploy from pipeline card.');
    } catch (error) {
      showToast('error', 'Failed to stage restore', error instanceof Error ? error.message : '');
    }
  };

  const handleDismissBadge = async (pipelineId: string, badgeId: string) => {
    if (!stagingAvailable) {
      removeRestoreBadge(pipelineId, badgeId);
      closeRestoreDiffModal();
      return;
    }
    try {
      await supabase.from('pipeline_restore_staging').delete().eq('id', badgeId);
    } catch (error) {
      console.warn('Failed to dismiss staged restore:', error);
    }
    removeRestoreBadge(pipelineId, badgeId);
    closeRestoreDiffModal();
  };

  const handleDeletePipeline = async (deleteTopics: boolean, isPermanent: boolean = false, retentionHours: number = 24) => {
    if (!deleteModal.pipelineId) return;

    try {
      // Check if this is a draft pipeline OR already deleted pipeline
      const isDraftPipeline = deleteModal.pipelineStatus === 'draft';
      const isPermanentDelete = deleteModal.isAlreadyDeleted || isDraftPipeline || isPermanent;

      if (isPermanentDelete) {
        // PERMANENT DELETE - zaten silinmiş pipeline VEYA draft pipeline VEYA user selected permanent
        // If deleting topics, call backend endpoint first
        if (deleteTopics) {
          const response = await fetch(`${import.meta.env.VITE_DEBEZIUM_BACKEND_URL}/api/pipelines/${deleteModal.pipelineId}/connectors?deleteTopics=true`, {
            method: 'DELETE'
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            showToast('warning', 'Failed to delete some connectors/topics', result.error || 'Unknown error');
          } else {
            const topicsMsg = result.deletedTopics?.length > 0
              ? ` ${result.deletedTopics.length} topic(s) deleted.`
              : '';
            showToast('info', `Connectors removed.${topicsMsg}`);
          }
        }

        const { error } = await supabase
          .from('pipelines')
          .delete()
          .eq('id', deleteModal.pipelineId);

        if (error) {
          showToast('error', 'Failed to permanently delete pipeline', error.message);
        } else {
          await logActivity(
            'pipeline.permanent_delete',
            `Permanently deleted ${isDraftPipeline ? 'draft ' : ''}pipeline: ${deleteModal.pipelineName}${deleteTopics ? ' (including topics)' : ''}`,
            'pipeline',
            deleteModal.pipelineId
          );
          showToast('success', `${isDraftPipeline ? 'Draft pipeline' : 'Pipeline'} permanently deleted`);
          loadPipelines();
        }
      } else {
        // SOFT DELETE - aktif/deployed pipeline için
        // Delete connectors from Kafka Connect via backend endpoint
        const response = await fetch(`${import.meta.env.VITE_DEBEZIUM_BACKEND_URL}/api/pipelines/${deleteModal.pipelineId}/connectors?deleteTopics=${deleteTopics}`, {
          method: 'DELETE'
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          showToast('error', 'Failed to delete connectors', result.error || 'Unknown error');
          setDeleteModal({ isOpen: false, pipelineId: null, pipelineName: '', isAlreadyDeleted: false, pipelineStatus: '' });
          return;
        }

        // Soft delete from database by setting deleted_at timestamp and retention hours
        const { error } = await supabase
          .from('pipelines')
          .update({
            deleted_at: new Date().toISOString(),
            status: 'deleted',
            backup_retention_hours: retentionHours
          })
          .eq('id', deleteModal.pipelineId);

        if (error) {
          showToast('error', 'Failed to delete pipeline', error.message);
        } else {
          await logActivity(
            'pipeline.delete',
            `Deleted pipeline: ${deleteModal.pipelineName}${deleteTopics ? ' (including topics)' : ''}`,
            'pipeline',
            deleteModal.pipelineId
          );

          // Show appropriate message based on whether there were real errors
          if (result.errors && result.errors.length > 0) {
            showToast('warning', `Pipeline deleted with warnings: ${result.errors.map((e: any) => e.error).join(', ')}`);
          } else {
            const topicsMsg = deleteTopics
              ? ` and ${result.deletedTopics?.length || 0} topic(s)`
              : '';
            showToast('success', `Pipeline marked for deletion. ${result.deletedConnectors?.length || 0} connector(s)${topicsMsg} removed. Restore available for ${retentionHours} hour${retentionHours !== 1 ? 's' : ''}.`);
          }

          // Update pipeline status in local state instead of reloading
          setPipelines(prev => prev.map(p =>
            p.id === deleteModal.pipelineId
              ? { ...p, status: 'deleted', deleted_at: new Date().toISOString() }
              : p
          ));
        }
      }
    } catch (error) {
      showToast('error', 'An error occurred');
    }

    setDeleteModal({ isOpen: false, pipelineId: null, pipelineName: '', isAlreadyDeleted: false, pipelineStatus: '' });
  };

  const handleRestorePipeline = async () => {
    if (!rollbackModal.pipelineId) return;

    try {
      // First, get current restore_count
      const { data: pipelineData, error: fetchError } = await supabase
        .from('pipelines')
        .select('restore_count')
        .eq('id', rollbackModal.pipelineId)
        .single();

      if (fetchError) {
        showToast('error', 'Failed to fetch pipeline data', fetchError.message);
        return;
      }

      const currentRestoreCount = pipelineData?.restore_count || 0;
      const newRestoreCount = currentRestoreCount + 1;

      // Restore pipeline by clearing deleted_at timestamp and incrementing restore_count
      // This will cause the backend to append _rN suffix to database.server.name
      const { error } = await supabase
        .from('pipelines')
        .update({
          deleted_at: null,
          status: 'ready',
          restore_count: newRestoreCount
        })
        .eq('id', rollbackModal.pipelineId);

      if (error) {
        showToast('error', 'Failed to restore pipeline', error.message);
        return;
      }

      // Call backend to redeploy connectors using saved configuration
      try {
        const response = await fetch(`${import.meta.env.VITE_DEBEZIUM_BACKEND_URL}/api/pipelines/${rollbackModal.pipelineId}/restore`, {
          method: 'POST'
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to restore connectors' }));
          throw new Error(errorData.error || 'Failed to restore connectors');
        }

        await logActivity(
          'pipeline.restore',
          `Restored pipeline: ${rollbackModal.pipelineName}`,
          'pipeline',
          rollbackModal.pipelineId
        );

        showToast('success', 'Pipeline restored and connectors are being redeployed');
        loadPipelines();
      } catch (deployError: any) {
        // Rollback if connector deployment fails
        await supabase
          .from('pipelines')
          .update({
            deleted_at: new Date().toISOString(),
            status: 'deleted'
          })
          .eq('id', rollbackModal.pipelineId);

        showToast('error', 'Failed to restore connectors', deployError.message);
      }
    } catch (error) {
      showToast('error', 'An error occurred');
    }

    setRollbackModal({ isOpen: false, pipelineId: null, pipelineName: '', timeRemaining: '', deletionTime: '' });
  };

  const getScheduleText = (pipeline: Pipeline): string => {
    const config = pipeline.schedule_config as any;
    if (!config || !config.type) return 'Ingests every 6 Hours';

    if (config.type === 'preset') {
      const value = config.value || '6h';
      if (value === '30m') return 'Ingests every 30 Minutes';
      if (value === '1h') return 'Ingests every 1 Hour';
      if (value === '2h') return 'Ingests every 2 Hours';
      if (value === '3h') return 'Ingests every 3 Hours';
      if (value === '6h') return 'Ingests every 6 Hours';
      if (value === '8h') return 'Ingests every 8 Hours';
      if (value === '12h') return 'Ingests every 12 Hours';
      if (value === '24h') return 'Ingests every 24 Hours';
    } else if (config.type === 'interval') {
      const hours = config.hours || 4;
      return `Ingests every ${hours} Hour${hours > 1 ? 's' : ''}`;
    } else if (config.type === 'daily') {
      const times = config.times || ['00:00'];
      if (times.length === 1) return `Ingests daily at ${times[0]}`;
      return `Ingests daily (${times.length} times)`;
    }

    return 'Ingests every 6 Hours';
  };

  useEffect(() => {
    if (scheduleModal) {
      const currentSchedule = scheduleModal.schedule_config as any;
      if (currentSchedule) {
        if (currentSchedule.type === 'preset') {
          setScheduleType('preset');
          setSelectedPreset(currentSchedule.value || '6h');
        } else if (currentSchedule.type === 'interval') {
          setScheduleType('custom');
          setCustomType('interval');
          setCustomHours(String(currentSchedule.hours || 4));
        } else if (currentSchedule.type === 'daily') {
          setScheduleType('custom');
          setCustomType('daily');
          setDailyTimes(currentSchedule.times || ['00:00']);
        }
      } else {
        setScheduleType('preset');
        setSelectedPreset('6h');
        setCustomType('interval');
        setCustomHours('4');
        setDailyTimes(['00:00']);
      }
    }
  }, [scheduleModal]);

  const renderScheduleModal = () => {
    if (!scheduleModal) return null;

    const presets = ['30m', '1h', '2h', '3h', '6h', '8h', '12h', '24h'];

    const handleUpdate = async () => {
      let config: any;

      if (scheduleType === 'preset') {
        config = { type: 'preset', value: selectedPreset };
      } else if (customType === 'interval') {
        const hours = parseInt(customHours);
        if (isNaN(hours) || hours < 1 || hours > 48) {
          showToast('error', 'Invalid interval', 'Hours must be between 1 and 48');
          return;
        }
        config = { type: 'interval', hours };
      } else {
        config = { type: 'daily', times: dailyTimes };
      }

      try {
        const { error } = await supabase
          .from('pipelines')
          .update({ schedule_config: config })
          .eq('id', scheduleModal.id);

        if (error) throw error;

        await logActivity(
          'pipeline.schedule_update',
          `Updated ingestion schedule for pipeline: ${scheduleModal.name}`,
          'pipeline',
          scheduleModal.id,
          { schedule_config: config }
        );

        showToast('success', 'Schedule updated successfully');
        setScheduleModal(null);
        await loadPipelines();
      } catch (error) {
        showToast('error', 'Failed to update schedule', error instanceof Error ? error.message : '');
      }
    };

    const getScheduleDescription = () => {
      if (scheduleType === 'preset') {
        const value = selectedPreset;
        if (value === '30m') return 'every 30 Minutes';
        if (value === '1h') return 'every 1 Hour';
        if (value === '2h') return 'every 2 Hours';
        if (value === '3h') return 'every 3 Hours';
        if (value === '6h') return 'every 6 Hours';
        if (value === '8h') return 'every 8 Hours';
        if (value === '12h') return 'every 12 Hours';
        if (value === '24h') return 'every 24 Hours';
      } else if (customType === 'interval') {
        const hours = parseInt(customHours);
        return `every ${hours} Hour${hours > 1 ? 's' : ''}`;
      } else {
        return `at ${dailyTimes.join(', ')} daily`;
      }
      return '';
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setScheduleModal(null)}>
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Change the Pipeline Ingestion Schedule
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Define the frequency or time(s) at which the Pipeline must ingest the data from the Source.
              </p>
            </div>
            <button
              onClick={() => setScheduleModal(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[60vh] overflow-auto">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Scheduled</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                This ingestion schedule applies to all the objects in the Pipeline.
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setScheduleType('preset');
                      setSelectedPreset(preset);
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      scheduleType === 'preset' && selectedPreset === preset
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {preset === '30m' ? '30 Mins' : preset === '1h' ? '1 Hr' : preset.replace('h', ' Hrs')}
                  </button>
                ))}
                <button
                  onClick={() => setScheduleType('custom')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    scheduleType === 'custom'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Custom
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 pb-4">
                  <button
                    onClick={() => {
                      setCustomType('interval');
                      if (scheduleType !== 'custom') {
                        setScheduleType('custom');
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                      customType === 'interval'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      customType === 'interval' ? 'border-blue-600' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {customType === 'interval' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                    </div>
                    Run at fixed interval
                  </button>
                  <button
                    onClick={() => {
                      setCustomType('daily');
                      setScheduleType('custom');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                      customType === 'daily'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      customType === 'daily' ? 'border-blue-600' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {customType === 'daily' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                    </div>
                    Run daily
                  </button>
                </div>

                {scheduleType === 'custom' && (
                  <div>
                    {customType === 'interval' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Hours *
                      </label>
                      <input
                        id="custom-hours-input"
                        name="customHours"
                        type="number"
                        min="1"
                        max="48"
                        value={customHours}
                        onChange={(e) => setCustomHours(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Minimum 1 hr and Maximum 48 hrs
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select time(s)
                      </label>
                      <div className="space-y-2">
                        {dailyTimes.map((time, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              id={`daily-time-${index}`}
                              name={`dailyTime${index}`}
                              type="time"
                              value={time}
                              onChange={(e) => {
                                const newTimes = [...dailyTimes];
                                newTimes[index] = e.target.value;
                                setDailyTimes(newTimes);
                              }}
                              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            {dailyTimes.length > 1 && (
                              <button
                                onClick={() => setDailyTimes(dailyTimes.filter((_, i) => i !== index))}
                                className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {dailyTimes.length < 24 && (
                        <button
                          onClick={() => setDailyTimes([...dailyTimes, '00:00'])}
                          className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          + ADD MORE
                        </button>
                      )}
                    </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                DataTravel will ingest your data <span className="font-semibold">{getScheduleDescription()}</span>
              </p>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            <button
              onClick={() => setScheduleModal(null)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              CANCEL
            </button>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              UPDATE
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-12 border border-blue-200 dark:border-blue-800">
          <div className="text-center space-y-6">
            <div className="flex justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Database className="w-12 h-12 text-white" />
                </div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">SOURCE</p>
              </div>

              <div className="flex items-center">
                <ArrowRight className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>

              <div className="text-center">
                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Database className="w-12 h-12 text-white" />
                </div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">DESTINATION</p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                Move your data from any Source to Destination in Near Real-Time
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Get data in your Destinations in near real-time, easily manage schema drift with Auto
                Mapping, apply transformations and track progress.
              </p>
            </div>

            <button
              onClick={onCreatePipeline}
              disabled={isReadOnly}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title={isReadOnly ? 'Read-only users cannot create pipelines' : ''}
            >
              {isReadOnly && <Lock className="w-4 h-4" />}
              <Plus className="w-5 h-5" />
              Create Pipeline
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            id="pipeline-search"
            name="pipelineSearch"
            type="text"
            placeholder="Search Pipelines"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 border-l border-gray-300 dark:border-gray-600 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="relative filter-menu-container">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <Filter className="w-4 h-4" />
              FILTERS
              {statusFilter !== 'all' && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">1</span>
              )}
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50">
                <div className="p-3">
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Status</div>
                  <div className="space-y-1">
                    {['all', 'running', 'paused', 'error', 'ready', 'draft'].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status);
                          setShowFilterMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          statusFilter === status
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <select
            id="sort-order"
            name="sortOrder"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name (A-Z)</option>
          </select>

          <button
            onClick={onCreatePipeline}
            disabled={isReadOnly}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={isReadOnly ? 'Read-only users cannot create pipelines' : ''}
          >
            {isReadOnly && <Lock className="w-4 h-4" />}
            <Plus className="w-5 h-5" />
            CREATE PIPELINE
          </button>
        </div>
      </div>

      {filteredPipelines.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No pipelines found matching your filters</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPipelines.map((pipeline) => {
            const readyForDeploy = canDeployPipeline(pipeline);
            const isDeployState = readyForDeploy || pipeline.status === 'draft';
            return (
            <div
              key={pipeline.id}
              onClick={() => {
                if (pipeline.status === 'draft' && !pipeline.source_connector) {
                  navigate(`/pipelines/new/source-config?resume=${pipeline.id}`);
                } else {
                  navigate(`/pipelines/${pipeline.id}`);
                }
              }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 mb-1">
                    {pipeline.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Created {formatDate(pipeline.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Blinking Alarm Bell - Shows when pipeline has unresolved alerts */}
                  {getPipelineAlertCount(pipeline.id) > 0 && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/pipelines/${pipeline.id}?tab=logs`);
                        }}
                        className="p-1 rounded transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 relative"
                        title={`${getPipelineAlertCount(pipeline.id)} unresolved alert(s)`}
                      >
                        <BellRing className={`w-5 h-5 ${
                          hasCriticalAlert(pipeline.id)
                            ? 'text-red-600 dark:text-red-400 animate-pulse'
                            : 'text-yellow-600 dark:text-yellow-400 animate-pulse'
                        }`} />
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {getPipelineAlertCount(pipeline.id)}
                        </span>
                      </button>
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      if (pipeline.status === 'draft') {
                        e.stopPropagation();
                        return;
                      }
                      e.stopPropagation();

                      // Check if pipeline has alerts
                      const alertCount = getPipelineAlertCount(pipeline.id);
                      if (alertCount === 0) {
                        showToast('info', 'No alerts for this pipeline');
                        return;
                      }

                      navigate(`/pipelines/${pipeline.id}?tab=monitoring`);
                    }}
                    className={`p-1 rounded transition-colors ${
                      pipeline.status === 'draft'
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    }`}
                    title={pipeline.status === 'draft' ? 'Alert settings available after starting pipeline' : 'View Alert Settings'}
                    disabled={pipeline.status === 'draft'}
                  >
                    <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadPipelines(false, true);
                    }}
                    className="p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Refresh pipeline"
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  {readyForDeploy && (
                    <button
                      onClick={(e) => handlePipelineAction(e, pipeline.id, 'deploy')}
                      className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={deployingPipelineId === pipeline.id}
                    >
                      <Rocket className="w-4 h-4" />
                      {deployingPipelineId === pipeline.id ? 'Deploying…' : 'Deploy'}
                    </button>
                  )}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(showMenu === pipeline.id ? null : pipeline.id);
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-400" />
                    </button>
                    {showMenu === pipeline.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(null)} />
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                        {pipeline.deleted_at ? (
                          // Silinen pipeline için SADECE Restore ve Delete Permanent
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowMenu(null);
                                setRollbackModal({
                                  isOpen: true,
                                  pipelineId: pipeline.id,
                                  pipelineName: pipeline.name,
                                  timeRemaining: pipeline.time_remaining || '',
                                  deletionTime: pipeline.deletion_time || '',
                                });
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Restore Pipeline
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowMenu(null);
                                setDeleteModal({
                                  isOpen: true,
                                  pipelineId: pipeline.id,
                                  pipelineName: pipeline.name,
                                  isAlreadyDeleted: true,
                                  pipelineStatus: pipeline.status,
                                });
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Permanent
                            </button>
                          </>
                        ) : (
                          // Aktif pipeline için normal menü
                          <>
                            {isDeployState ? (
                              readyForDeploy ? (
                                <button
                                  onClick={(e) => handlePipelineAction(e, pipeline.id, 'deploy')}
                                  className="w-full px-4 py-2 text-left text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                                  disabled={deployingPipelineId === pipeline.id}
                                >
                                  <Rocket className="w-4 h-4" />
                                  {deployingPipelineId === pipeline.id ? 'Deploying…' : 'Deploy Pipeline'}
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(null);
                                    if (!pipeline.source_type) {
                                      navigate(`/pipelines/new/source-config?resume=${pipeline.id}`);
                                    } else if (!pipeline.destination_type) {
                                      navigate(`/wizard/${pipeline.id}/destination`);
                                    } else {
                                      navigate(`/wizard/${pipeline.id}/destination`);
                                    }
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                >
                                  <Settings className="w-4 h-4" />
                                  Complete Setup
                                </button>
                              )
                            ) : (
                              <>
                                {getActualPipelineStatus(pipeline) !== 'running' && (
                                  <button
                                    onClick={(e) => handlePipelineAction(e, pipeline.id, 'start')}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                  >
                                    <Play className="w-4 h-4" />
                                    {getActualPipelineStatus(pipeline) === 'paused' ? 'Resume' : 'Start'}
                                  </button>
                                )}
                                {getActualPipelineStatus(pipeline) === 'running' && (
                                  <button
                                    onClick={(e) => handlePipelineAction(e, pipeline.id, 'pause')}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                  >
                                    <Pause className="w-4 h-4" />
                                    Pause
                                  </button>
                                )}
                                <button
                                  onClick={(e) => handlePipelineAction(e, pipeline.id, 'restart')}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                >
                                  <RotateCw className="w-4 h-4" />
                                  Restart
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(null);
                                    setScheduleModal(pipeline);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                >
                                  <Calendar className="w-4 h-4" />
                                  Change Schedule
                                </button>
                              </>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowMenu(null);
                                setDeleteModal({
                                  isOpen: true,
                                  pipelineId: pipeline.id,
                                  pipelineName: pipeline.name,
                                  isAlreadyDeleted: false,
                                  pipelineStatus: pipeline.status,
                                });
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              Delete Pipeline
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {(pipeline.status === 'draft' || pipeline.status === 'ready') && (
                  readyForDeploy ? (
                    <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Rocket className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-900 dark:text-blue-100">
                          <span className="font-medium">Ready to deploy.</span> Review your selections and click Deploy to push both connectors to Kafka Connect.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs">
                          <span className="font-medium text-amber-900 dark:text-amber-100">Setup incomplete: </span>
                          <span className="text-amber-700 dark:text-amber-300">
                            {!pipeline.source_type && 'Configure source'}
                            {pipeline.source_type && !pipeline.destination_type && 'Configure destination'}
                            {pipeline.source_type && pipeline.destination_type && !pipeline.sink_connector && 'Complete destination setup'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                )}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Source</div>
                    <div className="flex items-center gap-3">
                      <DatabaseLogoIcon
                        connectorClass={pipeline.source_connector?.connector_class}
                        sourceType={pipeline.source_type}
                        className="w-12 h-12 flex-shrink-0"
                      />
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {pipeline.source_connector?.name || pipeline.source_type || 'Not configured'}
                        </span>
                        {pipeline.source_connector && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getConnectorStatusColor(getConnectorStatus(pipeline.source_connector))}`}>
                            <span>{getConnectorStatusIcon(getConnectorStatus(pipeline.source_connector))}</span>
                            <span>{getConnectorStatus(pipeline.source_connector)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-4" />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Destination</div>
                    <div className="flex items-center gap-3">
                      <DatabaseLogoIcon
                        connectorClass={pipeline.sink_connector?.connector_class}
                        sourceType={pipeline.destination_type}
                        className="w-12 h-12 flex-shrink-0"
                      />
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {pipeline.sink_connector?.name || pipeline.destination_type || 'Not configured'}
                        </span>
                        {pipeline.sink_connector && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getConnectorStatusColor(getConnectorStatus(pipeline.sink_connector))}`}>
                            <span>{getConnectorStatusIcon(getConnectorStatus(pipeline.sink_connector))}</span>
                            <span>{getConnectorStatus(pipeline.sink_connector)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(getActualPipelineStatus(pipeline))}`}>
                  {getStatusIcon(getActualPipelineStatus(pipeline))}
                  {getActualPipelineStatus(pipeline)}
                </span>
                <div className="flex items-center gap-2">
                  {renderConnectorMeta(pipeline, 'source', pipeline.source_connector)}
                  {renderConnectorMeta(pipeline, 'sink', pipeline.sink_connector)}
                </div>
              </div>
            </div>
          );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPipelines.map((pipeline, index) => {
            const readyForDeploy = canDeployPipeline(pipeline);
            const isDeployState = readyForDeploy || pipeline.status === 'draft';
            return (
              <div
              key={pipeline.id}
              onClick={() => {
                // Silinen pipelinelar tıklanamaz
                if (pipeline.deleted_at) return;

                if (pipeline.status === 'draft' && !pipeline.source_connector) {
                  navigate(`/pipelines/new/source-config?resume=${pipeline.id}`);
                } else {
                  navigate(`/pipelines/${pipeline.id}`);
                }
              }}
              className={`bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-5 transition-all ${
                pipeline.deleted_at
                  ? 'opacity-60 cursor-not-allowed'
                  : 'hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md cursor-pointer'
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">#{filteredPipelines.length - index}</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {pipeline.name}
                  </span>
                  {pipeline.deleted_at && pipeline.time_remaining && (
                    <div className="ml-3 flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md">
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                        Deleted - {pipeline.time_remaining} remaining
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();

                    // Check if pipeline has alerts
                    const alertCount = getPipelineAlertCount(pipeline.id);
                    if (alertCount === 0) {
                      showToast('info', 'No alerts for this pipeline');
                      return;
                    }

                    navigate(`/pipelines/${pipeline.id}?tab=monitoring`);
                  }}
                  className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                  title="View Alert Settings"
                >
                  <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    loadPipelines(false, true);
                  }}
                  className="p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Refresh pipeline"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                {readyForDeploy && (
                  <button
                    onClick={(e) => handlePipelineAction(e, pipeline.id, 'deploy')}
                    className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={deployingPipelineId === pipeline.id}
                  >
                    <Rocket className="w-4 h-4" />
                    {deployingPipelineId === pipeline.id ? 'Deploying…' : 'Deploy'}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <DatabaseLogoIcon
                      connectorClass={pipeline.source_connector?.connector_class}
                      sourceType={pipeline.source_type}
                      className="w-12 h-12 flex-shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                        {pipeline.source_connector?.name || 'Source'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {pipeline.source_type} • {getScheduleText(pipeline)}
                        </span>
                        {pipeline.source_connector && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getConnectorStatusColor(getConnectorStatus(pipeline.source_connector))}`}>
                            <span>{getConnectorStatusIcon(getConnectorStatus(pipeline.source_connector))}</span>
                            <span>SRC: {getConnectorStatus(pipeline.source_connector)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {renderConnectorMeta(pipeline, 'source', pipeline.source_connector)}
                  </div>

                  <div className="flex items-center justify-center px-4 flex-shrink-0">
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400"></div>
                      <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400"></div>
                      <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400"></div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 mx-2" />
                  </div>

                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <DatabaseLogoIcon
                      connectorClass={pipeline.sink_connector?.connector_class}
                      sourceType={pipeline.destination_type}
                      className="w-12 h-12 flex-shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                        {pipeline.sink_connector?.name || pipeline.destination_type || 'Destination'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {pipeline.destination_type}
                        </span>
                        {pipeline.sink_connector && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getConnectorStatusColor(getConnectorStatus(pipeline.sink_connector))}`}>
                            <span>{getConnectorStatusIcon(getConnectorStatus(pipeline.sink_connector))}</span>
                            <span>SINK: {getConnectorStatus(pipeline.sink_connector)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {renderConnectorMeta(pipeline, 'sink', pipeline.sink_connector)}
                  </div>
                </div>

                <div className="flex items-center gap-4 ml-6 flex-shrink-0">
                  {(getActualPipelineStatus(pipeline) === 'running' || getActualPipelineStatus(pipeline) === 'paused' || getActualPipelineStatus(pipeline) === 'error' || getActualPipelineStatus(pipeline) === 'draft' || getActualPipelineStatus(pipeline) === 'ready') && (
                    <span className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                      getActualPipelineStatus(pipeline) === 'running'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : getActualPipelineStatus(pipeline) === 'paused'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        : getActualPipelineStatus(pipeline) === 'error'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {getActualPipelineStatus(pipeline)}
                    </span>
                  )}
                  {/* Blinking Alarm Bell - List View */}
                  {getPipelineAlertCount(pipeline.id) > 0 && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/pipelines/${pipeline.id}?tab=logs`);
                        }}
                        className="p-2 rounded-full transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 relative"
                        title={`${getPipelineAlertCount(pipeline.id)} unresolved alert(s)`}
                      >
                        <BellRing className={`w-5 h-5 ${
                          hasCriticalAlert(pipeline.id)
                            ? 'text-red-600 dark:text-red-400 animate-pulse'
                            : 'text-yellow-600 dark:text-yellow-400 animate-pulse'
                        }`} />
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {getPipelineAlertCount(pipeline.id)}
                        </span>
                      </button>
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/pipelines/${pipeline.id}`);
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    title="View Details"
                  >
                    <div className="w-5 h-5 rounded-full border-2 border-gray-400 dark:border-gray-500 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-500">i</span>
                    </div>
                  </button>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(showMenu === pipeline.id ? null : pipeline.id);
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-400" />
                    </button>
                    {showMenu === pipeline.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(null)} />
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                          {pipeline.deleted_at ? (
                            // Silinen pipeline için SADECE Restore ve Delete Permanent
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMenu(null);
                                  setRollbackModal({
                                    isOpen: true,
                                    pipelineId: pipeline.id,
                                    pipelineName: pipeline.name,
                                    timeRemaining: pipeline.time_remaining || '',
                                    deletionTime: pipeline.deletion_time || '',
                                  });
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Restore Pipeline
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMenu(null);
                                  setDeleteModal({
                                    isOpen: true,
                                    pipelineId: pipeline.id,
                                    pipelineName: pipeline.name,
                                    isAlreadyDeleted: true,
                                    pipelineStatus: pipeline.status,
                                  });
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Permanent
                              </button>
                            </>
                          ) : (
                            // Aktif pipeline için normal menü
                            <>
                              {isDeployState ? (
                                readyForDeploy ? (
                                  <button
                                    onClick={(e) => handlePipelineAction(e, pipeline.id, 'deploy')}
                                    className="w-full px-4 py-2 text-left text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2"
                                    disabled={deployingPipelineId === pipeline.id}
                                  >
                                    <Rocket className="w-4 h-4" />
                                    {deployingPipelineId === pipeline.id ? 'Deploying…' : 'Deploy Pipeline'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowMenu(null);
                                      if (!pipeline.source_type) {
                                        navigate(`/pipelines/new/source-config?resume=${pipeline.id}`);
                                      } else if (!pipeline.destination_type) {
                                        navigate(`/wizard/${pipeline.id}/destination`);
                                      } else {
                                        navigate(`/wizard/${pipeline.id}/destination`);
                                      }
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                  >
                                    <Settings className="w-4 h-4" />
                                    Complete Setup
                                  </button>
                                )
                              ) : (
                                <>
                                  {getActualPipelineStatus(pipeline) !== 'running' && (
                                    <button
                                      onClick={(e) => handlePipelineAction(e, pipeline.id, 'start')}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    >
                                      <Play className="w-4 h-4" />
                                      {getActualPipelineStatus(pipeline) === 'paused' ? 'Resume' : 'Start'}
                                    </button>
                                  )}
                                  {getActualPipelineStatus(pipeline) === 'running' && (
                                    <button
                                      onClick={(e) => handlePipelineAction(e, pipeline.id, 'pause')}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    >
                                      <Pause className="w-4 h-4" />
                                      Pause
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => handlePipelineAction(e, pipeline.id, 'restart')}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                  >
                                    <RotateCw className="w-4 h-4" />
                                    Restart
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowMenu(null);
                                      setScheduleModal(pipeline);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                  >
                                    <Calendar className="w-4 h-4" />
                                    Change Schedule
                                  </button>
                                </>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMenu(null);
                                  setDeleteModal({
                                    isOpen: true,
                                    pipelineId: pipeline.id,
                                    pipelineName: pipeline.name,
                                    isAlreadyDeleted: false,
                                    pipelineStatus: pipeline.status,
                                  });
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                              >
                                <XCircle className="w-4 h-4" />
                                Delete Pipeline
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
    {renderDiffModal()}
    {renderRestoreModal()}
    {renderRestoreDiffModal()}
    {renderScheduleModal()}
    <DeleteConfirmModal
      isOpen={deleteModal.isOpen}
      onClose={() => setDeleteModal({ isOpen: false, pipelineId: null, pipelineName: '', isAlreadyDeleted: false, pipelineStatus: '' })}
      onConfirm={handleDeletePipeline}
      title={
        deleteModal.pipelineStatus === 'draft'
          ? "Delete Draft Pipeline?"
          : deleteModal.isAlreadyDeleted
            ? "Permanently Delete Pipeline?"
            : "Delete Pipeline"
      }
      message={
        deleteModal.pipelineStatus === 'draft'
          ? "This draft pipeline will be permanently deleted. This action CANNOT be undone."
          : deleteModal.isAlreadyDeleted
            ? "This action CANNOT be undone. The pipeline and all its data will be permanently deleted from the database. There will be NO WAY to recover it."
            : "Choose how you want to delete this pipeline. You can keep it for restore or permanently remove it."
      }
      pipelineId={deleteModal.pipelineId || undefined}
      showTopicsOption={deleteModal.isAlreadyDeleted || deleteModal.pipelineStatus === 'draft'}
      showDeleteTypeOption={!deleteModal.isAlreadyDeleted && deleteModal.pipelineStatus !== 'draft'}
      pipelineStatus={deleteModal.pipelineStatus}
    />
    <RollbackConsoleModal
      isOpen={rollbackModal.isOpen}
      onClose={() => setRollbackModal({ isOpen: false, pipelineId: null, pipelineName: '', timeRemaining: '', deletionTime: '' })}
      onConfirm={handleRestorePipeline}
      pipelineName={rollbackModal.pipelineName}
      pipelineId={rollbackModal.pipelineId || ''}
      timeRemaining={rollbackModal.timeRemaining}
      deletionTime={rollbackModal.deletionTime}
    />
    </>
  );
}
