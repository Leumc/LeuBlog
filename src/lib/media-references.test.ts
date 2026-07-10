import { describe, expect, it } from "vitest";
import { extractMediaPaths } from "./media-references";

describe("extractMediaPaths", () => {
  it("finds unique media paths in Markdown and raw HTML", () => {
    const content = `
![示例](/uploads/aa/bb/image.png)
<img src="/uploads/cc/other.webp" alt="x">
![重复](/uploads/aa/bb/image.png)
`;
    expect(extractMediaPaths(content)).toEqual([
      "aa/bb/image.png",
      "cc/other.webp",
    ]);
  });

  it("does not treat unrelated URLs as managed media", () => {
    expect(extractMediaPaths("![remote](https://example.com/a.png)")).toEqual([]);
  });
});
