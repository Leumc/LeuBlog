"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  return (
    <nav className={`main${variant === "brand" ? " brandnav" : ""}`}>
      <div className="wrap">
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
