import { useState } from 'react';
import { Eye, EyeOff, AlertCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ConnectionConfig } from '../types';

interface ConfigurationFormProps {
  selectedSource: string;
  onSubmit: (config: ConnectionConfig) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

export function ConfigurationForm({
  selectedSource,
  onSubmit,
  onBack,
  isLoading,
}: ConfigurationFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'getting-started' | 'setup' | 'data-sync'>('getting-started');
  const [ingestionMode, setIngestionMode] = useState('redolog');
  const [showRedoLogSettings, setShowRedoLogSettings] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(true);
  const [formData, setFormData] = useState<ConnectionConfig>({
    name: '',
    db_type: selectedSource,
    host: '',
    port: getDefaultPort(selectedSource),
    database_name: '',
    username: '',
    password: '',
  });

  const getSourceDisplayName = () => {
    const names: Record<string, string> = {
      oracle: 'Oracle',
      postgresql: 'PostgreSQL',
      sqlserver: 'SQL Server',
    };
    return names[selectedSource] || selectedSource;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 p-8 max-w-3xl overflow-y-auto">
        <button
          onClick={onBack}
          className="text-blue-600 hover:text-blue-700 font-medium text-sm mb-6"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure your {getSourceDisplayName()} Source</h2>
        <p className="text-gray-600 mb-6">
          Follow the guide on the right to set up your Source or invite a team member to do it for you
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              There are <span className="font-semibold">Prerequisites</span> that you must ensure to set up
              this Source for your Pipeline.{' '}
              <a href="#" className="text-blue-600 hover:underline font-medium">Learn more →</a>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pipeline Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder={`${getSourceDisplayName()} Source`}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <p className="text-xs text-gray-500 mt-1">A unique name for your Pipeline</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Database Host <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="host"
                value={formData.host}
                onChange={handleChange}
                required
                placeholder="10.123.1.001 or oracle-replica.westerns.inc"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <p className="text-xs text-blue-600 mt-1">
                Learn more →
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Database Port <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="port"
                value={formData.port}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">
                The port on which the database is accepting connections.{' '}
                <a href="#" className="text-blue-600 hover:underline">Need help? →</a>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Database User <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="dbuser"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Database Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Enter database password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {selectedSource === 'oracle' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Select an Ingestion Mode
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 border-2 border-blue-500 rounded-lg bg-blue-50 cursor-pointer">
                    <input
                      type="radio"
                      name="ingestion_mode"
                      value="redolog"
                      checked={ingestionMode === 'redolog'}
                      onChange={(e) => setIngestionMode(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">RedoLog</span>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                          Recommended
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        Data is ingested using the Oracle's logminer utility. This is the most efficient way to set up real-time change data capture. Deletes are also replicated to the Destination.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:border-gray-400">
                    <input
                      type="radio"
                      name="ingestion_mode"
                      value="standard"
                      checked={ingestionMode === 'standard'}
                      onChange={(e) => setIngestionMode(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">Standard</span>
                      <p className="text-sm text-gray-700 mt-1">
                        Standard ingestion mode for batch data loading.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="database_name"
                  value={formData.database_name}
                  onChange={handleChange}
                  required
                  placeholder="Enter service name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {ingestionMode === 'redolog' && (
                <>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowRedoLogSettings(!showRedoLogSettings)}
                      className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 rounded transition-colors"
                    >
                      <span className="font-semibold text-gray-900 flex items-center gap-2">
                        {showRedoLogSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        Redo Log Advanced Settings
                      </span>
                    </button>

                    {showRedoLogSettings && (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                        <div className="flex gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-semibold text-amber-900 mb-2">
                              Improper configurations of the redo log settings may impact your database performance.
                            </p>
                            <p className="text-amber-800 mb-3">
                              We recommend that you contact Support before making any changes.
                            </p>
                            <button
                              type="button"
                              className="px-4 py-2 bg-white border border-amber-300 text-amber-900 rounded font-medium hover:bg-amber-50 transition-colors text-xs"
                            >
                              CONTACT SUPPORT
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Poll Interval (in ms) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          defaultValue="500"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          The delay (in milliseconds) between checks for new transactions in redo logs. Applicable only if pipeline is in streaming mode.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Query Fetch Size <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          defaultValue="10000"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          The maximum number of rows that DataMove must fetch from the logs in each cycle.
                        </p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Long Transaction Window (in mins) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        defaultValue="5"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        The duration for which DataMove must traverse back from the latest transaction to fetch the data from a long-running transaction.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium text-gray-900">Load All Schemas</div>
                          <p className="text-sm text-gray-600">
                            If enabled, DataMove loads data from all the schemas defined on the selected host.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium text-gray-900">Online Catalog</div>
                          <p className="text-sm text-gray-600">
                            If enabled, DataMove retrieves the latest schema information on tables and columns from the specified Oracle database. This setting is ideal when schema changes are infrequent or nonexistent in the database tables.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium text-gray-900">Archive Log Only</div>
                          <p className="text-sm text-gray-600">
                            If enabled, DataMove ingests data only from archived logs.
                          </p>
                        </div>
                      </label>
                    </div>
                    </>
                    )}
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                      className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 rounded transition-colors"
                    >
                      <span className="font-semibold text-gray-900 flex items-center gap-2">
                        {showAdvancedSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        Advanced Settings
                      </span>
                    </button>

                    {showAdvancedSettings && (
                    <>
                      <div className="space-y-4 mt-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium text-gray-900">Load Historical Data</div>
                          <p className="text-sm text-gray-600">
                            If disabled, DataMove loads only the data that is written to your database after the time of creation of the Pipeline.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium text-gray-900">Merge Tables</div>
                          <p className="text-sm text-gray-600">
                            If enabled, DataMove merges tables having the same name from different schemas while loading data to the Destination.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium text-gray-900">Include New Tables in the Pipeline</div>
                          <p className="text-sm text-gray-600">
                            If enabled, DataMove automatically ingests data from any tables created or restored after the Pipeline is created.
                          </p>
                        </div>
                      </label>
                    </div>
                    </>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {selectedSource !== 'oracle' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Database Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="database_name"
                value={formData.database_name}
                onChange={handleChange}
                required
                placeholder="mydb"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          )}

          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Test Connection
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Testing Connection...' : 'Test & Continue'}
            </button>
          </div>
        </form>
      </div>

      <div className="w-96 bg-gray-50 border-l border-gray-200 overflow-y-auto">
        <div className="border-b border-gray-200 bg-white">
          <div className="flex">
            <button
              onClick={() => setActiveTab('getting-started')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'getting-started'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Getting Started
            </button>
            <button
              onClick={() => setActiveTab('setup')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'setup'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Setup
            </button>
            <button
              onClick={() => setActiveTab('data-sync')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'data-sync'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Data Sync
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'getting-started' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Prerequisites</h3>
                <p className="text-sm text-gray-600">
                  Please ensure your database is properly configured before proceeding with the setup.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">
                  Perform the following steps to configure your Generic {getSourceDisplayName()} Source:
                </h3>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3">Step 1: Create a Database User and Grant Privileges</h4>
                <p className="text-sm text-gray-700 mb-3">
                  Connect to your {getSourceDisplayName()} server as a database administrator (DBA) using SQL Developer or any other SQL client tool and run the following script.
                </p>
                <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs overflow-x-auto">
                  {selectedSource === 'oracle' ? (
                    <>
                      -- Create a Database User<br />
                      CREATE USER &lt;username&gt; IDENTIFIED BY &lt;password&gt;;<br /><br />
                      -- Grant Privileges to the Database User<br />
                      GRANT SELECT ANY DICTIONARY TO &lt;username&gt;;<br />
                      GRANT CREATE SESSION, ALTER SESSION TO &lt;username&gt;;<br />
                      GRANT SELECT ON ALL_VIEWS TO &lt;username&gt;;<br />
                      GRANT EXECUTE ON DBMS_LOGMNR TO &lt;username&gt;;
                    </>
                  ) : selectedSource === 'postgresql' ? (
                    <>
                      CREATE USER hevo_user WITH PASSWORD 'password';<br />
                      GRANT CONNECT ON DATABASE mydb TO hevo_user;<br />
                      GRANT USAGE ON SCHEMA public TO hevo_user;
                    </>
                  ) : (
                    <>
                      CREATE USER hevo_user WITH PASSWORD = 'password';<br />
                      GRANT SELECT ON SCHEMA :: dbo TO hevo_user;
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data-sync' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Configure how data should be synchronized from your source database.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getDefaultPort(sourceType: string): number {
  const ports: Record<string, number> = {
    oracle: 1521,
    postgresql: 5432,
    sqlserver: 1433,
  };
  return ports[sourceType] || 5432;
}
