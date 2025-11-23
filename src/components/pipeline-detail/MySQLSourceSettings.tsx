import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface MySQLSourceSettingsProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function MySQLSourceSettings({ config, onChange }: MySQLSourceSettingsProps) {
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (field: string, value: unknown) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Hostname
          </label>
          <input
            type="text"
            value={(config['database.hostname'] as string) || ''}
            onChange={(e) => updateField('database.hostname', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            placeholder="localhost"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Port
          </label>
          <input
            type="number"
            value={(config['database.port'] as number) || 3306}
            onChange={(e) => updateField('database.port', parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Username
        </label>
        <input
          type="text"
          value={(config['database.user'] as string) || ''}
          onChange={(e) => updateField('database.user', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          placeholder="root"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={(config['database.password'] as string) || ''}
            onChange={(e) => updateField('database.password', e.target.value)}
            className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Binlog Settings</h4>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Server ID
            </label>
            <input
              type="number"
              value={(config['database.server.id'] as number) || 184054}
              onChange={(e) => updateField('database.server.id', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="184054"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Unique identifier for this database server
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Snapshot Mode
            </label>
            <select
              value={(config['snapshot.mode'] as string) || 'initial'}
              onChange={(e) => updateField('snapshot.mode', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="initial">Initial</option>
              <option value="when_needed">When Needed</option>
              <option value="never">Never</option>
              <option value="schema_only">Schema Only</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Controls how the connector snapshots existing data
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Binlog Offset Storage
            </label>
            <input
              type="text"
              value={(config['offset.storage'] as string) || 'kafka'}
              onChange={(e) => updateField('offset.storage', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="kafka"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={(config['include.schema.changes'] as boolean) || true}
                onChange={(e) => updateField('include.schema.changes', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Include schema changes
              </span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              Capture DDL changes in addition to DML
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Advanced Settings</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Queue Size
            </label>
            <input
              type="number"
              value={(config['max.queue.size'] as number) || 8192}
              onChange={(e) => updateField('max.queue.size', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Batch Size
            </label>
            <input
              type="number"
              value={(config['max.batch.size'] as number) || 2048}
              onChange={(e) => updateField('max.batch.size', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={(config['tombstones.on.delete'] as boolean) || true}
              onChange={(e) => updateField('tombstones.on.delete', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Send tombstone events on delete
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
