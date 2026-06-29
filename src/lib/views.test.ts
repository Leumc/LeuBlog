import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  post: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  dailyView: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
  },
}));

describe("recordView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.post.findUniqueOrThrow.mockResolvedValue({
      updatedAt: new Date("2026-06-01T08:00:00.000Z"),
    });
    tx.post.update.mockResolvedValue({});
    tx.dailyView.upsert.mockResolvedValue({});
    tx.dailyView.updateMany.mockResolvedValue({ count: 1 });
    tx.dailyView.create.mockResolvedValue({});
  });

  it("increments views without changing the post modification timestamp", async () => {
    const { recordView } = await import("./views");

    await recordView("post-1");

    expect(tx.post.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "post-1" },
      select: { updatedAt: true },
    });
    expect(tx.post.update).toHaveBeenCalledWith({
      where: { id: "post-1" },
      data: {
        viewCount: { increment: 1 },
        updatedAt: new Date("2026-06-01T08:00:00.000Z"),
      },
    });
  });
});
