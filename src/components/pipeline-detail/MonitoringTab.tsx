import { Activity, TrendingUp, TrendingDown, AlertTriangle, Database, Zap, Loader2, Info, Bell, MessageSquare, LayoutDashboard, X } from 'lucide-react';
import { KpiChip } from '../ui/KpiChip';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getPipelineMonitoring, type PipelineMonitoring, type MetricData as ApiMetricData, type ConnectorTaskMetric, type SlowTable } from '../../lib/debezium';
import { PipelineSlackChannels } from './PipelineSlackChannels';
import { ThroughputChart } from '../monitoring/ThroughputChart';
import { LatencyChart } from '../monitoring/LatencyChart';
import { WALSizePanel } from '../monitoring/WALSizePanel';
import GridLayout, { Layout, Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

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
  const [selectedPanels, setSelectedPanels] = useState<string[]>([]);
  const [layout, setLayout] = useState<Layout[]>([]);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // Generate default layout based on selected panels
  const generateDefaultLayout = (panels: string[]): Layout[] => {
    return panels.map((panelId, index) => ({
      i: panelId,
      x: (index % 2) * 6, // 2 columns: 0 or 6
      y: Math.floor(index / 2) * 4, // Row calculation
      w: 6, // Width (12 columns total, so 6 = half width)
      h: 4, // Height in grid units (80 * 4 = 320px to match chart height)
      minW: 4,
      minH: 3
    }));
  };

  // Save layout to backend
  const saveLayout = async (newLayout: Layout[]) => {
    if (!pipelineId) return;

    try {
      await fetch(`http://localhost:5001/api/monitoring-layout/${pipelineId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'default',
          layout: newLayout
        })
      });
      console.log('✓ Saved layout preferences');
    } catch (error) {
      console.error('Failed to save layout:', error);
    }
  };

  // Handle layout change
  const handleLayoutChange = (newLayout: Layout[]) => {
    setLayout(newLayout);
    saveLayout(newLayout);
  };

  // Update layout when selectedPanels change (e.g., new panel added)
  useEffect(() => {
    // Don't run during initial load - wait for Redis data to load first
    if (!isInitialLoadComplete) return;
    if (selectedPanels.length === 0) return;

    // Check if there are new panels not in current layout
    const panelsInLayout = layout.map(item => item.i);
    const newPanels = selectedPanels.filter(panelId => !panelsInLayout.includes(panelId));

    if (newPanels.length > 0) {
      // Add new panels to layout
      const newLayoutItems = newPanels.map((panelId, index) => ({
        i: panelId,
        x: ((layout.length + index) % 2) * 6,
        y: Math.floor((layout.length + index) / 2) * 4,
        w: 6,
        h: 4, // Height in grid units (80 * 4 = 320px to match chart height)
        minW: 4,
        minH: 3
      }));

      const updatedLayout = [...layout, ...newLayoutItems];
      setLayout(updatedLayout);
      saveLayout(updatedLayout);
    }
  }, [selectedPanels, isInitialLoadComplete]);

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

  // Fetch selected panel preferences from Redis
  useEffect(() => {
    const fetchPanelPreferences = async () => {
      if (!pipelineId) return;

      try {
        const response = await fetch(`http://localhost:5001/api/monitoring-panels/${pipelineId}?userId=default`);
        const data = await response.json();

        if (data.success && data.panels?.panels) {
          const panels = data.panels.panels;
          setSelectedPanels(panels);
          console.log('✓ Loaded panel preferences:', panels);

          // Load layout
          try {
            const layoutResponse = await fetch(`http://localhost:5001/api/monitoring-layout/${pipelineId}?userId=default`);
            const layoutData = await layoutResponse.json();

            if (layoutData.success && layoutData.layout?.layout) {
              // Migrate old layout data: update h:6 to h:4, minH:4 to minH:3 (charts are now smaller)
              const migratedLayout = layoutData.layout.layout.map((item: Layout) => {
                const needsMigration = item.h === 6 || item.minH === 4;
                if (needsMigration) {
                  return {
                    ...item,
                    h: item.h === 6 ? 4 : item.h,
                    minH: item.minH === 4 ? 3 : item.minH
                  };
                }
                return item;
              });

              setLayout(migratedLayout);

              // Save migrated layout back to Redis if any changes were made
              const hasMigration = migratedLayout.some((item: Layout, index: number) =>
                item.h !== layoutData.layout.layout[index].h ||
                item.minH !== layoutData.layout.layout[index].minH
              );

              if (hasMigration) {
                console.log('✓ Migrated old layout (h:6→h:4) and saved to Redis');
                saveLayout(migratedLayout);
              } else {
                console.log('✓ Loaded layout preferences');
              }
            } else {
              // Generate default layout if none exists
              const defaultLayout = generateDefaultLayout(panels);
              setLayout(defaultLayout);
              console.log('✓ Generated default layout');
            }
          } catch (layoutError) {
            console.log('No saved layout, generating default');
            const defaultLayout = generateDefaultLayout(panels);
            setLayout(defaultLayout);
          }
        }
      } catch (error) {
        console.error('Failed to load panel preferences:', error);
      } finally {
        // Mark initial load as complete
        setIsInitialLoadComplete(true);
      }
    };

    fetchPanelPreferences();
  }, [pipelineId, isActive]); // Re-fetch when tab becomes active

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

  // Transform monitoring data for ThroughputChart
  const throughputChartData = monitoring?.throughputMetrics && monitoring.throughputMetrics.length > 0
    ? monitoring.throughputMetrics.map((_, index) => {
        const match = monitoring.throughputMetrics[index]?.value?.match(/(\d+)/);
        const value = match ? parseFloat(match[1]) : 0;
        return {
          timestamp: Date.now() - (monitoring.throughputMetrics.length - index - 1) * 5000,
          value: isNaN(value) ? 0 : value
        };
      }).filter(d => !isNaN(d.timestamp) && !isNaN(d.value))
    : [];

  // Only show chart if we have valid data
  const hasValidThroughputData = throughputChartData.length > 0 &&
    throughputChartData.every(d => !isNaN(d.timestamp) && !isNaN(d.value));

  // Transform monitoring data for LatencyChart (using lagMetrics)
  const latencyChartData = monitoring?.lagMetrics && monitoring.lagMetrics.length > 0
    ? monitoring.lagMetrics.map((metric, index) => {
        // Extract numeric value from metric.value (e.g., "123ms" or "1.2s" -> convert to ms)
        let value = 0;
        if (metric.value) {
          const match = metric.value.match(/([\d.]+)(ms|s|m)?/);
          if (match) {
            const numValue = parseFloat(match[1]);
            const unit = match[2] || 'ms';
            // Convert to milliseconds
            if (unit === 's') value = numValue * 1000;
            else if (unit === 'm') value = numValue * 60000;
            else value = numValue; // already in ms
          }
        }
        return {
          timestamp: Date.now() - (monitoring.lagMetrics.length - index - 1) * 5000,
          value: isNaN(value) ? 0 : value
        };
      }).filter(d => !isNaN(d.timestamp) && !isNaN(d.value))
    : [];

  const hasValidLatencyData = latencyChartData.length > 0 &&
    latencyChartData.every(d => !isNaN(d.timestamp) && !isNaN(d.value));

  // Handle removing panel from details
  const handleRemovePanel = async (panelId: string) => {
    if (!pipelineId) return;

    // Immediately update UI - remove panel from local state
    const currentPanels = selectedPanels.filter(id => id !== panelId);
    const updatedLayout = layout.filter(item => item.i !== panelId);

    setSelectedPanels(currentPanels);
    setLayout(updatedLayout);
    console.log(`✓ Panel "${panelId}" removed from UI`);

    // Try to persist to backend (best-effort, don't block UI)
    try {
      // Save updated panels
      await fetch(`http://localhost:5001/api/monitoring-panels/${pipelineId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'default',
          panels: currentPanels
        })
      });

      // Save updated layout
      await saveLayout(updatedLayout);

      console.log(`✓ Panel "${panelId}" preferences saved to backend`);
    } catch (error) {
      console.warn('Failed to persist panel removal to backend (UI still updated):', error);
      // UI is already updated, so this is non-critical
    }
  };

  // Render panel content by ID
  const renderPanel = (panelId: string) => {
    const panelContent: Record<string, JSX.Element | null> = {
      'throughput': monitoring && hasValidThroughputData && throughputChartData.length > 0 ? (
        <ThroughputChart
          data={throughputChartData}
          title="Source Throughput"
          color="#3b82f6"
        />
      ) : null,
      'latency': monitoring && hasValidLatencyData && latencyChartData.length > 0 ? (
        <LatencyChart
          data={latencyChartData}
          title="Source Latency"
        />
      ) : null,
      'wal-size': pipelineId ? (
        <WALSizePanel
          pipelineId={pipelineId}
          height={320}
        />
      ) : null
    };

    const content = panelContent[panelId];
    if (!content) return null;

    return (
      <div key={panelId} className="relative h-full w-full" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('Remove button clicked for panel:', panelId);
            handleRemovePanel(panelId);
          }}
          className="absolute top-2 right-2 z-[9999] p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors shadow-lg cursor-pointer"
          title="Remove from Details"
          style={{ pointerEvents: 'auto' }}
        >
          <X className="w-4 h-4" />
        </button>
        {content}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Panels Section */}
      {selectedPanels.length > 0 && layout.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Dashboard Panels
          </h3>
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: layout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={80}
            onLayoutChange={(currentLayout) => handleLayoutChange(currentLayout)}
            isDraggable={false}
            isResizable={false}
            compactType="vertical"
            preventCollision={false}
          >
            {selectedPanels.map(panelId => renderPanel(panelId)).filter(Boolean)}
          </ResponsiveGridLayout>
        </div>
      )}

      {selectedPanels.includes('pipeline-state') && (
        <div className="relative">
          <button
            onClick={() => handleRemovePanel('pipeline-state')}
            className="absolute top-4 right-4 z-10 p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
            title="Remove from Details"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pipeline State</h3>
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
        </div>
      )}

      {selectedPanels.includes('end-to-end-latency') && lagMetrics.length > 0 && (
        <div className="relative">
          <button
            onClick={() => handleRemovePanel('end-to-end-latency')}
            className="absolute top-4 right-4 z-10 p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
            title="Remove from Details"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">End-to-End Latency</h3>
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
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Throughput</h3>
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

        {selectedPanels.includes('records-flow') && monitoring?.flowMetrics && (
          <div className="relative">
            <button
              onClick={() => handleRemovePanel('records-flow')}
              className="absolute top-4 right-4 z-10 p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
              title="Remove from Details"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Records Flow</h3>
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
        )}
      </div>

      {selectedPanels.includes('top-slow-tables') && slowTables.length > 0 && (
        <div className="relative">
          <button
            onClick={() => handleRemovePanel('top-slow-tables')}
            className="absolute top-4 right-4 z-10 p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
            title="Remove from Details"
          >
            <X className="w-4 h-4" />
          </button>
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
        </div>
      )}

      {selectedPanels.includes('connector-task-health') && connectorTasks.length > 0 && (
        <div className="relative">
          <button
            onClick={() => handleRemovePanel('connector-task-health')}
            className="absolute top-4 right-4 z-10 p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors"
            title="Remove from Details"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Connector Task Health Map
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({connectorTasks.length} {connectorTasks.length === 1 ? 'task' : 'tasks'})
              </span>
            </h3>
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
        </div>
      )}

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
    </div>
  );
}
