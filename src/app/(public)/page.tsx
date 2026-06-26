import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { formatDate, formatViews, formatCompact } from "@/lib/utils";
import SidebarPortals from "@/components/reader/SidebarPortals";

// 实时查询：首页文章列表随发文变化
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const count = parseInt((await getSetting("home.postCount")) || "8", 10);
  const [posts, categories, popular] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: count,
      include: { category: true, tags: true, author: true },
    }),
    prisma.category.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { posts: { where: { status: "PUBLISHED" } } } } },
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { viewCount: "desc" },
      take: 3,
      select: { slug: true, title: true, viewCount: true },
    }),
  ]);

  return (
    <div className="wrap layout-home">
      <main>
        <div className="section-label">最近发布</div>

        {posts.map((p) => {
          const catLabel = p.category
            ? p.category.name + (p.tags[0] ? ` · ${p.tags[0].name}` : "")
            : p.tags[0]?.name ?? "未分组";
          return (
            <article className="entry" key={p.id}>
              <span className="cat">{catLabel}</span>
              <h2>
                <Link href={`/posts/${p.slug}`}>
                  {p.locked && <span title="需要密钥">🔒 </span>}
                  {p.title}
                </Link>
              </h2>
              <div className="meta">
                {p.publishedAt && <>{formatDate(p.publishedAt)} · </>}
                <b>{p.author.displayName}</b> ·{" "}
                <span className="views">阅读 {formatViews(p.viewCount)}</span>
              </div>
              {p.excerpt && <p className="dek">{p.excerpt}</p>}
              {p.tags.length > 0 && (
                <div className="tags">
                  {p.tags.map((t) => (
                    <span key={t.id}>{t.name}</span>
                  ))}
                </div>
              )}
            </article>
          );
        })}

        {posts.length === 0 && (
          <p style={{ padding: "40px 0", fontStyle: "italic", color: "var(--muted)" }}>
            这里还没有文章。
          </p>
        )}

        <Link className="more" href="/categories">
          浏览全部分组 →
        </Link>
      </main>

      <aside>
        <SidebarPortals />

        <div className="block">
          <div className="section-label">分组</div>
          {categories.map((c) => (
            <div className="item" key={c.id}>
              <Link href={`/categories/${c.slug}`}>{c.name}</Link>
              <span className="n">{c._count.posts}</span>
            </div>
          ))}
        </div>

        {popular.length > 0 && (
          <div className="block">
            <div className="section-label">热门</div>
            {popular.map((p) => (
              <div className="item" key={p.slug}>
                <Link href={`/posts/${p.slug}`}>{p.title}</Link>
                <span className="n">{formatCompact(p.viewCount)}</span>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
