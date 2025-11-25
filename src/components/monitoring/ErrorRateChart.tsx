import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { AlertTriangle } from 'lucide-react';

interface DataPoint {
  timestamp: number;
  value: number;
}

interface ErrorRateChartProps {
  data: DataPoint[];
  title?: string;
  threshold?: number;
  height?: number;
}

export function ErrorRateChart({
  data,
  title = 'Error Rate',
  threshold = 10,
  height = 300
}: ErrorRateChartProps) {
  // Transform data for Recharts
  const chartData = data.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString(),
    value: Number(point.value.toFixed(2))
  }));

  // Calculate stats
  const values = data.map(d => d.value);
  const total = values.reduce((a, b) => a + b, 0);
  const avg = values.length > 0 ? (total / values.length).toFixed(2) : '0';
  const max = values.length > 0 ? Math.max(...values).toFixed(2) : '0';
  const current = values.length > 0 ? values[values.length - 1].toFixed(2) : '0';

  // Check if above threshold
  const isAboveThreshold = parseFloat(current) > threshold;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isAboveThreshold ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
            <AlertTriangle className={`w-5 h-5 ${isAboveThreshold ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
              <span>Current: <strong className={`${isAboveThreshold ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{current}</strong></span>
              <span>Avg: <strong className="text-gray-900 dark:text-gray-100">{avg}</strong></span>
              <span>Max: <strong className="text-gray-900 dark:text-gray-100">{max}</strong></span>
              <span>Total: <strong className="text-gray-900 dark:text-gray-100">{total.toFixed(0)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          No data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
            <XAxis
              dataKey="time"
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              label={{ value: 'errors', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
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
            {threshold > 0 && (
              <ReferenceLine
                y={threshold}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                label={{ value: `Threshold: ${threshold}`, fill: '#f59e0b', fontSize: 12 }}
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#errorGradient)"
              name="Errors"
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
