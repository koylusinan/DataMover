import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getPipelineStatus } from '../lib/debezium';

interface HealthCheckOptions {
  pipelineId: string;
  enabled: boolean;
  interval?: number;
  onStatusChange?: (newStatus: string) => void;
  onError?: (error: Error) => void;
}

export function usePipelineHealthCheck({
  pipelineId,
  enabled,
  interval = 30000,
  onStatusChange,
  onError,
}: HealthCheckOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const { data: pipeline } = await supabase
        .from('pipelines')
        .select('status')
        .eq('id', pipelineId)
        .maybeSingle();

      if (!pipeline || pipeline.status !== 'running') {
        return;
      }

      const statusResult = await getPipelineStatus(pipelineId);

      if (!statusResult.success || !statusResult.status) {
        return;
      }

      let hasErrors = false;
      let newStatus = 'running';

      if (statusResult.status.source) {
        const sourceState = statusResult.status.source.connector.state;
        if (sourceState === 'FAILED') {
          hasErrors = true;
          newStatus = 'error';
        }

        const failedTasks = statusResult.status.source.tasks?.filter(
          (t) => t.state === 'FAILED'
        );
        if (failedTasks && failedTasks.length > 0) {
          hasErrors = true;
          newStatus = 'error';
        }
      }

      if (statusResult.status.sink) {
        const sinkState = statusResult.status.sink.connector.state;
        if (sinkState === 'FAILED') {
          hasErrors = true;
          newStatus = 'error';
        }

        const failedTasks = statusResult.status.sink.tasks?.filter(
          (t) => t.state === 'FAILED'
        );
        if (failedTasks && failedTasks.length > 0) {
          hasErrors = true;
          newStatus = 'error';
        }
      }

      if (hasErrors && lastStatusRef.current !== newStatus) {
        await supabase
          .from('pipelines')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', pipelineId);

        lastStatusRef.current = newStatus;
        onStatusChange?.(newStatus);
      }
    } catch (error) {
      console.error('Health check failed:', error);
      onError?.(error as Error);
    }
  }, [pipelineId, onStatusChange, onError]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    checkHealth();

    intervalRef.current = setInterval(checkHealth, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, checkHealth]);

  return { checkHealth };
}
