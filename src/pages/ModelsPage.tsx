import { Layers } from 'lucide-react';

export function ModelsPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Models</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-12">SQL transformation models</p>

      <div className="max-w-2xl mx-auto mt-16">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700 text-center">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <Layers className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Models Coming Soon
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Define SQL transformation models to transform your data in-flight. This feature will allow you
            to apply custom business logic and transformations as data flows through your pipelines.
          </p>
          <span className="inline-block px-4 py-2 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg font-medium text-sm">
            Phase 2 Feature
          </span>
        </div>
      </div>
    </div>
  );
}
