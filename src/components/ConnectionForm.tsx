import { useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { ConnectionConfig } from '../types';

interface ConnectionFormProps {
  onSubmit: (config: ConnectionConfig) => Promise<void>;
  isLoading: boolean;
}

export function ConnectionForm({ onSubmit, isLoading }: ConnectionFormProps) {
  const [formData, setFormData] = useState<ConnectionConfig>({
    name: '',
    db_type: 'postgresql',
    host: '',
    port: 5432,
    database_name: '',
    username: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value) || 0 : value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Database className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Source Database Configuration</h2>
            <p className="text-sm text-gray-500">Configure your source database connection for CDC</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Connection Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="My Production DB"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="db_type" className="block text-sm font-medium text-gray-700 mb-2">
              Database Type
            </label>
            <select
              id="db_type"
              name="db_type"
              value={formData.db_type}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="mongodb">MongoDB</option>
              <option value="sqlserver">SQL Server</option>
            </select>
          </div>

          <div>
            <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-2">
              Host
            </label>
            <input
              type="text"
              id="host"
              name="host"
              value={formData.host}
              onChange={handleChange}
              required
              placeholder="localhost or db.example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-2">
              Port
            </label>
            <input
              type="number"
              id="port"
              name="port"
              value={formData.port}
              onChange={handleChange}
              required
              placeholder="5432"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="database_name" className="block text-sm font-medium text-gray-700 mb-2">
              Database Name
            </label>
            <input
              type="text"
              id="database_name"
              name="database_name"
              value={formData.database_name}
              onChange={handleChange}
              required
              placeholder="mydb"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="dbuser"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter database password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Validating Prerequisites...
              </>
            ) : (
              'Check Debezium Prerequisites'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
