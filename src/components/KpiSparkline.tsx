/** Relative shape of the supplied sample series; no time or unit scale is implied. */
export default function KpiSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const minimum = Math.min(...data);
  const span = Math.max(...data) - minimum;
  const points = data.map((value, index) => ({
    x: 2 + index * (60 / (data.length - 1)),
    y: span === 0 ? 15 : 26 - ((value - minimum) / span) * 22,
  }));
  const last = points[points.length - 1];

  return (
    <svg className="kpi-sparkline" viewBox="0 0 64 30" aria-hidden="true">
      <polyline points={points.map(({ x, y }) => `${x},${y}`).join(" ")} />
      <circle cx={last.x} cy={last.y} r="1.6" />
    </svg>
  );
}
