import { describe, it, expect } from "vitest";
import { renderMarkdown, extractToc } from "./markdown";

describe("renderMarkdown HTML 支持", () => {
  it("保留 details/summary 折叠框标签", async () => {
    const html = await renderMarkdown(
      "<details>\n<summary>标题</summary>\n\n正文\n\n</details>",
    );
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>标题</summary>");
  });

  it("保留 div.callout 提示框，且内部 Markdown 被解析", async () => {
    const html = await renderMarkdown(
      '<div class="callout info">\n\n**重点**内容\n\n</div>',
    );
    expect(html).toContain('class="callout info"');
    expect(html).toContain("<strong>重点</strong>");
  });

  it("普通 Markdown 仍正常渲染", async () => {
    const html = await renderMarkdown("# 标题\n\n段落");
    expect(html).toContain("<h1");
    expect(html).toContain("段落");
  });
});

describe("<markdown> 标签：强制把内容当 Markdown 渲染", () => {
  it("行内：紧贴 HTML 标签内部的 Markdown 也会被解析", async () => {
    const html = await renderMarkdown(
      '<div class="cols">\n<div><markdown>左栏 **加粗** 文本</markdown></div>\n<div>右栏</div>\n</div>',
    );
    expect(html).toContain('class="cols"');
    expect(html).toContain("<strong>加粗</strong>");
  });

  it("块级：列表等块级 Markdown 在标签内被解析", async () => {
    const html = await renderMarkdown(
      "<markdown>\n- 甲\n- 乙\n</markdown>",
    );
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>甲</li>");
  });

  it("不会在输出里残留 <markdown> 标签本身", async () => {
    const html = await renderMarkdown("<markdown>**x**</markdown>");
    expect(html).not.toContain("<markdown>");
    expect(html).not.toContain("</markdown>");
    expect(html).toContain("<strong>x</strong>");
  });
});

describe("折叠框正文包裹", () => {
  it("summary 之外的内容被裹进 .details-body", async () => {
    const html = await renderMarkdown(
      "<details>\n<summary>标题</summary>\n<markdown>\n\n- 甲\n- 乙\n\n</markdown>\n</details>",
    );
    expect(html).toContain('class="details-body"');
    // summary 仍是 details 的直接子节点，列表被包进 details-body
    expect(html).toMatch(/<summary>标题<\/summary>\s*<div class="details-body">/);
    expect(html).toContain("<li>甲</li>");
  });

  it("只有 summary、无正文时不注入包裹", async () => {
    const html = await renderMarkdown("<details>\n<summary>仅标题</summary>\n</details>");
    expect(html).not.toContain("details-body");
  });
});

describe("extractToc：<markdown> 内的标题不进目录", () => {
  it("排除 <markdown> 里的标题，保留正文标题且锚点不错位", async () => {
    const md = [
      "# 正文一",
      "",
      "<details>",
      "<summary>折叠</summary>",
      "<markdown>",
      "",
      "## 折叠里的标题",
      "",
      "</markdown>",
      "</details>",
      "",
      "## 正文二",
    ].join("\n");
    const toc = extractToc(md);
    const texts = toc.map((t) => t.text);
    expect(texts).toEqual(["正文一", "正文二"]);
    // 正文二 的锚点 id 应与渲染产物里的 id 一致
    const html = await renderMarkdown(md);
    const tail = toc.find((t) => t.text === "正文二")!;
    expect(html).toContain(`id="${tail.id}"`);
  });
});
