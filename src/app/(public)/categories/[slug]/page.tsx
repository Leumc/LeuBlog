import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { formatAuthorName } from "@/lib/author";
import { formatDate, formatViews } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await prisma.category.findUnique({ where: { slug } });
  return { title: c ? c.name : "分组" };
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tg?: string; page?: string }>;
}) {
  const { slug } = await params;
  const { tg, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10));

  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      tagGroups: {
        orderBy: { order: "asc" },
        include: {
          tags: { orderBy: { name: "asc" } },
        },
      },
    },
  });
  if (!category) notFound();

  const adminName = await getSetting("author.adminName");

  const where = {
    status: "PUBLISHED" as const,
    categoryId: category.id,
    ...(tg ? { tags: { some: { tagGroup: { slug: tg } } } } : {}),
  };

  const [posts, total, allCats, latest] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { tags: true, author: true, category: true },
    }),
    prisma.post.count({ where }),
    prisma.category.findMany({
      orderBy: { order: "asc" },
      include: { _count: { select: { posts: { where: { status: "PUBLISHED" } } } } },
    }),
    prisma.post.findFirst({
      where: { status: "PUBLISHED", categoryId: category.id },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    }),
  ]);
  const totalInCat = allCats.find((c) => c.id === category.id)?._count.posts ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 各标签组在本分组下的篇数
  const groupCounts = await Promise.all(
    category.tagGroups.map((g) =>
      prisma.post.count({
        where: {
          status: "PUBLISHED",
          categoryId: category.id,
          tags: { some: { tagGroupId: g.id } },
        },
      }),
    ),
  );

  const qp = (p: number) => `/categories/${slug}?${tg ? `tg=${tg}&` : ""}page=${p}`;
  const allTags = category.tagGroups.flatMap((g) => g.tags);

  return (
    <>
      <div className="wrap cat-banner">
        <div className="crumb">
          <Link href="/">首页</Link> &nbsp;/&nbsp; <Link href="/categories">分组</Link>{" "}
          &nbsp;/&nbsp; {category.name}
        </div>
        <h2>{category.name}</h2>
        {category.description && <p className="desc">{category.description}</p>}
        <div className="stat">
          共 <b>{totalInCat}</b> 篇
          {latest?.publishedAt && <> · 最近更新 {formatDate(latest.publishedAt)}</>}
        </div>
        <div className="subfilter">
          <Link className={!tg ? "on" : ""} href={`/categories/${slug}`}>
            全部
          </Link>
          {category.tagGroups.map((g, i) => (
            <Link
              key={g.id}
              className={tg === g.slug ? "on" : ""}
              href={`/categories/${slug}?tg=${g.slug}`}
            >
              {g.name} {groupCounts[i]}
            </Link>
          ))}
        </div>
      </div>

      <div className="wrap layout-cat">
        <main>
          {posts.map((p) => (
            <article className="entry" key={p.id}>
              {(p.tags[0] || p.category) && (
                <div className="top">{p.tags[0]?.name ?? p.category?.name}</div>
              )}
              <h3>
                <Link href={`/posts/${p.slug}`}>
                  {p.locked && <span title="需要密钥">⊘ </span>}
                  {p.title}
                </Link>
              </h3>
              <div className="meta">
                {p.publishedAt && <>{formatDate(p.publishedAt)} · </>}
                <b>{formatAuthorName(p.author, adminName)}</b> ·{" "}
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
          ))}
          {posts.length === 0 && (
            <p style={{ padding: "30px 0", fontStyle: "italic", color: "var(--muted)" }}>
              该筛选下暂无文章。
            </p>
          )}

          {pages > 1 && (
            <div className="pager">
              {page > 1 ? (
                <Link className="ar" href={qp(page - 1)}>
                  ← 上一页
                </Link>
              ) : (
                <span className="ar disabled">← 上一页</span>
              )}
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) =>
                p === page ? (
                  <span className="cur" key={p}>
                    {p}
                  </span>
                ) : (
                  <Link key={p} href={qp(p)}>
                    {p}
                  </Link>
                ),
              )}
              {page < pages ? (
                <Link className="ar" href={qp(page + 1)}>
                  下一页 →
                </Link>
              ) : (
                <span className="ar disabled">下一页 →</span>
              )}
            </div>
          )}
        </main>

        <aside>
          <div className="block">
            <div className="section-label">其他分组</div>
            {allCats.map((c) => (
              <div className={`item${c.id === category.id ? " on" : ""}`} key={c.id}>
                <Link href={`/categories/${c.slug}`}>{c.name}</Link>
                <span className="n">{c._count.posts}</span>
              </div>
            ))}
          </div>

          {allTags.length > 0 && (
            <div className="block">
              <div className="section-label">本组标签</div>
              <div className="cloud">
                {allTags.map((t) => (
                  <Link key={t.slug} href={`/tags/${t.slug}`}>
                    {t.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
