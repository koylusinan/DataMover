import { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle, XCircle, Clock, HardDrive, Table } from 'lucide-react';

interface DatabaseInfo {
  version: string;
  size: number;
  totalTables: number;
  database: string;
}

interface DatabaseInfoCardProps {
  connectionId: string;
}

export function DatabaseInfoCard({ connectionId }: DatabaseInfoCardProps) {
  const [info, setInfo] = useState<DatabaseInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDatabaseInfo = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch(`http://localhost:3001/api/pipelines/${connectionId}/database-info`);
      const result = await response.json();

      if (result.success) {
        setInfo(result.data);
        setLastUpdated(new Date());
      } else {
        setError(result.error || 'Failed to fetch database info');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch database info');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDatabaseInfo();
  }, [connectionId]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatTime = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  if (!info && refreshing) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Database Information</h3>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Loading database information...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Database Information</h3>
        </div>
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-100">Failed to load database information</p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={() => fetchDatabaseInfo()}
          className="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Database Information</h3>
        </div>
        <button
          onClick={() => fetchDatabaseInfo()}
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <Table className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Tables</span>
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{info.totalTables}</div>
        </div>

        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <HardDrive className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Database Size</span>
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{formatBytes(info.size)}</div>
        </div>

        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Status</span>
          </div>
          <div className="text-lg font-semibold text-green-900 dark:text-green-100">Connected</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Database Name</div>
          <div className="text-sm font-mono text-gray-900 dark:text-gray-100">{info.database}</div>
        </div>

        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Version</div>
          <div className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">{info.version}</div>
        </div>

        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Clock className="w-3 h-3" />
            <span>Last updated: {formatTime(lastUpdated)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
