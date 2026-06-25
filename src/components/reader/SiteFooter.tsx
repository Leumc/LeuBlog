import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { normalizeAccent } from "@/lib/appearance";
import AccentSwitcher from "@/components/reader/AccentSwitcher";

export default async function SiteFooter() {
  const [placement, accent] = await Promise.all([
    getSetting("portal.placement"),
    getSetting("appearance.accent"),
  ]);
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
        <div className="foot-row">
          <span>LeuBlog · 由 Next.js 与衬线字体驱动 · © {new Date().getFullYear()}</span>
          <AccentSwitcher defaultAccent={normalizeAccent(accent)} />
        </div>
      </div>
    </footer>
  );
}
