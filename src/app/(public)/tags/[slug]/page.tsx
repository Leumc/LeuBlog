import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatDate, formatViews } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await prisma.tag.findUnique({ where: { slug } });
  return { title: t ? `标签：${t.name}` : "标签" };
}

export default async function TagDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tag = await prisma.tag.findUnique({
    where: { slug },
    include: { tagGroup: { include: { category: true } } },
  });
  if (!tag) notFound();

  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED", tags: { some: { id: tag.id } } },
    orderBy: { publishedAt: "desc" },
    include: { tags: true, author: true, category: true },
  });

  return (
    <>
      <div className="wrap cat-banner">
        <div className="crumb">
          <Link href="/">首页</Link> &nbsp;/&nbsp; <Link href="/tags">标签</Link>{" "}
          &nbsp;/&nbsp; {tag.name}
        </div>
        <h2># {tag.name}</h2>
        {tag.tagGroup && (
          <p className="desc">
            {tag.tagGroup.category.name} · {tag.tagGroup.name}
          </p>
        )}
        <div className="stat">
          共 <b>{posts.length}</b> 篇
        </div>
      </div>

      <div className="wrap" style={{ padding: "30px 0 50px" }}>
        {posts.map((p) => (
          <article className="entry" key={p.id}>
            {(p.category || p.tags[0]) && (
              <div className="top">{p.category?.name ?? p.tags[0]?.name}</div>
            )}
            <h3>
              <Link href={`/posts/${p.slug}`}>{p.title}</Link>
            </h3>
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
        ))}
        {posts.length === 0 && (
          <p style={{ padding: "30px 0", fontStyle: "italic", color: "var(--muted)" }}>
            该标签下暂无文章。
          </p>
        )}
      </div>
    </>
  );
}
