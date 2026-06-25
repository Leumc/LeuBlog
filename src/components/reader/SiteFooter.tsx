import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

export default async function SiteFooter() {
  const placement = await getSetting("portal.placement");
  const footerPortals =
    placement === "footer"
      ? await prisma.portal.findMany({
          where: { visible: true, placement: "footer" },
          orderBy: { order: "asc" },
        })
      : [];

  return (
    <footer className="site">
      <div className="wrap">
        {footerPortals.length > 0 && (
          <div className="portal-links">
            {footerPortals.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                {p.title}
              </a>
            ))}
          </div>
        )}
        LeuBlog · 由 Next.js 与衬线字体驱动 · © {new Date().getFullYear()}
      </div>
    </footer>
  );
}
