import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { WizardLayout } from './WizardLayout';

export function WizardRouter() {
  const { pipelineId } = useParams<{ pipelineId?: string }>();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="source" replace />} />
      <Route path="source" element={<WizardLayout step="source" existingPipelineId={pipelineId} />} />
      <Route path="pipeline-mode" element={<WizardLayout step="pipeline-mode" existingPipelineId={pipelineId} />} />
      <Route path="source-config" element={<WizardLayout step="source-config" existingPipelineId={pipelineId} />} />
      <Route path="objects" element={<WizardLayout step="objects" existingPipelineId={pipelineId} />} />
      <Route path="destination-type" element={<WizardLayout step="destination-type" existingPipelineId={pipelineId} />} />
      <Route path="destination" element={<WizardLayout step="destination" existingPipelineId={pipelineId} />} />
      <Route path="schedule" element={<WizardLayout step="schedule" existingPipelineId={pipelineId} />} />
    </Routes>
  );
}
