import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles/globals.css"), "utf8");

function ruleFor(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("article column layout", () => {
  it("keeps cols children equal-width and wraps oversized content inside each column", () => {
    expect(ruleFor(".body .cols")).toMatch(/display:\s*flex/);
    expect(ruleFor(".body .cols > *")).toMatch(/flex:\s*1\s+1\s+0/);
    expect(ruleFor(".body .cols > *")).toMatch(/min-width:\s*0/);
    expect(ruleFor(".body .cols > *")).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
