import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PipelineTypeStepProps {
  sourceType?: string;
}

export function PipelineTypeStep({ sourceType }: PipelineTypeStepProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { sourceType?: string; pipelineMode?: string };
  const selectedSource = state?.sourceType || sourceType || 'your source';
  const [selectedType, setSelectedType] = useState<string>('edge');

  const handleBack = () => {
    navigate('/pipelines/new/pipeline-mode', { state: location.state });
  };

  const handleContinue = () => {
    navigate('/pipelines/new/source-config', {
      state: { ...state, pipelineType: selectedType },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded flex items-center justify-center">
              <span className="text-2xl">🗄️</span>
            </div>
            <span className="text-2xl">→</span>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded flex items-center justify-center">
              <span className="text-2xl">❄️</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Select Pipeline Type
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose the pipeline mode that best fits your performance and flexibility needs for {selectedSource}.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <label
            className={`block p-6 bg-white dark:bg-gray-800 border-2 rounded-lg cursor-pointer transition-all ${
              selectedType === 'edge'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="pipeline-type"
                value="edge"
                checked={selectedType === 'edge'}
                onChange={(e) => setSelectedType(e.target.value)}
                className="mt-1 w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Edge</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                    Recommended
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  New batch based engine offering higher throughput, control and observability with
                  increased support for all new database versions and capabilities.
                </p>
              </div>
            </div>
          </label>

          <label
            className={`block p-6 bg-white dark:bg-gray-800 border-2 rounded-lg cursor-pointer transition-all ${
              selectedType === 'standard'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="pipeline-type"
                value="standard"
                checked={selectedType === 'standard'}
                onChange={(e) => setSelectedType(e.target.value)}
                className="mt-1 w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Standard</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Legacy pipelines with moderate performance, use this only if you intend to use
                  existing naming convention, structure or pre-load transformations.
                </p>
              </div>
            </div>
          </label>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
