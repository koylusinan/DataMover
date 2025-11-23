import { Activity, TrendingUp, TrendingDown, AlertTriangle, Database, Zap, Loader2, Info, Bell, MessageSquare, LayoutDashboard, Maximize2, Minimize2, X } from 'lucide-react';
import { KpiChip } from '../ui/KpiChip';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getPipelineMonitoring, type PipelineMonitoring, type MetricData as ApiMetricData, type ConnectorTaskMetric, type SlowTable } from '../../lib/debezium';
import { PipelineSlackChannels } from './PipelineSlackChannels';

interface MetricData {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down';
}

interface AlertPreference {
  id: string;
  pipeline_id: string;
  created_by: string;
  updated_at: string;
  pipeline_connectivity_slack: boolean;
  pipeline_connectivity_dashboard: boolean;
  pipeline_job_failures_slack: boolean;
  pipeline_job_failures_dashboard: boolean;
  source_event_types_slack: boolean;
  source_event_types_dashboard: boolean;
  failed_events_summary_slack: boolean;
  failed_events_summary_dashboard: boolean;
  webhooks_slack: boolean;
  webhooks_dashboard: boolean;
  pipeline_loading_status_slack: boolean;
  pipeline_loading_status_dashboard: boolean;
  source_side_events_slack: boolean;
  source_side_events_dashboard: boolean;
  data_spike_alert_slack: boolean;
  data_spike_alert_dashboard: boolean;
  user_profiles?: {
    full_name: string;
  };
}

interface MonitoringTabProps {
  refreshTrigger?: number;
  refreshInterval?: number;
  isActive?: boolean;
}

export function MonitoringTab({ refreshTrigger, refreshInterval = 60000, isActive = false }: MonitoringTabProps) {
  const { id: pipelineId } = useParams<{ id: string }>();
  const [alertPreferences, setAlertPreferences] = useState<AlertPreference | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [monitoring, setMonitoring] = useState<PipelineMonitoring | null>(null);
  const [loadingMonitoring, setLoadingMonitoring] = useState(true);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [throughputHistory, setThroughputHistory] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // Store last 10 data points
  const [maximizedChart, setMaximizedChart] = useState<'latency' | 'throughput' | 'records' | 'pipeline' | null>(null);

  // Update throughput history when monitoring data changes
  useEffect(() => {
    if (!monitoring?.throughputMetrics || monitoring.throughputMetrics.length === 0) {
      return;
    }

    // Extract numeric value from first throughput metric (e.g., "150 rec/min" -> 150)
    const firstMetric = monitoring.throughputMetrics[0];
    if (firstMetric && firstMetric.value) {
      const match = firstMetric.value.match(/(\d+)/);
      if (match) {
        const newValue = parseInt(match[1], 10);

        setThroughputHistory(prev => {
          // Add new value and keep only last 10
          const updated = [...prev.slice(-9), newValue];

          // Normalize to percentages (relative to max value)
          const max = Math.max(...updated);
          if (max === 0) return updated.map(() => 0); // Show 0% if all zeros

          return updated.map(val => Math.round((val / max) * 100));
        });
      }
    }
  }, [monitoring?.throughputMetrics]);

  // Fetch alert preferences for this pipeline
  useEffect(() => {
    const fetchAlertPreferences = async () => {
      if (!pipelineId) return;

      setLoadingAlerts(true);
      try {
        const { data, error } = await supabase
          .from('alert_preferences')
          .select(`
            *,
            user_profiles!created_by(full_name)
          `)
          .eq('pipeline_id', pipelineId)
          .maybeSingle();

        if (error) throw error;
        setAlertPreferences(data);
      } catch (error) {
        console.error('Error fetching alert preferences:', error);
        setAlertPreferences(null);
      } finally {
        setLoadingAlerts(false);
      }
    };

    fetchAlertPreferences();
  }, [pipelineId]);

  // Fetch monitoring data from API
  useEffect(() => {
    const fetchMonitoringData = async () => {
      if (!pipelineId) {
        console.log('❌ No pipeline ID');
        return;
      }

      console.log('🔍 Fetching monitoring data for pipeline:', pipelineId);
      setLoadingMonitoring(true);

      try {
        const data = await getPipelineMonitoring(pipelineId);
        console.log('📊 Monitoring data:', data);
        setMonitoring(data);
      } catch (error) {
        console.error('❌ Error fetching monitoring data:', error);
        setMonitoring(null);
      } finally {
        setLoadingMonitoring(false);
      }
    };

    fetchMonitoringData();
  }, [pipelineId, refreshTrigger]); // Re-fetch when refreshTrigger changes

  // Auto-refresh monitoring data when tab is active
  useEffect(() => {
    if (!isActive || !pipelineId) {
      return;
    }

    const fetchMonitoringData = async () => {
      try {
        const data = await getPipelineMonitoring(pipelineId);
        setMonitoring(data);
      } catch (error) {
        console.error('❌ Error auto-refreshing monitoring data:', error);
      }
    };

    // Set up interval for auto-refresh
    const interval = setInterval(() => {
      fetchMonitoringData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [pipelineId, isActive, refreshInterval]);

  // Extract data from monitoring state or use defaults
  const lagMetrics: MetricData[] = monitoring?.lagMetrics || [];
  const throughputMetrics = monitoring?.throughputMetrics || [];
  const slowTables = monitoring?.slowTables || [];
  const connectorTasks = monitoring?.connectorTasks || [];
  const pipelineState = monitoring?.state || {
    status: 'Unknown',
    errorRate: '0%',
    commitRate: '0/s',
    queueUsage: '0%'
  };

  // Calculate flow progress bar widths based on actual metrics
  const calculateFlowWidth = (metricValue: string | undefined): number => {
    if (!metricValue) return 0;
    // Extract numeric value from strings like "150 rec/s" or "0 rec/s"
    const match = metricValue.match(/(\d+)/);
    if (!match) return 0;
    const value = parseInt(match[1], 10);

    // If value is 0, return 0 width
    if (value === 0) return 0;

    // Calculate percentage based on a reasonable max (e.g., 1000 rec/s)
    // For values > 0, show at least 20% to make it visible
    const maxRecords = 1000;
    const percentage = Math.min(Math.max((value / maxRecords) * 100, 20), 100);
    return Math.round(percentage);
  };

  const flowWidths = {
    sourceToKafka: calculateFlowWidth(monitoring?.flowMetrics?.sourceToKafka),
    kafkaToSink: calculateFlowWidth(monitoring?.flowMetrics?.kafkaToSink),
    sinkToDestination: calculateFlowWidth(monitoring?.flowMetrics?.sinkToDestination)
  };

  // Tooltip descriptions for lag metrics
  const getLagTooltip = (label: string): string => {
    const tooltips: Record<string, string> = {
      'P50 Lag': '50% of records have lower lag. Shows typical performance.',
      'P95 Lag': '95% of records have lower lag. Detects performance outliers.',
      'P99 Lag': '99% of records have lower lag. Captures worst-case scenarios.',
      'Avg Lag': 'Average lag across all records in the pipeline.'
    };
    return tooltips[label] || '';
  };

  if (loadingMonitoring) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">Loading monitoring data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pipeline State</h3>
          <button
            onClick={() => setMaximizedChart('pipeline')}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Maximize"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <KpiChip
            label="State"
            value={pipelineState.status}
            icon={Zap}
            variant={pipelineState.status === 'Streaming' ? 'success' : 'default'}
          />
          <KpiChip
            label="Error Rate"
            value={pipelineState.errorRate}
            icon={AlertTriangle}
            variant={parseFloat(pipelineState.errorRate) < 1 ? 'success' : 'default'}
          />
          <KpiChip label="Commit Rate" value={pipelineState.commitRate} icon={Database} variant="default" />
          <KpiChip label="Queue Usage" value={pipelineState.queueUsage} icon={Activity} variant="default" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">End-to-End Latency</h3>
          <button
            onClick={() => setMaximizedChart('latency')}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Maximize"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {lagMetrics.map((metric) => (
            <div
              key={metric.label}
              className="relative"
              onMouseEnter={() => setActiveTooltip(metric.label)}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-150 cursor-help">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="text-sm text-gray-500 dark:text-gray-400">{metric.label}</div>
                  <Info className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metric.value}</div>
                  {metric.change && (
                    <div
                      className={`flex items-center gap-1 text-xs font-medium ${
                        metric.trend === 'down'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {metric.trend === 'down' ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : (
                        <TrendingUp className="w-3 h-3" />
                      )}
                      {metric.change}
                    </div>
                  )}
                </div>
              </div>

              {activeTooltip === metric.label && (
                <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2.5 bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-700 dark:to-gray-600 text-white text-xs rounded-lg shadow-xl max-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="font-semibold mb-1 text-blue-300">{metric.label}</div>
                  <div className="text-gray-200 dark:text-gray-300 leading-relaxed">{getLagTooltip(metric.label)}</div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="border-[5px] border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Throughput</h3>
            <button
              onClick={() => setMaximizedChart('throughput')}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Maximize"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="space-y-4">
              {throughputMetrics.map((metric) => (
                <div key={metric.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{metric.label}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{metric.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 h-32 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg flex items-end justify-around p-4">
              {throughputHistory.map((height, i) => (
                <div
                  key={i}
                  className="w-6 bg-gradient-to-t from-blue-600 to-blue-400 dark:from-blue-500 dark:to-blue-300 rounded-t transition-all duration-700 ease-in-out animate-pulse-subtle"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${i * 100}ms`
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Records Flow</h3>
            <button
              onClick={() => setMaximizedChart('records')}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Maximize"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Source → Kafka</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{monitoring?.flowMetrics?.sourceToKafka || '0 rec/s'}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out relative" style={{ width: `${flowWidths.sourceToKafka}%` }}>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Kafka → Sink</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{monitoring?.flowMetrics?.kafkaToSink || '0 rec/s'}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out relative" style={{ width: `${flowWidths.kafkaToSink}%` }}>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sink → Destination</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{monitoring?.flowMetrics?.sinkToDestination || '0 rec/s'}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500 ease-out relative" style={{ width: `${flowWidths.sinkToDestination}%` }}>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ animationDelay: '0.6s' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Slow Tables</h3>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Table
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Lag
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Records
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {slowTables.map((table) => (
                <tr key={table.table} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {table.table}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{table.lag}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{table.records}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        table.status === 'ok'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : table.status === 'warning'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {table.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Connector Task Health Map</h3>
        <div className="grid grid-cols-4 gap-4">
          {connectorTasks.map((task) => (
            <div
              key={task.id}
              className={`p-4 rounded-lg border-2 ${
                task.status === 'healthy'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : task.status === 'warning'
                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-red-500 bg-red-50 dark:bg-red-900/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 dark:text-gray-100">{task.id}</span>
                <span
                  className={`w-3 h-3 rounded-full ${
                    task.status === 'healthy'
                      ? 'bg-green-500'
                      : task.status === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                />
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                  <span>Lag:</span>
                  <span className="font-medium">{task.lag}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                  <span>Rate:</span>
                  <span className="font-medium">{task.records}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Slack Channels */}
      {pipelineId && <PipelineSlackChannels pipelineId={pipelineId} />}

      {/* Defined Alarms */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Defined Alarms
          </h3>
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
            Read Only
          </span>
        </div>

        {loadingAlerts ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">Loading alarms...</p>
          </div>
        ) : !alertPreferences ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No alarms defined for this pipeline</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Configure alarms in Alert Preferences to receive notifications
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Defined by:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                    {alertPreferences.user_profiles?.full_name || 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Last updated:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                    {new Date(alertPreferences.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Alert Type
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Slack
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Dashboard
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[
                  { key: 'pipeline_connectivity', label: 'Pipeline Connectivity' },
                  { key: 'pipeline_job_failures', label: 'Pipeline Job Failures' },
                  { key: 'source_event_types', label: 'Source Event Types' },
                  { key: 'failed_events_summary', label: 'Failed Events Summary' },
                  { key: 'webhooks', label: 'Webhooks' },
                  { key: 'pipeline_loading_status', label: 'Pipeline Loading Status' },
                  { key: 'source_side_events', label: 'Source Side Events' },
                  { key: 'data_spike_alert', label: 'Data Spike Alert' },
                ].map((alertType) => {
                  const slackEnabled = alertPreferences[`${alertType.key}_slack` as keyof AlertPreference];
                  const dashboardEnabled = alertPreferences[`${alertType.key}_dashboard` as keyof AlertPreference];

                  return (
                    <tr key={alertType.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {alertType.label}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {slackEnabled ? (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Enabled</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {dashboardEnabled ? (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                            <LayoutDashboard className="w-3.5 h-3.5" />
                            <span>Enabled</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Maximized Chart Modal */}
      {maximizedChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-[90vw] h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {maximizedChart === 'latency' && 'End-to-End Latency'}
                {maximizedChart === 'throughput' && 'Throughput'}
                {maximizedChart === 'records' && 'Records Flow'}
                {maximizedChart === 'pipeline' && 'Pipeline State'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMaximizedChart(null)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Minimize"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setMaximizedChart(null)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-8">
              {maximizedChart === 'latency' && (
                <div className="grid grid-cols-2 gap-6 h-full">
                  {lagMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-8 hover:border-blue-500 dark:hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="text-lg font-medium text-gray-600 dark:text-gray-400">{metric.label}</div>
                        <Info className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <div className="flex items-end justify-between">
                        <div className="text-6xl font-bold text-gray-900 dark:text-gray-100">{metric.value}</div>
                        {metric.change && (
                          <div
                            className={`flex items-center gap-2 text-xl font-medium ${
                              metric.trend === 'down'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {metric.trend === 'down' ? (
                              <TrendingDown className="w-6 h-6" />
                            ) : (
                              <TrendingUp className="w-6 h-6" />
                            )}
                            {metric.change}
                          </div>
                        )}
                      </div>
                      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        {getLagTooltip(metric.label)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {maximizedChart === 'throughput' && (
                <div className="h-full flex flex-col">
                  <div className="grid grid-cols-2 gap-6 mb-8">
                    {throughputMetrics.map((metric) => (
                      <div key={metric.label} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <span className="text-lg font-medium text-gray-600 dark:text-gray-400">{metric.label}</span>
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metric.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg flex items-end justify-around p-12">
                    {throughputHistory.map((height, i) => (
                      <div
                        key={i}
                        className="w-16 bg-gradient-to-t from-blue-600 to-blue-400 dark:from-blue-500 dark:to-blue-300 rounded-t transition-all duration-700 ease-in-out"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {maximizedChart === 'records' && monitoring && (
                <div className="h-full flex flex-col justify-center space-y-12">
                  <div className="flex items-center gap-8">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">Source → Kafka</span>
                        <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {monitoring?.flowMetrics?.sourceToKafka || '0 rec/s'}
                        </span>
                      </div>
                      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out relative" style={{ width: `${flowWidths.sourceToKafka}%` }}>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </div>
                      </div>
                    </div>
                    <Database className="w-20 h-20 text-green-600 dark:text-green-400" />
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kafka → Sink</span>
                        <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {monitoring?.flowMetrics?.kafkaToSink || '0 rec/s'}
                        </span>
                      </div>
                      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out relative" style={{ width: `${flowWidths.kafkaToSink}%` }}>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ animationDelay: '0.3s' }} />
                        </div>
                      </div>
                    </div>
                    <Activity className="w-20 h-20 text-blue-600 dark:text-blue-400" />
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sink → Destination</span>
                        <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                          {monitoring?.flowMetrics?.sinkToDestination || '0 rec/s'}
                        </span>
                      </div>
                      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500 ease-out relative" style={{ width: `${flowWidths.sinkToDestination}%` }}>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ animationDelay: '0.6s' }} />
                        </div>
                      </div>
                    </div>
                    <TrendingUp className="w-20 h-20 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              )}

              {maximizedChart === 'pipeline' && (
                <div className="h-full flex items-center justify-center p-12">
                  <div className="grid grid-cols-2 gap-12 w-full max-w-5xl">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-10 rounded-2xl border-2 border-blue-200 dark:border-blue-700">
                      <div className="flex items-center gap-4 mb-6">
                        <Zap className="w-16 h-16 text-blue-600 dark:text-blue-400" />
                        <div>
                          <div className="text-lg font-medium text-gray-600 dark:text-gray-400">State</div>
                          <div className={`text-4xl font-bold ${pipelineState.status === 'Streaming' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                            {pipelineState.status}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 p-10 rounded-2xl border-2 border-amber-200 dark:border-amber-700">
                      <div className="flex items-center gap-4 mb-6">
                        <AlertTriangle className="w-16 h-16 text-amber-600 dark:text-amber-400" />
                        <div>
                          <div className="text-lg font-medium text-gray-600 dark:text-gray-400">Error Rate</div>
                          <div className={`text-4xl font-bold ${parseFloat(pipelineState.errorRate) < 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {pipelineState.errorRate}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-10 rounded-2xl border-2 border-purple-200 dark:border-purple-700">
                      <div className="flex items-center gap-4 mb-6">
                        <Database className="w-16 h-16 text-purple-600 dark:text-purple-400" />
                        <div>
                          <div className="text-lg font-medium text-gray-600 dark:text-gray-400">Commit Rate</div>
                          <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                            {pipelineState.commitRate}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20 p-10 rounded-2xl border-2 border-teal-200 dark:border-teal-700">
                      <div className="flex items-center gap-4 mb-6">
                        <Activity className="w-16 h-16 text-teal-600 dark:text-teal-400" />
                        <div>
                          <div className="text-lg font-medium text-gray-600 dark:text-gray-400">Queue Usage</div>
                          <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                            {pipelineState.queueUsage}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
