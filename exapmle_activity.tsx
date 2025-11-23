import { Database, Settings2, TrendingUp, Info, RotateCw, Loader2, Clock } from 'lucide-react';
import { useMemo, memo, useRef, useEffect } from 'react';
import { usePipelineActivity, type RefreshInterval } from '../../hooks/usePipelineActivity';

/* -------------------------------------------------------
   UTILS
-------------------------------------------------------- */
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  return num.toString();
}

function formatRate(rate: number): string {
  return rate.toFixed(2);
}

const REFRESH_INTERVALS = [
  { value: 1000, label: '1 second' },
  { value: 5000, label: '5 seconds' },
  { value: 10000, label: '10 seconds' },
  { value: 30000, label: '30 seconds' },
  { value: 60000, label: '1 minute' },
  { value: 300000, label: '5 minutes' },
  { value: 600000, label: '10 minutes' },
  { value: 900000, label: '15 minutes' },
  { value: 1800000, label: '30 minutes' },
];

/* -------------------------------------------------------
   🔥 ATOMIC NUMBER — Zero Flicker Number Component
   Bu component re-render almaz, sadece textContent değişir.
-------------------------------------------------------- */
const AtomicNumber = memo(function AtomicNumber({ value }: { value: number }) {
  const ref = useRef<HTMLDivElement>(null);

  const formatted = useMemo(() => formatNumber(value), [value]);

  useEffect(() => {
    if (ref.current) ref.current.textContent = formatted;
  }, [formatted]);

  return (
    <div
      ref={ref}
      className="text-3xl font-bold text-blue-600 dark:text-blue-400 tabular-nums min-w-[80px]"
      style={{ whiteSpace: 'nowrap' }}
    >
      {formatted}
    </div>
  );
});

/* -------------------------------------------------------
   🔥 ATOMIC RATE — Zero Flicker Rate Component
-------------------------------------------------------- */
const AtomicRate = memo(function AtomicRate({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  const formatted = useMemo(() => formatRate(value), [value]);

  useEffect(() => {
    if (ref.current) ref.current.textContent = `${formatted} epm`;
  }, [formatted]);

  return (
    <span
      ref={ref}
      className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1 tabular-nums"
    >
      {formatted} epm
    </span>
  );
});

/* -------------------------------------------------------
   🔥 ACTIVITY CARD — ZERO FLICKER, ZERO RE-RENDER
-------------------------------------------------------- */
const ActivityCard = memo(function ActivityCard({ icon: Icon, label, total, rate }) {
  return (
    <div
      className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      style={{
        minHeight: '110px',
        contain: 'layout paint', // maximum performance
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
          {label}
        </span>
      </div>

      {/* Atomic Number prevents layout shift */}
      <AtomicNumber value={total} />

      <div className="flex items-center gap-1 mt-1">
        <Info className="w-3 h-3 text-gray-400" />
        <AtomicRate value={rate} />
      </div>
    </div>
  );
});

/* -------------------------------------------------------
   🔥 MAIN COMPONENT (React Query + Atomic Engine)
-------------------------------------------------------- */
export const PipelineActivity = memo(function PipelineActivity({
  pipelineId,
  pipelineStatus,
  refreshInterval,
  onRefreshIntervalChange,
}: PipelineActivityProps) {
  
  const { data: activity, isLoading, isFetching, dataUpdatedAt, refetch } = usePipelineActivity({
    pipelineId,
    enabled: pipelineStatus === 'running',
    refetchInterval: refreshInterval,
  });

  const lastUpdated = useMemo(() => {
    if (!dataUpdatedAt) return 'Never';
    const d = new Date(dataUpdatedAt);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  }, [dataUpdatedAt]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" style={{ minHeight: '200px' }}>
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">Loading activity...</span>
      </div>
    );
  }

  if (!activity) {
    return (
      <div
        className="text-center py-12 text-gray-500 dark:text-gray-400"
        style={{ minHeight: '200px' }}
      >
        No activity data available
      </div>
    );
  }

  return (
    <div>
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pipeline Activity</h3>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Refresh:</span>
          </div>

          <select
            value={refreshInterval}
            onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 
                       dark:border-gray-600 bg-white dark:bg-gray-800 
                       text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {REFRESH_INTERVALS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>

          <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />

          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Updated: {lastUpdated}
          </span>

          <button
            onClick={() => refetch()}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 
                       dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Activity Grid */}
      <div className="grid grid-cols-4 gap-6">
        <ActivityCard
          icon={Database}
          label="INGESTION"
          total={activity.ingestion.total}
          rate={activity.ingestion.rate}
        />
        <ActivityCard
          icon={Settings2}
          label="TRANSFORMATIONS"
          total={activity.transformations.total}
          rate={activity.transformations.rate}
        />
        <ActivityCard
          icon={Database}
          label="SCHEMA MAPPER"
          total={activity.schemaMapper.total}
          rate={activity.schemaMapper.rate}
        />
        <ActivityCard
          icon={TrendingUp}
          label="LOAD"
          total={activity.load.total}
          rate={activity.load.rate}
        />
      </div>
    </div>
  );
});