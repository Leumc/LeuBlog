"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/lib/permissions";
import { logoutAction } from "@/app/admin/auth-actions";

function bestMatch(pathname: string, hrefs: string[]): string {
  let best = "";
  for (const h of hrefs) {
    const match = h === "/admin" ? pathname === "/admin" : pathname === h || pathname.startsWith(h + "/");
    if (match && h.length > best.length) best = h;
  }
  return best;
}

export default function AdminShell({
  sections,
  user,
  children,
}: {
  sections: NavSection[];
  user: { displayName: string; role: "ADMIN" | "EDITOR" };
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/admin";
  const allItems = sections.flatMap((s) => s.items);
  const activeHref = bestMatch(pathname, allItems.map((i) => i.href));
  const current = allItems.find((i) => i.href === activeHref);
  const title = current?.label ?? "仪表盘";

  return (
    <div className="admin">
      <div className="app">
        <aside className="side">
          <div className="logo">
            <span className="dot" /> LeuBlog 后台
          </div>
          <div className="scroll">
            {sections.map((sec) => (
              <div key={sec.title}>
                <div className="grp">{sec.title}</div>
                <nav>
                  {sec.items.map((it) => (
                    <Link key={it.href} href={it.href} className={it.href === activeHref ? "on" : ""}>
                      <span className="ic">{it.icon}</span> {it.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
          <div className="me">
            <div className="av">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="nm">{user.displayName}</div>
              <div className="ro">{user.role === "ADMIN" ? "管理员" : "编者"}</div>
            </div>
            <form action={logoutAction}>
              <button className="logout">退出</button>
            </form>
          </div>
        </aside>

        <div className="main">
          {/* 移动端导航 */}
          <nav className="side-mobile">
            {allItems.map((it) => (
              <Link key={it.href} href={it.href} className={it.href === activeHref ? "on" : ""}>
                {it.label}
              </Link>
            ))}
          </nav>

          <div className="top">
            <h1>{title}</h1>
            <span className="crumb">后台 / {title}</span>
            <span className="sp" />
            <Link className="btn" href="/" target="_blank">
              查看站点 ↗
            </Link>
            <Link className="btn primary" href="/admin/posts/new">
              ＋ 写文章
            </Link>
          </div>

          <div className="content">{children}</div>
        </div>
      </div>
    </div>
  );
}
