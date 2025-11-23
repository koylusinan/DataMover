import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';
import { Settings, Slack as SlackIcon, ArrowLeft, Loader2, Bell, Check, X, LayoutDashboard, Gauge } from 'lucide-react';
import { SlackIntegrationTab } from '../components/admin/SlackIntegrationTab';

interface Pipeline {
  id: string;
  name: string;
}

interface SlackChannel {
  id: string;
  name: string;
  description?: string;
}

interface AlertPreferences {
  id?: string;
  pipeline_id: string;
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
}

const alertTypes = [
  { key: 'pipeline_connectivity', label: 'Pipeline Connectivity', description: 'Alerts when pipeline connection is lost or restored' },
  { key: 'pipeline_job_failures', label: 'Pipeline Job Failures', description: 'Alerts when pipeline jobs fail' },
  { key: 'source_event_types', label: 'Source Event Types', description: 'Alerts about different source event types' },
  { key: 'failed_events_summary', label: 'Failed Events Summary', description: 'Summary of failed events' },
  { key: 'webhooks', label: 'Webhooks', description: 'Webhook-related alerts' },
  { key: 'pipeline_loading_status', label: 'Pipeline Loading Status', description: 'Alerts about pipeline loading progress' },
  { key: 'source_side_events', label: 'Source Side Events', description: 'Alerts from source-side events' },
  { key: 'data_spike_alert', label: 'Data Spike Alert', description: 'Alerts when unusual data spikes are detected' },
];

const defaultPreferences = (pipelineId: string): AlertPreferences => ({
  pipeline_id: pipelineId,
  pipeline_connectivity_slack: false,
  pipeline_connectivity_dashboard: false,
  pipeline_job_failures_slack: false,
  pipeline_job_failures_dashboard: false,
  source_event_types_slack: false,
  source_event_types_dashboard: false,
  failed_events_summary_slack: false,
  failed_events_summary_dashboard: false,
  webhooks_slack: false,
  webhooks_dashboard: false,
  pipeline_loading_status_slack: false,
  pipeline_loading_status_dashboard: false,
  source_side_events_slack: false,
  source_side_events_dashboard: false,
  data_spike_alert_slack: false,
  data_spike_alert_dashboard: false,
});

export default function AlertPreferencesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'preferences' | 'slack' | 'thresholds'>('preferences');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [preferences, setPreferences] = useState<AlertPreferences | null>(null);
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);

  // Monitoring thresholds state
  const [thresholds, setThresholds] = useState({
    lag_ms: 5000,
    throughput_drop_percent: 50,
    error_rate_percent: 1,
    dlq_count: 0,
    check_interval_ms: 60000,
    pause_duration_seconds: 5,
  });

  useEffect(() => {
    loadPipelines();
    loadThresholds();
  }, []);

  useEffect(() => {
    if (selectedPipelineId) {
      loadPreferences();
      loadSlackChannels();
    }
  }, [selectedPipelineId]);

  const loadPipelines = async () => {
    try {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name')
        .order('name');

      if (error) throw error;

      setPipelines(data || []);
      if (data && data.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load pipelines:', error);
      showToast('error', 'Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    if (!selectedPipelineId) return;

    try {
      const { data, error } = await supabase
        .from('alert_preferences')
        .select('*')
        .eq('pipeline_id', selectedPipelineId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences(data as AlertPreferences);
      } else {
        setPreferences(defaultPreferences(selectedPipelineId));
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
      showToast('error', 'Failed to load alert preferences');
    }
  };

  const loadSlackChannels = async () => {
    if (!selectedPipelineId) return;

    try {
      const { data, error } = await supabase
        .from('pipeline_slack_channels')
        .select(`
          id,
          slack_webhooks (
            id,
            name,
            description
          )
        `)
        .eq('pipeline_id', selectedPipelineId);

      if (error) throw error;

      const channels = data?.map((item: any) => ({
        id: item.slack_webhooks.id,
        name: item.slack_webhooks.name,
        description: item.slack_webhooks.description,
      })) || [];

      setSlackChannels(channels);
    } catch (error) {
      console.error('Failed to load Slack channels:', error);
    }
  };

  const handleToggle = (alertKey: string, channel: 'slack' | 'dashboard') => {
    if (!preferences) return;

    const key = `${alertKey}_${channel}` as keyof AlertPreferences;
    setPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  const loadThresholds = async () => {
    try {
      const response = await fetch('http://localhost:5002/api/monitoring/thresholds');
      const data = await response.json();
      if (data.success) {
        setThresholds(data.thresholds);
      }
    } catch (error) {
      console.error('Failed to load thresholds:', error);
    }
  };

  const handleSaveThresholds = async () => {
    setSaving(true);
    try {
      const response = await fetch('http://localhost:5002/api/monitoring/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholds),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      showToast('success', 'Monitoring thresholds updated successfully. Restart backend to apply changes.');
    } catch (error: any) {
      console.error('Failed to save thresholds:', error);
      showToast('error', 'Failed to save thresholds', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!preferences || !selectedPipelineId) return;

    setSaving(true);
    try {
      const saveData = {
        ...preferences,
        pipeline_id: selectedPipelineId,
        created_by: user?.id,
      };

      const { error } = await supabase
        .from('alert_preferences')
        .upsert(saveData, {
          onConflict: 'pipeline_id',
        });

      if (error) throw error;

      showToast('success', 'Alert preferences saved successfully');
    } catch (error: any) {
      console.error('Failed to save preferences:', error);
      showToast('error', 'Failed to save preferences', error.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  Alert Settings
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Configure alert preferences for your pipelines
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => setActiveTab('preferences')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'preferences'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Settings className="w-4 h-4 inline-block mr-2" />
              Alert Preferences
            </button>
            <button
              onClick={() => setActiveTab('thresholds')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'thresholds'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Gauge className="w-4 h-4 inline-block mr-2" />
              Monitoring Thresholds
            </button>
            <button
              onClick={() => setActiveTab('slack')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'slack'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <SlackIcon className="w-4 h-4 inline-block mr-2" />
              Slack Integrations
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'thresholds' ? (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Proactive Monitoring Thresholds
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Configure global thresholds for automatic alert generation. These settings apply to all pipelines.
              </p>

              <div className="space-y-6">
                {/* Lag Threshold */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Maximum Lag (milliseconds)
                  </label>
                  <input
                    type="number"
                    value={thresholds.lag_ms}
                    onChange={(e) => setThresholds({ ...thresholds, lag_ms: Number(e.target.value) })}
                    className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Alert when pipeline lag exceeds this value (default: 5000ms = 5 seconds)
                  </p>
                </div>

                {/* Throughput Drop */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Throughput Drop Threshold (%)
                  </label>
                  <input
                    type="number"
                    value={thresholds.throughput_drop_percent}
                    onChange={(e) => setThresholds({ ...thresholds, throughput_drop_percent: Number(e.target.value) })}
                    className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Alert when throughput drops by this percentage (default: 50%)
                  </p>
                </div>

                {/* Error Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Maximum Error Rate (%)
                  </label>
                  <input
                    type="number"
                    value={thresholds.error_rate_percent}
                    onChange={(e) => setThresholds({ ...thresholds, error_rate_percent: Number(e.target.value) })}
                    className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Alert when error rate exceeds this percentage (default: 1%)
                  </p>
                </div>

                {/* DLQ Count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    DLQ Message Threshold
                  </label>
                  <input
                    type="number"
                    value={thresholds.dlq_count}
                    onChange={(e) => setThresholds({ ...thresholds, dlq_count: Number(e.target.value) })}
                    className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Alert when DLQ message count exceeds this value (default: 0 = any DLQ messages trigger alert)
                  </p>
                </div>

                {/* Pause Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Connector Pause Duration Threshold (seconds)
                  </label>
                  <input
                    type="number"
                    value={thresholds.pause_duration_seconds}
                    onChange={(e) => setThresholds({ ...thresholds, pause_duration_seconds: Number(e.target.value) })}
                    className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Alert when connector remains PAUSED for this duration (default: 5 seconds, max: 60 seconds)
                  </p>
                </div>

                {/* Check Interval */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monitoring Check Interval (milliseconds)
                  </label>
                  <input
                    type="number"
                    value={thresholds.check_interval_ms}
                    onChange={(e) => setThresholds({ ...thresholds, check_interval_ms: Number(e.target.value) })}
                    className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    How often to check all pipelines (default: 60000ms = 60 seconds)
                  </p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> After saving these settings, you must restart the backend service for changes to take effect.
                </p>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleSaveThresholds}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Thresholds
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'preferences' ? (
          <div className="space-y-6">
            {/* Pipeline Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Pipeline
              </label>
              <select
                value={selectedPipelineId}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
                className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>

              {selectedPipeline && slackChannels.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <SlackIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Assigned Slack Channels
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {slackChannels.map((channel) => (
                          <span
                            key={channel.id}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-700"
                          >
                            #{channel.name}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                        Alerts will be sent to these channels when enabled below
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedPipeline && slackChannels.length === 0 && (
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    No Slack channels assigned to this pipeline. Slack alerts will not be sent.
                    <button
                      onClick={() => navigate(`/pipelines/${selectedPipelineId}`)}
                      className="ml-2 text-amber-600 dark:text-amber-400 underline hover:no-underline"
                    >
                      Assign channels
                    </button>
                  </p>
                </div>
              )}
            </div>

            {/* Alert Types Table */}
            {preferences && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Defined Alarms for "{selectedPipeline?.name}"
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Configure alert types for this pipeline. Alarms will be sent to assigned Slack channels.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Alert Type
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <SlackIcon className="w-4 h-4 inline-block mr-1" />
                          Slack
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <LayoutDashboard className="w-4 h-4 inline-block mr-1" />
                          Dashboard
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {alertTypes.map((alertType) => (
                        <tr key={alertType.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {alertType.label}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {alertType.description}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleToggle(alertType.key, 'slack')}
                              className={`inline-flex items-center justify-center w-12 h-6 rounded-full transition-colors ${
                                preferences[`${alertType.key}_slack` as keyof AlertPreferences]
                                  ? 'bg-blue-600'
                                  : 'bg-gray-300 dark:bg-gray-600'
                              }`}
                            >
                              <span
                                className={`inline-block w-4 h-4 rounded-full bg-white transform transition-transform ${
                                  preferences[`${alertType.key}_slack` as keyof AlertPreferences]
                                    ? 'translate-x-3'
                                    : '-translate-x-3'
                                }`}
                              />
                            </button>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleToggle(alertType.key, 'dashboard')}
                              className={`inline-flex items-center justify-center w-12 h-6 rounded-full transition-colors ${
                                preferences[`${alertType.key}_dashboard` as keyof AlertPreferences]
                                  ? 'bg-blue-600'
                                  : 'bg-gray-300 dark:bg-gray-600'
                              }`}
                            >
                              <span
                                className={`inline-block w-4 h-4 rounded-full bg-white transform transition-transform ${
                                  preferences[`${alertType.key}_dashboard` as keyof AlertPreferences]
                                    ? 'translate-x-3'
                                    : '-translate-x-3'
                                }`}
                              />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <SlackIntegrationTab />
        )}
      </div>
    </div>
  );
}
