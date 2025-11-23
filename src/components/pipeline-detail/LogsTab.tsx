import { useState, useEffect } from 'react';
import { Search, Download, AlertTriangle, Info, AlertCircle, CheckCircle, Filter, ChevronRight, BellRing, X } from 'lucide-react';
import { usePipelineAlerts, resolveAlert, getAlertSeverityColor, getAlertTypeDisplayName } from '../../hooks/useAlerts';
import { useQueryClient } from '@tanstack/react-query';

interface LogEntry {
  id: string;
  timestamp: string;
  severity: 'error' | 'warn' | 'info';
  message: string;
  context?: Record<string, unknown>;
  workerId?: string;
}

interface DLQRecord {
  id: string;
  key: string;
  topic: string;
  partition: number;
  offset: number;
  timestamp: string;
  errorReason: string;
}

interface StateChange {
  id: string;
  timestamp: string;
  from: string;
  to: string;
  workerId: string;
  task?: string;
}

const mockDLQRecords: DLQRecord[] = [
  {
    id: '1',
    key: 'order-12345',
    topic: 'oracle.SALES.ORDERS',
    partition: 2,
    offset: 1523456,
    timestamp: '2024-11-12T10:30:15Z',
    errorReason: 'Schema validation failed: missing required field "customer_id"',
  },
  {
    id: '2',
    key: 'customer-98765',
    topic: 'oracle.SALES.CUSTOMERS',
    partition: 1,
    offset: 892341,
    timestamp: '2024-11-12T09:15:30Z',
    errorReason: 'Data type mismatch: expected INTEGER, got VARCHAR',
  },
];

interface LogsTabProps {
  pipelineId: string;
  pipelineStatus?: string;
  activeView: 'logs' | 'dlq' | 'timeline' | 'alerts';
  searchQuery: string;
  severityFilter: string;
}

export function LogsTab({ pipelineId, pipelineStatus, activeView, searchQuery, severityFilter }: LogsTabProps) {
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stateChanges, setStateChanges] = useState<StateChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [alertErrors, setAlertErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Fetch pipeline alerts (both resolved and unresolved)
  const { data: alerts = [] } = usePipelineAlerts(pipelineId, { refetchInterval: 10000 });

  // Fetch logs from backend
  const fetchLogs = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    const backendUrl = import.meta.env.VITE_DEBEZIUM_BACKEND_URL;
    if (!backendUrl) {
      console.error('Debezium Backend URL not configured');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/pipelines/${pipelineId}/logs`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Fetch state changes from backend
  const fetchStateChanges = async (silent = false) => {
    const backendUrl = import.meta.env.VITE_DEBEZIUM_BACKEND_URL;
    if (!backendUrl) {
      console.error('Debezium Backend URL not configured');
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/pipelines/${pipelineId}/state-changes`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.stateChanges)) {
          setStateChanges(data.stateChanges);
        }
      }
    } catch (error) {
      console.error('Failed to fetch state changes:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchLogs();
    fetchStateChanges();
  }, [pipelineId]);

  // Auto-refresh every 5 seconds (for all active pipelines)
  useEffect(() => {
    // Only stop refresh if pipeline is explicitly stopped/deleted
    if (pipelineStatus === 'stopped' || pipelineStatus === 'deleted') return;

    const interval = setInterval(() => {
      fetchLogs(true); // Silent refresh
      fetchStateChanges(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [pipelineStatus, pipelineId]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warn':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const downloadLogs = () => {
    const logsToDownload = filteredLogs.length > 0 ? filteredLogs : logs;
    const logsText = logsToDownload
      .map((log) => {
        return `[${formatTimestamp(log.timestamp)}] [${log.severity.toUpperCase()}] ${log.message}${
          log.workerId ? ` (Worker: ${log.workerId})` : ''
        }${log.context ? `\nContext: ${JSON.stringify(log.context)}` : ''}`;
      })
      .join('\n\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-${pipelineId}-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="space-y-6">
      {activeView === 'logs' && (
        <>
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-all ${getSeverityColor(log.severity)}`}
              >
                <div className="flex items-start gap-3">
                  {getSeverityIcon(log.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 uppercase">
                        {log.severity}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{log.message}</p>
                    {log.workerId && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Worker: {log.workerId}</p>
                    )}
                    {log.context && (
                      <button className="text-xs text-blue-600 dark:text-blue-400 mt-2 hover:underline flex items-center gap-1">
                        View context
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeView === 'timeline' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">State Changes</h3>
          <div className="relative">
            {stateChanges.map((change, index) => (
              <div key={change.id} className="relative pb-8 last:pb-0">
                {index < stateChanges.length - 1 && (
                  <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-700" />
                )}
                <div className="relative flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                          {change.from}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                          {change.to}
                        </span>
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {formatTimestamp(change.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {change.task && <span className="font-medium">{change.task} • </span>}
                      <span className="text-gray-600 dark:text-gray-400">Worker: {change.workerId}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeView === 'dlq' && (
        <div className="space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <div className="text-sm text-yellow-900 dark:text-yellow-100">
                <p className="font-medium mb-1">Dead Letter Queue</p>
                <p className="text-yellow-800 dark:text-yellow-200">
                  Records that failed processing are stored here. Review and retry as needed.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Topic
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Partition/Offset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {mockDLQRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-gray-900 dark:text-gray-100">{record.key}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">{record.topic}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {record.partition} / {record.offset}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {formatTimestamp(record.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mockDLQRecords.length > 0 && (
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Retry All
              </button>
              <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download DLQ Records
              </button>
            </div>
          )}
        </div>
      )}

      {/* Alerts View */}
      {activeView === 'alerts' && (
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Alerts
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This pipeline has no unresolved alerts. The monitoring system is actively checking for issues.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`bg-white dark:bg-gray-800 border rounded-lg p-4 ${
                    alert.severity === 'critical'
                      ? 'border-red-300 dark:border-red-700'
                      : alert.severity === 'warning'
                      ? 'border-yellow-300 dark:border-yellow-700'
                      : 'border-blue-300 dark:border-blue-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <BellRing className={`w-5 h-5 ${
                          alert.severity === 'critical'
                            ? 'text-red-600 dark:text-red-400'
                            : alert.severity === 'warning'
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`} />
                        <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${getAlertSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          {getAlertTypeDisplayName(alert.alert_type)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(alert.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                        {alert.message}
                      </p>
                      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                        <details className="text-xs text-gray-600 dark:text-gray-400">
                          <summary className="cursor-pointer hover:text-gray-900 dark:hover:text-gray-200">
                            View Details
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
                            {JSON.stringify(alert.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setAlertErrors((prev) => {
                            const newErrors = { ...prev };
                            delete newErrors[alert.id];
                            return newErrors;
                          });
                          await resolveAlert(alert.id);
                          queryClient.invalidateQueries({ queryKey: ['pipeline-alerts', pipelineId] });
                          queryClient.invalidateQueries({ queryKey: ['alerts'] });
                          queryClient.invalidateQueries({ queryKey: ['alert-stats'] });
                        } catch (error) {
                          console.error('Failed to resolve alert:', error);
                          setAlertErrors((prev) => ({
                            ...prev,
                            [alert.id]: (error as Error).message || 'Failed to resolve alert'
                          }));
                        }
                      }}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-1.5"
                      title="Mark as resolved"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Resolve
                    </button>
                  </div>
                  {alertErrors[alert.id] && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                          {alertErrors[alert.id]}
                        </p>
                      </div>
                      <button
                        onClick={() => setAlertErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors[alert.id];
                          return newErrors;
                        })}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedLog && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setSelectedLog(null)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Log Details</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Message</div>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedLog.message}</p>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Timestamp</div>
                <p className="text-sm text-gray-900 dark:text-gray-100">{formatTimestamp(selectedLog.timestamp)}</p>
              </div>
              {selectedLog.context && (
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Context</div>
                  <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-xs text-gray-900 dark:text-gray-100 overflow-auto">
                    {JSON.stringify(selectedLog.context, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
