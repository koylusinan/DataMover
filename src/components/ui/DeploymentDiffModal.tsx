import { X } from 'lucide-react';
import { useMemo } from 'react';

interface DeploymentDiffModalProps {
  connectorName: string;
  connectorType: 'source' | 'sink';
  currentConfig: Record<string, unknown>;
  pendingConfig: Record<string, unknown>;
  onDeploy: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
  onClose: () => void;
}

export function DeploymentDiffModal({
  connectorName,
  connectorType,
  currentConfig,
  pendingConfig,
  onDeploy,
  onDismiss,
  onClose
}: DeploymentDiffModalProps) {
  const configDiff = useMemo(() => {
    const changes: Array<{
      key: string;
      oldValue: unknown;
      newValue: unknown;
      type: 'added' | 'removed' | 'changed';
    }> = [];

    const allKeys = new Set([
      ...Object.keys(currentConfig || {}),
      ...Object.keys(pendingConfig || {})
    ]);

    allKeys.forEach(key => {
      const oldVal = currentConfig?.[key];
      const newVal = pendingConfig?.[key];

      if (oldVal === undefined && newVal !== undefined) {
        changes.push({ key, oldValue: oldVal, newValue: newVal, type: 'added' });
      } else if (oldVal !== undefined && newVal === undefined) {
        changes.push({ key, oldValue: oldVal, newValue: newVal, type: 'removed' });
      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ key, oldValue: oldVal, newValue: newVal, type: 'changed' });
      }
    });

    return changes;
  }, [currentConfig, pendingConfig]);

  const renderJsonWithHighlights = () => {
    const lines: JSX.Element[] = [];
    const changedKeys = new Set(configDiff.map(c => c.key));
    const changeMap = new Map(configDiff.map(c => [c.key, c]));

    lines.push(<div key="open-brace" className="text-gray-600 dark:text-gray-400">{'{'}</div>);

    const entries = Object.entries(pendingConfig);
    entries.forEach(([key, value], index) => {
      const change = changeMap.get(key);
      const isLast = index === entries.length - 1;

      if (change) {
        if (change.type === 'changed') {
          lines.push(
            <div key={`${key}-old`} className="bg-red-50 dark:bg-red-900/20">
              <span className="text-red-600 dark:text-red-400">-  </span>
              <span className="text-red-700 dark:text-red-300">"{key}"</span>
              <span className="text-gray-600 dark:text-gray-400">: </span>
              <span className="text-red-700 dark:text-red-300">{JSON.stringify(change.oldValue)}</span>
              <span className="text-gray-600 dark:text-gray-400">,</span>
            </div>
          );
          lines.push(
            <div key={`${key}-new`} className="bg-green-50 dark:bg-green-900/20">
              <span className="text-green-600 dark:text-green-400">+  </span>
              <span className="text-green-700 dark:text-green-300">"{key}"</span>
              <span className="text-gray-600 dark:text-gray-400">: </span>
              <span className="text-green-700 dark:text-green-300">{JSON.stringify(value)}</span>
              <span className="text-gray-600 dark:text-gray-400">{isLast ? '' : ','}</span>
            </div>
          );
        } else if (change.type === 'added') {
          lines.push(
            <div key={key} className="bg-green-50 dark:bg-green-900/20">
              <span className="text-green-600 dark:text-green-400">+  </span>
              <span className="text-green-700 dark:text-green-300">"{key}"</span>
              <span className="text-gray-600 dark:text-gray-400">: </span>
              <span className="text-green-700 dark:text-green-300">{JSON.stringify(value)}</span>
              <span className="text-gray-600 dark:text-gray-400">{isLast ? '' : ','}</span>
            </div>
          );
        }
      } else {
        lines.push(
          <div key={key} className="text-gray-700 dark:text-gray-300">
            {'   '}
            <span>"{key}"</span>
            <span className="text-gray-600 dark:text-gray-400">: </span>
            <span>{JSON.stringify(value)}</span>
            <span className="text-gray-600 dark:text-gray-400">{isLast ? '' : ','}</span>
          </div>
        );
      }
    });

    Object.entries(currentConfig).forEach(([key, value]) => {
      if (!pendingConfig.hasOwnProperty(key)) {
        const change = changeMap.get(key);
        if (change?.type === 'removed') {
          lines.push(
            <div key={`${key}-removed`} className="bg-red-50 dark:bg-red-900/20">
              <span className="text-red-600 dark:text-red-400">-  </span>
              <span className="text-red-700 dark:text-red-300">"{key}"</span>
              <span className="text-gray-600 dark:text-gray-400">: </span>
              <span className="text-red-700 dark:text-red-300">{JSON.stringify(value)}</span>
              <span className="text-gray-600 dark:text-gray-400">,</span>
            </div>
          );
        }
      }
    });

    lines.push(<div key="close-brace" className="text-gray-600 dark:text-gray-400">{'}'}</div>);

    return lines;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>

      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col m-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Deploy {connectorType === 'source' ? 'Source' : 'Destination'} Configuration
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {connectorName} • {configDiff.length} changes
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {configDiff.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No changes detected
            </div>
          ) : (
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Configuration Changes
              </div>
              <pre className="text-xs bg-white dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto font-mono">
                {renderJsonWithHighlights()}
              </pre>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onDismiss}
              disabled={configDiff.length === 0}
              className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dismiss Changes
            </button>
            <button
              onClick={onDeploy}
              disabled={configDiff.length === 0}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Deploy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
