"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/markdown";

/** 文章右侧目录（深砖红色条内），跟随滚动高亮 + 分享块 */
export default function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    if (items.length === 0) return;
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el);

    const onScroll = () => {
      let current = headings[0]?.id ?? "";
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= 120) current = h.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
  };

  return (
    <nav className="toc">
      <div className="lbl">目录</div>
      {items.map((i) => (
        <a
          key={i.id}
          href={`#${i.id}`}
          className={i.id === active ? "on" : ""}
          style={i.level === 3 ? { paddingLeft: 24 } : undefined}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          {i.text}
        </a>
      ))}
      <div className="share">
        <div className="k">分享</div>
        <a href="#" onClick={(e) => { e.preventDefault(); copyLink(); }}>
          复制链接
        </a>{" "}
        · <a href="/rss.xml">RSS</a>
      </div>
    </nav>
  );
}
