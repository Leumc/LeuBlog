"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** 含侧栏的页面里能被当作抽屉打开的元素 */
const ASIDE_SELECTOR =
  ".layout-home aside, .layout-cat aside, .layout-about aside, .layout-post aside, .archive-layout .side";

/**
 * 移动端侧栏抽屉：仅在存在侧栏的页面显示一个悬浮按钮，
 * 点击从右侧滑出该页侧栏内容（目录 / 动效开关 / 分类等），点遮罩或切换页面关闭。
 * 抽屉视觉由 CSS 在窄屏下接管（body.aside-open + 各 aside 选择器）。
 */
export default function MobileSidebarDrawer() {
  const pathname = usePathname();
  const [hasAside, setHasAside] = useState(false);
  const [open, setOpen] = useState(false);

  // 切页时重新探测侧栏并收起抽屉
  useEffect(() => {
    setOpen(false);
    setHasAside(!!document.querySelector(ASIDE_SELECTOR));
  }, [pathname]);

  // 同步 body 类（驱动 CSS 抽屉），并锁定背景滚动
  useEffect(() => {
    document.body.classList.toggle("aside-open", open);
    return () => document.body.classList.remove("aside-open");
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!hasAside) return null;

  return (
    <>
      <button
        type="button"
        className="aside-fab"
        aria-label={open ? "关闭侧栏" : "打开侧栏"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>
      <div
        className="aside-overlay"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
    </>
  );
}
