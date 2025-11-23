import { X, RotateCcw, AlertCircle } from 'lucide-react';

interface RollbackConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pipelineName: string;
  pipelineId: string;
  timeRemaining: string;
  deletionTime: string;
}

export function RollbackConsoleModal({
  isOpen,
  onClose,
  onConfirm,
  pipelineName,
  pipelineId,
  timeRemaining,
  deletionTime,
}: RollbackConsoleModalProps) {
  if (!isOpen) return null;

  const handleRestore = () => {
    onConfirm();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-blue-600 dark:text-blue-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Rollback Console
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Restore deleted pipeline
                </p>
              </div>
            </div>

            {/* Pipeline Information */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Pipeline Name</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{pipelineName}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Pipeline ID</span>
                  <code className="text-xs font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {pipelineId}
                  </code>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Time Remaining</span>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">{timeRemaining}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Permanent Deletion At</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {new Date(deletionTime).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning Notice */}
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                    Restore Information
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    Restoring this pipeline will reactivate it with status 'draft'. You will need to redeploy the connectors
                    manually from the pipeline detail page. All configuration and metadata will be preserved.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors border-2 border-blue-600 hover:border-blue-700 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Restore Pipeline
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
