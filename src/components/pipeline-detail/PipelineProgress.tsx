import { memo } from 'react';
import { CheckCircle, Loader2, XCircle, ChevronRight, Clock } from 'lucide-react';
import type { PipelineProgress, PipelineProgressEvent } from '../../lib/debezium';

interface PipelineProgressProps {
  progress: PipelineProgress;
  isLoading?: boolean;
}

interface ProgressStep {
  key: keyof PipelineProgress;
  label: string;
  description?: string;
}

const PROGRESS_STEPS: ProgressStep[] = [
  {
    key: 'source_connected',
    label: 'Connected with Source',
    description: 'Established connection to source database',
  },
  {
    key: 'ingesting_started',
    label: 'Started Ingesting Events',
    description: 'Reading change events from source',
  },
  {
    key: 'staging_events',
    label: 'Staging Events for Loading',
    description: 'Preparing events for destination',
  },
  {
    key: 'loading_started',
    label: 'Started Loading Events',
    description: 'Writing events to destination',
  },
];

function getStepIcon(event?: PipelineProgressEvent, isLoading?: boolean) {
  if (isLoading) {
    return <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />;
  }

  if (!event) {
    return <Clock className="w-5 h-5 text-gray-400" />;
  }

  switch (event.event_status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
    case 'in_progress':
      return <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />;
    default:
      return <Clock className="w-5 h-5 text-gray-400" />;
  }
}

function getStepBgColor(event?: PipelineProgressEvent) {
  if (!event) {
    return 'bg-gray-100 dark:bg-gray-700';
  }

  switch (event.event_status) {
    case 'completed':
      return 'bg-green-100 dark:bg-green-900/30';
    case 'failed':
      return 'bg-red-100 dark:bg-red-900/30';
    case 'in_progress':
      return 'bg-blue-100 dark:bg-blue-900/30';
    default:
      return 'bg-gray-100 dark:bg-gray-700';
  }
}

export const PipelineProgress = memo(function PipelineProgress({ progress, isLoading }: PipelineProgressProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">Loading progress...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-4">
        {PROGRESS_STEPS.map((step, index) => {
          const event = progress[step.key];
          const isLastStep = index === PROGRESS_STEPS.length - 1;

          return (
            <div key={step.key} className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${getStepBgColor(event)}`}
                  title={step.description}
                >
                  {getStepIcon(event, isLoading)}
                </div>
                <div>
                  <span className={`text-sm font-semibold ${
                    event?.event_status === 'completed' ? 'text-gray-900 dark:text-gray-100' :
                    event?.event_status === 'failed' ? 'text-red-600 dark:text-red-400' :
                    event?.event_status === 'in_progress' ? 'text-blue-600 dark:text-blue-400' :
                    'text-gray-500 dark:text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                  {event?.metadata && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {event.metadata.running_tasks && event.metadata.total_tasks && (
                        <span>{event.metadata.running_tasks}/{event.metadata.total_tasks} tasks running</span>
                      )}
                      {event.metadata.connector_state && (
                        <span className="ml-2">({event.metadata.connector_state})</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {!isLastStep && (
                <ChevronRight className="w-5 h-5 text-gray-300" />
              )}
              {step.key === 'ingesting_started' && (
                <>
                  <img
                    src="/simurg.svg"
                    alt="Simurg"
                    className="w-12 h-12 mx-4 hover:animate-bounce transition-transform cursor-pointer"
                    style={{
                      animation: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.animation = 'flap 0.3s ease-in-out 3';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.animation = 'none';
                    }}
                  />
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                  <style>{`
                    @keyframes flap {
                      0%, 100% { transform: scaleY(1) scaleX(1); }
                      25% { transform: scaleY(0.9) scaleX(1.1); }
                      50% { transform: scaleY(1.1) scaleX(0.95); }
                      75% { transform: scaleY(0.95) scaleX(1.05); }
                    }
                  `}</style>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
