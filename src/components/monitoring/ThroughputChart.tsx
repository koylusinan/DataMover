import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, ExternalLink } from 'lucide-react';

interface DataPoint {
  timestamp: number;
  value: number;
}

interface ThroughputChartProps {
  data: DataPoint[];
  title?: string;
  color?: string;
  height?: number;
  onViewDetails?: () => void;
}

export function ThroughputChart({
  data,
  title = 'Throughput (records/sec)',
  color = '#3b82f6',
  height,
  onViewDetails
}: ThroughputChartProps) {
  // Filter and validate data first
  const validData = data.filter(point =>
    point &&
    typeof point.timestamp === 'number' &&
    typeof point.value === 'number' &&
    !isNaN(point.timestamp) &&
    !isNaN(point.value) &&
    isFinite(point.timestamp) &&
    isFinite(point.value)
  );

  // Transform data for Recharts with extra validation
  const chartData = validData
    .map(point => {
      const timeValue = new Date(point.timestamp).toLocaleTimeString();
      const numValue = Number(point.value.toFixed(2));

      // Double-check the transformed values
      if (isNaN(numValue) || !isFinite(numValue)) {
        return null;
      }

      return {
        time: timeValue,
        value: numValue
      };
    })
    .filter((d): d is { time: string; value: number } => d !== null);

  // Calculate stats
  const values = validData.map(d => d.value);
  const avg = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '0';
  const max = values.length > 0 ? Math.max(...values).toFixed(2) : '0';
  const current = values.length > 0 ? values[values.length - 1].toFixed(2) : '0';

  // Final safety check - don't render if no valid chart data
  const hasValidChartData = chartData.length > 0 && chartData.every(d => !isNaN(d.value) && isFinite(d.value));

  return (
    <div
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col"
      style={{ height: height || 320 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
              <span>Current: <strong className="text-gray-900 dark:text-gray-100">{current}</strong></span>
              <span>Avg: <strong className="text-gray-900 dark:text-gray-100">{avg}</strong></span>
              <span>Max: <strong className="text-gray-900 dark:text-gray-100">{max}</strong></span>
            </div>
          </div>
        </div>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg transition-colors"
            title="View on Details Page"
          >
            <ExternalLink className="w-4 h-4" />
            <span>View on Details</span>
          </button>
        )}
      </div>

      {!hasValidChartData ? (
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
              label={{ value: 'rec/s', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
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
              stroke={color}
              strokeWidth={2}
              dot={false}
              name="Throughput"
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
