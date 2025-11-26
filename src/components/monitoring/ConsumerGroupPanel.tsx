import { useState, useEffect } from 'react';
import { Users, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface ConsumerGroupPanelProps {
  pipelineId: string;
  height?: number;
}

interface Partition {
  group: string;
  topic: string;
  partition: number;
  currentOffset: number;
  logEndOffset: number;
  lag: number;
  consumerId: string;
  host: string;
  clientId: string;
}

interface ConsumerGroupData {
  groupName: string;
  partitions: Partition[];
}

export function ConsumerGroupPanel({ pipelineId, height }: ConsumerGroupPanelProps) {
  const [data, setData] = useState<ConsumerGroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [pipelineId]);

  const loadData = async () => {
    try {
      const response = await fetch(`http://localhost:5001/api/pipelines/${pipelineId}/consumer-group`);
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to load consumer group data');
      }
    } catch (err) {
      console.error('Error loading consumer group data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load consumer group data');
    } finally {
      setLoading(false);
    }
  };

  const totalLag = data?.partitions.reduce((sum, p) => sum + p.lag, 0) || 0;
  const hasLag = totalLag > 0;

  return (
    <div
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col"
      style={{ height: height || 300 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${hasLag ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
            <Users className={`w-5 h-5 ${hasLag ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Consumer Group</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {data?.groupName || 'Loading...'}
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Body */}
      {loading && !data ? (
        <div className="flex items-center justify-center flex-1">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center flex-1 p-4">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      ) : data ? (
        <div className="flex-1 overflow-auto">
          {/* Summary Stats */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Partitions</span>
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {data.partitions.length}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Lag</span>
                </div>
                <div className={`text-xl font-bold ${hasLag ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                  {totalLag.toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  {hasLag ? (
                    <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  )}
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Status</span>
                </div>
                <div className={`text-sm font-bold ${hasLag ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                  {hasLag ? 'Lagging' : 'Healthy'}
                </div>
              </div>
            </div>
          </div>

          {/* Partition Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Topic</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">Partition</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Current Offset</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Log End Offset</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Lag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.partitions.map((partition, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100 font-mono text-xs">
                      {partition.topic.split('.').pop()}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-900 dark:text-gray-100 font-mono">
                      {partition.partition}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100 font-mono">
                      {partition.currentOffset.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100 font-mono">
                      {partition.logEndOffset.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span className={`${
                        partition.lag > 0
                          ? 'text-orange-600 dark:text-orange-400 font-semibold'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {partition.lag.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
