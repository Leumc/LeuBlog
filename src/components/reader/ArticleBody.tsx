"use client";

import { useEffect, useRef } from "react";
import {
  type ReadingMotion,
  READING_MOTION_EVENT,
  readReadingMotion,
} from "@/lib/reading-motion";

/** 文本块（逐字打字）；其余块（代码/图片/表格/分隔线）走淡入浮现。 */
const TEXT_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "UL", "OL", "BLOCKQUOTE"]);
const TYPE_SPEED_MS = 18;

/** 被打字接管的文本节点：换成一个逐字填充的 span，记下全文以便还原。 */
type TwRec = { on: HTMLElement; full: string };
type TwState = {
  el: HTMLElement;
  recs: TwRec[];
  caret: HTMLElement | null;
  timers: Set<number>;
};

function collectTextNodes(el: HTMLElement): Text[] {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  let n = walker.nextNode();
  while (n) {
    if ((n.nodeValue ?? "").length) out.push(n as Text);
    n = walker.nextNode();
  }
  return out;
}

/**
 * 渲染文章 HTML，注入代码块工具条，并按读者选择的阅读动效
 * （浮入 / 打字机 / 关闭）驱动正文各块的入场动画。
 */
export default function ArticleBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  // 代码块工具条（语言 + 复制按钮），1:1 匹配预览 .code .bar —— 与动效互不干扰
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // 宽表格在窄屏会把页面撑出横向滚动（整页缩放）；包一层可横向滚动的容器
    root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
      const parent = table.parentElement;
      if (!parent || parent.classList.contains("table-scroll")) return;
      const wrap = document.createElement("div");
      wrap.className = "table-scroll";
      parent.insertBefore(wrap, table);
      wrap.appendChild(table);
    });

    const figures = root.querySelectorAll<HTMLElement>(
      "figure[data-rehype-pretty-code-figure]",
    );
    const cleanups: (() => void)[] = [];

    figures.forEach((fig) => {
      if (fig.querySelector(".code-bar")) return;
      const pre = fig.querySelector("pre");
      if (!pre) return;
      const lang =
        pre.getAttribute("data-language") ||
        fig.querySelector("code")?.getAttribute("data-language") ||
        "code";

      const bar = document.createElement("div");
      bar.className = "code-bar";
      const langSpan = document.createElement("span");
      langSpan.className = "lang";
      langSpan.textContent = lang;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy";
      btn.textContent = "复制";
      bar.appendChild(langSpan);
      bar.appendChild(btn);

      const title = fig.querySelector("[data-rehype-pretty-code-title]");
      if (title) title.remove();
      fig.insertBefore(bar, pre);

      const onClick = async () => {
        try {
          await navigator.clipboard.writeText(pre.innerText);
          btn.textContent = "已复制";
          btn.classList.add("done");
          setTimeout(() => {
            btn.textContent = "复制";
            btn.classList.remove("done");
          }, 1500);
        } catch {
          btn.textContent = "失败";
        }
      };
      btn.addEventListener("click", onClick);
      cleanups.push(() => btn.removeEventListener("click", onClick));
    });

    return () => cleanups.forEach((c) => c());
  }, [html]);

  // 阅读动效：浮入 / 打字机 / 关闭，读者实时切换
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const blocks = Array.from(root.children) as HTMLElement[];

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let observer: IntersectionObserver | null = null;
    let rafId = 0;
    const startTimers = new Set<number>();
    const twStates = new Map<HTMLElement, TwState>();

    /** 把某块还原为完整可见态。 */
    const resetBlock = (el: HTMLElement) => {
      el.classList.remove("reveal", "reveal-in", "typing", "tw-pending");
      el.style.transitionDelay = "";
      el.style.minHeight = "";
      const st = twStates.get(el);
      if (st) {
        st.timers.forEach((t) => clearTimeout(t));
        st.caret?.remove();
        st.recs.forEach((r) => {
          const parent = r.on.parentNode;
          if (parent) parent.replaceChild(document.createTextNode(r.full), r.on);
        });
        twStates.delete(el);
      }
    };

    /** 拆掉当前模式的所有副作用，恢复全部块为可见。 */
    const teardown = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      startTimers.forEach((t) => clearTimeout(t));
      startTimers.clear();
      observer?.disconnect();
      observer = null;
      blocks.forEach(resetBlock);
    };

    /**
     * 启动某文本块逐字打字：先按当前完整高度锁定 min-height（整块预留空白，
     * 下文不被顶动），再清空文字逐字填回——行内代码等样式框随打字自然长出。
     */
    const typeBlock = (el: HTMLElement) => {
      const h = el.getBoundingClientRect().height; // tw-pending 隐藏态仍有布局高度
      el.style.minHeight = `${h}px`;
      el.classList.remove("tw-pending");
      el.classList.add("typing");

      const recs: TwRec[] = [];
      collectTextNodes(el).forEach((node) => {
        const parent = node.parentNode;
        if (!parent) return;
        const full = node.nodeValue ?? "";
        const on = document.createElement("span");
        on.className = "tw-on";
        parent.replaceChild(on, node);
        recs.push({ on, full });
      });

      const st: TwState = { el, recs, caret: null, timers: new Set<number>() };
      twStates.set(el, st);

      const caret = document.createElement("span");
      caret.className = "rm-caret";
      caret.setAttribute("aria-hidden", "true");
      caret.textContent = "|";
      st.caret = caret;

      let ri = 0;
      let ci = 0;
      const placeCaret = () => {
        if (ri < recs.length) {
          const on = recs[ri].on;
          on.parentNode?.insertBefore(caret, on.nextSibling);
        }
      };
      placeCaret();

      const step = () => {
        if (ri >= recs.length) {
          caret.remove();
          st.caret = null;
          el.classList.remove("typing");
          el.style.minHeight = ""; // 交还自然高度
          return;
        }
        const r = recs[ri];
        ci += 1;
        r.on.textContent = r.full.slice(0, ci);
        if (ci >= r.full.length) {
          ri += 1;
          ci = 0;
          placeCaret();
        }
        const t = window.setTimeout(step, TYPE_SPEED_MS);
        st.timers.add(t);
      };
      step();
    };

    const apply = (mode: ReadingMotion) => {
      teardown();
      const effective: ReadingMotion = reduced ? "off" : mode;
      if (effective === "off") return;

      const isTw = (el: HTMLElement) =>
        effective === "typewriter" && TEXT_TAGS.has(el.tagName);

      /** 触发一个块的入场；order 用于首屏自上而下的错峰。 */
      const trigger = (el: HTMLElement, order: number) => {
        if (isTw(el)) {
          const delay = Math.min(order * 160, 640);
          if (delay) {
            const t = window.setTimeout(() => {
              startTimers.delete(t);
              typeBlock(el);
            }, delay);
            startTimers.add(t);
          } else {
            typeBlock(el);
          }
        } else {
          if (order > 0) el.style.transitionDelay = `${Math.min(order * 70, 420)}ms`;
          el.classList.add("reveal-in");
        }
      };

      // 先打上初始隐藏态（浮入：opacity0 下移；打字：隐藏占位保留高度）
      blocks.forEach((el) => el.classList.add(isTw(el) ? "tw-pending" : "reveal"));

      const vh = window.innerHeight || document.documentElement.clientHeight;
      const hasIO = typeof IntersectionObserver !== "undefined";
      const inView: HTMLElement[] = [];
      blocks.forEach((el) => {
        // 视口内（含上方已滚过）的块首屏入场；其余（有 IO 时）滚动到再触发
        if (!hasIO || el.getBoundingClientRect().top < vh) inView.push(el);
        else {
          if (!observer) {
            observer = new IntersectionObserver(
              (entries, obs) => {
                for (const e of entries) {
                  if (!e.isIntersecting) continue;
                  const t = e.target as HTMLElement;
                  obs.unobserve(t);
                  trigger(t, 0); // 滚动进入的块逐个触发，不错峰
                }
              },
              { threshold: 0.08 },
            );
          }
          observer.observe(el);
        }
      });

      // 关键：把入场推迟到下一帧。隐藏态需先被绘制一帧，过渡才会真正播放，
      // 否则隐藏态与可见态在同一帧内确定，浏览器直接以可见态绘制（“直接摆着”）。
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        inView.forEach((el, i) => trigger(el, i));
      });
    };

    apply(readReadingMotion());

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ReadingMotion>).detail;
      if (detail) apply(detail);
    };
    window.addEventListener(READING_MOTION_EVENT, onChange);

    return () => {
      window.removeEventListener(READING_MOTION_EVENT, onChange);
      teardown();
    };
  }, [html]);

  return <div ref={ref} className="body" dangerouslySetInnerHTML={{ __html: html }} />;
}
