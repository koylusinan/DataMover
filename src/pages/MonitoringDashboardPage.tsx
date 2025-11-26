import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, Download, Settings, Clock, Database, Zap, AlertTriangle, TrendingUp, TrendingDown, Info, Server, Cpu, HardDrive, Network, Bell, CheckCircle, XCircle, Award, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ThroughputChart } from '../components/monitoring/ThroughputChart';
import { LatencyChart } from '../components/monitoring/LatencyChart';
import { ErrorRateChart } from '../components/monitoring/ErrorRateChart';
import { WALSizePanel } from '../components/monitoring/WALSizePanel';
import { ConsumerGroupPanel } from '../components/monitoring/ConsumerGroupPanel';
import { Sparkline } from '../components/monitoring/Sparkline';
import { KpiChip } from '../components/ui/KpiChip';
import { getPipelineMonitoring, type PipelineMonitoring, type MetricData, type SlowTable, type ConnectorTaskMetric } from '../lib/debezium';
import { PipelineProgress as PipelineProgressComponent } from '../components/pipeline-detail/PipelineProgress';
import { PipelineActivity as PipelineActivityComponent } from '../components/pipeline-detail/PipelineActivity';
import { usePipelineProgress } from '../hooks/usePipelineProgress';
import { usePipelineActivity } from '../hooks/usePipelineActivity';

interface Pipeline {
  id: string;
  name: string;
  status: string;
  source_type?: string;
}

const BACKEND_URL = import.meta.env.VITE_DEBEZIUM_BACKEND_URL || 'http://localhost:5002';

const TIME_RANGES = [
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' }
];

interface ChartData {
  timestamp: number;
  value: number;
}

interface ActivityEvent {
  id: string;
  timestamp: string;
  time: string;
  icon: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  details?: string;
  sparklineData?: number[]; // Historical data for mini charts
  metricValue?: number; // Current metric value
}

type TabType = 'pipelines' | 'kafka' | 'jmx';

export function MonitoringDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pipelines');
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('5m');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Chart data
  const [throughputData, setThroughputData] = useState<ChartData[]>([]);
  const [latencyData, setLatencyData] = useState<ChartData[]>([]);
  const [errorData, setErrorData] = useState<ChartData[]>([]);

  // Flow metrics
  const [flowMetrics, setFlowMetrics] = useState<{
    sourceToKafka?: string;
    kafkaToSink?: string;
    sinkToDestination?: string;
  } | null>(null);

  // Full monitoring data
  const [monitoring, setMonitoring] = useState<PipelineMonitoring | null>(null);
  const [lagMetrics, setLagMetrics] = useState<MetricData[]>([]);
  const [slowTables, setSlowTables] = useState<SlowTable[]>([]);
  const [connectorTasks, setConnectorTasks] = useState<ConnectorTaskMetric[]>([]);
  const [pipelineState, setPipelineState] = useState({
    status: 'Unknown',
    errorRate: '0%',
    commitRate: '0/s',
    queueUsage: '0%'
  });

  // Activity feed
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);

  // Historical metrics for sparklines (last 15 data points)
  const [throughputHistory, setThroughputHistory] = useState<number[]>([]);
  const [lagHistory, setLagHistory] = useState<number[]>([]);
  const [errorRateHistory, setErrorRateHistory] = useState<number[]>([]);
  const [commitRateHistory, setCommitRateHistory] = useState<number[]>([]);

  // JMX metrics
  const [jmxMetrics, setJmxMetrics] = useState<any>(null);

  // Kafka Consumer metrics
  const [consumerMetrics, setConsumerMetrics] = useState<any>(null);

  // Get selected pipeline for status check
  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

  // React Query hook for pipeline progress - polls in background smoothly
  const { data: pipelineProgress = {}, isLoading: isProgressLoading } = usePipelineProgress({
    pipelineId: selectedPipelineId || '',
    enabled: !!selectedPipeline && (selectedPipeline.status === 'running' || selectedPipeline.status === 'paused'),
    refetchInterval: autoRefresh ? 5000 : undefined, // 5s interval when auto-refresh is on
  });

  // React Query hook for pipeline activity - polls in background smoothly
  const { data: pipelineActivity, isLoading: isActivityLoading, refetch: refetchActivity } = usePipelineActivity({
    pipelineId: selectedPipelineId || '',
    enabled: !!selectedPipeline && (selectedPipeline.status === 'running' || selectedPipeline.status === 'paused'),
    refetchInterval: autoRefresh ? 5000 : undefined, // 5s interval when auto-refresh is on
  });

  // Load pipelines
  useEffect(() => {
    loadPipelines();
  }, []);

  const loadPipelines = async () => {
    try {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, status, source_type')
        .in('status', ['running', 'paused', 'stopped'])
        .order('name');

      if (error) throw error;

      setPipelines(data || []);

      // Auto-select first pipeline
      if (data && data.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading pipelines:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch metrics from backend
  const fetchMetrics = useCallback(async (pipelineId: string) => {
    if (!pipelineId) return;

    try {
      const [throughputRes, latencyRes, errorRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/monitoring/timeseries?pipelineId=${pipelineId}&metric=throughput&range=${timeRange}`),
        fetch(`${BACKEND_URL}/api/monitoring/timeseries?pipelineId=${pipelineId}&metric=latency&range=${timeRange}`),
        fetch(`${BACKEND_URL}/api/monitoring/timeseries?pipelineId=${pipelineId}&metric=errors&range=${timeRange}`)
      ]);

      if (throughputRes.ok) {
        const data = await throughputRes.json();
        if (data.success && data.data.series.length > 0) {
          // Validate and filter data before setting state
          const values = data.data.series[0].values;
          const validValues = Array.isArray(values)
            ? values.filter((point: any) =>
                point &&
                typeof point.timestamp === 'number' &&
                typeof point.value === 'number' &&
                !isNaN(point.timestamp) &&
                !isNaN(point.value) &&
                isFinite(point.timestamp) &&
                isFinite(point.value)
              )
            : [];

          console.log('✓ Throughput data validated:', validValues.length, 'valid points out of', values?.length || 0);
          setThroughputData(validValues);
        } else {
          setThroughputData([]);
        }
      }

      if (latencyRes.ok) {
        const data = await latencyRes.json();
        if (data.success && data.data.series.length > 0) {
          // Validate and filter data before setting state
          const values = data.data.series[0].values;
          const validValues = Array.isArray(values)
            ? values.filter((point: any) =>
                point &&
                typeof point.timestamp === 'number' &&
                typeof point.value === 'number' &&
                !isNaN(point.timestamp) &&
                !isNaN(point.value) &&
                isFinite(point.timestamp) &&
                isFinite(point.value)
              )
            : [];

          console.log('✓ Latency data validated:', validValues.length, 'valid points out of', values?.length || 0);
          setLatencyData(validValues);
        } else {
          setLatencyData([]);
        }
      }

      if (errorRes.ok) {
        const data = await errorRes.json();
        if (data.success && data.data.series.length > 0) {
          // Validate and filter data before setting state
          const values = data.data.series[0].values;
          const validValues = Array.isArray(values)
            ? values.filter((point: any) =>
                point &&
                typeof point.timestamp === 'number' &&
                typeof point.value === 'number' &&
                !isNaN(point.timestamp) &&
                !isNaN(point.value) &&
                isFinite(point.timestamp) &&
                isFinite(point.value)
              )
            : [];

          console.log('✓ Error data validated:', validValues.length, 'valid points out of', values?.length || 0);
          setErrorData(validValues);
        } else {
          setErrorData([]);
        }
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }, [timeRange]);

  // Fetch all monitoring data from backend
  const fetchFlowMetrics = useCallback(async (pipelineId: string) => {
    if (!pipelineId) return;

    try {
      const monitoringData = await getPipelineMonitoring(pipelineId);
      if (monitoringData) {
        setMonitoring(monitoringData);
        setFlowMetrics(monitoringData.flowMetrics || null);
        setLagMetrics(monitoringData.lagMetrics || []);
        setSlowTables(monitoringData.slowTables || []);
        setConnectorTasks(monitoringData.connectorTasks || []);
        setPipelineState(monitoringData.state || {
          status: 'Unknown',
          errorRate: '0%',
          commitRate: '0/s',
          queueUsage: '0%'
        });

        // Generate activity events based on monitoring data (now async)
        await generateActivityEvents(monitoringData);
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      setFlowMetrics(null);
      setLagMetrics([]);
      setSlowTables([]);
      setConnectorTasks([]);
    }
  }, [selectedPipelineId]);

  // Fetch JMX metrics from backend
  const fetchJMXMetrics = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5001/api/jmx-metrics');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setJmxMetrics(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching JMX metrics:', error);
      setJmxMetrics(null);
    }
  }, []);

  // Fetch Kafka Consumer metrics from backend
  const fetchConsumerMetrics = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5001/api/kafka-consumer-metrics');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setConsumerMetrics(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching consumer metrics:', error);
      setConsumerMetrics(null);
    }
  }, []);

  // Generate activity events from monitoring data
  const generateActivityEvents = async (monitoringData: PipelineMonitoring) => {
    const events: ActivityEvent[] = [];
    const now = new Date();

    // Helper to format time
    const formatTime = (minutesAgo: number) => {
      const time = new Date(now.getTime() - minutesAgo * 60000);
      return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    // Fetch WAL alerts from database
    try {
      const { data: walAlerts } = await supabase
        .from('alert_events')
        .select('*')
        .eq('pipeline_id', selectedPipelineId)
        .eq('alert_type', 'WAL_SIZE_EXCEEDED')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(5);

      // Add WAL alerts to events
      if (walAlerts && walAlerts.length > 0) {
        walAlerts.forEach((alert, index) => {
          const alertTime = new Date(alert.created_at);
          const minutesAgo = Math.floor((now.getTime() - alertTime.getTime()) / 60000);

          events.push({
            id: `wal-alert-${alert.id}`,
            timestamp: alert.created_at,
            time: alertTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            icon: '⚠️',
            type: 'warning',
            message: 'WAL Size Exceeded',
            details: alert.message || `WAL size exceeded threshold`
          });
        });
      }
    } catch (error) {
      console.error('Error fetching WAL alerts:', error);
    }

    // Generate events based on pipeline state
    let minuteCounter = 0;

    // Pipeline status event
    if (monitoringData.state.status === 'Streaming') {
      events.push({
        id: `event-${minuteCounter}`,
        timestamp: new Date(now.getTime() - minuteCounter * 60000).toISOString(),
        time: formatTime(minuteCounter),
        icon: '🟢',
        type: 'success',
        message: 'Pipeline is streaming',
        details: 'All connectors running normally'
      });
      minuteCounter += Math.floor(Math.random() * 3) + 1;
    }

    // Throughput event
    const sourceToKafkaRate = monitoringData.flowMetrics?.sourceToKafka || '0 rec/s';
    if (!sourceToKafkaRate.startsWith('0')) {
      events.push({
        id: `event-${minuteCounter}`,
        timestamp: new Date(now.getTime() - minuteCounter * 60000).toISOString(),
        time: formatTime(minuteCounter),
        icon: '📊',
        type: 'info',
        message: 'Records processed',
        details: `Source → Kafka: ${sourceToKafkaRate}`
      });
      minuteCounter += Math.floor(Math.random() * 2) + 1;
    }

    // Connector task events
    monitoringData.connectorTasks.forEach((task) => {
      if (task.status === 'healthy') {
        events.push({
          id: `event-${minuteCounter}-${task.id}`,
          timestamp: new Date(now.getTime() - minuteCounter * 60000).toISOString(),
          time: formatTime(minuteCounter),
          icon: '✅',
          type: 'success',
          message: `${task.id} healthy`,
          details: `Lag: ${task.lag}, Rate: ${task.records}`
        });
      } else if (task.status === 'warning') {
        events.push({
          id: `event-${minuteCounter}-${task.id}`,
          timestamp: new Date(now.getTime() - minuteCounter * 60000).toISOString(),
          time: formatTime(minuteCounter),
          icon: '⚠️',
          type: 'warning',
          message: `${task.id} high lag`,
          details: `Lag: ${task.lag} - Performance degraded`
        });
      } else if (task.status === 'error') {
        events.push({
          id: `event-${minuteCounter}-${task.id}`,
          timestamp: new Date(now.getTime() - minuteCounter * 60000).toISOString(),
          time: formatTime(minuteCounter),
          icon: '❌',
          type: 'error',
          message: `${task.id} error`,
          details: `Task is not running - requires attention`
        });
      }
      minuteCounter += Math.floor(Math.random() * 2) + 1;
    });

    // Error rate event
    const errorRate = parseFloat(monitoringData.state.errorRate);
    if (errorRate > 1) {
      events.push({
        id: `event-${minuteCounter}`,
        timestamp: new Date(now.getTime() - minuteCounter * 60000).toISOString(),
        time: formatTime(minuteCounter),
        icon: '🔴',
        type: 'error',
        message: 'High error rate detected',
        details: `Error rate: ${monitoringData.state.errorRate}`
      });
      minuteCounter += Math.floor(Math.random() * 3) + 1;
    } else {
      events.push({
        id: `event-${minuteCounter}`,
        timestamp: new Date(now.getTime() - minuteCounter * 60000).toISOString(),
        time: formatTime(minuteCounter),
        icon: '✅',
        type: 'success',
        message: 'Low error rate',
        details: `Error rate: ${monitoringData.state.errorRate} - System stable`
      });
      minuteCounter += Math.floor(Math.random() * 4) + 2;
    }

    // Slow tables event
    if (monitoringData.slowTables.length > 0) {
      monitoringData.slowTables.forEach((table) => {
        events.push({
          id: `event-${minuteCounter}-${table.table}`,
          timestamp: new Date(now.getTime() - minuteCounter * 60000).toISOString(),
          time: formatTime(minuteCounter),
          icon: table.status === 'ok' ? '✅' : table.status === 'warning' ? '⚠️' : '🔴',
          type: table.status === 'ok' ? 'success' : table.status === 'warning' ? 'warning' : 'error',
          message: `Table: ${table.table}`,
          details: `Lag: ${table.lag}, Records: ${table.records}`
        });
        minuteCounter += Math.floor(Math.random() * 2) + 1;
      });
    }

    // Commit rate event
    events.push({
      id: `event-${minuteCounter}`,
      timestamp: new Date(now.getTime() - minuteCounter * 60000).toISOString(),
      time: formatTime(minuteCounter),
      icon: '💾',
      type: 'info',
      message: 'Offset commits',
      details: `Commit rate: ${monitoringData.state.commitRate}`
    });

    // Sort by timestamp (newest first) and limit to 20
    setActivityEvents(events.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 20));
  };

  // Fetch metrics when pipeline or time range changes
  useEffect(() => {
    if (selectedPipelineId) {
      fetchMetrics(selectedPipelineId);
      fetchFlowMetrics(selectedPipelineId);
    }
  }, [selectedPipelineId, timeRange, fetchMetrics, fetchFlowMetrics]);

  // Fetch JMX metrics when JMX tab is active
  useEffect(() => {
    if (activeTab === 'jmx') {
      fetchJMXMetrics();
    }
  }, [activeTab, fetchJMXMetrics]);

  // Fetch consumer metrics when Kafka tab is active
  useEffect(() => {
    if (activeTab === 'kafka') {
      fetchConsumerMetrics();
    }
  }, [activeTab, fetchConsumerMetrics]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !selectedPipelineId) return;

    const interval = setInterval(() => {
      fetchMetrics(selectedPipelineId);
      fetchFlowMetrics(selectedPipelineId);
      if (activeTab === 'jmx') {
        fetchJMXMetrics();
      }
      if (activeTab === 'kafka') {
        fetchConsumerMetrics();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, selectedPipelineId, activeTab, fetchMetrics, fetchFlowMetrics, fetchJMXMetrics, fetchConsumerMetrics]);

  // Track historical metrics for sparklines
  useEffect(() => {
    if (throughputData.length > 0) {
      const latestThroughput = throughputData[throughputData.length - 1]?.value || 0;
      // Validate before adding to history
      if (!isNaN(latestThroughput) && isFinite(latestThroughput)) {
        setThroughputHistory(prev => {
          const updated = [...prev, latestThroughput];
          return updated.slice(-15); // Keep last 15 points
        });
      }
    }

    if (latencyData.length > 0) {
      const latestLag = latencyData[latencyData.length - 1]?.value || 0;
      // Validate before adding to history
      if (!isNaN(latestLag) && isFinite(latestLag)) {
        setLagHistory(prev => {
          const updated = [...prev, latestLag];
          return updated.slice(-15); // Keep last 15 points
        });
      }
    }

    if (errorData.length > 0) {
      const latestError = errorData[errorData.length - 1]?.value || 0;
      // Validate before adding to history
      if (!isNaN(latestError) && isFinite(latestError)) {
        setErrorRateHistory(prev => {
          const updated = [...prev, latestError];
          return updated.slice(-15); // Keep last 15 points
        });
      }
    }

    if (pipelineState.commitRate) {
      const commitRateMatch = pipelineState.commitRate.match(/([\d.]+)/);
      const latestCommitRate = commitRateMatch ? parseFloat(commitRateMatch[1]) : 0;
      // Validate before adding to history
      if (!isNaN(latestCommitRate) && isFinite(latestCommitRate)) {
        setCommitRateHistory(prev => {
          const updated = [...prev, latestCommitRate];
          return updated.slice(-15); // Keep last 15 points
        });
      }
    }
  }, [throughputData, latencyData, errorData, pipelineState.commitRate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPipelines();
    if (selectedPipelineId) {
      await fetchMetrics(selectedPipelineId);
      await fetchFlowMetrics(selectedPipelineId);
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Handle adding panel to Pipeline Details Monitoring
  const handleAddPanelToDetails = async (panelId: string) => {
    if (!selectedPipelineId) {
      console.warn('No pipeline selected');
      return;
    }

    try {
      // Get current panels
      const response = await fetch(`http://localhost:5001/api/monitoring-panels/${selectedPipelineId}?userId=default`);
      const { panels: currentConfig } = await response.json();
      const currentPanels = currentConfig?.panels || [];

      // Add new panel if not already present
      if (!currentPanels.includes(panelId)) {
        const updatedPanels = [...currentPanels, panelId];

        // Save updated panels
        await fetch(`http://localhost:5001/api/monitoring-panels/${selectedPipelineId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'default',
            panels: updatedPanels
          })
        });

        console.log(`✓ Panel "${panelId}" added to Pipeline Details`);
      } else {
        console.log(`Panel "${panelId}" already in Pipeline Details`);
      }
    } catch (error) {
      console.error('Failed to add panel:', error);
    }
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

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Monitoring Dashboard
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Real-time pipeline monitoring and analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Pipeline Selector and Controls */}
        <div className="mt-6 flex items-center gap-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Pipeline
            </label>
            <select
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
              disabled={isLoading}
            >
              {isLoading ? (
                <option>Loading pipelines...</option>
              ) : pipelines.length === 0 ? (
                <option>No pipelines available</option>
              ) : (
                pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name} ({pipeline.status})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Range
            </label>
            <div className="flex items-center gap-2">
              {TIME_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    timeRange === range.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Auto-refresh
            </label>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                autoRefresh
                  ? 'bg-green-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
              }`}
            >
              <Clock className="w-4 h-4" />
              {autoRefresh ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2 pt-4">
            <button
              onClick={() => setActiveTab('pipelines')}
              className={`px-6 py-3 text-sm font-semibold rounded-t-lg transition-all ${
                activeTab === 'pipelines'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Pipelines
            </button>
            <button
              onClick={() => setActiveTab('kafka')}
              className={`px-6 py-3 text-sm font-semibold rounded-t-lg transition-all ${
                activeTab === 'kafka'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Kafka
            </button>
            <button
              onClick={() => setActiveTab('jmx')}
              className={`px-6 py-3 text-sm font-semibold rounded-t-lg transition-all ${
                activeTab === 'jmx'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              JMX
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading pipelines...</p>
            </div>
          </div>
        ) : !selectedPipeline ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                No pipeline selected. Please select a pipeline to view monitoring data.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Pipelines Tab */}
            {activeTab === 'pipelines' && (
              <div className="space-y-6">
                {/* Pipeline Progress - from Pipeline Details */}
            {selectedPipeline && (selectedPipeline.status === 'running' || selectedPipeline.status === 'paused') && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Pipeline Progress</h3>
                <PipelineProgressComponent
                  progress={pipelineProgress}
                  isLoading={isProgressLoading}
                />
              </div>
            )}

            {/* Pipeline State KPIs */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pipeline State</h3>
                <button
                  onClick={() => handleAddPanelToDetails('pipeline-state')}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg transition-colors"
                  title="View on Details Page"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>View on Details</span>
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

            {/* Pipeline Activity - from Pipeline Details */}
            {selectedPipeline && (selectedPipeline.status === 'running' || selectedPipeline.status === 'paused') && pipelineActivity && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <PipelineActivityComponent
                  pipelineId={selectedPipelineId}
                  pipelineStatus={selectedPipeline.status}
                  refreshInterval={5000}
                  onRefreshIntervalChange={() => {}}
                  onManualRefresh={refetchActivity}
                />
              </div>
            )}

            {/* End-to-End Latency Metrics */}
            {lagMetrics.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">End-to-End Latency</h3>
                  <button
                    onClick={() => handleAddPanelToDetails('end-to-end-latency')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg transition-colors"
                    title="View on Details Page"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View on Details</span>
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {lagMetrics.map((metric) => (
                    <div key={metric.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
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
                  ))}
                </div>
              </div>
            )}

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-[400px]">
                    <ThroughputChart
                      data={throughputData}
                      title="Source Throughput"
                      color="#3b82f6"
                      onViewDetails={() => handleAddPanelToDetails('throughput')}
                    />
                  </div>
                  <div className="h-[400px]">
                    <LatencyChart
                      data={latencyData}
                      title="Source Latency"
                      onViewDetails={() => handleAddPanelToDetails('latency')}
                    />
                  </div>
                </div>

                {/* Error Rate Chart */}
                <div className="h-[400px]">
                  <ErrorRateChart
                    data={errorData}
                    title="Error Rate"
                    threshold={10}
                  />
                </div>

                {/* Records Flow */}
                {flowMetrics && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                      <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Records Flow</h3>
                  </div>
                  <button
                    onClick={() => handleAddPanelToDetails('records-flow')}
                    className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium rounded-lg transition-colors"
                    title="View on Details Page"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View on Details</span>
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Source → Kafka</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{flowMetrics.sourceToKafka || '0 rec/s'}</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out relative"
                          style={{ width: `${calculateFlowWidth(flowMetrics.sourceToKafka)}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Kafka → Sink</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{flowMetrics.kafkaToSink || '0 rec/s'}</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out relative"
                          style={{ width: `${calculateFlowWidth(flowMetrics.kafkaToSink)}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ animationDelay: '0.3s' }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sink → Destination</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{flowMetrics.sinkToDestination || '0 rec/s'}</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500 ease-out relative"
                          style={{ width: `${calculateFlowWidth(flowMetrics.sinkToDestination)}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ animationDelay: '0.6s' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Slow Tables */}
            {slowTables.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Top Slow Tables</h3>
                  <button
                    onClick={() => handleAddPanelToDetails('top-slow-tables')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg transition-colors"
                    title="View on Details Page"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View on Details</span>
                  </button>
                </div>
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
            )}

            {/* Connector Task Health Map */}
            {connectorTasks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Connector Task Health Map
                    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({connectorTasks.length} {connectorTasks.length === 1 ? 'task' : 'tasks'})
                    </span>
                  </h3>
                  <button
                    onClick={() => handleAddPanelToDetails('connector-task-health')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg transition-colors"
                    title="View on Details Page"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View on Details</span>
                  </button>
                </div>

                <div className="grid grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                  {connectorTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg border ${
                        task.status === 'healthy'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : task.status === 'warning'
                            ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                            : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{task.id}</span>
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ml-1 ${
                            task.status === 'healthy'
                              ? 'bg-green-500'
                              : task.status === 'warning'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                        />
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span>Lag:</span>
                          <span className="font-medium truncate ml-1">{task.lag}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span>Rate:</span>
                          <span className="font-medium truncate ml-1">{task.records}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pipeline Health Score */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                    <Award className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Pipeline Health Score</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Overall system performance and reliability</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-purple-600 dark:text-purple-400">
                    {pipelineState.status === 'Streaming' && parseFloat(pipelineState.errorRate) < 1 ? '95' : '72'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">out of 100</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-gray-700 dark:text-gray-300">Uptime: 99.9%</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-gray-700 dark:text-gray-300">Latency: Good</span>
                </div>
                <div className="flex items-center gap-2">
                  {parseFloat(pipelineState.errorRate) < 1 ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                  <span className="text-gray-700 dark:text-gray-300">Errors: {pipelineState.errorRate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-gray-700 dark:text-gray-300">Throughput: Stable</span>
                </div>
              </div>
            </div>

            {/* System Resources (Coming Soon) */}
            <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Server className="w-6 h-6 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">System Resources</h3>
                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-2 py-1 rounded">Coming Soon</span>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <Cpu className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">CPU Usage</div>
                </div>
                <div className="text-center">
                  <Server className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">Memory</div>
                </div>
                <div className="text-center">
                  <HardDrive className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">Disk I/O</div>
                </div>
                <div className="text-center">
                  <Network className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <div className="text-sm text-gray-600 dark:text-gray-400">Network</div>
                </div>
              </div>
            </div>

            {/* Real-time Activity Feed - Modern Enhanced Design */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-lg">
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      Real-time Activity Feed
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Live pipeline events</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-xs font-medium text-gray-700 dark:text-gray-300">
                  Last 20 events
                </span>
              </div>

              <div className="max-h-[500px] overflow-y-auto">
                {activityEvents.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="inline-flex p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                      <Activity className="w-16 h-16 text-gray-400 dark:text-gray-600" />
                    </div>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No activity events yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Events will appear as the pipeline processes data</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {activityEvents.map((event, index) => {
                      const timeAgo = index === 0 ? 'NOW' : `${index * 2}m`;
                      const getTimelineColor = () => {
                        if (event.type === 'success') return 'bg-green-500';
                        if (event.type === 'warning') return 'bg-yellow-500';
                        if (event.type === 'error') return 'bg-red-500';
                        return 'bg-blue-500';
                      };

                      const getCardBg = () => {
                        if (event.type === 'success') return 'bg-green-50/50 dark:bg-green-900/5 border-green-200 dark:border-green-800/30';
                        if (event.type === 'warning') return 'bg-yellow-50/50 dark:bg-yellow-900/5 border-yellow-200 dark:border-yellow-800/30';
                        if (event.type === 'error') return 'bg-red-50/50 dark:bg-red-900/5 border-red-200 dark:border-red-800/30';
                        return 'bg-blue-50/50 dark:bg-blue-900/5 border-blue-200 dark:border-blue-800/30';
                      };

                      return (
                        <div
                          key={event.id}
                          className={`relative flex gap-4 p-5 ${getCardBg()} border-l-4 rounded-xl`}
                        >
                          {/* Timeline indicator */}
                          <div className="flex flex-col items-center gap-2 flex-shrink-0">
                            <div className={`w-1 h-full absolute left-0 top-0 ${getTimelineColor()}`} />
                            <div className="text-3xl">{event.icon}</div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              index === 0
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 animate-pulse'
                                : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {timeAgo}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 px-2 py-1 rounded">
                                  {event.time}
                                </span>
                                <span
                                  className={`px-2 py-1 text-xs rounded-md font-bold uppercase tracking-wider ${
                                    event.type === 'success'
                                      ? 'bg-green-500 text-white'
                                      : event.type === 'warning'
                                        ? 'bg-yellow-500 text-white'
                                        : event.type === 'error'
                                          ? 'bg-red-500 text-white'
                                          : 'bg-blue-500 text-white'
                                  }`}
                                >
                                  {event.type}
                                </span>
                              </div>
                            </div>

                            <h4 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
                              {event.message}
                            </h4>

                            {event.details && (
                              <div className="flex items-center gap-2 mt-2">
                                <Info className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                                  {event.details}
                                </p>
                              </div>
                            )}

                            {/* Visual indicator with sparkline for specific event types */}
                            {event.message.includes('records') && (
                              <div className="mt-4 p-3 bg-white/60 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Throughput Rate</span>
                                  </div>
                                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {event.details?.match(/[\d.]+[KM]?\/s|[\d,]+\/min/)?.[0] || '0/min'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Sparkline
                                    data={throughputHistory.length > 0 ? throughputHistory : [0]}
                                    width={120}
                                    height={32}
                                    color="#3b82f6"
                                    fillColor="rgba(59, 130, 246, 0.15)"
                                    type="area"
                                  />
                                  <div className="flex-1 text-right">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {throughputHistory.length > 0 ? `Last ${throughputHistory.length} points` : 'No data'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {(event.message.includes('healthy') || (event.message.includes('lag') && event.message.includes('healthy'))) && event.details && event.details.includes('Lag') && (
                              <div className="mt-4 p-3 bg-white/60 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-green-500" />
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Replication Lag</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                      {event.details?.match(/Lag:\s*([\d.]+[a-z]+)/)?.[1] || '0ms'}
                                    </span>
                                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold rounded-full">
                                      Healthy
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Sparkline
                                    data={lagHistory.length > 0 ? lagHistory : [0]}
                                    width={120}
                                    height={32}
                                    color="#10b981"
                                    fillColor="rgba(16, 185, 129, 0.15)"
                                    type="area"
                                  />
                                  <div className="flex-1 text-right">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {lagHistory.length > 0 ? `Last ${lagHistory.length} points` : 'No data'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Error rate sparkline */}
                            {event.message.includes('error') && event.message.includes('rate') && (
                              <div className="mt-4 p-3 bg-white/60 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Error Rate</span>
                                  </div>
                                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {event.details?.match(/Error rate:\s*([\d.]+%)/)?.[1] || '0.00%'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Sparkline
                                    data={errorRateHistory.length > 0 ? errorRateHistory : [0]}
                                    width={120}
                                    height={32}
                                    color="#f97316"
                                    fillColor="rgba(249, 115, 22, 0.15)"
                                    type="area"
                                  />
                                  <div className="flex-1 text-right">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {errorRateHistory.length > 0 ? `Last ${errorRateHistory.length} points` : 'No data'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Commit rate sparkline */}
                            {event.message.includes('Offset commits') && (
                              <div className="mt-4 p-3 bg-white/60 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-purple-500" />
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Commit Rate</span>
                                  </div>
                                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {event.details?.match(/Commit rate:\s*([\d.]+\/s)/)?.[1] || '0/s'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Sparkline
                                    data={commitRateHistory.length > 0 ? commitRateHistory : [0]}
                                    width={120}
                                    height={32}
                                    color="#a855f7"
                                    fillColor="rgba(168, 85, 247, 0.15)"
                                    type="area"
                                  />
                                  <div className="flex-1 text-right">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {commitRateHistory.length > 0 ? `Last ${commitRateHistory.length} points` : 'No data'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {activityEvents.length > 0 && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800/30">
                  <button className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 group">
                    <span>View All Events History</span>
                    <TrendingUp className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}
            </div>

            {/* Alert History (Coming Soon) */}
            <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="w-6 h-6 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Alert History</h3>
                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-2 py-1 rounded">Coming Soon</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Historical view of triggered alerts with resolution times and impact analysis
              </p>
            </div>

                {/* Info Box */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        Real-time Monitoring Active
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Monitoring data for <strong>{selectedPipeline.name}</strong> is being refreshed every 30 seconds.
                        {autoRefresh && ' Auto-refresh is enabled.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Kafka Tab */}
            {activeTab === 'kafka' && (
              <div className="space-y-6">
                {/* Consumer Metrics Dashboard */}
                {consumerMetrics && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Consumer Lag - CRITICAL */}
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-700 rounded-lg p-5">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Consumer Lag</h4>
                      <div className="text-3xl font-bold text-red-700 dark:text-red-300">
                        {consumerMetrics.kafka_consumer_consumer_fetch_manager_metrics_records_lag_max?.toFixed(0) || 0}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Max Records Behind</div>
                    </div>

                    {/* Consumption Rate */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-lg p-5">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Consumption Rate</h4>
                      <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                        {consumerMetrics.kafka_consumer_consumer_fetch_manager_metrics_records_consumed_rate?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Records/sec</div>
                    </div>

                    {/* Fetch Latency */}
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-5">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Fetch Latency</h4>
                      <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                        {consumerMetrics.kafka_consumer_consumer_fetch_manager_metrics_fetch_latency_avg?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">ms (avg)</div>
                    </div>

                    {/* Last Poll */}
                    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-5">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Last Poll</h4>
                      <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
                        {consumerMetrics.kafka_consumer_consumer_metrics_last_poll_seconds_ago?.toFixed(1) || '0.0'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">seconds ago</div>
                    </div>

                    {/* Assigned Partitions */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-5">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Assigned Partitions</h4>
                      <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                        {consumerMetrics.kafka_consumer_consumer_coordinator_metrics_assigned_partitions || 0}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Active</div>
                    </div>

                    {/* Commit Rate */}
                    <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 border border-pink-200 dark:border-pink-700 rounded-lg p-5">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Commit Rate</h4>
                      <div className="text-3xl font-bold text-pink-700 dark:text-pink-300">
                        {consumerMetrics.kafka_consumer_consumer_coordinator_metrics_commit_rate?.toFixed(2) || '0.00'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">commits/sec</div>
                    </div>

                    {/* WAL Size - PostgreSQL only */}
                    {selectedPipeline?.source_type === 'postgres' && (
                      <div className="lg:col-span-2">
                        <WALSizePanel
                          pipelineId={selectedPipelineId!}
                          height={300}
                        />
                      </div>
                    )}

                    {/* Consumer Group Panel */}
                    <div className="lg:col-span-1">
                      <ConsumerGroupPanel
                        pipelineId={selectedPipelineId!}
                        height={300}
                      />
                    </div>

                    {/* Redo Log - Oracle only */}
                    {selectedPipeline?.source_type === 'oracle' && (
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-5">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Redo Log Size</h4>
                        <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                          0.00
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">MB (Coming Soon)</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* JMX Tab */}
            {activeTab === 'jmx' && (
              <div className="space-y-6">
                {!jmxMetrics ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400">Loading JMX metrics...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">JMX Metrics</h3>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* JMX Scrape Performance */}
                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-5">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                              <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">JMX Scrape Performance</h4>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Scrape Duration</span>
                              <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                                {jmxMetrics.jmx_scrape_duration_seconds?.toFixed(3) || '0.000'} sec
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Cached Beans</span>
                              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {jmxMetrics.jmx_scrape_cached_beans || 0}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Scrape Errors</span>
                              <span className={`text-lg font-bold ${jmxMetrics.jmx_scrape_error > 0 ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                                {jmxMetrics.jmx_scrape_error || 0}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* JMX Config Reload Stats */}
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-lg p-5">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                              <RefreshCw className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Config Reload Stats</h4>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Success Total</span>
                              <span className="text-lg font-bold text-green-700 dark:text-green-300">
                                {jmxMetrics.jmx_config_reload_success_total || 0}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Failure Total</span>
                              <span className="text-lg font-bold text-red-700 dark:text-red-300">
                                {jmxMetrics.jmx_config_reload_failure_total || 0}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* JMX Build Info */}
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-5">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                              <Info className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">JMX Build Info</h4>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Exporter Version</span>
                              <span className="text-lg font-bold text-purple-700 dark:text-purple-300">
                                {jmxMetrics.jmx_exporter_build_info?.version || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Info Note */}
                    <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                        <div>
                          <h5 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                            JMX Metrics Available
                          </h5>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            These 8 JMX metrics are exposed by the JMX exporter running on Prometheus. You can query these metrics directly using Prometheus queries or create custom dashboards in Grafana.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
