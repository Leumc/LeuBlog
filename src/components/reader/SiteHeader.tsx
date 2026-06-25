import Link from "next/link";
import { getSettings } from "@/lib/settings";
import AnnouncementBar from "./AnnouncementBar";
import MainNav from "./MainNav";

/** 完整报头：顶带 + 公告 + masthead + 居中主导航 */
export default async function SiteHeader() {
  const s = await getSettings();
  return (
    <>
      <div className="topbar" />
      <AnnouncementBar />
      <header className="masthead">
        <div className="wrap">
          <div className="kicker">{s["masthead.kicker"]}</div>
          <h1>
            <Link href="/">{s["masthead.title"]}</Link>
          </h1>
          <div className="sub">{s["masthead.subtitle"]}</div>
        </div>
      </header>
      <MainNav variant="center" />
    </>
  );
}
