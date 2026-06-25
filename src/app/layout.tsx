import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "@/styles/globals.css";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s["site.name"], template: `%s · ${s["site.name"]}` },
    description: s["site.subtitle"],
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
