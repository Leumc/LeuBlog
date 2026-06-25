"use client";

import { useEffect, useRef } from "react";

/** 渲染文章 HTML，并为每个代码块注入顶部工具条（语言 + 复制按钮），1:1 匹配预览 .code .bar */
export default function ArticleBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

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

      // 若已有 title，移除（用统一的 bar 替代）
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

  return <div ref={ref} className="body" dangerouslySetInnerHTML={{ __html: html }} />;
}
