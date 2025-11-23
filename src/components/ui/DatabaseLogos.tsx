interface DatabaseLogoIconProps {
  connectorClass?: string;
  sourceType?: string;
  className?: string;
}

const DATABASE_LOGOS: Record<string, { url: string; bgColor: string; darkBgColor: string }> = {
  oracle: {
    url: '/logos/oracle.svg',
    bgColor: 'bg-red-50',
    darkBgColor: 'dark:bg-red-900/20',
  },
  postgresql: {
    url: '/logos/postgresql.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  postgres: {
    url: '/logos/postgresql.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  sqlserver: {
    url: '/logos/sqlserver.svg',
    bgColor: 'bg-gray-50',
    darkBgColor: 'dark:bg-gray-800',
  },
  mysql: {
    url: '/logos/mysql.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  mongodb: {
    url: '/logos/mongodb.svg',
    bgColor: 'bg-green-50',
    darkBgColor: 'dark:bg-green-900/20',
  },
  mongo: {
    url: '/logos/mongodb.svg',
    bgColor: 'bg-green-50',
    darkBgColor: 'dark:bg-green-900/20',
  },
  mariadb: {
    url: '/logos/mariadb.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  db2: {
    url: '/logos/db2.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  cassandra: {
    url: '/logos/cassandra.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  redis: {
    url: '/logos/redis.svg',
    bgColor: 'bg-red-50',
    darkBgColor: 'dark:bg-red-900/20',
  },
  elasticsearch: {
    url: '/logos/elasticsearch.svg',
    bgColor: 'bg-teal-50',
    darkBgColor: 'dark:bg-teal-900/20',
  },
  dynamodb: {
    url: '/logos/dynamodb.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  snowflake: {
    url: '/logos/snowflake.svg',
    bgColor: 'bg-cyan-50',
    darkBgColor: 'dark:bg-cyan-900/20',
  },
  synapse: {
    url: '/logos/azure.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  bigquery: {
    url: '/logos/bigquery.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  redshift: {
    url: '/logos/redshift.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  kafka: {
    url: '/logos/kafka.svg',
    bgColor: 'bg-gray-50',
    darkBgColor: 'dark:bg-gray-800',
  },
  couchbase: {
    url: '/logos/couchbase.svg',
    bgColor: 'bg-red-50',
    darkBgColor: 'dark:bg-red-900/20',
  },
  neo4j: {
    url: '/logos/neo4j.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  jdbc: {
    url: '/logos/postgresql.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
  jdbcsink: {
    url: '/logos/postgresql.svg',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-900/20',
  },
};

function getLogoForConnector(connectorClass?: string): { url: string; bgColor: string; darkBgColor: string } | null {
  if (!connectorClass) return null;

  const lowerClass = connectorClass.toLowerCase();

  for (const [key, config] of Object.entries(DATABASE_LOGOS)) {
    if (lowerClass.includes(key)) {
      return config;
    }
  }

  return null;
}

export function DatabaseLogoIcon({ connectorClass, sourceType, className = "w-10 h-10" }: DatabaseLogoIconProps) {
  let logoConfig = null;

  // PRIORITY 1: Use sourceType if provided (more specific for destination selection)
  if (sourceType) {
    logoConfig = DATABASE_LOGOS[sourceType.toLowerCase()] || null;
  }

  // PRIORITY 2: Fallback to connectorClass detection
  if (!logoConfig) {
    logoConfig = getLogoForConnector(connectorClass);
  }

  if (!logoConfig) {
    return (
      <div className={`${className} rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center p-2`}>
        <svg className="w-full h-full text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
          <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
          <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${className} rounded-lg ${logoConfig.bgColor} ${logoConfig.darkBgColor} flex items-center justify-center p-2`}>
      <img
        src={logoConfig.url}
        alt={`${connectorClass || 'Database'} Logo`}
        className="w-full h-full object-contain"
        onError={(e) => {
          console.error(`Failed to load logo: ${logoConfig.url} for connector: ${connectorClass}`);
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            const fallback = document.createElement('div');
            fallback.className = 'w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400';
            fallback.innerHTML = '<svg class="w-full h-full" fill="currentColor" viewBox="0 0 20 20"><path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"></path><path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"></path><path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"></path></svg>';
            parent.appendChild(fallback);
          }
        }}
      />
    </div>
  );
}
