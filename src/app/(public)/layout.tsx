import SiteHeader from "@/components/reader/SiteHeader";
import SiteFooter from "@/components/reader/SiteFooter";
import { getSettings } from "@/lib/settings";
import { normalizeAccent } from "@/lib/appearance";

// 实时读取站点设置（强调色等），避免静态固化构建时的默认值
export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getSettings();
  const accent = normalizeAccent(s["appearance.accent"]);

  return (
    <>
      {/* 站点默认强调色写入 :root（低优先级）；读者切换器用 documentElement
          内联样式覆盖，故能生效。不要把 --accent 写在本 div 的内联 style，
          否则会遮蔽切换器设在 <html> 上的值。 */}
      <style dangerouslySetInnerHTML={{ __html: `:root{--accent:${accent}}` }} />
      <div
        className="dotgrid"
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <SiteHeader />
        <main style={{ flex: 1 }}>{children}</main>
        <SiteFooter />
      </div>
    </>
  );
}
