/** 柱状图，1:1 匹配 admin.html .chart */
export default function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="chart">
      {data.map((d, i) => {
        const h = Math.round((d.count / max) * 150) + 8;
        const day = d.date.slice(8); // DD
        const isToday = i === data.length - 1;
        return (
          <div className="col" key={d.date} title={`${d.count} 次`}>
            <div className={`bar${isToday ? " today" : ""}`} style={{ height: h }} />
            <div className="lab">{isToday ? "今日" : day}</div>
          </div>
        );
      })}
    </div>
  );
}
