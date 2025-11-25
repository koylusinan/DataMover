interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  type?: 'line' | 'area';
  showDots?: boolean;
}

export function Sparkline({
  data,
  width = 100,
  height = 30,
  color = '#3b82f6',
  fillColor = 'rgba(59, 130, 246, 0.1)',
  type = 'line',
  showDots = false
}: SparklineProps) {
  // Filter out NaN and invalid values
  const validData = data.filter(value =>
    typeof value === 'number' &&
    !isNaN(value) &&
    isFinite(value)
  );

  if (!validData || validData.length === 0) {
    return (
      <svg width={width} height={height} className="inline-block">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2,2" />
      </svg>
    );
  }

  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min || 1;

  const points = validData.map((value, index) => {
    // Handle single data point case to avoid NaN from 0/0
    const x = validData.length === 1 ? width / 2 : (index / (validData.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });

  const linePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  ).join(' ');

  const areaPath = type === 'area'
    ? `${linePath} L ${width} ${height} L 0 ${height} Z`
    : '';

  return (
    <svg width={width} height={height} className="inline-block">
      {type === 'area' && (
        <path d={areaPath} fill={fillColor} />
      )}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {showDots && points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} />
      ))}
    </svg>
  );
}
