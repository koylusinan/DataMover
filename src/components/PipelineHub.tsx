import { Plus, ArrowRight } from 'lucide-react';

interface PipelineHubProps {
  onCreatePipeline: () => void;
}

export function PipelineHub({ onCreatePipeline }: PipelineHubProps) {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Pipelines</h1>
      <p className="text-gray-600 mb-12">Move data between any Source and Destination</p>

      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-12 border border-blue-200">
          <div className="text-center space-y-6">
            <div className="flex justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <span className="text-4xl">📦</span>
                </div>
                <p className="font-semibold text-gray-700">SOURCE</p>
              </div>

              <div className="flex items-center">
                <ArrowRight className="w-8 h-8 text-blue-600" />
              </div>

              <div className="text-center">
                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <span className="text-4xl">📥</span>
                </div>
                <p className="font-semibold text-gray-700">DESTINATION</p>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Move your data from any Source to Destination in Near Real-Time
              </h2>
              <p className="text-gray-600 mb-6">
                Get data in your Destinations in near real-time, easily manage schema drift with Auto
                Mapping, apply transformations and track progress. tool.
              </p>
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                Learn More →
              </a>
            </div>

            <button
              onClick={onCreatePipeline}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Create Pipeline
            </button>

            <p className="text-gray-700">
              Need onboarding support?{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
                Schedule a Call
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
