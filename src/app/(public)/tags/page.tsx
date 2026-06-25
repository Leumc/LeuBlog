import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "标签总览" };

export default async function TagsPage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { posts: { where: { status: "PUBLISHED" } }, tagGroups: true } },
      tagGroups: {
        orderBy: { order: "asc" },
        include: {
          tags: {
            orderBy: { name: "asc" },
            include: { _count: { select: { posts: { where: { status: "PUBLISHED" } } } } },
          },
        },
      },
    },
  });

  const ungrouped = await prisma.tag.findMany({
    where: { tagGroupId: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: { where: { status: "PUBLISHED" } } } } },
  });

  return (
    <div className="wrap">
      <div className="pagehead">
        <div className="crumb">
          <Link href="/">首页</Link> &nbsp;/&nbsp; 标签
        </div>
        <h2>标签</h2>
        <p className="lead">
          按 <b>文章分组 → 标签组</b> 两级层次组织 · 角标为文章数
        </p>
      </div>

      {categories.map((c) => (
        <div className="cat-sec" key={c.id}>
          <div className="cat-head">
            <span className="name">{c.name}</span>
            <span className="meta">
              {c._count.tagGroups} 个标签组 · {c._count.posts} 篇
            </span>
            <Link className="all" href={`/categories/${c.slug}`}>
              进入分组 →
            </Link>
          </div>

          {c.tagGroups.map((g) => (
            <div className="tg-row" key={g.id}>
              <div className="tg-name">
                {g.name}
                <span className="c">标签组</span>
              </div>
              <div className="chips">
                {g.tags.map((t) => (
                  <Link className="chip" href={`/tags/${t.slug}`} key={t.slug}>
                    {t.name} <span className="n">{t._count.posts}</span>
                  </Link>
                ))}
                {g.tags.length === 0 && (
                  <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 14 }}>
                    （暂无标签）
                  </span>
                )}
              </div>
            </div>
          ))}
          {c.tagGroups.length === 0 && (
            <div className="tg-row">
              <div className="tg-name">—</div>
              <div className="chips">
                <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 14 }}>
                  （暂无标签组）
                </span>
              </div>
            </div>
          )}
        </div>
      ))}

      {ungrouped.length > 0 && (
        <div className="cat-sec">
          <div className="cat-head">
            <span className="name">未分组</span>
            <span className="meta">{ungrouped.length} 个标签</span>
          </div>
          <div className="tg-row">
            <div className="tg-name">
              其他<span className="c">标签组</span>
            </div>
            <div className="chips">
              {ungrouped.map((t) => (
                <Link className="chip" href={`/tags/${t.slug}`} key={t.slug}>
                  {t.name} <span className="n">{t._count.posts}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
