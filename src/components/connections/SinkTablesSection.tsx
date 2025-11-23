import { useState, useEffect } from 'react';
import { Table, RefreshCw, ChevronDown, ChevronRight, Eye, Calendar, Database as DatabaseIcon } from 'lucide-react';

interface SinkTable {
  schema: string;
  tableName: string;
  rowCount: number;
  tableSize: number;
  lastModified: string | null;
  columnCount: number;
}

interface SinkTablesSectionProps {
  connectionId: string;
}

export function SinkTablesSection({ connectionId }: SinkTablesSectionProps) {
  const [tables, setTables] = useState<SinkTable[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [sampleData, setSampleData] = useState<Map<string, any[]>>(new Map());
  const [loadingSamples, setLoadingSamples] = useState<Set<string>>(new Set());

  const fetchSinkTables = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch(`http://localhost:3001/api/pipelines/${connectionId}/sink-tables`);
      const result = await response.json();

      if (result.success) {
        setTables(result.data);
      } else {
        setError(result.error || 'Failed to fetch sink tables');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sink tables');
    } finally {
      setRefreshing(false);
    }
  };

  const fetchSampleData = async (schema: string, tableName: string) => {
    const key = `${schema}.${tableName}`;
    setLoadingSamples(prev => new Set(prev).add(key));

    try {
      const response = await fetch(
        `http://localhost:3001/api/pipelines/${connectionId}/tables/${schema}/${tableName}/sample`
      );
      const result = await response.json();

      if (result.success) {
        setSampleData(prev => new Map(prev).set(key, result.data));
      }
    } catch (err) {
      console.error('Failed to fetch sample data:', err);
    } finally {
      setLoadingSamples(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const toggleTable = (schema: string, tableName: string) => {
    const key = `${schema}.${tableName}`;
    const newExpanded = new Set(expandedTables);

    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
      if (!sampleData.has(key)) {
        fetchSampleData(schema, tableName);
      }
    }

    setExpandedTables(newExpanded);
  };

  useEffect(() => {
    fetchSinkTables();
  }, [connectionId]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (tables.length === 0 && refreshing) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Table className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">CDC Sink Tables</h3>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Loading sink tables...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Table className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">CDC Sink Tables</h3>
        </div>
        <div className="text-center py-8 text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Table className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">CDC Sink Tables</h3>
        </div>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No CDC sink tables found for this destination
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Table className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">CDC Sink Tables</h3>
          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded-full">
            {tables.length} {tables.length === 1 ? 'table' : 'tables'}
          </span>
        </div>
        <button
          onClick={() => fetchSinkTables()}
          disabled={refreshing}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-hide">
        {tables.map((table) => {
          const key = `${table.schema}.${table.tableName}`;
          const isExpanded = expandedTables.has(key);
          const samples = sampleData.get(key);
          const isLoadingSample = loadingSamples.has(key);

          return (
            <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleTable(table.schema, table.tableName)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  )}
                  <DatabaseIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {table.schema}.{table.tableName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatNumber(table.rowCount)} rows • {formatBytes(table.tableSize)} • {table.columnCount} columns
                    </div>
                  </div>
                </div>
                {table.lastModified && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3 h-3" />
                    {formatDate(table.lastModified)}
                  </div>
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
                  {isLoadingSample ? (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      Loading sample data...
                    </div>
                  ) : samples && samples.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            {Object.keys(samples[0]).map((col) => (
                              <th
                                key={col}
                                className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {samples.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                              {Object.values(row).map((val: any, colIdx) => (
                                <td key={colIdx} className="px-3 py-2 text-gray-900 dark:text-gray-100 font-mono text-xs">
                                  {val === null ? (
                                    <span className="text-gray-400 italic">null</span>
                                  ) : typeof val === 'object' ? (
                                    <span className="text-gray-600 dark:text-gray-400">{JSON.stringify(val)}</span>
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Eye className="w-3 h-3" />
                        <span>Showing first 10 rows</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      No sample data available
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
