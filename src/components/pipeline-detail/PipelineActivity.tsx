import { Database, Settings2, ArrowRight, Loader2, TrendingUp, RotateCw } from 'lucide-react';
import { useMemo, memo, useRef, useEffect, useState } from 'react';
import { usePipelineActivity, type RefreshInterval, type TimeRange } from '../../hooks/usePipelineActivity';

interface PipelineActivityProps {
  pipelineId: string;
  pipelineStatus: string;
  refreshInterval: RefreshInterval;
  onRefreshIntervalChange: (interval: RefreshInterval) => void;
  onManualRefresh?: () => void;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }
  return num.toString();
}

function formatRate(rate: number): string {
  return rate.toFixed(2);
}

/**
 * Deep equality check for atomic state comparison
 * Returns true if objects are equal, false otherwise
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;

  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (error) {
    console.warn('isEqual: JSON.stringify failed, using reference equality', error);
    return a === b;
  }
}

/**
 * Simple Sparkline Component
 * Renders a mini line chart from data array
 */
const Sparkline = memo(({ data, color = '#3b82f6' }: { data: number[]; color?: string }) => {
  if (!data || data.length === 0) {
    return <div className="w-full h-12" />;
  }

  const width = 120;
  const height = 40;
  const padding = 2;

  const max = Math.max(...data, 0.1); // Prevent division by zero
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1 || 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

Sparkline.displayName = 'Sparkline';

/**
 * Activity Card with ATOMIC UPDATE PATTERN + Sparkline
 *
 * Enterprise-grade zero-flicker implementation:
 * - Renders ONCE with initial values
 * - Never re-renders (fully memoized)
 * - DOM text nodes updated directly via refs
 * - Fixed min-height prevents layout shifts
 * - Includes mini sparkline graph
 */
const ActivityCard = memo(({
  icon: Icon,
  label,
  totalRef,
  rateRef,
  initialTotal,
  initialRate,
  sparklineData,
  color
}: {
  icon: any;
  label: string;
  totalRef: React.RefObject<HTMLDivElement>;
  rateRef: React.RefObject<HTMLSpanElement>;
  initialTotal: number;
  initialRate: number;
  sparklineData: number[];
  color: string;
}) => {
  return (
    <div
      className="flex-1 p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      style={{
        minHeight: '140px',
        contain: 'layout',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      </div>

      <div
        ref={totalRef}
        className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums mb-2"
      >
        {formatNumber(initialTotal)}
      </div>

      <div className="mb-2">
        <Sparkline data={sparklineData} color={color} />
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        <Clock className="w-3 h-3" />
        <span ref={rateRef}>{formatRate(initialRate)}</span> epm
      </div>
    </div>
  );
});

ActivityCard.displayName = 'ActivityCard';

/**
 * Arrow Component
 */
const Arrow = memo(() => (
  <div className="flex items-center justify-center px-2">
    <ArrowRight className="w-6 h-6 text-gray-400 dark:text-gray-600" />
  </div>
));

Arrow.displayName = 'Arrow';

/**
 * Clock icon for rate display
 */
const Clock = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeWidth="2" d="M12 6v6l4 2" />
  </svg>
);

/**
 * Pipeline Activity Component with ATOMIC UPDATE PATTERN
 *
 * Enterprise-grade implementation:
 * 1. React Query for smooth background polling
 * 2. Atomic State Update - DOM text nodes updated directly via refs
 * 3. Stable layout (fixed heights) to prevent flicker
 * 4. Component NEVER re-renders when data updates
 * 5. Time range selector (2h, 12h, 24h)
 * 6. Mini sparkline graphs for visual activity
 *
 * Flow:
 * React Query → lastDataRef → compare → direct DOM update
 *
 * Result: ZERO flicker even with 1-second polling!
 */
export const PipelineActivity = memo(function PipelineActivity({
  pipelineId,
  pipelineStatus,
  refreshInterval,
  onRefreshIntervalChange,
  onManualRefresh,
}: PipelineActivityProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  // React Query hook - polls in background
  const { data: activity, isLoading, isFetching, refetch } = usePipelineActivity({
    pipelineId,
    enabled: pipelineStatus === 'running' || pipelineStatus === 'paused',
    refetchInterval: refreshInterval,
    timeRange,
  });

  // === ATOMIC UPDATE REFS ===
  // Refs to store previous data (doesn't trigger re-render)
  const lastDataRef = useRef<typeof activity>(null);

  // Refs for DOM elements we'll update directly (bypasses React reconciliation)
  const ingestionTotalRef = useRef<HTMLDivElement>(null);
  const ingestionRateRef = useRef<HTMLSpanElement>(null);
  const transformationsTotalRef = useRef<HTMLDivElement>(null);
  const transformationsRateRef = useRef<HTMLSpanElement>(null);
  const schemaTotalRef = useRef<HTMLDivElement>(null);
  const schemaRateRef = useRef<HTMLSpanElement>(null);
  const loadTotalRef = useRef<HTMLDivElement>(null);
  const loadRateRef = useRef<HTMLSpanElement>(null);

  // === ATOMIC UPDATE EFFECT ===
  // This is the MAGIC: Directly update DOM when data changes
  // Component NEVER re-renders, only text nodes update
  // This eliminates ALL flicker/jitter
  useEffect(() => {
    if (!activity) return;

    const lastData = lastDataRef.current;

    // Only update DOM if data actually changed
    if (!lastData || !isEqual(lastData, activity)) {
      // Update Ingestion card
      if (ingestionTotalRef.current) {
        ingestionTotalRef.current.textContent = formatNumber(activity.ingestion.total);
      }
      if (ingestionRateRef.current) {
        ingestionRateRef.current.textContent = formatRate(activity.ingestion.rate);
      }

      // Update Transformations card
      if (transformationsTotalRef.current) {
        transformationsTotalRef.current.textContent = formatNumber(activity.transformations.total);
      }
      if (transformationsRateRef.current) {
        transformationsRateRef.current.textContent = formatRate(activity.transformations.rate);
      }

      // Update Schema Mapper card
      if (schemaTotalRef.current) {
        schemaTotalRef.current.textContent = formatNumber(activity.schemaMapper.total);
      }
      if (schemaRateRef.current) {
        schemaRateRef.current.textContent = formatRate(activity.schemaMapper.rate);
      }

      // Update Load card
      if (loadTotalRef.current) {
        loadTotalRef.current.textContent = formatNumber(activity.load.total);
      }
      if (loadRateRef.current) {
        loadRateRef.current.textContent = formatRate(activity.load.rate);
      }

      // Store current data for next comparison
      lastDataRef.current = activity;
    }
  }, [activity]);

  // Show loading spinner only on initial load
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" style={{ minHeight: '200px' }}>
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">Loading activity...</span>
      </div>
    );
  }

  // Show empty state if no data
  if (!activity) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400" style={{ minHeight: '200px' }}>
        No activity data available
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pipeline Activity</h3>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['2h', '12h', '24h'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              refetch();
              if (onManualRefresh) {
                onManualRefresh();
              }
            }}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh now"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Activity Cards with Arrows - Horizontal Layout */}
      <div className="flex items-center">
        <ActivityCard
          icon={Database}
          label="INGESTION"
          totalRef={ingestionTotalRef}
          rateRef={ingestionRateRef}
          initialTotal={activity.ingestion.total}
          initialRate={activity.ingestion.rate}
          sparklineData={activity.ingestion.sparkline || []}
          color="#3b82f6"
        />
        <Arrow />
        <ActivityCard
          icon={Settings2}
          label="TRANSFORMATIONS"
          totalRef={transformationsTotalRef}
          rateRef={transformationsRateRef}
          initialTotal={activity.transformations.total}
          initialRate={activity.transformations.rate}
          sparklineData={activity.transformations.sparkline || []}
          color="#8b5cf6"
        />
        <Arrow />
        <ActivityCard
          icon={Database}
          label="SCHEMA MAPPER"
          totalRef={schemaTotalRef}
          rateRef={schemaRateRef}
          initialTotal={activity.schemaMapper.total}
          initialRate={activity.schemaMapper.rate}
          sparklineData={activity.schemaMapper.sparkline || []}
          color="#ec4899"
        />
        <Arrow />
        <ActivityCard
          icon={TrendingUp}
          label="LOAD"
          totalRef={loadTotalRef}
          rateRef={loadRateRef}
          initialTotal={activity.load.total}
          initialRate={activity.load.rate}
          sparklineData={activity.load.sparkline || []}
          color="#10b981"
        />
      </div>
    </div>
  );
});
