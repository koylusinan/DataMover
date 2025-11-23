import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, PlayCircle, Pause, Trash2 } from 'lucide-react';

interface TestResult {
  step: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  timestamp: string;
}

export default function TestRollbackPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState('');

  const addResult = (step: string, status: TestResult['status'], message: string) => {
    setTestResults(prev => [...prev, {
      step,
      status,
      message,
      timestamp: new Date().toISOString()
    }]);
  };

  const testDeploy = async () => {
    if (!selectedPipeline) {
      alert('Please enter a pipeline ID');
      return;
    }

    setIsRunning(true);
    setTestResults([]);

    addResult('Start', 'pending', 'Starting deployment test...');

    try {
      const response = await fetch(`http://localhost:5001/api/pipelines/${selectedPipeline}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        addResult('Deploy', 'success', 'Deployment successful!');
        if (data.results?.source) {
          addResult('Source', 'success', 'Source connector deployed');
        }
        if (data.results?.sink) {
          addResult('Sink', 'success', 'Sink connector deployed');
        }
      } else {
        addResult('Deploy', 'error', `Deployment failed: ${data.error}`);

        if (data.results?.errors) {
          data.results.errors.forEach((err: any) => {
            addResult('Error', 'error', `${err.connector}: ${err.error}`);
          });
        }

        if (data.error?.includes('rolled back') || data.error?.includes('rollback')) {
          addResult('Rollback', 'warning', '🔄 Rollback was triggered!');
        }
      }
    } catch (error: any) {
      addResult('Deploy', 'error', error.message);
    }

    setIsRunning(false);
  };

  const testPause = async () => {
    if (!selectedPipeline) {
      alert('Please enter a pipeline ID');
      return;
    }

    setIsRunning(true);
    setTestResults([]);

    addResult('Start', 'pending', 'Pausing pipeline...');

    try {
      const response = await fetch(`http://localhost:5001/api/pipelines/${selectedPipeline}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        addResult('Pause', 'success', data.message);
      } else {
        addResult('Pause', 'error', data.error);
        if (data.errors) {
          data.errors.forEach((err: any) => {
            addResult('Error', 'error', `${err.connector}: ${err.error}`);
          });
        }
      }
    } catch (error: any) {
      addResult('Pause', 'error', error.message);
    }

    setIsRunning(false);
  };

  const testStart = async () => {
    if (!selectedPipeline) {
      alert('Please enter a pipeline ID');
      return;
    }

    setIsRunning(true);
    setTestResults([]);

    addResult('Start', 'pending', 'Starting pipeline...');

    try {
      const response = await fetch(`http://localhost:5001/api/pipelines/${selectedPipeline}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        addResult('Start', 'success', data.message);
      } else {
        addResult('Start', 'error', data.error);
        if (data.errors) {
          data.errors.forEach((err: any) => {
            addResult('Error', 'error', `${err.connector}: ${err.error}`);
          });
        }
      }
    } catch (error: any) {
      addResult('Start', 'error', error.message);
    }

    setIsRunning(false);
  };

  const testDelete = async () => {
    if (!selectedPipeline) {
      alert('Please enter a pipeline ID');
      return;
    }

    if (!confirm('Are you sure you want to delete all connectors?')) {
      return;
    }

    setIsRunning(true);
    setTestResults([]);

    addResult('Start', 'pending', 'Deleting connectors...');

    try {
      const response = await fetch(`http://localhost:5001/api/pipelines/${selectedPipeline}/connectors`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        addResult('Delete', 'success', data.message);
      } else {
        addResult('Delete', 'error', data.error);
        if (data.errors) {
          data.errors.forEach((err: any) => {
            addResult('Error', 'error', `${err.connector}: ${err.error}`);
          });
        }
      }
    } catch (error: any) {
      addResult('Delete', 'error', error.message);
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Rollback Test Console</h1>
          <p className="text-gray-600 mb-6">Test deployment, rollback, pause, start, and delete operations</p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pipeline ID
            </label>
            <input
              type="text"
              value={selectedPipeline}
              onChange={(e) => setSelectedPipeline(e.target.value)}
              placeholder="Enter pipeline ID (e.g., 123e4567-e89b-12d3-a456-426614174000)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <button
              onClick={testDeploy}
              disabled={isRunning || !selectedPipeline}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <PlayCircle className="w-5 h-5" />
              Deploy
            </button>

            <button
              onClick={testPause}
              disabled={isRunning || !selectedPipeline}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Pause className="w-5 h-5" />
              Pause
            </button>

            <button
              onClick={testStart}
              disabled={isRunning || !selectedPipeline}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <PlayCircle className="w-5 h-5" />
              Start
            </button>

            <button
              onClick={testDelete}
              disabled={isRunning || !selectedPipeline}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              Delete
            </button>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Results</h2>

            {testResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No test results yet. Run a test to see results.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-4 rounded-lg ${
                      result.status === 'success' ? 'bg-green-50' :
                      result.status === 'error' ? 'bg-red-50' :
                      result.status === 'warning' ? 'bg-yellow-50' :
                      'bg-blue-50'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getStatusIcon(result.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{result.step}</p>
                      <p className="text-sm text-gray-600 break-words">{result.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">How to Test Rollback:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
              <li>Get a pipeline ID from the Pipelines page</li>
              <li>Click "Deploy" - this will attempt to deploy both source and sink connectors</li>
              <li>If sink deployment fails, check the results for "Rollback" warning</li>
              <li>Check backend logs for: "Rolling back source connector due to sink failure"</li>
              <li>Verify that source connector was deleted from Kafka Connect</li>
            </ol>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="font-semibold text-yellow-900 mb-2">Backend Logs to Monitor:</h3>
            <div className="text-sm text-yellow-800 space-y-1 font-mono">
              <p>✅ "Deploying source connector"</p>
              <p>✅ "Deploying sink connector"</p>
              <p>⚠️ "Sink deployment failed"</p>
              <p>🔄 "Rolling back source connector due to sink failure"</p>
              <p>✅ "Source connector rolled back"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
