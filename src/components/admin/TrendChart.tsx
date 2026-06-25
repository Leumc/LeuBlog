/** 轻量纯 SVG 折线图（无第三方依赖） */
export default function TrendChart({
  data,
  height = 120,
}: {
  data: { date: string; count: number }[];
  height?: number;
}) {
  const w = 720;
  const h = height;
  const pad = 8;
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
  const y = (v: number) => h - pad - (v / max) * (h - 2 * pad);

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.count)}`).join(" ");
  const area = `${line} L${x(n - 1)},${h - pad} L${x(0)},${h - pad} Z`;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full min-w-[480px]"
        preserveAspectRatio="none"
      >
        <path d={area} fill="rgba(156,43,34,0.08)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {data.map((d, i) => (
          <circle key={d.date} cx={x(i)} cy={y(d.count)} r={1.6} fill="var(--accent)" />
        ))}
      </svg>
    </div>
  );
}
