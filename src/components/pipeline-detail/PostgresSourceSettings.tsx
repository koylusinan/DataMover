import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PostgresSourceSettingsProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function PostgresSourceSettings({ config, onChange }: PostgresSourceSettingsProps) {
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (field: string, value: unknown) => {
    onChange({ ...config, [field]: value });
  };

  const getBoolean = (value: unknown, fallback = false) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
    }
    return fallback;
  };

  const getNumber = (value: unknown, fallback: number) => {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return fallback;
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
            value={getNumber(config['database.port'], 5432)}
            onChange={(e) => updateField('database.port', parseInt(e.target.value, 10) || 5432)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Database Name
        </label>
        <input
          type="text"
          value={(config['database.dbname'] as string) || ''}
          onChange={(e) => updateField('database.dbname', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          placeholder="postgres"
        />
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
          placeholder="postgres"
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
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Connection Settings</h4>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Database Schema
            </label>
            <input
              type="text"
              value={(config['database.schema'] as string) || 'public'}
              onChange={(e) => updateField('database.schema', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="public"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Database Server ID
            </label>
            <input
              type="text"
              value={(config['database.server.id'] as string) || ''}
              onChange={(e) => updateField('database.server.id', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="8106"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={getBoolean(config['use_ssl'])}
                onChange={(e) => updateField('use_ssl', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Use SSL
              </span>
            </label>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={getBoolean(config['ssh_tunnel'])}
                onChange={(e) => updateField('ssh_tunnel', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                SSH Tunnel
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">CDC Settings</h4>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Topic Prefix
              </label>
              <input
                type="text"
                value={(config['topic.prefix'] as string) || ''}
                onChange={(e) => updateField('topic.prefix', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="denizim"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Prefix for Kafka topics
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Database Server Name
              </label>
              <input
                type="text"
                value={(config['database.server.name'] as string) || ''}
                onChange={(e) => updateField('database.server.name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="denizim_res_20251123"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Logical name for database server
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Plugin Name
            </label>
            <select
              value={(config['plugin.name'] as string) || 'pgoutput'}
              onChange={(e) => updateField('plugin.name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="pgoutput">pgoutput</option>
              <option value="wal2json">wal2json</option>
              <option value="decoderbufs">decoderbufs</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Logical decoding plugin for PostgreSQL
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Publication Name
            </label>
            <input
              type="text"
              value={(config['publication.name'] as string) || 'dbz_publication'}
              onChange={(e) => updateField('publication.name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="dbz_publication"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              PostgreSQL publication for CDC
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Slot Name
            </label>
            <input
              type="text"
              value={(config['slot.name'] as string) || 'debezium'}
              onChange={(e) => updateField('slot.name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="debezium"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Replication slot name
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
              <option value="always">Always</option>
              <option value="never">Never</option>
              <option value="exported">Exported</option>
              <option value="custom">Custom</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Controls when initial snapshot is taken
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Table Include List
            </label>
            <input
              type="text"
              value={(config['table.include.list'] as string) || ''}
              onChange={(e) => updateField('table.include.list', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="public.customers,public.orders"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Comma-separated list of tables to include
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={getBoolean(config['slot.drop.on.stop'])}
                onChange={(e) => updateField('slot.drop.on.stop', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Drop slot on connector stop
              </span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              Automatically drop replication slot when connector stops
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={getBoolean(config['include.schema.changes'])}
                onChange={(e) => updateField('include.schema.changes', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Include schema changes
              </span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={getBoolean(config['tombstones.on.delete'])}
                onChange={(e) => updateField('tombstones.on.delete', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tombstones on delete
              </span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              Emit tombstone events for deletions
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Decimal Handling Mode
            </label>
            <select
              value={(config['decimal.handling.mode'] as string) || 'precise'}
              onChange={(e) => updateField('decimal.handling.mode', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="precise">Precise</option>
              <option value="double">Double</option>
              <option value="string">String</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              How to handle decimal values
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Connector Settings</h4>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tasks Max
            </label>
            <input
              type="number"
              value={getNumber(config['tasks.max'], 1)}
              onChange={(e) => updateField('tasks.max', parseInt(e.target.value, 10) || 1)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Maximum number of tasks for this connector
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Error Handling</h4>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Error Tolerance
            </label>
            <select
              value={(config['errors.tolerance'] as string) || 'none'}
              onChange={(e) => updateField('errors.tolerance', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="none">None</option>
              <option value="all">All</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Error tolerance level
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={getBoolean(config['errors.log.enable'])}
                onChange={(e) => updateField('errors.log.enable', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable error logging
              </span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={getBoolean(config['errors.log.include.messages'])}
                onChange={(e) => updateField('errors.log.include.messages', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Include error messages in logs
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Dead Letter Queue Topic
            </label>
            <input
              type="text"
              value={(config['errors.deadletterqueue.topic.name'] as string) || ''}
              onChange={(e) => updateField('errors.deadletterqueue.topic.name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="denizim-source-dlq"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Topic name for failed records
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                DLQ Replication Factor
              </label>
              <input
                type="number"
                value={getNumber(config['errors.deadletterqueue.topic.replication.factor'], 1)}
                onChange={(e) => updateField('errors.deadletterqueue.topic.replication.factor', parseInt(e.target.value, 10) || 1)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 mt-8">
                <input
                  type="checkbox"
                  checked={getBoolean(config['errors.deadletterqueue.context.headers.enable'])}
                  onChange={(e) => updateField('errors.deadletterqueue.context.headers.enable', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable DLQ context headers
                </span>
              </label>
            </div>
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
              value={getNumber(config['max.queue.size'], 8192)}
              onChange={(e) => updateField('max.queue.size', parseInt(e.target.value, 10) || 8192)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Batch Size
            </label>
            <input
              type="number"
              value={getNumber(config['max.batch.size'], 2048)}
              onChange={(e) => updateField('max.batch.size', parseInt(e.target.value, 10) || 2048)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
