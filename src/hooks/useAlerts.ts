import { useQuery } from '@tanstack/react-query';

interface AlertEvent {
  id: string;
  pipeline_id: string;
  pipeline_name?: string;
  alert_type: 'CONNECTOR_FAILED' | 'TASK_FAILED' | 'HIGH_LAG' | 'THROUGHPUT_DROP' | 'DLQ_MESSAGES' | 'HIGH_ERROR_RATE';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  metadata: Record<string, any>;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AlertStats {
  unresolved_count: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  affected_pipelines: number;
}

interface UseAlertsOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

/**
 * React Query hook for fetching global alert statistics
 * Used for showing alert count in side navigation
 */
export function useAlertStats({ enabled = true, refetchInterval = 10000 }: UseAlertsOptions = {}) {
  return useQuery<AlertStats>({
    queryKey: ['alert-stats'],
    queryFn: async () => {
      const response = await fetch('http://localhost:5002/api/alerts/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch alert stats');
      }
      const data = await response.json();
      return data.stats;
    },
    enabled,
    refetchInterval,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * React Query hook for fetching all unresolved alerts
 * Used for showing alerts in global alerts page
 */
export function useAlerts({ enabled = true, refetchInterval }: UseAlertsOptions = {}) {
  return useQuery<AlertEvent[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const response = await fetch('http://localhost:5002/api/alerts');
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }
      const data = await response.json();
      return data.alerts;
    },
    enabled,
    refetchInterval,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * React Query hook for fetching alerts for a specific pipeline
 */
export function usePipelineAlerts(pipelineId: string, { enabled = true, refetchInterval = 10000 }: UseAlertsOptions = {}) {
  return useQuery<AlertEvent[]>({
    queryKey: ['pipeline-alerts', pipelineId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:5002/api/pipelines/${pipelineId}/alerts?resolved=false`);
      if (!response.ok) {
        throw new Error('Failed to fetch pipeline alerts');
      }
      const data = await response.json();
      return data.alerts;
    },
    enabled: enabled && !!pipelineId,
    refetchInterval,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Helper function to resolve an alert
 */
export async function resolveAlert(alertId: string): Promise<void> {
  const response = await fetch(`http://localhost:5002/api/alerts/${alertId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to resolve alert');
  }
}

/**
 * Helper function to resolve all alerts for a pipeline
 */
export async function resolveAllPipelineAlerts(pipelineId: string): Promise<void> {
  const response = await fetch(`http://localhost:5002/api/pipelines/${pipelineId}/alerts/resolve-all`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to resolve alerts');
  }
}

/**
 * Get severity color for alert badge
 */
export function getAlertSeverityColor(severity: 'critical' | 'warning' | 'info'): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'info':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  }
}

/**
 * Get alert type display name
 */
export function getAlertTypeDisplayName(alertType: string): string {
  const names: Record<string, string> = {
    'CONNECTOR_FAILED': 'Connector Failed',
    'TASK_FAILED': 'Task Failed',
    'HIGH_LAG': 'High Lag',
    'THROUGHPUT_DROP': 'Throughput Drop',
    'DLQ_MESSAGES': 'DLQ Messages',
    'HIGH_ERROR_RATE': 'High Error Rate',
  };
  return names[alertType] || alertType;
}
