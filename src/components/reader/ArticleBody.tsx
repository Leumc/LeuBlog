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

/** 一个被拆为「已打出 / 待打出」两段的文本节点，待打出段透明占位以锁定布局。 */
type TwPart = { on: HTMLElement; off: HTMLElement; full: string };
type TwState = {
  parts: TwPart[];
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
      const st = twStates.get(el);
      if (st) {
        st.timers.forEach((t) => clearTimeout(t));
        st.caret?.remove();
        // 把拆开的 on/off 两段合回单个原始文本节点
        st.parts.forEach((p) => {
          const parent = p.off.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(p.full), p.off);
            p.on.remove();
          }
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

    /** 启动某文本块逐字打字：全文透明占位，逐字从透明转可见，布局不抖。 */
    const typeBlock = (el: HTMLElement) => {
      const parts: TwPart[] = [];
      collectTextNodes(el).forEach((node) => {
        const parent = node.parentNode;
        if (!parent) return;
        const full = node.nodeValue ?? "";
        const on = document.createElement("span");
        on.className = "tw-on";
        const off = document.createElement("span");
        off.className = "tw-off";
        off.textContent = full;
        parent.replaceChild(off, node);
        parent.insertBefore(on, off);
        parts.push({ on, off, full });
      });

      const st: TwState = { parts, caret: null, timers: new Set<number>() };
      twStates.set(el, st);
      el.classList.remove("tw-pending");
      el.classList.add("typing");

      const caret = document.createElement("span");
      caret.className = "rm-caret";
      caret.setAttribute("aria-hidden", "true");
      caret.textContent = "|";
      st.caret = caret;

      let pi = 0;
      let ci = 0;
      const placeCaret = () => {
        if (pi < parts.length) parts[pi].off.parentNode?.insertBefore(caret, parts[pi].off);
      };
      placeCaret();

      const step = () => {
        if (pi >= parts.length) {
          caret.remove();
          st.caret = null;
          el.classList.remove("typing");
          return;
        }
        const p = parts[pi];
        ci += 1;
        p.on.textContent = p.full.slice(0, ci);
        p.off.textContent = p.full.slice(ci);
        if (ci >= p.full.length) {
          pi += 1;
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
      if (typeof IntersectionObserver === "undefined") return;

      const isTw = (el: HTMLElement) =>
        effective === "typewriter" && TEXT_TAGS.has(el.tagName);

      // 先打上初始隐藏态（浮入：opacity0 下移；打字：透明占位保留布局）
      blocks.forEach((el) => el.classList.add(isTw(el) ? "tw-pending" : "reveal"));

      // 等隐藏态先绘制一帧，否则进视口的块会瞬间到位、不播放过渡
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          observer = new IntersectionObserver(
            (entries, obs) => {
              const hits = entries
                .filter((e) => e.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
              hits.forEach((e, i) => {
                const el = e.target as HTMLElement;
                obs.unobserve(el);
                if (isTw(el)) {
                  const delay = Math.min(i * 160, 640); // 首屏自上而下错峰开打
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
                  if (hits.length > 1) {
                    el.style.transitionDelay = `${Math.min(i * 70, 420)}ms`;
                  }
                  el.classList.add("reveal-in");
                }
              });
            },
            { threshold: 0.08 },
          );
          blocks.forEach((el) => observer!.observe(el));
        });
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
