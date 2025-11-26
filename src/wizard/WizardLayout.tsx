import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { WizardStepper } from '../components/WizardStepper';
import { SourceSelection } from '../components/SourceSelection';
import { PipelineModeStep } from './PipelineModeStep';
import { SourceConfigStep } from './SourceConfigStep';
import { ObjectsStep } from './ObjectsStep';
import { DestinationTypeStep } from './DestinationTypeStep';
import { DestinationStep } from './DestinationStep';
import { ScheduleStep } from './ScheduleStep';
import { supabase } from '../lib/supabase';

interface WizardLayoutProps {
  step: 'source' | 'pipeline-mode' | 'source-config' | 'objects' | 'destination-type' | 'destination' | 'schedule';
  existingPipelineId?: string;
}

export function WizardLayout({ step, existingPipelineId }: WizardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { sourceType?: string; pipelineId?: string };
  const [resumeSourceType, setResumeSourceType] = useState<string | null>(null);

  // Check for resume parameter in URL
  const params = new URLSearchParams(location.search);
  const resumeId = params.get('resume') || existingPipelineId;

  useEffect(() => {
    if (resumeId && step === 'source-config') {
      const loadPipeline = async () => {
        const { data } = await supabase
          .from('pipelines')
          .select('source_type')
          .eq('id', resumeId)
          .maybeSingle();

        if (data?.source_type) {
          setResumeSourceType(data.source_type);
        }
      };

      loadPipeline();
    }
  }, [resumeId, step]);

  const stepMap = {
    source: 1,
    'pipeline-mode': 1,
    'source-config': 1,
    objects: 2,
    'destination-type': 3,
    destination: 3,
    schedule: 4,
  };

  const steps = [
    'Configure Source',
    'Select Objects',
    'Configure Destination',
    'Schedule & Final',
  ];

  const handleClose = () => {
    navigate('/pipelines');
  };

  const handleSelectSource = (sourceId: string) => {
    navigate('/pipelines/new/pipeline-mode', { state: { sourceType: sourceId } });
  };

  const isFullScreenStep = step === 'source' || step === 'pipeline-mode';
  const internallyScrollManagedSteps = new Set(['objects', 'destination-type']);
  const contentContainerClass = internallyScrollManagedSteps.has(step)
    ? 'flex-1 min-h-0 overflow-hidden'
    : 'flex-1 min-h-0 overflow-auto';

  return (
    <div className="flex flex-col h-full min-h-0">
      {!isFullScreenStep && (
        <div className="flex-shrink-0 flex items-center justify-between bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-4">
          <WizardStepper currentStep={stepMap[step]} steps={steps} />
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      )}

      <div className={contentContainerClass}>
        {step === 'source' && <SourceSelection onSelectSource={handleSelectSource} onBack={handleClose} />}
        {step === 'pipeline-mode' && state?.sourceType && <PipelineModeStep sourceType={state.sourceType} />}
        {step === 'source-config' && (state?.sourceType || resumeSourceType) && (
          <SourceConfigStep sourceType={state?.sourceType || resumeSourceType || ''} />
        )}
        {step === 'objects' && <ObjectsStep />}
        {step === 'destination-type' && <DestinationTypeStep />}
        {step === 'destination' && <DestinationStep pipelineId={resumeId} />}
        {step === 'schedule' && <ScheduleStep />}
      </div>
    </div>
  );
}
