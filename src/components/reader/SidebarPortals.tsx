import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

/** 侧栏传送门块（match homepage aside：section-label + grp + portal） */
export default async function SidebarPortals() {
  const placement = await getSetting("portal.placement");
  if (placement !== "sidebar") return null;

  const portals = await prisma.portal.findMany({
    where: { visible: true, placement: "sidebar" },
    orderBy: { order: "asc" },
  });
  if (portals.length === 0) return null;

  const groups = new Map<string, typeof portals>();
  for (const p of portals) {
    if (!groups.has(p.group)) groups.set(p.group, []);
    groups.get(p.group)!.push(p);
  }

  return (
    <div className="block">
      <div className="section-label">传送门</div>
      {[...groups.entries()].map(([group, items]) => (
        <div key={group}>
          <div className="grp">{group}</div>
          {items.map((p) => (
            <div className="portal" key={p.id}>
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                {p.title} ↗
              </a>
              {p.description && <div className="d">{p.description}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
