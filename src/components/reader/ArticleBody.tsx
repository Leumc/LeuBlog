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

type TextNodeRec = { node: Text; full: string };
type TwState = {
  el: HTMLElement;
  nodes: TextNodeRec[];
  caret: HTMLElement | null;
  timers: Set<number>;
  started: boolean;
  done: boolean;
};

function collectTextNodes(el: HTMLElement): TextNodeRec[] {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out: TextNodeRec[] = [];
  let n = walker.nextNode();
  while (n) {
    const full = n.nodeValue ?? "";
    if (full.length) out.push({ node: n as Text, full });
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
    const body = root; // root 自身即 .body
    const blocks = Array.from(body.children) as HTMLElement[];

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let observer: IntersectionObserver | null = null;
    const twStates = new Map<HTMLElement, TwState>();

    /** 把某块还原为完整可见态（清类、清打字定时器、补回文本、移除 caret）。 */
    const resetBlock = (el: HTMLElement) => {
      el.classList.remove("reveal", "reveal-in", "typing", "tw-pending");
      const st = twStates.get(el);
      if (st) {
        st.timers.forEach((t) => clearTimeout(t));
        st.timers.clear();
        st.nodes.forEach((r) => (r.node.nodeValue = r.full));
        if (st.caret) {
          st.caret.remove();
          st.caret = null;
        }
        twStates.delete(el);
      }
    };

    /** 拆掉当前模式的所有副作用，恢复全部块为可见。 */
    const teardown = () => {
      observer?.disconnect();
      observer = null;
      blocks.forEach(resetBlock);
    };

    /** 启动某文本块的逐字打字。 */
    const typeBlock = (el: HTMLElement) => {
      const nodes = collectTextNodes(el);
      const st: TwState = {
        el,
        nodes,
        caret: null,
        timers: new Set<number>(),
        started: true,
        done: false,
      };
      twStates.set(el, st);
      el.classList.remove("tw-pending");
      el.classList.add("typing");
      nodes.forEach((r) => (r.node.nodeValue = ""));

      const caret = document.createElement("span");
      caret.className = "rm-caret";
      caret.setAttribute("aria-hidden", "true");
      caret.textContent = "|";
      st.caret = caret;

      const placeCaret = (after: Text) => {
        const parent = after.parentNode;
        if (!parent) return;
        if (after.nextSibling) parent.insertBefore(caret, after.nextSibling);
        else parent.appendChild(caret);
      };

      let ni = 0;
      let ci = 0;
      if (nodes.length) placeCaret(nodes[0].node);

      const step = () => {
        if (ni >= nodes.length) {
          caret.remove();
          st.caret = null;
          el.classList.remove("typing");
          st.done = true;
          return;
        }
        const cur = nodes[ni];
        ci += 1;
        cur.node.nodeValue = cur.full.slice(0, ci);
        if (ci >= cur.full.length) {
          ni += 1;
          ci = 0;
          if (ni < nodes.length) placeCaret(nodes[ni].node);
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

      observer = new IntersectionObserver(
        (entries, obs) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const el = e.target as HTMLElement;
            obs.unobserve(el);
            if (effective === "typewriter" && TEXT_TAGS.has(el.tagName)) {
              typeBlock(el);
            } else {
              el.classList.add("reveal-in");
            }
          }
        },
        { threshold: 0.1, rootMargin: "0px 0px -10% 0px" },
      );

      blocks.forEach((el) => {
        if (effective === "typewriter" && TEXT_TAGS.has(el.tagName)) {
          // 文本块：预隐藏（保留布局高度，避免进视口前闪现全文）
          el.classList.add("tw-pending");
        } else {
          el.classList.add("reveal");
        }
        observer!.observe(el);
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
