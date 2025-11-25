import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock, ExternalLink } from 'lucide-react';

interface DataPoint {
  timestamp: number;
  value: number;
}

interface LatencyChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  onViewDetails?: () => void;
}

export function LatencyChart({
  data,
  title = 'Latency (milliseconds)',
  height,
  onViewDetails
}: LatencyChartProps) {
  // Transform data for Recharts
  const chartData = data.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString(),
    value: point.value != null ? Number(point.value.toFixed(2)) : 0
  }));

  // Calculate stats
  const values = data.filter(d => d.value != null).map(d => d.value);
  const avg = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '0';
  const max = values.length > 0 ? Math.max(...values).toFixed(2) : '0';
  const min = values.length > 0 ? Math.min(...values).toFixed(2) : '0';
  const current = values.length > 0 ? values[values.length - 1].toFixed(2) : '0';

  return (
    <div
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col"
      style={{ height: height || 320 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
              <span>Current: <strong className="text-gray-900 dark:text-gray-100">{current}ms</strong></span>
              <span>Avg: <strong className="text-gray-900 dark:text-gray-100">{avg}ms</strong></span>
              <span>Min/Max: <strong className="text-gray-900 dark:text-gray-100">{min}/{max}ms</strong></span>
            </div>
          </div>
        </div>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium rounded-lg transition-colors"
            title="View on Details Page"
          >
            <ExternalLink className="w-4 h-4" />
            <span>View on Details</span>
          </button>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-gray-500 dark:text-gray-400">
          No data available
        </div>
      ) : (
        <div className="flex-1" style={{ minHeight: '200px' }}>
          <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
            <XAxis
              dataKey="time"
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              label={{ value: 'ms', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f9fafb'
              }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
              name="Latency"
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
