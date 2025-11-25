import { useState, useEffect } from 'react';
import { Database, Settings, X, Activity, Clock, HardDrive, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface WALSizePanelProps {
  pipelineId: string;
  height?: number;
}

interface WALSettings {
  enable_log_monitoring: boolean;
  max_wal_size: number;
  alert_threshold: number;
  log_monitoring_slack: boolean;
  wal_check_interval_seconds: number;
}

interface ReplicationSlot {
  slot_name: string;
  active: boolean;
  wal_status: string;
  lag_bytes: number;
}

interface PhysicalWAL {
  total_size_mb: number;
  total_size_pretty: string;
  file_count: number;
}

export function WALSizePanel({ pipelineId, height }: WALSizePanelProps) {
  const [walSize, setWalSize] = useState<number>(0);
  const [replicationSlot, setReplicationSlot] = useState<ReplicationSlot | null>(null);
  const [physicalWal, setPhysicalWal] = useState<PhysicalWAL | null>(null);
  const [settings, setSettings] = useState<WALSettings>({
    enable_log_monitoring: false,
    max_wal_size: 1024,
    alert_threshold: 80,
    log_monitoring_slack: false,
    wal_check_interval_seconds: 60,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [walHistory, setWalHistory] = useState<number[]>([12, 15, 18, 14, 20, 17, 19, 16, 21, 18]);

  // Load settings and WAL size
  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [pipelineId]);

  const loadData = async () => {
    try {
      // Fetch WAL size and replication slot info from backend API
      const response = await fetch(`http://localhost:5001/api/pipelines/${pipelineId}/wal-size`);
      const result = await response.json();

      if (result.success && result.data) {
        const walData = result.data;

        // Update WAL size
        setWalSize(walData.wal_size_mb);

        // Update settings from API response
        setSettings(prev => ({
          ...prev,
          max_wal_size: walData.max_wal_size_mb,
          alert_threshold: walData.alert_threshold_percent,
        }));

        // Update replication slot info
        if (walData.replication_slot) {
          setReplicationSlot(walData.replication_slot);
        }

        // Update physical WAL info
        if (walData.physical_wal) {
          setPhysicalWal(walData.physical_wal);
        }

        // Update history
        setWalHistory(prev => {
          const newHistory = [...prev.slice(1), walData.wal_size_mb];
          return newHistory;
        });
      }

      // Also fetch other settings from Supabase
      const { data, error } = await supabase
        .from('pipelines')
        .select('enable_log_monitoring, log_monitoring_slack, wal_check_interval_seconds')
        .eq('id', pipelineId)
        .single();

      if (error) throw error;
      if (data) {
        setSettings(prev => ({
          ...prev,
          enable_log_monitoring: data.enable_log_monitoring || false,
          log_monitoring_slack: data.log_monitoring_slack || false,
          wal_check_interval_seconds: data.wal_check_interval_seconds || 60,
        }));
      }
    } catch (error) {
      console.error('Error loading WAL data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pipelines')
        .update({
          enable_log_monitoring: settings.enable_log_monitoring,
          max_wal_size: settings.max_wal_size,
          alert_threshold: settings.alert_threshold,
          log_monitoring_slack: settings.log_monitoring_slack,
          wal_check_interval_seconds: settings.wal_check_interval_seconds,
        })
        .eq('id', pipelineId);

      if (error) throw error;
      setShowSettings(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const threshold = (settings.max_wal_size * settings.alert_threshold) / 100;
  const percentage = (walSize / settings.max_wal_size) * 100;
  const isWarning = walSize > threshold;
  const isHealthy = percentage < 50;
  const isCritical = percentage > 90;

  // Calculate circular progress
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <>
      <div
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col"
        style={{ height: height || 400 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isCritical ? 'bg-red-100 dark:bg-red-900/30' : isWarning ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
              <Database className={`w-5 h-5 ${isCritical ? 'text-red-600 dark:text-red-400' : isWarning ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">WAL Size Monitor</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">Write-Ahead Log & Replication</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Configure Log Monitoring"
          >
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="flex-1 p-4 overflow-auto">
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* Left Column - Circular Progress */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative">
                  {/* Circular Progress SVG */}
                  <svg className="transform -rotate-90" width="160" height="160">
                    {/* Background circle */}
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className={`transition-all duration-500 ${
                        isCritical
                          ? 'text-red-600 dark:text-red-400'
                          : isWarning
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    />
                  </svg>

                  {/* Center Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className={`text-3xl font-bold ${
                      isCritical
                        ? 'text-red-600 dark:text-red-400'
                        : isWarning
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {walSize.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">MB</div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{percentage.toFixed(1)}%</div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="mt-4 flex items-center gap-2">
                  {isCritical ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">Critical</span>
                    </>
                  ) : isWarning ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <span className="text-sm font-medium text-orange-600 dark:text-orange-400">Warning</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Healthy</span>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column - Details */}
              <div className="flex flex-col justify-between space-y-3">
                {/* Replication Slot Info */}
                {replicationSlot && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Replication Slot</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Name:</span>
                        <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{replicationSlot.slot_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Status:</span>
                        <span className={`font-medium flex items-center gap-1 ${replicationSlot.active ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${replicationSlot.active ? 'bg-green-600 dark:bg-green-400' : 'bg-red-600 dark:bg-red-400'} animate-pulse`}></span>
                          {replicationSlot.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Lag:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{formatBytes(replicationSlot.lag_bytes)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Mode:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{replicationSlot.wal_status}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Physical WAL Directory */}
                {physicalWal && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Physical WAL (pg_wal/)</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Total Size:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{physicalWal.total_size_pretty}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">File Count:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{physicalWal.file_count} files</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* WAL Metrics */}
                <div className="space-y-2">
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Threshold</span>
                      </div>
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {threshold.toFixed(2)} MB ({settings.alert_threshold}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-gray-400 to-gray-500 h-1.5 rounded-full"
                        style={{ width: `${settings.alert_threshold}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Max Size</span>
                      </div>
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{settings.max_wal_size} MB</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1.5 rounded-full"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Check Interval</span>
                      </div>
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{settings.wal_check_interval_seconds}s</span>
                    </div>
                  </div>
                </div>

                {/* Alert Status */}
                {(isWarning || isCritical) && (
                  <div className={`rounded-lg p-2.5 border ${
                    isCritical
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                  }`}>
                    <div className="flex items-start gap-2">
                      <AlertCircle className={`w-4 h-4 mt-0.5 ${isCritical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`} />
                      <div className="flex-1">
                        <p className={`text-xs font-semibold ${isCritical ? 'text-red-900 dark:text-red-300' : 'text-orange-900 dark:text-orange-300'}`}>
                          {isCritical ? 'Critical Alert' : 'Warning Alert'}
                        </p>
                        <p className={`text-xs mt-0.5 ${isCritical ? 'text-red-700 dark:text-red-400' : 'text-orange-700 dark:text-orange-400'}`}>
                          {isCritical
                            ? 'WAL size critically high. Immediate action recommended.'
                            : 'WAL size exceeds threshold. Monitor closely.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">WAL Monitoring Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Enable Log Monitoring */}
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="relative inline-block w-11 h-6 mt-0.5">
                  <input
                    type="checkbox"
                    checked={settings.enable_log_monitoring}
                    onChange={(e) => setSettings({ ...settings, enable_log_monitoring: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable WAL Monitoring</div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Monitor WAL size and send alerts
                  </p>
                </div>
              </label>

              {settings.enable_log_monitoring && (
                <div className="pl-14 space-y-4 border-l-2 border-blue-200 dark:border-blue-800 ml-5">
                  {/* Max WAL Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Max WAL Size (MB)
                    </label>
                    <input
                      type="number"
                      value={settings.max_wal_size}
                      onChange={(e) => setSettings({ ...settings, max_wal_size: parseInt(e.target.value) || 1024 })}
                      min="0"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  {/* Alert Threshold */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Alert Threshold (%)
                    </label>
                    <input
                      type="number"
                      value={settings.alert_threshold}
                      onChange={(e) => setSettings({ ...settings, alert_threshold: parseInt(e.target.value) || 80 })}
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  {/* Check Interval */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Check Interval (seconds)
                    </label>
                    <input
                      type="number"
                      value={settings.wal_check_interval_seconds}
                      onChange={(e) => setSettings({ ...settings, wal_check_interval_seconds: parseInt(e.target.value) || 60 })}
                      min="10"
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      How often to check WAL size (minimum: 10 seconds)
                    </p>
                  </div>

                  {/* Send Slack Notifications */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.log_monitoring_slack}
                      onChange={(e) => setSettings({ ...settings, log_monitoring_slack: e.target.checked })}
                      className="mt-1 rounded"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Send Slack Notifications
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Receive alerts when WAL size exceeds threshold
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
