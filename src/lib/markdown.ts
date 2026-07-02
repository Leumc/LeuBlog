import "server-only";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import GithubSlugger from "github-slugger";

export type TocItem = { id: string; text: string; level: number };

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

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: { className?: unknown; href?: unknown; target?: unknown; rel?: unknown };
  children?: HastNode[];
};

/**
 * 把 <details> 里 summary 之外的所有内容裹进一个 <div class="details-body">。
 * 这样折叠框的内边距施加在「单一容器」上——代码块背景、列表圆点等带自身
 * 盒子/标记的元素也会随之内缩，而不是各自贴到折叠框边界。
 */
function rehypeWrapDetailsBody() {
  const isSummary = (c: HastNode) => c.type === "element" && c.tagName === "summary";
  const walk = (node: HastNode) => {
    if (node.type === "element" && node.tagName === "details" && node.children) {
      const summaries = node.children.filter(isSummary);
      const rest = node.children.filter((c) => !isSummary(c));
      const hasContent = rest.some(
        (c) => c.type === "element" || (c.type === "text" && (c.value ?? "").trim() !== ""),
      );
      const already =
        rest.length === 1 &&
        rest[0].type === "element" &&
        rest[0].tagName === "div" &&
        Array.isArray(rest[0].properties?.className) &&
        (rest[0].properties!.className as string[]).includes("details-body");
      if (hasContent && !already) {
        node.children = [
          ...summaries,
          { type: "element", tagName: "div", properties: { className: ["details-body"] }, children: rest },
        ];
      }
    }
    node.children?.forEach(walk);
  };
  return (tree: HastNode) => walk(tree);
}

/** 给外链 <a>(http/https 绝对链接)加 target=_blank + rel=noopener noreferrer。
 *  站内一律相对路径，不判 host；相对链接/锚点/mailto/tel 不动。 */
function rehypeExternalLinks() {
  const walk = (node: HastNode) => {
    if (node.type === "element" && node.tagName === "a" && node.properties) {
      const href = node.properties.href;
      if (typeof href === "string" && /^https?:\/\//i.test(href)) {
        node.properties.target = "_blank";
        node.properties.rel = "noopener noreferrer";
      }
    }
    node.children?.forEach(walk);
  };
  return (tree: HastNode) => walk(tree);
}

/** 核心管线：Markdown → HTML（GFM + LaTeX + 语法高亮 + 原始 HTML）。 */
async function runPipeline(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeKatex)
    .use(rehypePrettyCode, {
      theme: LEU_CODE_THEME as unknown as PrettyCodeOptions["theme"],
      keepBackground: false, // 背景由自定义 CSS 控制（#272320）
    })
    .use(rehypeWrapDetailsBody)
    .use(rehypeExternalLinks)
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

/** 去掉公共行首缩进——HTML 里缩进的 <markdown> 内容不会被当成代码块。 */
function dedent(s: string): string {
  const lines = s.replace(/^\n+/, "").replace(/\s+$/, "").split("\n");
  const indents = lines
    .filter((l) => l.trim())
    .map((l) => l.match(/^[ \t]*/)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join("\n");
}

/**
 * 非标准 <markdown>…</markdown> 标签：把其中内容强制按 Markdown 渲染后内联回去。
 * 用于在 HTML 标签内部（如 <div class="cols">、<details>）写紧贴标签、未被空行
 * 分隔的 Markdown——CommonMark 原本会把这些内容当作原始 HTML 不予解析。
 * 用否定先行断言匹配「不含嵌套 markdown 标签」的最内层，循环替换以支持嵌套。
 */
async function expandMarkdownTags(src: string): Promise<string> {
  const re = /<markdown>((?:(?!<\/?markdown>)[\s\S])*?)<\/markdown>/i;
  let out = src;
  let m: RegExpExecArray | null;
  while ((m = re.exec(out)) !== null) {
    const rendered = await runPipeline(dedent(m[1]));
    out = out.slice(0, m.index) + rendered + out.slice(m.index + m[0].length);
  }
  return out;
}

/** 把 Markdown 渲染为 HTML 字符串（服务端）：GFM + LaTeX + 语法高亮 + <markdown> 标签 */
export async function renderMarkdown(md: string): Promise<string> {
  const expanded = await expandMarkdownTags(md);
  return runPipeline(expanded);
}

/** 提取 h1–h4 目录，slug 规则与 rehype-slug 一致（github-slugger）。
 *  level 保留原始标题层级(1–4)；若文章最高层级 >1（如从 ## 开始），
 *  调用方可据此归一化缩进。
 *
 *  必须在「与 renderMarkdown 相同的展开后文本」上解析：否则当 <markdown>
 *  内含带空行的 ``` 代码块时，remark-parse 会把 <details> HTML 块在首个
 *  空行处截断，收尾的 ``` 随即把 </markdown>、</details> 及其后所有标题
 *  吞进一个 code 节点，导致这些标题在 MDAST 里根本不作为 heading 存在，
 *  自然也就不进目录。先展开 <markdown> 即可让两路解析对齐。
 *
 *  slug 计数也只对正文标题推进：<markdown> 内的标题在展开时已由各自独立的
 *  rehype-slug 生成 id（外层 rehype-slug 见其已有 id 便跳过、不去重），故
 *  正文标题的锚点与 <markdown> 内标题互不干扰——此处 slugger 同样不应把
 *  内部标题计入，才能与渲染产物一致。 */
export async function extractToc(md: string): Promise<TocItem[]> {
  const expanded = await expandMarkdownTags(md);
  const tree = unified().use(remarkParse).use(remarkGfm).parse(expanded);
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];

  type Node = {
    type: string;
    depth?: number;
    children?: Node[];
    value?: string;
  };
  const text = (n: Node): string => {
    if (n.value) return n.value;
    if (n.children) return n.children.map(text).join("");
    return "";
  };

  const walk = (n: Node) => {
    if (n.type === "heading" && n.depth && n.depth >= 1 && n.depth <= 4) {
      const t = text(n).trim();
      if (t) {
        const id = slugger.slug(t);
        items.push({ id, text: t, level: n.depth });
      }
    }
    // <markdown> 展开后其内部标题已是 raw HTML（<hN id="…">），落在 html 节点
    // 里——既不会作为 heading 节点进目录，也不推进 slugger 计数（见上）。
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
