import { useState, useEffect } from 'react';
import { Download, AlertTriangle, AlertCircle, CheckCircle, BellRing, X } from 'lucide-react';
import { usePipelineAlerts, resolveAlert, getAlertSeverityColor, getAlertTypeDisplayName } from '../../hooks/useAlerts';
import { useQueryClient } from '@tanstack/react-query';

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
  activeView: 'dlq' | 'timeline' | 'alerts';
  searchQuery: string;
  severityFilter: string;
}

export function LogsTab({ pipelineId, pipelineStatus, activeView }: LogsTabProps) {
  const [stateChanges, setStateChanges] = useState<StateChange[]>([]);
  const [alertErrors, setAlertErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Fetch pipeline alerts (both resolved and unresolved)
  const { data: alerts = [] } = usePipelineAlerts(pipelineId, { refetchInterval: 10000 });

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
    fetchStateChanges();
  }, [pipelineId]);

  // Auto-refresh every 5 seconds (for all active pipelines)
  useEffect(() => {
    // Only stop refresh if pipeline is explicitly stopped/deleted
    if (pipelineStatus === 'stopped' || pipelineStatus === 'deleted') return;

    const interval = setInterval(() => {
      fetchStateChanges(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [pipelineStatus, pipelineId]);

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

  return (
    <div className="space-y-6">
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
    </div>
  );
}
