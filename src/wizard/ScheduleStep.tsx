import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, Calendar, Zap, Loader2, Check, AlertCircle } from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../lib/supabase';

type ScheduleMode = 'manual' | 'continuous' | 'scheduled';
type SnapshotMode = 'initial' | 'always' | 'never';

export function ScheduleStep() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const state = location.state as { pipelineId?: string };

  const [isLoading, setIsLoading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('continuous');
  const [snapshotMode, setSnapshotMode] = useState<SnapshotMode>('initial');
  const [cronExpression, setCronExpression] = useState('0 0 * * *');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!state.pipelineId) {
      showToast('error', 'Pipeline ID is missing');
      return;
    }

    if (scheduleMode === 'scheduled' && !cronExpression.trim()) {
      showToast('error', 'Cron expression is required for scheduled mode');
      return;
    }

    setIsLoading(true);

    try {
      const scheduleConfig = {
        mode: scheduleMode,
        snapshot_mode: snapshotMode,
        ...(scheduleMode === 'scheduled' && { cron: cronExpression }),
      };

      const { error } = await supabase
        .from('pipelines')
        .update({
          schedule_config: scheduleConfig,
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', state.pipelineId);

      if (error) {
        showToast('error', 'Failed to save schedule', error.message);
        return;
      }

      showToast('success', 'Pipeline created successfully');
      navigate('/pipelines');
    } catch (error) {
      showToast('error', 'An error occurred', 'Please try again');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const scheduleOptions = [
    {
      id: 'continuous' as ScheduleMode,
      icon: Zap,
      title: 'Continuous Replication',
      description: 'Real-time CDC streaming with minimal latency',
      recommended: true,
    },
    {
      id: 'scheduled' as ScheduleMode,
      icon: Calendar,
      title: 'Scheduled Sync',
      description: 'Run at specific intervals using cron expressions',
      recommended: false,
    },
    {
      id: 'manual' as ScheduleMode,
      icon: Clock,
      title: 'Manual Trigger',
      description: 'Start replication manually when needed',
      recommended: false,
    },
  ];

  const cronPresets = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
    { label: 'Weekly (Sunday)', value: '0 0 * * 0' },
  ];

  const timelineSteps = [
    { label: 'Initial Snapshot', status: snapshotMode === 'always' || snapshotMode === 'initial' ? 'complete' : 'skipped', description: 'Full table copy' },
    { label: 'CDC Streaming', status: 'active', description: 'Ongoing changes' },
    { label: 'Monitoring', status: 'pending', description: 'Health checks' },
  ];

  return (
    <div className="flex h-full">
      <div className="flex-1 p-8 overflow-y-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm mb-6"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Schedule & Finalize
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Configure when and how your pipeline runs
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Replication Mode
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {scheduleOptions.map((option) => (
                <label
                  key={option.id}
                  className={`relative flex items-start gap-4 p-5 border-2 rounded-lg cursor-pointer transition-all ${
                    scheduleMode === option.id
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="scheduleMode"
                    value={option.id}
                    checked={scheduleMode === option.id}
                    onChange={(e) => setScheduleMode(e.target.value as ScheduleMode)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <option.icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {option.title}
                      </span>
                      {option.recommended && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {option.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {scheduleMode === 'scheduled' && (
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                Cron Expression
              </h4>
              <input
                type="text"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 0 * * *"
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-gray-900 dark:text-gray-100"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {cronPresets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setCronExpression(preset.value)}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Initial Snapshot
            </h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="radio"
                  name="snapshotMode"
                  value="initial"
                  checked={snapshotMode === 'initial'}
                  onChange={(e) => setSnapshotMode(e.target.value as SnapshotMode)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    Initial snapshot only (Recommended)
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Copy existing data once, then stream changes
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="radio"
                  name="snapshotMode"
                  value="never"
                  checked={snapshotMode === 'never'}
                  onChange={(e) => setSnapshotMode(e.target.value as SnapshotMode)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    Skip snapshot
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Only capture new changes from now on
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="radio"
                  name="snapshotMode"
                  value="always"
                  checked={snapshotMode === 'always'}
                  onChange={(e) => setSnapshotMode(e.target.value as SnapshotMode)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    Always snapshot
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Full copy on every run (scheduled mode only)
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Completing Pipeline...' : 'Complete Pipeline'}
            </button>
          </div>
        </form>
      </div>

      <div className="w-[500px] bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          Pipeline Execution Timeline
        </h3>

        <div className="relative">
          {timelineSteps.map((step, index) => (
            <div key={index} className="relative pb-8 last:pb-0">
              {index < timelineSteps.length - 1 && (
                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-700" />
              )}

              <div className="relative flex items-start gap-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.status === 'complete'
                      ? 'bg-green-600 text-white'
                      : step.status === 'active'
                        ? 'bg-blue-600 text-white ring-4 ring-blue-200 dark:ring-blue-900'
                        : step.status === 'skipped'
                          ? 'bg-gray-400 dark:bg-gray-600 text-white'
                          : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {step.status === 'complete' && <Check className="w-4 h-4" />}
                  {step.status === 'active' && <Zap className="w-4 h-4" />}
                  {step.status === 'pending' && <Clock className="w-4 h-4" />}
                  {step.status === 'skipped' && <AlertCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 pt-0.5">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {step.label}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-semibold mb-1">What happens next?</p>
              <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                <li>• Pipeline will be created in "Ready" state</li>
                <li>• You can start it manually from the dashboard</li>
                <li>• Monitor progress in real-time</li>
                <li>• View logs and metrics</li>
              </ul>
            </div>
          </div>
        </div>

        {scheduleMode === 'continuous' && (
          <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="text-sm text-green-900 dark:text-green-100">
              <p className="font-semibold mb-1">Continuous Replication</p>
              <p className="text-green-800 dark:text-green-200">
                Changes will be captured in near real-time with typical latency under 1 second
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
