import { describe, expect, it } from "vitest";
import { extractMediaAssetIds, extractMediaPaths } from "./media-references";

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

describe("extractMediaAssetIds", () => {
  it("finds unique media ids in Markdown and HTML download links", () => {
    const content = `
[下载文档](/downloads/cma123)
<a href="/downloads/cmb_456">下载压缩包</a>
[重复](/downloads/cma123)
`;
    expect(extractMediaAssetIds(content)).toEqual(["cma123", "cmb_456"]);
  });

  it("does not treat a download path on another host as managed media", () => {
    expect(extractMediaAssetIds("[外部](https://example.com/downloads/not-ours)")).toEqual([]);
  });
});
