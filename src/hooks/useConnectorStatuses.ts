import { useQuery } from '@tanstack/react-query';

interface ConnectorStatus {
  name: string;
  connector: {
    state: string;
    worker_id: string;
  };
  tasks: any[];
}

interface PipelineConnectorStatuses {
  source: ConnectorStatus | null;
  sink: ConnectorStatus | null;
}

interface UseConnectorStatusesOptions {
  pipelineId: string;
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * React Query hook for fetching connector statuses with smooth polling
 * - Polls Kafka Connect for real-time connector states
 * - Keeps old data while fetching new data (no flicker)
 * - Syncs with progress refresh interval
 * - Uses cache to prevent blink on page refresh
 */
export function useConnectorStatuses({
  pipelineId,
  enabled = true,
  refetchInterval = 60000, // Default: 1 minute
}: UseConnectorStatusesOptions) {
  return useQuery<PipelineConnectorStatuses>({
    queryKey: ['connector-statuses', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return { source: null, sink: null };

      try {
        const response = await fetch(`http://localhost:5002/api/pipelines/${pipelineId}/status`);
        if (!response.ok) {
          throw new Error('Failed to fetch connector statuses');
        }

        const data = await response.json();
        return data.status || { source: null, sink: null };
      } catch (error) {
        console.error('Failed to load connector statuses:', error);
        return { source: null, sink: null };
      }
    },
    enabled: enabled && !!pipelineId,
    refetchInterval,
    staleTime: 0, // Always allow immediate refetch for instant status updates
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Keep previous data during refetch
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes after unmount
  });
}
