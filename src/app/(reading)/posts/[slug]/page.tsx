import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { renderMarkdown, extractToc } from "@/lib/markdown";
import { formatDate, formatViews } from "@/lib/utils";
import ArticleBody from "@/components/reader/ArticleBody";
import Toc from "@/components/reader/Toc";
import ViewTracker from "@/components/reader/ViewTracker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findUnique({ where: { slug } });
  if (!post) return { title: "未找到文章" };
  return { title: post.title, description: post.excerpt ?? undefined };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { author: true, category: true, tags: true },
  });
  if (!post) notFound();

  const html = await renderMarkdown(post.content);
  const toc = extractToc(post.content);
  const readMin = Math.max(1, Math.round(post.content.length / 400));

  const [prev, next] = await Promise.all([
    post.publishedAt
      ? prisma.post.findFirst({
          where: { status: "PUBLISHED", publishedAt: { lt: post.publishedAt } },
          orderBy: { publishedAt: "desc" },
          select: { slug: true, title: true },
        })
      : null,
    post.publishedAt
      ? prisma.post.findFirst({
          where: { status: "PUBLISHED", publishedAt: { gt: post.publishedAt } },
          orderBy: { publishedAt: "asc" },
          select: { slug: true, title: true },
        })
      : null,
  ]);

  const catLabel = post.category
    ? post.category.name + (post.tags[0] ? ` · ${post.tags[0].name}` : "")
    : post.tags[0]?.name ?? "";

  return (
    <div className="wrap layout-post" style={{ maxWidth: 1100 }}>
      <ViewTracker slug={post.slug} />
      <article>
        <div className="post-crumb">
          <Link href="/">首页</Link>
          {post.category && (
            <>
              {" / "}
              <Link href={`/categories/${post.category.slug}`}>{post.category.name}</Link>
            </>
          )}
        </div>
        {catLabel && <span className="cat">{catLabel}</span>}
        <h1>{post.title}</h1>
        <div className="post-meta">
          {post.publishedAt && <span>{formatDate(post.publishedAt)}</span>}
          <span>
            作者 <b>{post.author.displayName}</b>
          </span>
          <span>阅读时长 {readMin} 分钟</span>
          <span className="v">阅读 {formatViews(post.viewCount)}</span>
        </div>

        <ArticleBody html={html} />

        {post.tags.length > 0 && (
          <div className="post-tags">
            标签：
            {post.tags.map((t) => (
              <Link key={t.slug} href={`/tags/${t.slug}`}>
                {t.name}
              </Link>
            ))}
          </div>
        )}

        {(prev || next) && (
          <div className="pn">
            {prev ? (
              <Link className="prev" href={`/posts/${prev.slug}`}>
                <div className="k">← 上一篇</div>
                <div className="t">{prev.title}</div>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link className="next" href={`/posts/${next.slug}`}>
                <div className="k">下一篇 →</div>
                <div className="t">{next.title}</div>
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </article>

      <aside>
        <Toc items={toc} />
      </aside>
    </div>
  );
}
