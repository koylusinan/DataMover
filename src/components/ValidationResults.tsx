import { CheckCircle2, XCircle, Loader2, ChevronRight } from 'lucide-react';
import { ValidationResult } from '../types';

interface ValidationResultsProps {
  results: ValidationResult[];
  connectionName: string;
  isValidating?: boolean;
  currentStep?: string;
  onRetry?: () => void;
}

export function ValidationResults({ results, connectionName, isValidating = false, currentStep = '', onRetry }: ValidationResultsProps) {
  const validationSteps = [
    { id: 'hostname', label: 'Validating hostname' },
    { id: 'host', label: 'Connecting to host' },
    { id: 'database', label: 'Connecting to database' },
    { id: 'credentials', label: 'Validating user credentials' },
    { id: 'permissions', label: 'Checking user permissions' },
    { id: 'configurations', label: 'Checking configurations' },
  ];

  const getStepStatus = (stepId: string): 'success' | 'error' | 'loading' | 'pending' => {
    if (isValidating) {
      const currentIndex = validationSteps.findIndex(s => s.id === currentStep);
      const stepIndex = validationSteps.findIndex(s => s.id === stepId);

      if (stepIndex < currentIndex) return 'success';
      if (stepIndex === currentIndex) return 'loading';
      return 'pending';
    }

    const stepResult = results.find(r => r.check_name.toLowerCase().includes(stepId));
    if (!stepResult) return 'pending';

    return stepResult.status === 'passed' ? 'success' : 'error';
  };

  const getStepErrorMessage = (stepId: string): string | null => {
    const stepResult = results.find(r => r.check_name.toLowerCase().includes(stepId));
    if (stepResult && stepResult.status === 'failed') {
      return stepResult.message;
    }
    return null;
  };

  const getStepIcon = (status: 'success' | 'error' | 'loading' | 'pending') => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-500" />;
      case 'loading':
        return <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-500 animate-spin" />;
      case 'pending':
        return <CheckCircle2 className="w-5 h-5 text-gray-300 dark:text-gray-600" />;
    }
  };

  const getStepTextColor = (status: 'success' | 'error' | 'loading' | 'pending') => {
    switch (status) {
      case 'success':
        return 'text-gray-700 dark:text-gray-300';
      case 'error':
        return 'text-gray-900 dark:text-gray-100 font-semibold';
      case 'loading':
        return 'text-gray-900 dark:text-gray-100 font-semibold';
      case 'pending':
        return 'text-gray-400 dark:text-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-200 dark:border-blue-800 p-6">
        <div className="space-y-4">
          {validationSteps.map((step, index) => {
            const status = getStepStatus(step.id);
            const errorMessage = getStepErrorMessage(step.id);

            return (
              <div key={step.id}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-base ${getStepTextColor(status)}`}>
                      {step.label}
                    </div>
                    {errorMessage && status === 'error' && (
                      <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <p className="text-sm text-red-900 dark:text-red-200">
                          FATAL: {errorMessage}{' '}
                          <a
                            href="#"
                            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                            onClick={(e) => e.preventDefault()}
                          >
                            Learn More <ChevronRight className="w-4 h-4" />
                          </a>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!isValidating && results.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {results.filter(r => r.status === 'passed').length} of {validationSteps.length} checks passed
          </div>
          {results.some(r => r.status === 'failed') && onRetry && (
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              onClick={onRetry}
            >
              Retry Connection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
