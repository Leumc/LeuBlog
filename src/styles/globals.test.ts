import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles/globals.css"), "utf8");
const tagDetailPage = readFileSync(
  join(process.cwd(), "src/app/(public)/tags/[slug]/page.tsx"),
  "utf8",
);

function ruleFor(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

function ruleIndex(selector: string) {
  return css.indexOf(`${selector} {`);
}

describe("article column layout", () => {
  it("keeps cols children equal-width and wraps oversized content inside each column", () => {
    expect(ruleFor(".body .cols")).toMatch(/display:\s*flex/);
    expect(ruleFor(".body .cols > *")).toMatch(/flex:\s*1\s+1\s+0/);
    expect(ruleFor(".body .cols > *")).toMatch(/min-width:\s*0/);
    expect(ruleFor(".body .cols > *")).toMatch(/overflow-wrap:\s*anywhere/);
  });
});

describe("tag detail mobile spacing", () => {
  it("uses a page class for vertical spacing so wrap keeps its horizontal padding", () => {
    expect(tagDetailPage).toContain('className="wrap tag-detail-list"');
    expect(tagDetailPage).not.toContain('padding: "30px 0 50px"');
    expect(ruleFor(".tag-detail-list")).toMatch(/padding-block:\s*30px\s+50px/);
    expect(ruleFor(".tag-detail-list")).not.toMatch(/padding:/);
  });
});

describe("article table of contents active item", () => {
  it("does not change font weight when a heading becomes active", () => {
    expect(ruleFor(".toc a.on")).not.toMatch(/font-weight/);
  });
});

describe("article body links", () => {
  it("marks clickable text with a dashed underline", () => {
    expect(ruleFor(".body a")).toMatch(/text-decoration-line:\s*underline/);
    expect(ruleFor(".body a")).toMatch(/text-decoration-style:\s*dashed/);
  });

  it("keeps dashed underline visible inside the admin preview pane", () => {
    const previewLinkRule = ruleFor(".admin .ed-pv .body a");

    expect(previewLinkRule).toMatch(/text-decoration-line:\s*underline/);
    expect(previewLinkRule).toMatch(/text-decoration-style:\s*dashed/);
    expect(ruleIndex(".admin .ed-pv .body a")).toBeGreaterThan(ruleIndex(".admin a"));
  });
});

describe("media library grid", () => {
  it("fills available width instead of capping the library at three columns", () => {
    expect(ruleFor(".admin .media")).toMatch(/repeat\(auto-fill,\s*minmax\(/);
    expect(ruleFor(".admin .media")).not.toMatch(/repeat\(3,/);
  });

  it("uses the same column sizing for folders and images", () => {
    const folders = ruleFor(".admin .media-folder-grid").match(/grid-template-columns:\s*([^;]+)/)?.[1];
    const images = ruleFor(".admin .media").match(/grid-template-columns:\s*([^;]+)/)?.[1];
    expect(folders).toBe(images);
  });
});
