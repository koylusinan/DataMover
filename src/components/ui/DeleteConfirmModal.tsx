import { X, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteTopics: boolean, isPermanent: boolean) => void;
  title?: string;
  message?: string;
  itemName?: string;
  pipelineId?: string;
  showTopicsOption?: boolean;
  showDeleteTypeOption?: boolean;
  pipelineStatus?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure you want to delete the Pipeline?',
  message = 'This action CANNOT be undone. The Pipeline will be permanently deleted from your account. Do you wish to continue?',
  itemName,
  pipelineId,
  showTopicsOption = true,
  showDeleteTypeOption = false,
  pipelineStatus = '',
}: DeleteConfirmModalProps) {
  const [deleteTopics, setDeleteTopics] = useState(false);
  const [deleteType, setDeleteType] = useState<'soft' | 'permanent'>('soft');
  const [retentionHours, setRetentionHours] = useState<number>(24);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(deleteTopics, deleteType === 'permanent', retentionHours);
    onClose();
    setDeleteTopics(false);
    setDeleteType('soft');
    setRetentionHours(24);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-600 dark:text-red-500" />
            </div>

            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 text-center">
              {title}
            </h2>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed text-center max-w-xl mx-auto">
              {message}
            </p>

            {pipelineId && (
              <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Pipeline ID (for restore)
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(pipelineId)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <code className="block mt-2 text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                  {pipelineId}
                </code>
              </div>
            )}

            {showDeleteTypeOption && (
              <div className="mb-5">
                <div className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">
                  How would you like to delete this pipeline?
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col cursor-pointer p-4 border-2 rounded-lg transition-all hover:shadow-md"
                    style={{
                      borderColor: deleteType === 'soft' ? 'rgb(59, 130, 246)' : 'rgb(229, 231, 235)',
                      backgroundColor: deleteType === 'soft' ? 'rgb(239, 246, 255)' : 'transparent'
                    }}>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        name="deleteType"
                        checked={deleteType === 'soft'}
                        onChange={() => setDeleteType('soft')}
                        className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        Soft Delete (Recommended)
                      </span>
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pl-6">
                      Keep for restore within retention period
                    </span>
                  </label>

                  <label className="flex flex-col cursor-pointer p-4 border-2 rounded-lg transition-all hover:shadow-md"
                    style={{
                      borderColor: deleteType === 'permanent' ? 'rgb(220, 38, 38)' : 'rgb(229, 231, 235)',
                      backgroundColor: deleteType === 'permanent' ? 'rgb(254, 242, 242)' : 'transparent'
                    }}>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="radio"
                        name="deleteType"
                        checked={deleteType === 'permanent'}
                        onChange={() => setDeleteType('permanent')}
                        className="w-4 h-4 text-red-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-red-500 focus:ring-2"
                      />
                      <span className="text-sm font-bold text-red-900 dark:text-red-100">
                        Permanent Delete
                      </span>
                    </div>
                    <span className="text-xs text-red-700 dark:text-red-300 leading-relaxed pl-6">
                      Immediately remove. Cannot be undone.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {showDeleteTypeOption && deleteType === 'soft' && (
              <div className="mb-5 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <label className="block">
                  <span className="text-sm font-bold text-blue-900 dark:text-blue-100 block mb-2">
                    Retention Period
                  </span>
                  <span className="text-xs text-blue-700 dark:text-blue-300 block mb-3">
                    Keep pipeline available for restore. After this period, it will be permanently deleted.
                  </span>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={retentionHours}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (value >= 1 && value <= 24) {
                          setRetentionHours(value);
                        }
                      }}
                      className="w-full px-4 py-2.5 pr-16 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base font-semibold border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500 dark:text-gray-400 pointer-events-none">
                      hours
                    </span>
                  </div>
                  <span className="text-xs text-blue-600 dark:text-blue-400 block mt-2">
                    1-24 hours (Default: 24)
                  </span>
                </label>
              </div>
            )}

            {(showTopicsOption || showDeleteTypeOption) && (
              <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteTopics}
                    onChange={(e) => setDeleteTopics(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-amber-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-amber-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-amber-900 dark:text-amber-100 block mb-1">
                      Delete Kafka Topics
                    </span>
                    <span className="text-xs text-amber-800 dark:text-amber-200 block leading-relaxed">
                      Permanently delete all data in related Kafka topics. If unchecked, only connectors will be removed.
                    </span>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm rounded-lg border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-6 py-2.5 bg-red-600 text-white font-semibold text-sm rounded-lg hover:bg-red-700 transition-all border-2 border-red-600 hover:border-red-700 shadow-md hover:shadow-lg"
              >
                {deleteType === 'permanent' || !showDeleteTypeOption ? 'Delete Pipeline' : 'Delete Pipeline (Recoverable)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
