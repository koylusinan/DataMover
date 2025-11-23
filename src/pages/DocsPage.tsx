import { HelpCircle, Search, Book, Code, Database } from 'lucide-react';

export function DocsPage() {
  const sections = [
    {
      icon: Database,
      title: 'Source Configuration',
      description: 'Learn how to configure Oracle and PostgreSQL sources',
      topics: ['Oracle Pre-requisites', 'PostgreSQL Setup', 'Network Configuration'],
    },
    {
      icon: Code,
      title: 'Pre-check SQL Snippets',
      description: 'SQL commands for validating database configuration',
      topics: ['ARCHIVELOG Mode', 'Supplemental Logging', 'User Privileges'],
    },
    {
      icon: Book,
      title: 'Troubleshooting',
      description: 'Common issues and their solutions',
      topics: ['Connection Failures', 'Permission Errors', 'Long Transactions'],
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Documentation</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Guides, references, and troubleshooting help
      </p>

      <div className="max-w-4xl mx-auto">
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search documentation..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {section.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {section.description}
                </p>
                <ul className="space-y-2">
                  {section.topics.map((topic, topicIdx) => (
                    <li key={topicIdx}>
                      <a
                        href="#"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {topic}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-12 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex gap-4">
            <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Need More Help?
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Can't find what you're looking for? Our support team is here to help.
              </p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
