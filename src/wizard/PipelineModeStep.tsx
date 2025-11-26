import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PipelineModeStepProps {
  sourceType: string;
}

export function PipelineModeStep({ sourceType }: PipelineModeStepProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedMode, setSelectedMode] = useState<string>('change-tracking');

  const handleBack = () => {
    navigate('/pipelines/new/source');
  };

  const handleContinue = () => {
    // Skip pipeline-type step, go directly to source-config with default 'edge' type
    navigate('/pipelines/new/source-config', {
      state: { ...location.state, pipelineMode: selectedMode, pipelineType: 'edge' },
    });
  };

  const modes = [
    {
      id: 'change-tracking',
      title: 'Change Tracking',
      badge: 'Recommended',
      description:
        "Data is ingested using database's Change Tracking mode. To use this, you will need to enable Change Tracking on tables.",
      available: sourceType === 'sqlserver',
    },
    {
      id: 'log-based',
      title: 'Log-Based (CDC)',
      badge: 'Recommended',
      description:
        'Data is ingested using database logs (Write-Ahead Logs for PostgreSQL). This captures all changes including inserts, updates, and deletes in real-time.',
      available: sourceType === 'postgres' || sourceType === 'oracle',
    },
    {
      id: 'table',
      title: 'Table',
      badge: '',
      description:
        'Data is ingested by running SQL queries on your tables. This mode provides change data capture through modified/updated timestamp columns. Deletes are not replicated to the Destination.',
      available: true,
    },
    {
      id: 'custom-sql',
      title: 'Custom SQL',
      badge: '',
      description:
        'Data is ingested by running a custom SQL query provided by you on the database. With this mode, you can replicate database views or selective data sets queried through the SQL query. Deletes are not replicated to the Destination.',
      available: true,
    },
  ];

  const availableModes = modes.filter((mode) => mode.available);

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
            Select Pipeline Mode
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Define how your source data will be captured and ingested.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {availableModes.map((mode) => (
            <label
              key={mode.id}
              className={`block p-6 bg-white dark:bg-gray-800 border-2 rounded-lg cursor-pointer transition-all ${
                selectedMode === mode.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="pipeline-mode"
                  value={mode.id}
                  checked={selectedMode === mode.id}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="mt-1 w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {mode.title}
                    </span>
                    {mode.badge && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                        {mode.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{mode.description}</p>
                </div>
              </div>
            </label>
          ))}
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
