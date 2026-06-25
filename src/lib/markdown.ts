import "server-only";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import GithubSlugger from "github-slugger";

export type TocItem = { id: string; text: string; level: 2 | 3 };

/** 自定义 Shiki 主题，颜色对齐设计稿（--kw/--ty/--str/--com/--num/--fn） */
const LEU_CODE_THEME = {
  name: "leu-dark",
  type: "dark" as const,
  colors: {
    "editor.background": "#272320",
    "editor.foreground": "#e9e2d4",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: "#8f8674", fontStyle: "italic" },
    },
    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator.new",
        "storage.type",
        "storage.modifier",
        "variable.language",
        "keyword.other",
      ],
      settings: { foreground: "#ec8c7c" },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
        "storage.type.primitive",
      ],
      settings: { foreground: "#6fd0c4" },
    },
    {
      scope: ["string", "string.quoted", "constant.character", "constant.other.symbol"],
      settings: { foreground: "#b6d77a" },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.language.boolean"],
      settings: { foreground: "#e0a45a" },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call",
        "meta.function-call.generic",
      ],
      settings: { foreground: "#b9a6f0" },
    },
  ],
};

/** 把 Markdown 渲染为 HTML 字符串（服务端）：GFM + LaTeX + 语法高亮 */
export async function renderMarkdown(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeKatex)
    .use(rehypePrettyCode, {
      theme: LEU_CODE_THEME as unknown as PrettyCodeOptions["theme"],
      keepBackground: false, // 背景由自定义 CSS 控制（#272320）
    })
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

/** 提取 h2/h3 目录，slug 规则与 rehype-slug 一致（github-slugger） */
export function extractToc(md: string): TocItem[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md);
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];

  type Node = { type: string; depth?: number; children?: Node[]; value?: string };
  const text = (n: Node): string => {
    if (n.value) return n.value;
    if (n.children) return n.children.map(text).join("");
    return "";
  };

  const walk = (n: Node) => {
    if (n.type === "heading" && (n.depth === 2 || n.depth === 3)) {
      const t = text(n).trim();
      if (t) items.push({ id: slugger.slug(t), text: t, level: n.depth as 2 | 3 });
    }
    n.children?.forEach(walk);
  };
  walk(tree as unknown as Node);
  return items;
}

/** 从 Markdown 生成纯文本摘要 */
export function makeExcerpt(md: string, max = 140): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`$]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? plain.slice(0, max) + "…" : plain;
}
