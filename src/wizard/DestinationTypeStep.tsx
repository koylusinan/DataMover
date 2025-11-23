import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { DatabaseLogoIcon } from '../components/ui/DatabaseLogos';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';

interface DestinationType {
  id: string;
  name: string;
  logo: string;
  category: string;
  connector: string;
  description: string;
  comingSoon?: boolean;
}

const DESTINATION_TYPES: DestinationType[] = [
  {
    id: 'postgres',
    name: 'PostgreSQL',
    logo: '/logos/postgresql.svg',
    category: 'Relational Databases',
    connector: 'io.debezium.connector.jdbc.JdbcSinkConnector',
    description: 'PostgreSQL Database',
  },
  {
    id: 'mysql',
    name: 'MySQL',
    logo: '/logos/mysql.svg',
    category: 'Relational Databases',
    connector: 'io.debezium.connector.jdbc.JdbcSinkConnector',
    description: 'MySQL Database',
  },
  {
    id: 'sqlserver',
    name: 'SQL Server',
    logo: '/logos/sqlserver.svg',
    category: 'Relational Databases',
    connector: 'io.debezium.connector.jdbc.JdbcSinkConnector',
    description: 'Microsoft SQL Server',
  },
  {
    id: 'oracle',
    name: 'Oracle',
    logo: '/logos/oracle.svg',
    category: 'Relational Databases',
    connector: 'io.debezium.connector.jdbc.JdbcSinkConnector',
    description: 'Oracle Database',
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    logo: '/logos/snowflake.svg',
    category: 'Cloud Data Warehouses',
    connector: 'com.snowflake.kafka.connector.SnowflakeSinkConnector',
    description: 'Snowflake Data Warehouse',
    comingSoon: true,
  },
  {
    id: 'bigquery',
    name: 'BigQuery',
    logo: '/logos/bigquery.svg',
    category: 'Cloud Data Warehouses',
    connector: 'com.wepay.kafka.connect.bigquery.BigQuerySinkConnector',
    description: 'Google BigQuery',
    comingSoon: true,
  },
  {
    id: 'kafka',
    name: 'Kafka',
    logo: '/logos/kafka.svg',
    category: 'Streaming Platforms',
    connector: 'org.apache.kafka.connect.file.FileStreamSinkConnector',
    description: 'Apache Kafka Topic',
    comingSoon: true,
  },
  {
    id: 'elasticsearch',
    name: 'Elasticsearch',
    logo: '/logos/elasticsearch.svg',
    category: 'Search & Analytics',
    connector: 'io.confluent.connect.elasticsearch.ElasticsearchSinkConnector',
    description: 'Elasticsearch Index',
    comingSoon: true,
  },
];

interface DestinationTypeStepState {
  pipelineId?: string;
  sourceType?: string;
}

export function DestinationTypeStep() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const state = (location.state as DestinationTypeStepState) || {};
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const filteredDestinations = DESTINATION_TYPES.filter((dest) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      dest.name.toLowerCase().includes(searchLower) ||
      dest.category.toLowerCase().includes(searchLower) ||
      dest.description.toLowerCase().includes(searchLower)
    );
  });

  const groupedDestinations = filteredDestinations.reduce((acc, dest) => {
    if (!acc[dest.category]) {
      acc[dest.category] = [];
    }
    acc[dest.category].push(dest);
    return acc;
  }, {} as Record<string, DestinationType[]>);

  const handleContinue = async () => {
    if (!selectedType) {
      showToast('warning', 'Please select a destination type');
      return;
    }

    if (!state.pipelineId) {
      showToast('error', 'Pipeline ID is missing');
      return;
    }

    const destination = DESTINATION_TYPES.find(d => d.id === selectedType);
    if (destination?.comingSoon) {
      showToast('info', 'Coming Soon', `${destination.name} support is coming soon!`);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('pipelines')
        .update({
          destination_type: selectedType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', state.pipelineId);

      if (error) throw error;

      navigate('/pipelines/new/destination', {
        state: {
          ...state,
          destinationType: selectedType,
        },
      });
    } catch (error) {
      console.error('Error updating destination type:', error);
      showToast('error', 'Failed to save destination type', (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 p-8 pb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm mb-6"
          >
            ← Back
          </button>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Select Destination
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Choose where you want to replicate your data
          </p>

          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search destinations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
          <div className="space-y-8">
            {Object.entries(groupedDestinations).map(([category, destinations]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
                  {category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {destinations.map((dest) => (
                    <button
                      key={dest.id}
                      onClick={() => !dest.comingSoon && setSelectedType(dest.id)}
                      disabled={dest.comingSoon}
                      className={`relative p-6 bg-white dark:bg-gray-800 border-2 rounded-xl text-left transition-all ${
                        selectedType === dest.id
                          ? 'border-blue-500 shadow-lg'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                      } ${
                        dest.comingSoon
                          ? 'opacity-60 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                    >
                      {dest.comingSoon && (
                        <span className="absolute top-3 right-3 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium rounded">
                          Coming Soon
                        </span>
                      )}
                      <div className="flex items-start gap-4">
                        <DatabaseLogoIcon
                          sourceType={dest.id}
                          connectorClass={dest.connector}
                          className="w-12 h-12 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            {dest.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {dest.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-8 py-6 bg-white dark:bg-gray-900">
          <button
            onClick={handleContinue}
            disabled={!selectedType || isLoading}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? 'Saving...' : 'Continue to Configuration'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="w-[400px] bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Destination Information
        </h3>

        {selectedType ? (
          <>
            {(() => {
              const dest = DESTINATION_TYPES.find(d => d.id === selectedType);
              if (!dest) return null;

              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <DatabaseLogoIcon
                      sourceType={dest.id}
                      connectorClass={dest.connector}
                      className="w-16 h-16 flex-shrink-0"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {dest.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {dest.category}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Connector Class
                    </h4>
                    <code className="block text-xs bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 font-mono text-gray-900 dark:text-gray-100 break-all">
                      {dest.connector}
                    </code>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Features
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>Real-time data replication</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>Automatic schema evolution</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>Upsert and delete support</span>
                      </li>
                      {!dest.comingSoon && (
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>Production ready</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {dest.comingSoon && (
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <p className="text-sm text-orange-900 dark:text-orange-100">
                        Support for {dest.name} is coming soon! Currently, only PostgreSQL, MySQL, SQL Server, and Oracle destinations are available.
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a destination type to see more details
          </p>
        )}
      </div>
    </div>
  );
}
