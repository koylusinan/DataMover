import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Trash2, Settings, FileText, Database, TrendingUp, MoreVertical, Square, RotateCw, CheckCircle, ChevronRight, X, Info, Settings2, Calendar, Clock, Search, Download, Filter, BellRing } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { deployPipeline, deletePipelineConnectors, getPipelineStatus } from '../lib/debezium';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Tag } from '../components/ui/Tag';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { ObjectsTab } from '../components/pipeline-detail/ObjectsTab';
import { MonitoringTab } from '../components/pipeline-detail/MonitoringTab';
import { LogsTab } from '../components/pipeline-detail/LogsTab';
import { SettingsTab } from '../components/pipeline-detail/SettingsTab';
import { PipelineProgress as PipelineProgressComponent } from '../components/pipeline-detail/PipelineProgress';
import { PipelineActivity as PipelineActivityComponent, type RefreshInterval } from '../components/pipeline-detail/PipelineActivity';
import { usePipelineHealthCheck } from '../hooks/usePipelineHealthCheck';
import { usePipelineProgress } from '../hooks/usePipelineProgress';
import { useConnectorStatuses } from '../hooks/useConnectorStatuses';
import { usePipelineData } from '../hooks/usePipelineData';
import { usePipelineAlerts } from '../hooks/useAlerts';

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
  resolved_config?: Record<string, unknown>;
  registry_meta?: RegistryMetadata | null;
  last_deployed_version?: number | null;
  has_pending_changes?: boolean;
  pending_config?: Record<string, unknown>;
}

interface Pipeline {
  id: string;
  name: string;
  source_type: string;
  destination_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  source_config?: Record<string, unknown>;
  destination_config?: Record<string, unknown>;
  schedule_config?: Record<string, unknown>;
  source_connector?: Connector;
  sink_connector?: Connector;
}

type TabType = 'objects' | 'monitoring' | 'logs' | 'settings';

const REFRESH_INTERVALS: { value: RefreshInterval; label: string }[] = [
  { value: 1000, label: '1s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '1m' },
  { value: 300000, label: '5m' },
  { value: 600000, label: '10m' },
  { value: 900000, label: '15m' },
  { value: 1800000, label: '30m' },
];

export function PipelineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { logActivity } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('objects');
  const [activeLogsView, setActiveLogsView] = useState<'dlq' | 'timeline' | 'alerts'>('timeline');
  const [logsSearchQuery, setLogsSearchQuery] = useState('');
  const [logsSeverityFilter, setLogsSeverityFilter] = useState<string>('all');
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleType, setScheduleType] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState('6h');
  const [customType, setCustomType] = useState<'interval' | 'daily'>('interval');
  const [customHours, setCustomHours] = useState('4');
  const [dailyTimes, setDailyTimes] = useState<string[]>(['00:00']);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(60000); // Default: 1 minute
  const [monitoringRefreshTrigger, setMonitoringRefreshTrigger] = useState(0);
  const [showNotification, setShowNotification] = useState(true);

  // React Query hook for pipeline data - smooth loading with cache
  const { data: pipeline, isLoading, error: pipelineError, refetch: refetchPipeline, updatePipelineStatus } = usePipelineData({
    pipelineId: id || '',
    enabled: !!id,
  });

  // React Query hook for pipeline progress - polls in background smoothly
  const { data: pipelineProgress = {}, isLoading: isProgressLoading, refetch: refetchProgress } = usePipelineProgress({
    pipelineId: id || '',
    enabled: pipeline?.status === 'running' || pipeline?.status === 'paused',
    refetchInterval: refreshInterval,
  });

  // React Query hook for connector statuses - polls in background smoothly
  const { data: connectorStatuses = { source: null, sink: null }, refetch: refetchConnectorStatuses } = useConnectorStatuses({
    pipelineId: id || '',
    enabled: !!pipeline,
    refetchInterval: refreshInterval,
  });

  // React Query hook for pipeline alerts - polls every 10 seconds
  const { data: pipelineAlerts = [] } = usePipelineAlerts(id || '', { refetchInterval: 10000 });

  usePipelineHealthCheck({
    pipelineId: id || '',
    enabled: pipeline?.status === 'running',
    interval: refreshInterval, // Use dynamic refresh interval from user selection
    onStatusChange: (newStatus) => {
      showToast('warning', 'Pipeline status changed', `Pipeline is now ${newStatus}`);
      refetchPipeline();
    },
    onError: (error) => {
      console.error('Health check error:', error);
    },
  });

  // Aggressive refetch handler for ObjectsTab connector actions
  const handleObjectsTabStatusChange = useCallback(async () => {
    const rapidRefetch = async () => {
      await refetchConnectorStatuses();
      await refetchProgress();
    };

    // Immediate refetch
    await rapidRefetch();

    // Then refetch 3 more times with 1-second intervals to catch Kafka Connect updates
    setTimeout(() => rapidRefetch(), 1000);
    setTimeout(() => rapidRefetch(), 2000);
    setTimeout(() => rapidRefetch(), 3000);
  }, [refetchConnectorStatuses, refetchProgress]);

  useEffect(() => {
    if (pipeline && showScheduleModal) {
      const currentSchedule = pipeline.schedule_config as any;
      if (currentSchedule) {
        if (currentSchedule.type === 'interval') {
          const hours = currentSchedule.hours || 4;
          const presetValues: Record<number, string> = {
            0.083: '5m',
            0.25: '15m',
            0.5: '30m',
            1: '1h',
            2: '2h',
            3: '3h',
            6: '6h',
            8: '8h',
            12: '12h',
            24: '24h'
          };

          if (presetValues[hours]) {
            setScheduleType('preset');
            setSelectedPreset(presetValues[hours]);
          } else {
            setScheduleType('custom');
            setCustomType('interval');
            setCustomHours(String(hours));
          }
        } else if (currentSchedule.type === 'daily') {
          setScheduleType('custom');
          setCustomType('daily');
          setDailyTimes(currentSchedule.times || ['00:00']);
        }
      } else {
        setScheduleType('preset');
        setSelectedPreset('1h');
        setCustomType('interval');
        setCustomHours('4');
        setDailyTimes(['00:00']);
      }
    }
  }, [pipeline, showScheduleModal]);

  useEffect(() => {
    const handlePipelineUpdate = (event: CustomEvent) => {
      if (event.detail?.pipelineId === id) {
        refetchPipeline();
      }
    };

    window.addEventListener('pipeline-updated', handlePipelineUpdate as EventListener);
    return () => {
      window.removeEventListener('pipeline-updated', handlePipelineUpdate as EventListener);
    };
  }, [id, refetchPipeline]);

  // Handle pipeline errors
  useEffect(() => {
    if (pipelineError) {
      showToast('error', 'Failed to load pipeline');
      navigate('/pipelines');
    }
  }, [pipelineError, navigate, showToast]);

  const handleStartPipeline = async () => {
    if (!pipeline) return;

    try {
      // Optimistic update - instantly update UI without reload
      updatePipelineStatus('running');

      showToast('info', 'Resuming pipeline connectors...');

      const errors: string[] = [];
      const connectorsToResume: Array<{ name: string; type: 'source' | 'sink' }> = [];

      if (pipeline.source_connector?.name) {
        connectorsToResume.push({ name: pipeline.source_connector.name, type: 'source' });
      }
      if (pipeline.sink_connector?.name) {
        connectorsToResume.push({ name: pipeline.sink_connector.name, type: 'sink' });
      }

      // Resume connectors IN PARALLEL for instant response
      const resumePromises = connectorsToResume.map(async (connector) => {
        try {
          const response = await fetch(`http://localhost:5002/api/connectors/${connector.name}/resume`, {
            method: 'POST'
          });

          const result = await response.json();
          if (!result.success) {
            errors.push(`${connector.type}: ${result.error || 'Unknown error'}`);
          }
        } catch (error: any) {
          errors.push(`${connector.type}: ${error.message || 'Failed to connect'}`);
        }
      });

      await Promise.all(resumePromises);

      await supabase
        .from('pipelines')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', id);

      await logActivity(
        'pipeline.start',
        `Resumed pipeline: ${pipeline.name}`,
        'pipeline',
        id
      );

      if (errors.length > 0) {
        showToast('warning', `Pipeline resumed with warnings`, errors.join(', '));
      } else {
        showToast('success', 'Pipeline resumed successfully');
      }

      // Aggressive refetch: Poll connector statuses rapidly for 5 seconds to catch fast state changes
      // This ensures both source and sink tasks update quickly in the UI
      const rapidRefetch = async () => {
        await refetchConnectorStatuses();
        await refetchProgress();
      };

      // Immediate refetch
      await rapidRefetch();

      // Then refetch 3 more times with 1-second intervals to catch Kafka Connect updates
      setTimeout(() => rapidRefetch(), 1000);
      setTimeout(() => rapidRefetch(), 2000);
      setTimeout(() => rapidRefetch(), 3000);
    } catch (error: any) {
      showToast('error', 'Failed to resume pipeline', error.message);
      // Revert optimistic update on error
      refetchPipeline();
    }
  };

  const handlePausePipeline = async () => {
    if (!pipeline) return;

    try {
      // Optimistic update - instantly update UI without reload
      updatePipelineStatus('paused');

      showToast('info', 'Pausing pipeline connectors...');

      const errors: string[] = [];
      const connectorsToPause: Array<{ name: string; type: 'source' | 'sink' }> = [];

      if (pipeline.source_connector?.name) {
        connectorsToPause.push({ name: pipeline.source_connector.name, type: 'source' });
      }
      if (pipeline.sink_connector?.name) {
        connectorsToPause.push({ name: pipeline.sink_connector.name, type: 'sink' });
      }

      // Pause connectors IN PARALLEL for instant response
      const pausePromises = connectorsToPause.map(async (connector) => {
        try {
          const response = await fetch(`http://localhost:5002/api/connectors/${connector.name}/pause`, {
            method: 'POST'
          });

          const result = await response.json();
          if (!result.success) {
            errors.push(`${connector.type}: ${result.error || 'Unknown error'}`);
          }
        } catch (error: any) {
          errors.push(`${connector.type}: ${error.message || 'Failed to connect'}`);
        }
      });

      await Promise.all(pausePromises);

      await supabase
        .from('pipelines')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', id);

      await logActivity(
        'pipeline.pause',
        `Paused pipeline: ${pipeline.name}`,
        'pipeline',
        id
      );

      if (errors.length > 0) {
        showToast('warning', `Pipeline paused with warnings`, errors.join(', '));
      } else {
        showToast('success', 'Pipeline paused successfully');
      }

      // Aggressive refetch: Poll connector statuses rapidly for 5 seconds to catch fast state changes
      // This ensures both source and sink tasks update quickly in the UI
      const rapidRefetch = async () => {
        await refetchConnectorStatuses();
        await refetchProgress();
      };

      // Immediate refetch
      await rapidRefetch();

      // Then refetch 3 more times with 1-second intervals to catch Kafka Connect updates
      setTimeout(() => rapidRefetch(), 1000);
      setTimeout(() => rapidRefetch(), 2000);
      setTimeout(() => rapidRefetch(), 3000);
    } catch (error: any) {
      showToast('error', 'Failed to pause pipeline', error.message);
      // Revert optimistic update on error
      refetchPipeline();
    }
  };

  const handleConnectorAction = async (connectorName: string, action: 'pause' | 'resume' | 'restart', connectorType: 'source' | 'sink') => {
    try {
      const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
      showToast('info', `${actionLabel}ing ${connectorType} connector...`);

      const endpoint = action === 'resume'
        ? `/api/connectors/${connectorName}/resume`
        : action === 'pause'
        ? `/api/connectors/${connectorName}/pause`
        : `/api/connectors/${connectorName}/restart`;

      const response = await fetch(`http://localhost:5002${endpoint}`, {
        method: 'POST'
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || `Failed to ${action} connector`);
      }

      await logActivity(
        `connector.${action}`,
        `${actionLabel}ed ${connectorType} connector: ${connectorName}`,
        'pipeline',
        id
      );

      showToast('success', `${connectorType.charAt(0).toUpperCase() + connectorType.slice(1)} connector ${action}ed successfully`);

      // Refetch to sync - placeholderData prevents blink
      refetchConnectorStatuses();
      refetchProgress();
      // Note: Don't trigger ObjectsTab refresh - connectorStatuses update is enough
    } catch (error: any) {
      showToast('error', `Failed to ${action} ${connectorType} connector`, error.message);
    }
  };

  const handleRestartPipeline = async () => {
    if (!pipeline) return;

    try {
      showToast('info', 'Restarting pipeline connectors...');

      const errors: string[] = [];
      const connectorsToRestart: Array<{ name: string; type: 'source' | 'sink' }> = [];

      if (pipeline.source_connector?.name) {
        connectorsToRestart.push({ name: pipeline.source_connector.name, type: 'source' });
      }
      if (pipeline.sink_connector?.name) {
        connectorsToRestart.push({ name: pipeline.sink_connector.name, type: 'sink' });
      }

      for (const connector of connectorsToRestart) {
        try {
          const response = await fetch(`http://localhost:5002/api/connectors/${connector.name}/restart`, {
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

      await logActivity(
        'pipeline.restart',
        `Restarted pipeline: ${pipeline.name}`,
        'pipeline',
        id
      );

      if (errors.length > 0) {
        showToast('warning', `Pipeline restarted with warnings`, errors.join(', '));
      } else {
        showToast('success', 'Pipeline restarted successfully');
      }

      // Refetch to sync - placeholderData prevents blink
      refetchConnectorStatuses();
      refetchProgress();
    } catch (error: any) {
      showToast('error', 'Failed to restart pipeline', error.message);
    }
  };

  const handleDeployPipeline = async () => {
    if (!confirm('Deploy this pipeline to Kafka Connect? This will create source and sink connectors.')) return;

    try {
      showToast('info', 'Deploying pipeline...');

      const result = await deployPipeline(id!);

      if (result.success) {
        const sourceConnectorName = `${pipeline?.name}-source`;
        const sinkConnectorName = `${pipeline?.name}-sink`;

        if (result.results?.source?.connector) {
          await supabase.from('pipeline_connectors').upsert({
            pipeline_id: id,
            name: sourceConnectorName,
            type: 'source',
            connector_class: result.results.source.connector.config?.['connector.class'] || '',
            config: result.results.source.connector.config || {},
            status: 'running',
          }, {
            onConflict: 'pipeline_id,type',
            ignoreDuplicates: false,
          });
        }

        if (result.results?.sink?.connector) {
          await supabase.from('pipeline_connectors').upsert({
            pipeline_id: id,
            name: sinkConnectorName,
            type: 'sink',
            connector_class: result.results.sink.connector.config?.['connector.class'] || '',
            config: result.results.sink.connector.config || {},
            status: 'running',
          }, {
            onConflict: 'pipeline_id,type',
            ignoreDuplicates: false,
          });
        }

        const statusCheck = await getPipelineStatus(id!);
        let actualStatus = 'running';

        if (statusCheck.status?.source?.connector?.state === 'FAILED' ||
            statusCheck.status?.sink?.connector?.state === 'FAILED') {
          actualStatus = 'error';
        }

        await supabase
          .from('pipelines')
          .update({ status: actualStatus, updated_at: new Date().toISOString() })
          .eq('id', id);

        await logActivity(
          'pipeline.deploy',
          `Deployed pipeline to Kafka Connect: ${pipeline?.name}`,
          'pipeline',
          id
        );

        showToast('success', 'Pipeline deployed successfully');
        refetchPipeline();
      } else {
        const errors = result.results?.errors || [];
        const errorMsg = errors.length > 0 ? errors.map(e => `${e.connector}: ${e.error}`).join(', ') : result.error;
        showToast('error', 'Failed to deploy pipeline', errorMsg);
      }
    } catch (error: any) {
      showToast('error', 'Failed to deploy pipeline', error.message);
    }
  };

  const handleDeletePipeline = async (deleteTopics: boolean, isPermanent: boolean = false, retentionHours: number = 24) => {
    try {
      const isDraftPipeline = pipeline?.status === 'draft';
      const isPermanentDelete = isPermanent || isDraftPipeline;

      if (isPermanentDelete) {
        // PERMANENT DELETE
        if (deleteTopics) {
          const response = await fetch(`${import.meta.env.VITE_DEBEZIUM_BACKEND_URL}/api/pipelines/${id}/connectors?deleteTopics=true`, {
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

        const { error } = await supabase.from('pipelines').delete().eq('id', id);

        if (error) {
          showToast('error', 'Failed to permanently delete pipeline', error.message);
        } else {
          await logActivity(
            'pipeline.permanent_delete',
            `Permanently deleted ${isDraftPipeline ? 'draft ' : ''}pipeline: ${pipeline?.name}${deleteTopics ? ' (including topics)' : ''}`,
            'pipeline',
            id
          );
          showToast('success', `${isDraftPipeline ? 'Draft pipeline' : 'Pipeline'} permanently deleted`);
          navigate('/pipelines');
        }
      } else {
        // SOFT DELETE
        const response = await fetch(`${import.meta.env.VITE_DEBEZIUM_BACKEND_URL}/api/pipelines/${id}/connectors?deleteTopics=${deleteTopics}`, {
          method: 'DELETE'
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          showToast('error', 'Failed to delete connectors', result.error || 'Unknown error');
          return;
        }

        const { error } = await supabase
          .from('pipelines')
          .update({
            deleted_at: new Date().toISOString(),
            status: 'deleted',
            backup_retention_hours: retentionHours
          })
          .eq('id', id);

        if (error) {
          showToast('error', 'Failed to delete pipeline', error.message);
        } else {
          await logActivity(
            'pipeline.delete',
            `Deleted pipeline: ${pipeline?.name}${deleteTopics ? ' (including topics)' : ''}`,
            'pipeline',
            id
          );

          if (result.errors && result.errors.length > 0) {
            showToast('warning', `Pipeline deleted with warnings: ${result.errors.map((e: any) => e.error).join(', ')}`);
          } else {
            const topicsMsg = deleteTopics
              ? ` and ${result.deletedTopics?.length || 0} topic(s)`
              : '';
            showToast('success', `Pipeline marked for deletion. ${result.deletedConnectors?.length || 0} connector(s)${topicsMsg} removed. Restore available for ${retentionHours} hour${retentionHours !== 1 ? 's' : ''}.`);
          }

          navigate('/pipelines');
        }
      }
    } catch (error: any) {
      showToast('error', 'Failed to delete pipeline', error.message);
    }
  };

  const handleUpdateSchedule = async () => {
    let config: any;

    if (scheduleType === 'preset') {
      const presetHours: Record<string, number> = {
        '5m': 0.083,
        '15m': 0.25,
        '30m': 0.5,
        '1h': 1,
        '2h': 2,
        '3h': 3,
        '6h': 6,
        '8h': 8,
        '12h': 12,
        '24h': 24
      };
      config = { type: 'interval', hours: presetHours[selectedPreset] || 6 };
    } else if (customType === 'interval') {
      const hours = parseFloat(customHours);
      if (isNaN(hours) || hours < 0.083 || hours > 48) {
        showToast('error', 'Invalid interval', 'Hours must be between 0.083 (5 mins) and 48');
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
        .eq('id', id);

      if (error) {
        showToast('error', 'Failed to update schedule', error.message);
        return;
      }

      await logActivity(
        'pipeline.schedule_update',
        `Updated ingestion schedule for pipeline: ${pipeline?.name}`,
        'pipeline',
        id,
        { schedule_config: config }
      );

      showToast('success', 'Schedule updated successfully');
      setShowScheduleModal(false);
      refetchPipeline();
    } catch (error: any) {
      showToast('error', 'Failed to update schedule', error.message);
    }
  };

  const getScheduleDescription = () => {
    if (scheduleType === 'preset') {
      const value = selectedPreset;
      if (value === '5m') return 'every 5 Minutes';
      if (value === '15m') return 'every 15 Minutes';
      if (value === '30m') return 'every 30 Minutes';
      if (value === '1h') return 'every 1 Hour';
      if (value === '2h') return 'every 2 Hours';
      if (value === '3h') return 'every 3 Hours';
      if (value === '6h') return 'every 6 Hours';
      if (value === '8h') return 'every 8 Hours';
      if (value === '12h') return 'every 12 Hours';
      if (value === '24h') return 'every 24 Hours';
    } else if (customType === 'interval') {
      const hours = parseFloat(customHours);
      if (hours < 1) {
        const minutes = Math.round(hours * 60);
        return `every ${minutes} Minute${minutes > 1 ? 's' : ''}`;
      }
      return `every ${hours} Hour${hours > 1 ? 's' : ''}`;
    } else {
      return `at ${dailyTimes.join(', ')} daily`;
    }
    return '';
  };

  const getConnectorStatus = (type: 'source' | 'sink'): string => {
    const status = type === 'source' ? connectorStatuses.source : connectorStatuses.sink;
    const state = status?.connector?.state;

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

    // Check connector states from Kafka Connect (using live data from hook)
    const sourceState = connectorStatuses.source?.connector?.state;
    const sinkState = connectorStatuses.sink?.connector?.state;

    // If we don't have connector statuses yet, use pipeline status (e.g., after optimistic update)
    if (!sourceState && !sinkState) {
      return pipeline.status;
    }

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
        return 'success';
      case 'paused':
        return 'warning';
      case 'ready':
        return 'info';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading && !pipeline) {
    return (
      <div className="h-full flex flex-col animate-pulse">
        {/* Summary Bar Skeleton */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div>
                  <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Bar Skeleton */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-4">
          <div className="flex gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="flex-1 p-8 space-y-4">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!pipeline) {
    return null;
  }

  // Deleted pipeline'lar için Objects tab'ı gizle (connector yok)
  const tabs = [
    ...(pipeline.deleted_at ? [] : [{ id: 'objects' as TabType, label: 'Objects', icon: Database }]),
    { id: 'monitoring' as TabType, label: 'Monitoring', icon: TrendingUp },
    { id: 'logs' as TabType, label: 'Issue Monitoring', icon: FileText },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Summary Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-5">
          {/* Top row: Pipeline info and Status */}
          <div className="flex items-center justify-between mb-4">
            {/* Left: Back button + Pipeline info */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/pipelines')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{pipeline.name}</h1>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  <span>Created {formatDate(pipeline.created_at)}</span>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="font-mono opacity-75">{pipeline.id}</span>
                </div>
              </div>
            </div>

            {/* Right: Refresh Interval + Alarm + Status + Menu */}
            <div className="flex items-center gap-3">
              {(pipeline.status === 'running' || pipeline.status === 'paused') && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value) as RefreshInterval)}
                    className="text-sm font-medium bg-transparent border-none text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-0 cursor-pointer"
                  >
                    {REFRESH_INTERVALS.map((interval) => (
                      <option key={interval.value} value={interval.value}>
                        {interval.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Alarm Indicator - Shows when pipeline has unresolved alerts */}
              {pipelineAlerts.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setActiveTab('logs');
                      setActiveLogsView('alerts');
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30"
                    title={`${pipelineAlerts.length} unresolved alert(s) - Click to view`}
                  >
                    <BellRing className={`w-4 h-4 ${
                      pipelineAlerts.some(a => a.severity === 'critical')
                        ? 'text-red-600 dark:text-red-400 animate-pulse'
                        : 'text-yellow-600 dark:text-yellow-400 animate-pulse'
                    }`} />
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">
                      {pipelineAlerts.length} Alert{pipelineAlerts.length !== 1 ? 's' : ''}
                    </span>
                  </button>
                </div>
              )}
              <Tag variant={getStatusColor(getActualPipelineStatus(pipeline))}>{getActualPipelineStatus(pipeline).toUpperCase()}</Tag>
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                      {getActualPipelineStatus(pipeline) === 'ready' && (
                        <button
                          onClick={() => {
                            handleDeployPipeline();
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                        >
                          <Play className="w-4 h-4 text-green-600" />
                          Deploy Pipeline
                        </button>
                      )}
                      {getActualPipelineStatus(pipeline) === 'paused' && (
                        <button
                          onClick={() => {
                            handleStartPipeline();
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Resume Pipeline
                        </button>
                      )}
                      {getActualPipelineStatus(pipeline) === 'running' && (
                        <button
                          onClick={() => {
                            handlePausePipeline();
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Pause className="w-4 h-4" />
                          Pause Pipeline
                        </button>
                      )}
                      <button
                        onClick={() => {
                          handleRestartPipeline();
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <RotateCw className="w-4 h-4" />
                        Restart Pipeline
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowScheduleModal(true);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Calendar className="w-4 h-4" />
                        Change Schedule
                      </button>
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                      <button
                        onClick={() => {
                          setShowDeleteModal(true);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Pipeline
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bottom row: Centered Source and Destination Connectors */}
          {(pipeline.status === 'running' || pipeline.status === 'paused') && (
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2">
                {/* Source Connector Card */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-0.5">Source</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {pipeline.source_connector?.name || pipeline.source_type || 'Not configured'}
                        </div>
                      </div>
                    </div>
                    {pipeline.source_connector && (
                      <>
                        <div className="h-8 w-px bg-blue-200 dark:bg-blue-700" />
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm ${getConnectorStatusColor(getConnectorStatus('source'))}`}>
                          <span>{getConnectorStatusIcon(getConnectorStatus('source'))}</span>
                          <span>{getConnectorStatus('source')}</span>
                        </span>
                        <div className="flex gap-1">
                          {getConnectorStatus('source') === 'RUNNING' && (
                            <button
                              onClick={() => handleConnectorAction(pipeline.source_connector!.name, 'pause', 'source')}
                              className="p-1.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-md transition-colors"
                              title="Pause Source"
                            >
                              <Pause className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                            </button>
                          )}
                          {getConnectorStatus('source') === 'PAUSED' && (
                            <button
                              onClick={() => handleConnectorAction(pipeline.source_connector!.name, 'resume', 'source')}
                              className="p-1.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-md transition-colors"
                              title="Resume Source"
                            >
                              <Play className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                            </button>
                          )}
                          <button
                            onClick={() => handleConnectorAction(pipeline.source_connector!.name, 'restart', 'source')}
                            className="p-1.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-md transition-colors"
                            title="Restart Source"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-4" />

                {/* Destination Connector Card */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800 rounded-lg px-4 py-2.5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <div>
                        <div className="text-xs text-purple-700 dark:text-purple-300 font-medium mb-0.5">Destination</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {pipeline.sink_connector?.name || pipeline.destination_type || 'Not configured'}
                        </div>
                      </div>
                    </div>
                    {pipeline.sink_connector && (
                      <>
                        <div className="h-8 w-px bg-purple-200 dark:bg-purple-700" />
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm ${getConnectorStatusColor(getConnectorStatus('sink'))}`}>
                          <span>{getConnectorStatusIcon(getConnectorStatus('sink'))}</span>
                          <span>{getConnectorStatus('sink')}</span>
                        </span>
                        <div className="flex gap-1">
                          {getConnectorStatus('sink') === 'RUNNING' && (
                            <button
                              onClick={() => handleConnectorAction(pipeline.sink_connector!.name, 'pause', 'sink')}
                              className="p-1.5 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-md transition-colors"
                              title="Pause Sink"
                            >
                              <Pause className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
                            </button>
                          )}
                          {getConnectorStatus('sink') === 'PAUSED' && (
                            <button
                              onClick={() => handleConnectorAction(pipeline.sink_connector!.name, 'resume', 'sink')}
                              className="p-1.5 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-md transition-colors"
                              title="Resume Sink"
                            >
                              <Play className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                            </button>
                          )}
                          <button
                            onClick={() => handleConnectorAction(pipeline.sink_connector!.name, 'restart', 'sink')}
                            className="p-1.5 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-md transition-colors"
                            title="Restart Sink"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification Bar */}
      {pipeline.status === 'running' && showNotification && (
        <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
              <CheckCircle className="w-4 h-4" />
              Events have started loading in your Destination
            </div>
            <button
              onClick={() => setShowNotification(false)}
              className="text-green-600 dark:text-green-400 hover:text-green-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {(pipeline.status === 'running' || pipeline.status === 'paused') && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6">
          <PipelineProgressComponent
            progress={pipelineProgress}
            isLoading={isProgressLoading}
          />
        </div>
      )}

      {/* Pipeline Activity - Now using React Query for smooth polling! */}
      {(pipeline.status === 'running' || pipeline.status === 'paused') && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6">
          <PipelineActivityComponent
            pipelineId={id!}
            pipelineStatus={pipeline.status}
            refreshInterval={refreshInterval}
            onRefreshIntervalChange={setRefreshInterval}
            onManualRefresh={() => {
              refetchProgress();
              refetchConnectorStatuses();
            }}
          />
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-4">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Sub-Tab Bar - Only show when Logs tab is active */}
      {activeTab === 'logs' && (
        <>
          <div className="sticky top-[72px] z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveLogsView('timeline')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeLogsView === 'timeline'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setActiveLogsView('dlq')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeLogsView === 'dlq'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                DLQ (2)
              </button>
              <button
                onClick={() => setActiveLogsView('alerts')}
                className={`px-4 py-2 font-medium transition-colors relative ${
                  activeLogsView === 'alerts'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Alerts
                {pipelineAlerts.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-red-600 text-white text-xs rounded-full">
                    {pipelineAlerts.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="flex-1 overflow-auto p-8">
        {activeTab === 'objects' && <ObjectsTab pipelineId={pipeline.id} pipelineStatus={pipeline.status} sourceType={pipeline.source_type} destinationType={pipeline.destination_type} onPipelineStatusChange={handleObjectsTabStatusChange} connectorStatuses={connectorStatuses} />}
        {activeTab === 'monitoring' && (
          <MonitoringTab
            refreshTrigger={monitoringRefreshTrigger}
            refreshInterval={refreshInterval}
            isActive={activeTab === 'monitoring' && pipeline?.status === 'running'}
          />
        )}
        {activeTab === 'logs' && <LogsTab pipelineId={pipeline.id} pipelineStatus={pipeline.status} activeView={activeLogsView} searchQuery="" severityFilter="all" />}
        {activeTab === 'settings' && <SettingsTab pipeline={pipeline} onUpdate={refetchPipeline} />}
      </div>

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeletePipeline}
        title={
          pipeline?.status === 'draft'
            ? "Delete Draft Pipeline?"
            : "Delete Pipeline"
        }
        message={
          pipeline?.status === 'draft'
            ? "This draft pipeline will be permanently deleted. This action CANNOT be undone."
            : "Choose how you want to delete this pipeline. You can keep it for restore or permanently remove it."
        }
        pipelineId={id}
        showTopicsOption={pipeline?.status === 'draft'}
        showDeleteTypeOption={pipeline?.status !== 'draft'}
        pipelineStatus={pipeline?.status}
      />

      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowScheduleModal(false)}>
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
                onClick={() => setShowScheduleModal(false)}
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
                  {['5m', '15m', '30m', '1h', '2h', '3h'].map((preset) => (
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
                      {preset === '5m' ? '5 Mins' : preset === '15m' ? '15 Mins' : preset === '30m' ? '30 Mins' : preset === '1h' ? '1 Hr' : preset.replace('h', ' Hrs')}
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
                  <div className="flex gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={customType === 'interval'}
                        onChange={() => {
                          setCustomType('interval');
                          if (scheduleType !== 'custom') {
                            setScheduleType('custom');
                          }
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Run at fixed interval</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={customType === 'daily'}
                        onChange={() => {
                          setCustomType('daily');
                          setScheduleType('custom');
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Run daily</span>
                    </label>
                  </div>

                  {scheduleType === 'custom' && (
                    <div>
                      {customType === 'interval' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Hours *
                        </label>
                        <input
                          type="number"
                          min="0.083"
                          max="48"
                          step="0.001"
                          value={customHours}
                          onChange={(e) => setCustomHours(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Minimum 0.083 hr (5 mins) and Maximum 48 hrs
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          At (in UTC) *
                        </label>
                        <div className="space-y-2">
                          {dailyTimes.map((time, index) => (
                            <div key={index} className="flex gap-2 items-center">
                              <Clock className="w-5 h-5 text-gray-400" />
                              <input
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
                                  className="text-red-600 hover:text-red-700"
                                >
                                  DELETE
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {dailyTimes.length < 24 && (
                          <button
                            onClick={() => setDailyTimes([...dailyTimes, '00:00'])}
                            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <span>+</span> ADD MORE
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
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                CANCEL
              </button>
              <button
                onClick={handleUpdateSchedule}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                UPDATE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
