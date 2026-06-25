import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { renderMarkdown } from "@/lib/markdown";
import SidebarPortals from "@/components/reader/SidebarPortals";

export const metadata: Metadata = { title: "关于" };

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const s = await getSettings();
  const html = await renderMarkdown(s["about.content"]);

  const [postCount, catCount, tagCount, firstPost] = await Promise.all([
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.category.count(),
    prisma.tag.count(),
    prisma.post.findFirst({
      where: { status: "PUBLISHED", publishedAt: { not: null } },
      orderBy: { publishedAt: "asc" },
      select: { publishedAt: true },
    }),
  ]);
  const startYear = firstPost?.publishedAt?.getFullYear() ?? new Date().getFullYear();

  return (
    <>
      <div className="wrap">
        <div className="about-head">
          <div className="label">About</div>
          <h2>关于这里</h2>
          <p>{s["site.subtitle"]}</p>
        </div>
      </div>

      <div className="wrap layout-about">
        <main>
          <div className="about-prose" dangerouslySetInnerHTML={{ __html: html }} />

          <div className="stats">
            <div>
              <div className="num">{postCount}</div>
              <div className="cap">文章</div>
            </div>
            <div>
              <div className="num">{catCount}</div>
              <div className="cap">分组</div>
            </div>
            <div>
              <div className="num">{tagCount}</div>
              <div className="cap">标签</div>
            </div>
            <div>
              <div className="num">{startYear}</div>
              <div className="cap">开博于</div>
            </div>
          </div>
        </main>

        <aside>
          <div className="block">
            <div className="s-label">联系</div>
            {s["about.contact"]
              .split("\n")
              .filter(Boolean)
              .map((line, i) => (
                <div className="contact" key={i}>
                  <span className="k">联系</span>
                  <span>{line}</span>
                </div>
              ))}
          </div>

          <SidebarPortals />

          <div className="block">
            <div className="s-label">本站构建</div>
            <div className="colophon">{s["about.colophon"]}</div>
          </div>
        </aside>
      </div>
    </>
  );
}
