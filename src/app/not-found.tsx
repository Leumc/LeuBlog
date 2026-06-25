import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { formatDateSlash } from "@/lib/utils";

export default async function NotFound() {
  const [recent, brand] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 4,
      select: { slug: true, title: true, publishedAt: true },
    }),
    getSetting("masthead.title"),
  ]);

  return (
    <div className="dotgrid" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="topbar" />
      <nav className="main brandnav">
        <div className="wrap">
          <Link className="brand" href="/">
            {brand}
          </Link>
          <Link href="/">首页</Link>
          <Link href="/categories">分组</Link>
          <Link href="/tags">标签</Link>
          <Link href="/archive">归档</Link>
          <Link href="/about">关于</Link>
        </div>
      </nav>

      <div className="nf-center">
        <div className="nf-box">
          <div className="nf-big">
            4<span className="mid">0</span>4
          </div>
          <div className="nf-kicker">Page Not Found</div>
          <h1>这一页走丢了</h1>
          <p className="nf-lead">
            你要找的页面可能已被移动、删除，或从未存在过。不如从下面这些入口继续逛逛。
          </p>

          <div className="go">
            <Link className="primary" href="/">
              ← 返回首页
            </Link>
            <Link href="/categories">分组</Link>
            <Link href="/tags">标签</Link>
            <Link href="/archive">归档</Link>
            <Link href="/about">关于</Link>
          </div>

          {recent.length > 0 && (
            <>
              <hr className="nf-rule" />
              <div className="recent">
                <div className="lbl">也许你想读</div>
                {recent.map((p) => (
                  <div className="row" key={p.slug}>
                    <Link href={`/posts/${p.slug}`}>{p.title}</Link>
                    {p.publishedAt && <span className="d">{formatDateSlash(p.publishedAt)}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="site">
        <div className="wrap">LeuBlog · 由 Next.js 与衬线字体驱动 · © {new Date().getFullYear()}</div>
      </footer>
    </div>
  );
}
