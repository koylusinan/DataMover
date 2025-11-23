type PipelineRowProps = {
  sourceLabel: string;
  destinationLabel: string;
  onSourceClick?: () => void;
  onDestinationClick?: () => void;
};

export default function PipelineRow({
  sourceLabel,
  destinationLabel,
  onSourceClick,
  onDestinationClick,
}: PipelineRowProps) {
  return (
    <div
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 px-4 py-3 min-h-20"
      role="group"
      aria-label={`Pipeline from ${sourceLabel} to ${destinationLabel}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSourceClick}
        onKeyUp={(event) => event.key === 'Enter' && onSourceClick?.()}
        aria-label={`Source: ${sourceLabel}`}
        className="h-12 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex items-center justify-center px-4 text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate outline-none focus:ring-2 focus:ring-blue-500/60"
      >
        {sourceLabel}
      </div>

      <div className="flex items-center justify-center px-1" aria-hidden="true">
        <svg width="36" height="20" viewBox="0 0 36 20" className="opacity-70 text-neutral-500 dark:text-neutral-300">
          <path d="M2 10h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M26 5l8 5-8 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={onDestinationClick}
        onKeyUp={(event) => event.key === 'Enter' && onDestinationClick?.()}
        aria-label={`Destination: ${destinationLabel}`}
        className="h-12 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm flex items-center justify-center px-4 text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate outline-none focus:ring-2 focus:ring-blue-500/60"
      >
        {destinationLabel}
      </div>
    </div>
  );
}
