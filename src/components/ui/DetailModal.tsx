import { X, ArrowRight, Info } from 'lucide-react';

interface DetailModalProps {
  log: {
    id: string;
    action_type: string;
    action_description: string;
    metadata: any;
    created_at: string;
  };
  onClose: () => void;
}

export function DetailModal({ log, onClose }: DetailModalProps) {
  const renderValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      'database.hostname': 'Database Host',
      'database.port': 'Database Port',
      'database.user': 'Database User',
      'database.password': 'Database Password',
      'database.dbname': 'Database Name',
      'database.server.name': 'Server Name',
      'table.include.list': 'Included Tables',
      'table.exclude.list': 'Excluded Tables',
      'connection.url': 'Connection URL',
      'connection.user': 'Connection User',
      'topics': 'Kafka Topics',
      'tasks.max': 'Max Tasks',
      'key.converter': 'Key Converter',
      'value.converter': 'Value Converter',
      'transforms': 'Transforms',
      'predicates': 'Predicates',
    };
    return labels[field] || field.split('.').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const changes = log.metadata?.changes || {};
  const hasChanges = Object.keys(changes).length > 0;
  const changeCount = Object.keys(changes).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Change Details
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {changeCount} field{changeCount !== 1 ? 's' : ''} modified
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  {log.action_type}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  {log.action_description}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {hasChanges && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Modified Fields
                </p>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
              </div>
              <div className="space-y-4">
                {Object.entries(changes).map(([field, change]: [string, any]) => (
                  <div
                    key={field}
                    className="border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                  >
                    <div className="bg-gray-100 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {getFieldLabel(field)}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-4">
                        {field}
                      </p>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded text-xs font-medium text-red-700 dark:text-red-400">
                              Old Value
                            </div>
                          </div>
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <pre className="text-sm text-red-800 dark:text-red-300 whitespace-pre-wrap break-all font-mono">
                              {renderValue(change.old)}
                            </pre>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <ArrowRight className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-xs font-medium text-green-700 dark:text-green-400">
                              New Value
                            </div>
                          </div>
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <pre className="text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap break-all font-mono">
                              {renderValue(change.new)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
