import { useQuery } from '@tanstack/react-query';
import { getPipelineActivity, type PipelineActivity } from '../lib/debezium';

export type RefreshInterval = 1000 | 5000 | 10000 | 30000 | 60000 | 300000 | 600000 | 900000 | 1800000;

interface UsePipelineActivityOptions {
  pipelineId: string;
  enabled?: boolean;
  refetchInterval?: RefreshInterval;
}

/**
 * React Query hook for fetching pipeline activity with smooth polling
 * - Polls in background without blocking UI
 * - Keeps old data while fetching new data (no flicker)
 * - Updates UI with a "patch" approach
 * - Never causes layout shake
 * - Uses cache to prevent blink on page refresh
 */
export function usePipelineActivity({
  pipelineId,
  enabled = true,
  refetchInterval = 60000, // Default: 1 minute
}: UsePipelineActivityOptions) {
  return useQuery<PipelineActivity | null>({
    queryKey: ['pipeline-activity', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return null;
      try {
        return await getPipelineActivity(pipelineId, '24h');
      } catch (error) {
        console.error('Failed to load pipeline activity:', error);
        return null;
      }
    },
    enabled: enabled && !!pipelineId,
    refetchInterval, // Smooth polling interval
    staleTime: 5000,  // Data stays fresh for 5 seconds
    refetchOnWindowFocus: false,
    // Keep previous data while fetching - prevents flicker during refresh
    placeholderData: (previousData) => previousData,
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes after unmount
  });
}
