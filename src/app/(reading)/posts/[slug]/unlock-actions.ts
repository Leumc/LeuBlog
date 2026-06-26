"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { decryptSecret, secretsMatch, keyUsable } from "@/lib/access-keys";
import { grantUnlocks } from "@/lib/unlock-cookie";

export type UnlockState = { error?: string };

const FAIL = "密钥错误或已失效";

function safeMatch(enc: string, entered: string): boolean {
  try {
    return secretsMatch(decryptSecret(enc), entered);
  } catch {
    return false;
  }
}

export async function unlockPostAction(
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const slug = String(formData.get("slug") || "");
  const entered = String(formData.get("key") || "").trim();
  if (!slug || !entered) return { error: "请输入密钥" };

  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED", locked: true },
    select: { id: true },
  });
  if (!post) return { error: FAIL };

  // 覆盖本文且启用的候选密钥
  const candidates = await prisma.accessKey.findMany({
    where: { active: true, posts: { some: { id: post.id } } },
    include: { posts: { where: { status: "PUBLISHED" }, select: { id: true } } },
  });

  const now = new Date();
  const match = candidates.find(
    (k) => keyUsable(k, now) && safeMatch(k.secretEnc, entered),
  );
  if (!match) return { error: FAIL };

  // 条件式原子自增，防并发超出 maxUses
  const upd = await prisma.accessKey.updateMany({
    where:
      match.maxUses === null
        ? { id: match.id }
        : { id: match.id, usedCount: { lt: match.maxUses } },
    data: { usedCount: { increment: 1 } },
  });
  if (upd.count === 0) return { error: FAIL };

  // 一次兑换解锁该密钥覆盖的全部已发布文章
  await grantUnlocks(match.posts.map((p) => p.id), match.id);

  redirect(`/posts/${slug}`); // 抛出 NEXT_REDIRECT，结束 action
}
