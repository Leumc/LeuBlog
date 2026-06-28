import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

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
