import { LucideIcon } from 'lucide-react';

interface KpiChipProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'error' | 'warning';
}

export function KpiChip({ icon: Icon, label, value, variant = 'default' }: KpiChipProps) {
  const variants = {
    default: 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100',
    success: 'bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100',
    error: 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100',
    warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100',
  };

  const iconVariants = {
    default: 'text-gray-500 dark:text-gray-400',
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
  };

  return (
    <div className={`px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 ${variants[variant]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${iconVariants[variant]}`} />
        <span className="text-xs font-medium opacity-75">{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
