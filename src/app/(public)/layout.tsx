import SiteHeader from "@/components/reader/SiteHeader";
import SiteFooter from "@/components/reader/SiteFooter";
import { getSettings } from "@/lib/settings";
import { normalizeAccent } from "@/lib/appearance";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getSettings();
  const accent = normalizeAccent(s["appearance.accent"]);

  return (
    <div
      className="dotgrid"
      style={
        {
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          "--accent": accent,
        } as React.CSSProperties
      }
    >
      <SiteHeader />
      <main style={{ flex: 1 }}>{children}</main>
      <SiteFooter />
    </div>
  );
}
