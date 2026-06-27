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
  const colophonHtml = await renderMarkdown(s["about.colophon"]);

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
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, i) => {
                // 每行「键：值」（半/全角冒号均可），仅按首个冒号拆分，值里允许含冒号（如 URL）
                const m = line.match(/^([^:：]+?)\s*[:：]\s*(.*)$/);
                const k = m ? m[1].trim() : "";
                const v = m ? m[2].trim() : line;
                return (
                  <div className="contact" key={i}>
                    {k && <span className="k">{k}</span>}
                    <span>{v}</span>
                  </div>
                );
              })}
          </div>

          <SidebarPortals />

          <div className="block">
            <div className="s-label">补充信息</div>
            <div className="colophon" dangerouslySetInnerHTML={{ __html: colophonHtml }} />
          </div>
        </aside>
      </div>
    </>
  );
}
