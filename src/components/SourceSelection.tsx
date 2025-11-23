import { ArrowLeft, Search } from 'lucide-react';
import { useState } from 'react';

interface DatabaseSource {
  id: string;
  name: string;
  logo: string;
  category: string;
  connector?: string;
  description?: string;
}

interface SourceSelectionProps {
  onSelectSource: (sourceId: string) => void;
  onBack: () => void;
}

const DATABASE_SOURCES: DatabaseSource[] = [
  // Relational Databases
  {
    id: 'oracle',
    name: 'Oracle',
    logo: '/logos/oracle.svg',
    category: 'Relational Databases',
    connector: 'io.debezium.connector.oracle.OracleConnector',
    description: 'Oracle Database'
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    logo: '/logos/postgresql.svg',
    category: 'Relational Databases',
    connector: 'io.debezium.connector.postgresql.PostgresConnector',
    description: 'PostgreSQL Database'
  },
  {
    id: 'mysql',
    name: 'MySQL',
    logo: '/logos/mysql.svg',
    category: 'Relational Databases',
    connector: 'io.debezium.connector.mysql.MySqlConnector',
    description: 'MySQL Database'
  },
  {
    id: 'mariadb',
    name: 'MariaDB',
    logo: '/logos/mariadb.svg',
    category: 'Relational Databases',
    connector: 'io.debezium.connector.mysql.MySqlConnector',
    description: 'MariaDB Database'
  },
  {
    id: 'sqlserver',
    name: 'SQL Server',
    logo: '/logos/sqlserver.svg',
    category: 'Relational Databases',
    connector: 'io.debezium.connector.sqlserver.SqlServerConnector',
    description: 'Microsoft SQL Server'
  },
  {
    id: 'db2',
    name: 'IBM Db2',
    logo: '/logos/db2.svg',
    category: 'Relational Databases',
    connector: 'io.debezium.connector.db2.Db2Connector',
    description: 'IBM Db2 Database'
  },

  // Cloud Data Warehouses
  {
    id: 'snowflake',
    name: 'Snowflake',
    logo: '/logos/snowflake.svg',
    category: 'Cloud Data Warehouses',
    description: 'Snowflake Data Warehouse'
  },
  {
    id: 'bigquery',
    name: 'BigQuery',
    logo: '/logos/bigquery.svg',
    category: 'Cloud Data Warehouses',
    description: 'Google BigQuery'
  },
  {
    id: 'redshift',
    name: 'Redshift',
    logo: '/logos/redshift.svg',
    category: 'Cloud Data Warehouses',
    description: 'Amazon Redshift'
  },
  {
    id: 'azure-synapse',
    name: 'Azure Synapse',
    logo: '/logos/azure.svg',
    category: 'Cloud Data Warehouses',
    description: 'Azure Synapse Analytics'
  },

  // NoSQL Databases
  {
    id: 'mongodb',
    name: 'MongoDB',
    logo: '/logos/mongodb.svg',
    category: 'NoSQL Databases',
    connector: 'io.debezium.connector.mongodb.MongoDbConnector',
    description: 'MongoDB Database'
  },
  {
    id: 'cassandra',
    name: 'Cassandra',
    logo: '/logos/cassandra.svg',
    category: 'NoSQL Databases',
    description: 'Apache Cassandra'
  },
  {
    id: 'couchbase',
    name: 'Couchbase',
    logo: '/logos/couchbase.svg',
    category: 'NoSQL Databases',
    description: 'Couchbase Server'
  },
  {
    id: 'dynamodb',
    name: 'DynamoDB',
    logo: '/logos/dynamodb.svg',
    category: 'NoSQL Databases',
    description: 'Amazon DynamoDB'
  },

  // Key-Value & Cache
  {
    id: 'redis',
    name: 'Redis',
    logo: '/logos/redis.svg',
    category: 'Key-Value & Cache',
    description: 'Redis Cache'
  },

  // Graph Databases
  {
    id: 'neo4j',
    name: 'Neo4j',
    logo: '/logos/neo4j.svg',
    category: 'Graph Databases',
    description: 'Neo4j Graph Database'
  },

  // Search & Analytics
  {
    id: 'elasticsearch',
    name: 'Elasticsearch',
    logo: '/logos/elasticsearch.svg',
    category: 'Search & Analytics',
    description: 'Elasticsearch'
  },

  // Event Streaming
  {
    id: 'kafka',
    name: 'Kafka',
    logo: '/logos/kafka.svg',
    category: 'Event Streaming',
    description: 'Apache Kafka'
  },
];

export function SourceSelection({ onSelectSource, onBack }: SourceSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(DATABASE_SOURCES.map(s => s.category))).sort();

  const filteredSources = DATABASE_SOURCES.filter(source => {
    const matchesSearch = searchQuery === '' ||
      source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      source.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || source.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedSources = categories.reduce((acc, category) => {
    const sourcesInCategory = filteredSources.filter(s => s.category === category);
    if (sourcesInCategory.length > 0) {
      acc[category] = sourcesInCategory;
    }
    return acc;
  }, {} as Record<string, DatabaseSource[]>);

  return (
    <div className="p-8">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Source Type</h2>
      <p className="text-gray-600 mb-6">Select the Source you want to bring data from</p>

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search Source Types"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedCategory === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Sources ({DATABASE_SOURCES.length})
        </button>
        {categories.map(category => {
          const count = DATABASE_SOURCES.filter(s => s.category === category).length;
          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category} ({count})
            </button>
          );
        })}
      </div>

      {Object.keys(groupedSources).length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sources found</h3>
          <p className="text-gray-600">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedSources).map(([category, sources]) => (
            <div key={category} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                  {category}
                </h4>
                <div className="h-px flex-1 bg-gray-200"></div>
                <span className="text-xs text-gray-500 font-medium">
                  {sources.length} {sources.length === 1 ? 'source' : 'sources'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => onSelectSource(source.id)}
                    className="group flex flex-col items-center gap-3 p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all duration-200 relative"
                  >
                    {source.connector && (
                      <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full" title="Debezium connector available"></div>
                    )}
                    <div className="w-12 h-12 flex items-center justify-center">
                      <img
                        src={source.logo}
                        alt={source.name}
                        className="w-full h-full object-contain transition-transform group-hover:scale-110"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'text-blue-600';
                            fallback.innerHTML = '<svg class="w-10 h-10" fill="currentColor" viewBox="0 0 20 20"><path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"></path><path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"></path><path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"></path></svg>';
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    </div>
                    <div className="text-center">
                      <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                        {source.name}
                      </span>
                      {source.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{source.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
