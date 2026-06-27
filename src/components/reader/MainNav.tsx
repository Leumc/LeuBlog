"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const NAV = [
  { label: "首页", href: "/" },
  { label: "分组", href: "/categories" },
  { label: "标签", href: "/tags" },
  { label: "归档", href: "/archive" },
  { label: "关于", href: "/about" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MainNav({
  variant = "center",
  brand,
}: {
  variant?: "center" | "brand";
  brand?: string;
}) {
  const pathname = usePathname() || "/";
  const wrapRef = useRef<HTMLDivElement>(null);

  // 按实际可用宽度等比缩放整条导航，保证五个入口始终单行完整显示（不写死倍率）
  useEffect(() => {
    const wrap = wrapRef.current;
    const nav = wrap?.parentElement as HTMLElement | null;
    if (!wrap || !nav) return;

    const fit = () => {
      nav.style.setProperty("--nav-scale", "1");
      let scale = 1;
      // 迭代收敛：内容（含已缩放的字号/间距/内边距）超过可用宽度时按比例缩小
      for (let i = 0; i < 6; i++) {
        const cs = getComputedStyle(wrap);
        const gap = parseFloat(cs.columnGap) || 0;
        const kids = Array.from(wrap.children) as HTMLElement[];
        let content = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        content += gap * Math.max(0, kids.length - 1);
        for (const k of kids) content += k.offsetWidth;
        const avail = wrap.clientWidth;
        if (content <= avail) break;
        scale = Math.max(0.45, scale * (avail / content) * 0.99);
        nav.style.setProperty("--nav-scale", String(scale));
      }
    };

    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(nav);
    // 字体异步加载完成后宽度会变，重测一次
    (document as Document & { fonts?: FontFaceSet }).fonts?.ready
      ?.then(fit)
      .catch(() => {});
    return () => ro.disconnect();
  }, [brand, variant]);

  return (
    <nav className={`main${variant === "brand" ? " brandnav" : ""}`}>
      <div className="wrap" ref={wrapRef}>
        {variant === "brand" && brand && (
          <Link className="brand" href="/">
            {brand}
          </Link>
        )}
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={isActive(pathname, n.href) ? "active" : ""}
          >
            {n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
