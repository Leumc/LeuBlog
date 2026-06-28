import { describe, expect, it, vi } from "vitest";
import {
  READING_MOTION_ARMING_CLASS,
  armInitialMotionState,
  scheduleAfterNextPaint,
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
