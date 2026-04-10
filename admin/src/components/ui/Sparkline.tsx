interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
}

/** Tiny inline SVG sparkline chart. */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = '#8B5CF6',
  fillOpacity = 0.15,
}: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const padding = 1;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * chartW;
    const y = padding + chartH - (v / max) * chartH;
    return `${x},${y}`;
  });

  const linePath = `M${points.join(' L')}`;
  const fillPath = `${linePath} L${padding + chartW},${padding + chartH} L${padding},${padding + chartH} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
      aria-hidden="true"
    >
      <path d={fillPath} fill={color} opacity={fillOpacity} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
