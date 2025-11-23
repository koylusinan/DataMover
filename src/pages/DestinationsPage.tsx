import { useState, useEffect } from 'react';
import { Settings, CheckCircle, AlertCircle, ExternalLink, X, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { DatabaseLogoIcon } from '../components/ui/DatabaseLogos';
import { DatabaseInfoCard } from '../components/connections/DatabaseInfoCard';
import { SinkTablesSection } from '../components/connections/SinkTablesSection';

type DestinationConfig = Record<string, string | number | null | undefined>;

interface Pipeline {
  id: string;
  name: string;
  status: string;
}

interface Destination {
  id: string;
  name: string;
  type: string;
  connector_class?: string;
  config: DestinationConfig;
  pipelineCount: number;
  pipelines: Pipeline[];
  status: 'active' | 'idle';
}

export function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadDestinations();
  }, []);

  async function loadDestinations() {
    try {
      const { data: pipelines, error } = await supabase
        .from('pipelines')
        .select(`
          id,
          name,
          destination_type,
          destination_config,
          status,
          sink_connector:pipeline_connectors!pipeline_connectors_pipeline_id_fkey(
            id,
            name,
            connector_class,
            type
          )
        `)
        .not('destination_type', 'is', null);

      if (error) throw error;

      const destMap = new Map<string, Destination>();

      pipelines?.forEach((pipeline: any) => {
        const sinkConnector = pipeline.sink_connector?.find((c: any) => c.type === 'sink');
        const key = `${pipeline.destination_type}-${JSON.stringify(pipeline.destination_config)}`;
        if (destMap.has(key)) {
          const existing = destMap.get(key)!;
          existing.pipelineCount++;
          existing.pipelines.push({
            id: pipeline.id,
            name: pipeline.name,
            status: pipeline.status,
          });
          if (pipeline.status === 'running' || pipeline.status === 'incremental') {
            existing.status = 'active';
          }
        } else {
          destMap.set(key, {
            id: pipeline.id,
            name: sinkConnector?.name || (pipeline.destination_config as any)?.host || pipeline.destination_type || 'Destination',
            type: pipeline.destination_type || 'unknown',
            connector_class: sinkConnector?.connector_class,
            config: (pipeline.destination_config || {}) as DestinationConfig,
            pipelineCount: 1,
            pipelines: [{
              id: pipeline.id,
              name: pipeline.name,
              status: pipeline.status,
            }],
            status: pipeline.status === 'running' || pipeline.status === 'incremental' ? 'active' : 'idle',
          });
        }
      });

      setDestinations(Array.from(destMap.values()));
    } catch (error) {
      console.error('Error loading destinations:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Destinations</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-12">Loading destinations...</p>
      </div>
    );
  }

  if (destinations.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Destinations</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-12">Manage your data destinations</p>

        <div className="max-w-2xl mx-auto mt-16">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700 text-center">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              No Destinations Yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Destinations are configured as part of the pipeline creation process. Create your first
              pipeline to set up a destination.
            </p>
          </div>
        </div>
      </div>
    );
  }

  function maskPassword(password: string): string {
    if (!password) return '';
    return '•'.repeat(password.length);
  }

  function getConnectionString(config: DestinationConfig): string {
    const host = config.host ?? 'localhost';
    const port = config.port ?? '5432';
    const database = config.database ?? 'mydb';
    const username = config.username ?? 'user';
    return `${username}@${host}:${port}/${database}`;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Destinations</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {destinations.length} destination{destinations.length !== 1 ? 's' : ''} configured
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {destinations.map((dest) => (
          <div
            key={dest.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => {
              setSelectedDestination(dest);
              setSelectedPipeline(dest.pipelines[0]);
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <DatabaseLogoIcon
                connectorClass={dest.connector_class}
                sourceType={dest.type}
                className="w-12 h-12"
              />
              <div className="flex items-center gap-2">
                {dest.status === 'active' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {dest.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 uppercase">
              {dest.type}
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Pipelines</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {dest.pipelineCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    dest.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {dest.status}
                </span>
              </div>
            </div>

            <button className="mt-4 w-full px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center justify-center gap-2">
              <ExternalLink className="w-4 h-4" />
              View Pipelines
            </button>
          </div>
        ))}
      </div>

      {/* Destination Detail Modal */}
      {selectedDestination && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDestination(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <DatabaseLogoIcon
                  connectorClass={selectedDestination.connector_class}
                  className="w-14 h-14"
                />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedDestination.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 uppercase">
                    {selectedDestination.type}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDestination(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Pipelines Using This Destination */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Pipelines Using This Destination ({selectedDestination.pipelines.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Connector Type:</span>
                    <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded">
                      {selectedDestination.connector_class?.split('.').pop() || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedDestination.pipelines.map((pipeline) => (
                    <div
                      key={pipeline.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPipeline(pipeline);
                      }}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                        selectedPipeline?.id === pipeline.id
                          ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500 dark:ring-blue-400'
                          : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className={`font-medium ${
                        selectedPipeline?.id === pipeline.id
                          ? 'text-blue-900 dark:text-blue-100'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {pipeline.name}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          pipeline.status === 'running' || pipeline.status === 'incremental'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : pipeline.status === 'snapshot'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {pipeline.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Database Information Card */}
              {selectedDestination.config.host && selectedPipeline && (
                <DatabaseInfoCard connectionId={selectedPipeline.id} />
              )}

              {/* Sink Tables Section */}
              {selectedPipeline && (
                <SinkTablesSection connectionId={selectedPipeline.id} />
              )}

              {/* Status */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
                <span
                  className={`px-3 py-1 text-sm font-medium rounded-full ${
                    selectedDestination.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {selectedDestination.status}
                </span>
              </div>

              {/* Connection Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Connection Details</h3>

                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Host</span>
                    <span className="col-span-2 text-sm text-gray-900 dark:text-gray-100 font-mono">
                      {selectedDestination.config.host || 'N/A'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Port</span>
                    <span className="col-span-2 text-sm text-gray-900 dark:text-gray-100 font-mono">
                      {selectedDestination.config.port || 'N/A'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Database</span>
                    <span className="col-span-2 text-sm text-gray-900 dark:text-gray-100 font-mono">
                      {selectedDestination.config.database || 'N/A'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Username</span>
                    <span className="col-span-2 text-sm text-gray-900 dark:text-gray-100 font-mono">
                      {selectedDestination.config.username || 'N/A'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</span>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-sm text-gray-900 dark:text-gray-100 font-mono flex-1">
                        {showPassword
                          ? selectedDestination.config.password || 'N/A'
                          : maskPassword(String(selectedDestination.config.password || ''))}
                      </span>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Connection String</span>
                    <span className="col-span-2 text-sm text-blue-900 dark:text-blue-100 font-mono break-all">
                      {getConnectionString(selectedDestination.config)}
                    </span>
                  </div>
                </div>
              </div>


              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setSelectedDestination(null);
                    navigate('/pipelines');
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Pipelines
                </button>
                <button
                  onClick={() => setSelectedDestination(null)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
