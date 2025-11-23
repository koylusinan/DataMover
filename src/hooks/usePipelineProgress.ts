import { useQuery } from '@tanstack/react-query';
import { calculatePipelineProgress, type PipelineProgress } from '../lib/debezium';

interface UsePipelineProgressOptions {
  pipelineId: string;
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * React Query hook for fetching pipeline progress with smooth polling
 * - Polls in background without blocking UI
 * - Keeps old data while fetching new data (no flicker)
 * - Never causes layout shake
 * - Uses keepPreviousData to prevent blink on page refresh
 */
export function usePipelineProgress({
  pipelineId,
  enabled = true,
  refetchInterval = 60000, // Default: 1 minute
}: UsePipelineProgressOptions) {
  return useQuery<PipelineProgress>({
    queryKey: ['pipeline-progress', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return {};
      try {
        return await calculatePipelineProgress(pipelineId);
      } catch (error) {
        console.error('Failed to load pipeline progress:', error);
        return {};
      }
    },
    enabled: enabled && !!pipelineId,
    refetchInterval,
    staleTime: 0, // Always allow immediate refetch for instant progress updates
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Keep previous data during refetch
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes after unmount
  });
}
