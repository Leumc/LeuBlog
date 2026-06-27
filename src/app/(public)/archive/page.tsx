import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import ArchiveView, {
  type ArchivePost,
  type YearData,
} from "@/components/reader/ArchiveView";

export const metadata: Metadata = { title: "归档" };

// 实时查询：内容随发文变化，不做静态固化
export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED", publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    include: { category: true },
  });

  const data: Record<number, YearData> = {};
  const yearSet = new Set<number>();

  for (const p of posts) {
    const dt = p.publishedAt!;
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    yearSet.add(y);
    if (!data[y]) {
      const monthCount: Record<number, number> = {};
      for (let i = 1; i <= 12; i++) monthCount[i] = 0;
      data[y] = { posts: [], monthCount, dayCount: {}, total: 0 };
    }
    const yd = data[y];
    const entry: ArchivePost = {
      y,
      m,
      d,
      key,
      title: p.title,
      slug: p.slug,
      cat: p.category?.name ?? null,
    };
    yd.posts.push(entry);
    yd.monthCount[m]++;
    yd.dayCount[key] = (yd.dayCount[key] || 0) + 1;
    yd.total++;
  }

  const years = [...yearSet].sort((a, b) => b - a);

  return (
    <div className="wrap" style={{ maxWidth: 1120 }}>
      <div className="pagehead">
        <div className="crumb">
          <a href="/">首页</a> &nbsp;/&nbsp; 归档
        </div>
        <h2>归档</h2>
      </div>
      {years.length === 0 ? (
        <p style={{ padding: "40px 0", fontStyle: "italic", color: "var(--muted)" }}>
          这里还没有文章。
        </p>
      ) : (
        <ArchiveView years={years} data={data} />
      )}
    </div>
  );
}
