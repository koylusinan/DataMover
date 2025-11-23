import { PipelineList } from '../components/PipelineList';
import { useNavigate } from 'react-router-dom';

export function PipelinesPage() {
  const navigate = useNavigate();

  const handleCreatePipeline = () => {
    navigate('/pipelines/new/source');
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Pipelines</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">Move data between any Source and Destination</p>
      <PipelineList onCreatePipeline={handleCreatePipeline} />
    </div>
  );
}
