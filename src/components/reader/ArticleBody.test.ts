import { describe, expect, it, vi } from "vitest";
import {
  READING_MOTION_ARMING_CLASS,
  armInitialMotionState,
  getMotionBlocks,
  scheduleAfterNextPaint,
  shouldUseTypewriterBlock,
} from "./ArticleBody";

describe("scheduleAfterNextPaint", () => {
  it("runs callbacks after one paint has had a chance to commit", () => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.fn((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    const cb = vi.fn();

    const id = scheduleAfterNextPaint(raf, cb);

    expect(id).toBe(1);
    expect(cb).not.toHaveBeenCalled();

    frames.shift()?.(16);
    expect(cb).not.toHaveBeenCalled();

    frames.shift()?.(32);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("armInitialMotionState", () => {
  it("disables transitions while arming reveal blocks into their hidden state", () => {
    const events: string[] = [];
    const root = {
      classList: {
        add: (name: string) => events.push(`root:add:${name}`),
      },
      get offsetHeight() {
        events.push("root:measure");
        return 100;
      },
    };
    const block = {
      tagName: "P",
      classList: {
        add: (name: string) => events.push(`block:add:${name}`),
      },
    };

    armInitialMotionState(
      root as unknown as Pick<HTMLElement, "classList" | "offsetHeight">,
      [block as unknown as HTMLElement],
      () => false,
    );

    expect(events).toEqual([
      `root:add:${READING_MOTION_ARMING_CLASS}`,
      "block:add:reveal",
      "root:measure",
    ]);
  });
});

describe("shouldUseTypewriterBlock", () => {
  it("keeps list containers out of typewriter mode so list items are not grouped as one block", () => {
    expect(shouldUseTypewriterBlock("P")).toBe(true);
    expect(shouldUseTypewriterBlock("H2")).toBe(true);
    expect(shouldUseTypewriterBlock("LI")).toBe(true);
    expect(shouldUseTypewriterBlock("UL")).toBe(false);
    expect(shouldUseTypewriterBlock("OL")).toBe(false);
  });
});

describe("getMotionBlocks", () => {
  it("splits direct list items into independent typewriter blocks", () => {
    const paragraph = { tagName: "P" };
    const firstItem = { tagName: "LI" };
    const secondItem = { tagName: "LI" };
    const list = {
      tagName: "OL",
      children: [firstItem, secondItem],
    };

    expect(
      getMotionBlocks([paragraph, list] as unknown as HTMLElement[], "typewriter"),
    ).toEqual([paragraph, firstItem, secondItem]);
    expect(getMotionBlocks([paragraph, list] as unknown as HTMLElement[], "reveal")).toEqual([
      paragraph,
      list,
    ]);
  });
});
