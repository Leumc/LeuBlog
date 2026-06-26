import { describe, it, expect } from "vitest";
import { filterActive, mergeGrants, type UnlockMap } from "./unlock-cookie";

describe("filterActive", () => {
  it("过滤掉已过期项", () => {
    const map: UnlockMap = {
      a: { e: 100, k: "k1" },
      b: { e: 300, k: "k1" },
    };
    expect(filterActive(map, 200)).toEqual({ b: { e: 300, k: "k1" } });
  });
  it("到期时间等于 now 视为过期", () => {
    expect(filterActive({ a: { e: 200, k: "k1" } }, 200)).toEqual({});
  });
});

describe("mergeGrants", () => {
  it("新增并覆盖已有项的到期与 keyId", () => {
    const existing: UnlockMap = { a: { e: 100, k: "old" } };
    const out = mergeGrants(existing, ["a", "b"], "new", 999);
    expect(out).toEqual({
      a: { e: 999, k: "new" },
      b: { e: 999, k: "new" },
    });
  });
  it("不修改入参对象", () => {
    const existing: UnlockMap = { a: { e: 100, k: "old" } };
    mergeGrants(existing, ["b"], "new", 999);
    expect(existing).toEqual({ a: { e: 100, k: "old" } });
  });
});
