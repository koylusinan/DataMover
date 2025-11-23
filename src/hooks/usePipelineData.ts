import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getActiveConnectorConfig } from '../lib/registry';

interface RegistryMetadata {
  registry_connector?: string;
  registry_version?: number;
  checksum?: string;
  [key: string]: unknown;
}

interface Connector {
  id: string;
  name: string;
  type: 'source' | 'sink';
  connector_class: string;
  status: string;
  config?: Record<string, unknown>;
  resolved_config?: Record<string, unknown>;
  registry_meta?: RegistryMetadata | null;
  last_deployed_version?: number | null;
  has_pending_changes?: boolean;
  pending_config?: Record<string, unknown>;
}

interface Pipeline {
  id: string;
  name: string;
  source_type: string;
  destination_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  source_config?: Record<string, unknown>;
  destination_config?: Record<string, unknown>;
  schedule_config?: Record<string, unknown>;
  source_connector?: Connector;
  sink_connector?: Connector;
}

interface UsePipelineDataOptions {
  pipelineId: string;
  enabled?: boolean;
}

/**
 * React Query hook for fetching pipeline data with smooth caching
 * - Loads pipeline and connectors from Supabase
 * - Resolves connector configs from registry
 * - Caches data to prevent blink on page refresh
 * - Automatically invalidates on updates
 */
export function usePipelineData({
  pipelineId,
  enabled = true,
}: UsePipelineDataOptions) {
  const queryClient = useQueryClient();

  const query = useQuery<Pipeline | null>({
    queryKey: ['pipeline', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return null;

      try {
        const [pipelineRes, connectorsRes] = await Promise.all([
          supabase.from('pipelines').select('*').eq('id', pipelineId).maybeSingle(),
          supabase.from('pipeline_connectors')
            .select('id, name, type, connector_class, status, config, last_deployed_version, has_pending_changes, pending_config')
            .eq('pipeline_id', pipelineId),
        ]);

        if (pipelineRes.error) {
          throw new Error(pipelineRes.error.message);
        }

        if (!pipelineRes.data) {
          throw new Error('Pipeline not found');
        }

        const connectorsRaw = connectorsRes.data || [];
        const connectors = await Promise.all(
          connectorsRaw.map(async (conn: any) => {
            const registryMeta = conn.config?.registry_connector ? conn.config : null;
            let resolvedConfig: Record<string, unknown> | undefined;
            if (registryMeta?.registry_connector) {
              try {
                const activeConfig = await getActiveConnectorConfig(registryMeta.registry_connector);
                resolvedConfig = activeConfig || undefined;
              } catch (error) {
                console.warn('Failed to load registry config', error);
              }
            }
            if (!resolvedConfig) {
              resolvedConfig = (registryMeta as any)?.snapshot_config || (conn.config as any)?.snapshot_config;
            }

            return {
              ...conn,
              registry_meta: registryMeta,
              config: conn.config || {},
              resolved_config: resolvedConfig,
              last_deployed_version: conn.last_deployed_version ?? null,
            };
          })
        );

        const formattedData: Pipeline = {
          ...pipelineRes.data,
          source_connector: connectors.find((c: any) => c.type === 'source'),
          sink_connector: connectors.find((c: any) => c.type === 'sink'),
        };

        return formattedData;
      } catch (error) {
        console.error('Failed to load pipeline data:', error);
        throw error;
      }
    },
    enabled: enabled && !!pipelineId,
    staleTime: 30000, // Data stays fresh for 30 seconds
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData, // Keep previous data during refetch
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes after unmount
    retry: 1, // Only retry once on failure
  });

  // Helper function for optimistic updates
  const updatePipelineStatus = (newStatus: string) => {
    queryClient.setQueryData(['pipeline', pipelineId], (old: Pipeline | null | undefined) => {
      if (!old) return old;
      return {
        ...old,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
    });
  };

  return {
    ...query,
    updatePipelineStatus,
  };
}
