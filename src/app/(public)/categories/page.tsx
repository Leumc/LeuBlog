import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateSlash } from "@/lib/utils";

export const metadata: Metadata = { title: "分组总览" };

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: {
      posts: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 5,
        select: { slug: true, title: true, publishedAt: true },
      },
      _count: { select: { posts: { where: { status: "PUBLISHED" } } } },
    },
  });

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: { where: { status: "PUBLISHED" } } } } },
  });
  const totalPosts = categories.reduce((a, c) => a + c._count.posts, 0);

  return (
    <div className="wrap">
      <div className="pagehead">
        <div className="crumb">
          <Link href="/">首页</Link> &nbsp;/&nbsp; 分组
        </div>
        <h2>按分组浏览</h2>
        <p className="lead">
          共 <span className="count">{categories.length}</span> 个分组 ·{" "}
          <span className="count">{totalPosts}</span> 篇文章
        </p>
      </div>

      {categories.map((c) => {
        const latest = c.posts[0]?.publishedAt;
        return (
          <div className="cat-block" key={c.id}>
            <div className="cat-meta">
              <span className="label">{c.name}</span>
              <h3>{c.name}</h3>
              {c.description && <p>{c.description}</p>}
              <div className="stat">
                共 <b>{c._count.posts}</b> 篇
                {latest && <> · 最近更新 {formatDate(latest).replace(/^\d+ 年 /, "")}</>}
              </div>
              <Link className="view" href={`/categories/${c.slug}`}>
                查看全部 →
              </Link>
            </div>
            <div className="cat-list">
              {c.posts.map((p) => (
                <div className="row" key={p.slug}>
                  <Link href={`/posts/${p.slug}`}>{p.title}</Link>
                  {p.publishedAt && <span className="d">{formatDateSlash(p.publishedAt)}</span>}
                </div>
              ))}
              {c.posts.length === 0 && (
                <div className="row">
                  <span className="d">（暂无文章）</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="tags-section">
        <div className="section-label">按标签浏览</div>
        <div className="cloud">
          {tags.map((t) => (
            <Link
              key={t.slug}
              href={`/tags/${t.slug}`}
              className={t._count.posts >= 10 ? "big" : ""}
            >
              {t.name} <span className="n">{t._count.posts}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
