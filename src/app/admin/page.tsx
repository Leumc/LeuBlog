import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { viewTrend, today } from "@/lib/views";
import { formatViews } from "@/lib/utils";
import BarChart from "@/components/admin/BarChart";

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "刚刚";
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  if (day === 1) return "昨天";
  return `${day} 天前`;
}

export default async function AdminDashboard() {
  const user = (await getSessionUser())!;
  const isAdmin = user.role === "ADMIN";
  const mine = isAdmin ? {} : { authorId: user.id };

  const [published, drafts, totalViewsAgg, popular, recentPosts] = await Promise.all([
    prisma.post.count({ where: { ...mine, status: "PUBLISHED" } }),
    prisma.post.count({ where: { ...mine, status: "DRAFT" } }),
    prisma.post.aggregate({ where: mine, _sum: { viewCount: true } }),
    prisma.post.findMany({
      where: { ...mine, status: "PUBLISHED" },
      orderBy: { viewCount: "desc" },
      take: 5,
      include: { category: true, author: true },
    }),
    prisma.post.findMany({
      where: mine,
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { author: true },
    }),
  ]);
  const totalViews = totalViewsAgg._sum.viewCount ?? 0;

  const [catCount, tagCount, editorCount, portalCount, activeAnn, trend, recentAnns, newEditors] =
    isAdmin
      ? await Promise.all([
          prisma.category.count(),
          prisma.tag.count(),
          prisma.user.count({ where: { role: "EDITOR" } }),
          prisma.portal.count(),
          prisma.announcement.count({ where: { active: true } }),
          viewTrend(14),
          prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 3, include: { author: true } }),
          prisma.user.findMany({
            where: { role: "EDITOR" },
            orderBy: { createdAt: "desc" },
            take: 3,
            include: { _count: { select: { posts: true } } },
          }),
        ])
      : [0, 0, 0, 0, 0, [], [], []];

  const todayKey = today();
  const todayViews = (trend as { date: string; count: number }[]).find((d) => d.date === todayKey)?.count ?? 0;
  const last7 = (trend as { date: string; count: number }[]).slice(-7).reduce((a, b) => a + b.count, 0);
  const total14 = (trend as { date: string; count: number }[]).reduce((a, b) => a + b.count, 0);
  const peak = (trend as { date: string; count: number }[]).reduce(
    (m, d) => (d.count > m.count ? d : m),
    { date: "", count: 0 },
  );
  const avg = (trend as { date: string; count: number }[]).length
    ? Math.round(total14 / (trend as { date: string; count: number }[]).length)
    : 0;

  // 活动流
  const activity = [
    ...recentPosts.map((p) => ({
      kind: p.status === "PUBLISHED" ? "pub" : "edit",
      icon: p.status === "PUBLISHED" ? "✓" : "✎",
      text: (
        <>
          <b>{p.author.displayName}</b>
          {p.status === "PUBLISHED" ? " 发布" : " 编辑"}《{p.title}》
        </>
      ),
      time: p.updatedAt,
    })),
    ...(recentAnns as { id: string; content: string; createdAt: Date; author: { displayName: string } }[]).map(
      (a) => ({
        kind: "ann",
        icon: "!",
        text: (
          <>
            <b>{a.author.displayName}</b> 发布公告「{a.content.slice(0, 16)}」
          </>
        ),
        time: a.createdAt,
      }),
    ),
  ]
    .sort((x, y) => y.time.getTime() - x.time.getTime())
    .slice(0, 5);

  const idleEditors = (newEditors as { displayName: string; createdAt: Date; _count: { posts: number } }[]).filter(
    (e) => e._count.posts === 0,
  );

  return (
    <>
      <div className="cards">
        <div className="card">
          <div className="k">文章总数</div>
          <div className="v">{published + drafts}</div>
          <div className="sub">已发布 {published} · 草稿 {drafts}</div>
        </div>
        <div className="card">
          <div className="k">总阅读量</div>
          <div className="v">{formatViews(totalViews)}</div>
          {isAdmin && (
            <div className="sub">
              <span className="up">▲ {formatViews(last7)}</span> 近 7 日
            </div>
          )}
        </div>
        {isAdmin ? (
          <>
            <div className="card">
              <div className="k">今日访问</div>
              <div className="v">{formatViews(todayViews)}</div>
              <div className="sub">近 14 日日均 {avg}</div>
            </div>
            <div className="card">
              <div className="k">生效公告</div>
              <div className="v">
                {activeAnn} {activeAnn > 0 && <span className="pill warn">展示中</span>}
              </div>
              <div className="sub">前台当前展示</div>
            </div>
            <div className="card">
              <div className="k">编者 / 分类</div>
              <div className="v">{editorCount}</div>
              <div className="sub">
                {catCount} 分组 · {tagCount} 标签 · {portalCount} 传送门
              </div>
            </div>
          </>
        ) : (
          <div className="card">
            <div className="k">草稿</div>
            <div className="v">{drafts}</div>
            <div className="sub">待发布</div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="row2">
          <div className="panel">
            <div className="h">
              <h2>访问量趋势</h2>
              <span className="right" style={{ fontSize: 12, color: "var(--soft)" }}>
                近 14 天
              </span>
            </div>
            <div className="b">
              <BarChart data={trend as { date: string; count: number }[]} />
              <div className="chartfoot">
                <span>
                  近 14 天合计 <b>{formatViews(total14)}</b> 次
                </span>
                <span>
                  日均 <b>{avg}</b> · 峰值 <b>{peak.count}</b>
                  {peak.date && `（${peak.date.slice(5).replace("-", "/")}）`}
                </span>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="h">
              <h2>最近活动</h2>
            </div>
            <ul className="feed">
              {activity.map((a, i) => (
                <li key={i}>
                  <div className={`ic ${a.kind}`}>{a.icon}</div>
                  <div>
                    <div className="tx">{a.text}</div>
                    <div className="tm">{timeAgo(a.time)}</div>
                  </div>
                </li>
              ))}
              {activity.length === 0 && <li style={{ color: "var(--amuted)" }}>暂无活动</li>}
            </ul>
          </div>
        </div>
      )}

      <div className="row2">
        <div className="panel">
          <div className="h">
            <h2>热门文章排行{isAdmin ? "" : "（我的）"}</h2>
            <Link className="more" href="/admin/posts">
              查看全部
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: 46 }}>#</th>
                <th>标题</th>
                <th>分组</th>
                <th>作者</th>
                <th className="num">阅读</th>
              </tr>
            </thead>
            <tbody>
              {popular.map((p, i) => (
                <tr key={p.id}>
                  <td>
                    <span className={`rank${i < 3 ? " top" : ""}`}>{i + 1}</span>
                  </td>
                  <td className="ttl">{p.title}</td>
                  <td>{p.category ? <span className="tag">{p.category.name}</span> : "—"}</td>
                  <td>{p.author.displayName}</td>
                  <td className="num">{formatViews(p.viewCount)}</td>
                </tr>
              ))}
              {popular.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "var(--amuted)", textAlign: "center" }}>
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="h">
            <h2>需要关注</h2>
          </div>
          <ul className="feed">
            <li>
              <div className="ic edit">▤</div>
              <div>
                <div className="tx">
                  <b>{drafts} 篇草稿</b>未发布
                </div>
                <div className="tm">{drafts > 0 ? "记得整理发布" : "全部已发布"}</div>
              </div>
            </li>
            {isAdmin && activeAnn > 0 && (
              <li>
                <div className="ic ann">!</div>
                <div>
                  <div className="tx">
                    当前有 <b>{activeAnn} 条公告</b>展示中
                  </div>
                  <div className="tm">确认是否仍需展示</div>
                </div>
              </li>
            )}
            {isAdmin &&
              idleEditors.map((e) => (
                <li key={e.displayName}>
                  <div className="ic user">☺</div>
                  <div>
                    <div className="tx">
                      <b>{e.displayName}</b> 尚无已发布文章
                    </div>
                    <div className="tm">{e.createdAt.toISOString().slice(0, 10)} 加入</div>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </>
  );
}
