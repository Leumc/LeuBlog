import "server-only";
import { prisma } from "@/lib/prisma";

/** 本地日 YYYY-MM-DD */
export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 记录一次文章阅读：Post.viewCount++ 且按天聚合（文章维度 + 全站维度） */
export async function recordView(postId: string): Promise<void> {
  const date = today();
  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });
    await tx.dailyView.upsert({
      where: { date_postId: { date, postId } },
      update: { count: { increment: 1 } },
      create: { date, postId, count: 1 },
    });
    // 全站当日计数 postId=null：复合唯一含可空字段，null 不能用于唯一 where 直接 upsert
    // （原写法会抛错使整个事务回滚 → viewCount 一直不增）。改用 updateMany + 条件 create
    const site = await tx.dailyView.updateMany({
      where: { date, postId: null },
      data: { count: { increment: 1 } },
    });
    if (site.count === 0) {
      await tx.dailyView.create({ data: { date, postId: null, count: 1 } });
    }
  });
}

/** 取近 n 天全站访问趋势（含补零） */
export async function viewTrend(days = 30): Promise<{ date: string; count: number }[]> {
  const rows = await prisma.dailyView.findMany({
    where: { postId: null },
    orderBy: { date: "desc" },
    take: days,
  });
  const map = new Map(rows.map((r) => [r.date, r.count]));
  const out: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}
