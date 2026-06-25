"use client";

import { useEffect, useRef } from "react";

export type ArchivePost = {
  y: number;
  m: number;
  d: number;
  key: string; // YYYY-MM-DD
  title: string;
  slug: string;
  cat: string | null;
};
export type YearData = {
  posts: ArchivePost[];
  monthCount: Record<number, number>;
  dayCount: Record<string, number>;
  total: number;
};

const MONNUM = (m: number) => `${m}月`;
const WD = ["日", "一", "二", "三", "四", "五", "六"];
const pad = (n: number) => String(n).padStart(2, "0");
const lvl = (c: number) => (c >= 3 ? "lv3" : c === 2 ? "lv2" : c >= 1 ? "lv1" : "");

export default function ArchiveView({
  years,
  data,
}: {
  years: number[];
  data: Record<number, YearData>;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    const tree = treeRef.current;
    if (!content || !tree) return;

    let fYear = years[0];
    let fMonth: number | null = null;

    function fullYearHeat(y: number): string {
      const dc = data[y].dayCount;
      const first = new Date(y, 0, 1);
      const lead = first.getDay();
      const diy =
        (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
      const numCols = Math.ceil((lead + diy) / 7);
      let cells = "";
      for (let i = 0; i < lead; i++) cells += `<div class="cell empty"></div>`;
      const monthCol: Record<number, number> = {};
      for (
        let dd = new Date(y, 0, 1);
        dd.getFullYear() === y;
        dd.setDate(dd.getDate() + 1)
      ) {
        const key = `${y}-${pad(dd.getMonth() + 1)}-${pad(dd.getDate())}`;
        const c = dc[key] || 0;
        cells += `<div class="cell ${lvl(c)} ${c > 0 ? "has" : ""}" title="${key}${
          c > 0 ? " · " + c + " 篇" : " · 无"
        }" ${c > 0 ? `data-day="${key}"` : ""}></div>`;
        if (dd.getDate() === 1) {
          const idx = lead + Math.floor((dd.getTime() - first.getTime()) / 86400000);
          monthCol[dd.getMonth()] = Math.floor(idx / 7) + 1;
        }
      }
      let mlabels = "";
      for (let m = 0; m < 12; m++)
        mlabels += `<span style="${
          monthCol[m] ? `grid-column-start:${monthCol[m]}` : ""
        }">${m + 1}月</span>`;
      return `<div class="yearheat">
        <div class="yh-top"><span class="t">${y} 全年发布日历</span>
          <span class="legend">少<i style="background:var(--c0)"></i><i style="background:var(--c1)"></i><i style="background:var(--c2)"></i><i style="background:var(--c3)"></i>多</span></div>
        <div class="yh-scroll"><div class="yh-area">
          <div class="yh-months" style="grid-template-columns:repeat(${numCols},12px)">${mlabels}</div>
          <div class="yh-rowwrap"><div class="yh-wd"><span></span><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span></div>
          <div class="yh-cells">${cells}</div></div></div></div></div>`;
    }

    function renderContent() {
      let h = "";
      years.forEach((y) => {
        h += `<div class="yhead" id="yhead-${y}" data-year="${y}" data-month="">
          <div class="year">${y} <span>${data[y].total} 篇</span></div>${fullYearHeat(y)}</div>`;
        let curM: number | null = null;
        data[y].posts.forEach((p) => {
          if (p.m !== curM) {
            curM = p.m;
            h += `<div class="month-sec" id="m-${y}-${pad(p.m)}" data-year="${y}" data-month="${p.m}">
              <div class="month-h">${MONNUM(p.m)} <span>${data[y].monthCount[p.m]} 篇</span></div>`;
          }
          h += `<div class="arow" data-daykey="${p.key}"><span class="date">${pad(p.m)}-${pad(
            p.d,
          )}</span><span class="title"><a href="/posts/${p.slug}">${escapeHtml(
            p.title,
          )}</a></span>${p.cat ? `<span class="cat">${escapeHtml(p.cat)}</span>` : "<span></span>"}</div>`;
        });
      });
      h += `<div class="tail-spacer" style="height:calc(100vh - 160px)" aria-hidden="true"></div>`;
      content!.innerHTML = h;
    }

    function escapeHtml(s: string): string {
      return s.replace(/[&<>"]/g, (c) =>
        c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
      );
    }

    function miniCal(y: number, m: number): string {
      const dc = data[y].dayCount;
      const first = new Date(y, m - 1, 1);
      const lead = first.getDay();
      const dim = new Date(y, m, 0).getDate();
      let cells = WD.map((w) => `<div class="wd">${w}</div>`).join("");
      for (let i = 0; i < lead; i++) cells += `<div class="mc-d blank"></div>`;
      for (let d = 1; d <= dim; d++) {
        const key = `${y}-${pad(m)}-${pad(d)}`;
        const c = dc[key] || 0;
        cells += `<div class="mc-d ${lvl(c)} ${c > 0 ? "has" : ""}" title="${pad(m)}-${pad(
          d,
        )}${c > 0 ? " · " + c + " 篇" : ""}" ${c > 0 ? `data-day="${key}"` : ""}>${
          c > 0 ? c : ""
        }</div>`;
      }
      return `<div class="minical"><div class="cap">${y} · ${MONNUM(
        m,
      )}</div><div class="mc-grid">${cells}</div></div>`;
    }

    function renderTree() {
      let h = "";
      years.forEach((y) => {
        h += `<div class="yrow ${y === fYear ? "on" : ""}" data-gotoyear="${y}"><span>${y}</span><span class="n">${
          data[y].total
        } 篇</span></div>`;
        if (y === fYear) {
          h += `<div class="months">`;
          for (let m = 12; m >= 1; m--) {
            const cnt = data[y].monthCount[m] || 0;
            const on = m === fMonth;
            h += `<div class="mrow ${cnt === 0 ? "zero" : ""} ${on ? "on" : ""}" ${
              cnt > 0 ? `data-gotomonth="${y}-${m}"` : ""
            }><span>${MONNUM(m)}</span><span class="n">${cnt}</span></div>`;
            if (on && cnt > 0) h += miniCal(y, m);
          }
          h += `</div>`;
        }
      });
      tree!.innerHTML = h;
      const a =
        tree!.querySelector(".mrow.on") || tree!.querySelector(".yrow.on");
      if (a) (a as HTMLElement).scrollIntoView({ block: "nearest" });
    }

    function detectFocus() {
      const base = 20;
      const blocks = Array.from(
        content!.querySelectorAll<HTMLElement>(".yhead, .month-sec"),
      );
      if (!blocks.length) return;
      let pick = blocks[0];
      blocks.forEach((b) => {
        if (b.getBoundingClientRect().top <= base) pick = b;
      });
      const ny = +pick.dataset.year!;
      const nm = pick.dataset.month === "" ? null : +pick.dataset.month!;
      if (ny !== fYear || nm !== fMonth) {
        fYear = ny;
        fMonth = nm;
        renderTree();
      }
    }

    function jumpDate(key: string) {
      const el = content!.querySelector<HTMLElement>(`.arow[data-daykey="${key}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("flash");
        setTimeout(() => el.classList.remove("flash"), 1400);
      }
    }

    // 事件委托
    const onTreeClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-gotoyear],[data-gotomonth],[data-day]",
      );
      if (!t) return;
      if (t.dataset.gotoyear) {
        document
          .getElementById("yhead-" + t.dataset.gotoyear)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (t.dataset.gotomonth) {
        const [yy, mm] = t.dataset.gotomonth.split("-");
        document
          .getElementById(`m-${yy}-${pad(+mm)}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (t.dataset.day) {
        jumpDate(t.dataset.day);
      }
    };
    const onContentClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-day]");
      if (t?.dataset.day) jumpDate(t.dataset.day);
    };

    let raf: number | null = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        detectFocus();
      });
    };

    renderContent();
    renderTree();
    detectFocus();
    tree.addEventListener("click", onTreeClick);
    content.addEventListener("click", onContentClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", detectFocus);

    return () => {
      tree.removeEventListener("click", onTreeClick);
      content.removeEventListener("click", onContentClick);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", detectFocus);
    };
  }, [years, data]);

  return (
    <div className="archive-layout">
      <nav className="side">
        <div className="side-inner">
          <div className="lbl">时间线</div>
          <div ref={treeRef} />
        </div>
      </nav>
      <div ref={contentRef} />
    </div>
  );
}
