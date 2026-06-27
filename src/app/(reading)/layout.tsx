import { getSettings } from "@/lib/settings";
import { normalizeAccent } from "@/lib/appearance";
import MainNav from "@/components/reader/MainNav";
import SiteFooter from "@/components/reader/SiteFooter";
import ProgressBar from "@/components/reader/ProgressBar";
import MobileSidebarDrawer from "@/components/reader/MobileSidebarDrawer";

export const dynamic = "force-dynamic";

/** 文章阅读页外壳：紧凑品牌导航（无 masthead），含阅读进度条 */
export default async function ReadingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getSettings();
  const accent = normalizeAccent(s["appearance.accent"]);
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root{--accent:${accent}}` }} />
      <div className="dotgrid" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <ProgressBar />
        <div className="topbar" />
        <MainNav variant="brand" brand={s["masthead.title"]} />
        <main style={{ flex: 1 }}>{children}</main>
        <SiteFooter />
        <MobileSidebarDrawer />
      </div>
    </>
  );
}
