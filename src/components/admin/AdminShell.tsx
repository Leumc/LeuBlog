"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { NavSection } from "@/lib/permissions";
import { logoutAction } from "@/app/admin/auth-actions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  POST_DRAFT_EVENT,
  POST_DRAFT_DISCARD_EVENT,
  POST_DRAFT_FLUSH_EVENT,
  activePostDraftStorageKey,
  editorIdentityFromPathname,
  readActivePostDraft,
  shouldConfirmEditorNavigation,
  type ActivePostDraft,
} from "@/lib/post-browser-draft";

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
  user: { id: string; displayName: string; role: "ADMIN" | "EDITOR" };
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/admin";
  const allItems = sections.flatMap((s) => s.items);
  const activeHref = bestMatch(pathname, allItems.map((i) => i.href));
  const current = allItems.find((i) => i.href === activeHref);
  const title = current?.label ?? "仪表盘";
  const [activeDraft, setActiveDraft] = useState<ActivePostDraft | null>(null);
  const [pendingEditorHref, setPendingEditorHref] = useState<string | null>(null);

  const refreshActiveDraft = useCallback(() => {
    try {
      setActiveDraft(readActivePostDraft(window.localStorage, user.id));
    } catch {
      setActiveDraft(null);
    }
  }, [user.id]);

  useEffect(() => {
    refreshActiveDraft();
    window.addEventListener(POST_DRAFT_EVENT, refreshActiveDraft);
    window.addEventListener("storage", refreshActiveDraft);
    return () => {
      window.removeEventListener(POST_DRAFT_EVENT, refreshActiveDraft);
      window.removeEventListener("storage", refreshActiveDraft);
    };
  }, [refreshActiveDraft]);

  useEffect(() => {
    const guardEditorLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const targetIdentity = editorIdentityFromPathname(url.pathname);
      if (!targetIdentity) return;

      window.dispatchEvent(new Event(POST_DRAFT_FLUSH_EVENT));
      const latest = readActivePostDraft(window.localStorage, user.id);
      setActiveDraft(latest);
      if (!shouldConfirmEditorNavigation({
        activeIdentity: latest?.identity ?? null,
        targetIdentity,
        currentEditorIdentity: editorIdentityFromPathname(pathname),
      })) return;

      event.preventDefault();
      setPendingEditorHref(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener("click", guardEditorLink, true);
    return () => document.removeEventListener("click", guardEditorLink, true);
  }, [pathname, user.id]);

  const discardAndNavigate = () => {
    if (!pendingEditorHref) return;
    try {
      const latest = readActivePostDraft(window.localStorage, user.id);
      if (latest) window.localStorage.removeItem(latest.draftKey);
      window.localStorage.removeItem(activePostDraftStorageKey(user.id));
      window.dispatchEvent(new CustomEvent(POST_DRAFT_DISCARD_EVENT, { detail: latest?.draftKey ?? null }));
      window.dispatchEvent(new Event(POST_DRAFT_EVENT));
    } catch {
      /* storage unavailable: navigation still proceeds */
    }
    window.location.assign(pendingEditorHref);
  };

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
      <ConfirmDialog
        open={Boolean(pendingEditorHref)}
        title="开始编辑另一篇文章？"
        description={
          <>
            当前未保存的工作{activeDraft?.title ? <>“{activeDraft.title}”</> : ""}将从浏览器中删除，且无法恢复。
          </>
        }
        confirmText="丢弃并继续"
        onCancel={() => setPendingEditorHref(null)}
        onConfirm={discardAndNavigate}
      />
    </div>
  );
}
