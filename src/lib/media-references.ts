import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureMediaSchema } from "@/lib/media-schema";
import { assetRelativePath } from "@/lib/media-storage";

export function extractMediaPaths(text: string): string[] {
  const paths = new Set<string>();
  const pattern = /\/uploads\/([A-Za-z0-9._/-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) paths.add(match[1]);
  return [...paths];
}

export function extractMediaAssetIds(text: string): string[] {
  const ids = new Set<string>();
  const pattern = /(?:^|[\s("'=])\/downloads\/([A-Za-z0-9_-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) ids.add(match[1]);
  return [...ids];
}

export async function syncPostMediaReferences(
  postId: string,
  content: string,
  coverImage?: string | null,
): Promise<void> {
  await ensureMediaSchema();
  const paths = new Set(extractMediaPaths(`${content}\n${coverImage || ""}`));
  const linkedIds = new Set(extractMediaAssetIds(content));
  const assets = await prisma.mediaAsset.findMany({ include: { storage: true } });
  const assetIds = assets
    .filter((asset) => linkedIds.has(asset.id) || paths.has(assetRelativePath(asset)))
    .map((asset) => asset.id);

  await prisma.$transaction([
    prisma.mediaReference.deleteMany({ where: { postId } }),
    ...assetIds.map((assetId) => prisma.mediaReference.create({ data: { assetId, postId } })),
  ]);
}

let backfillPromise: Promise<void> | null = null;

export function backfillMediaReferences(): Promise<void> {
  if (!backfillPromise) {
    backfillPromise = (async () => {
      await ensureMediaSchema();
      const posts = await prisma.post.findMany({ select: { id: true, content: true, coverImage: true } });
      const assets = await prisma.mediaAsset.findMany({ include: { storage: true } });
      const assetByPath = new Map(assets.map((asset) => [assetRelativePath(asset), asset.id]));
      const knownAssetIds = new Set(assets.map((asset) => asset.id));
      for (const post of posts) {
        const paths = extractMediaPaths(`${post.content}\n${post.coverImage || ""}`);
        const linkedIds = extractMediaAssetIds(post.content).filter((id) => knownAssetIds.has(id));
        const assetIds = [...new Set([
          ...paths.map((mediaPath) => assetByPath.get(mediaPath)).filter((id): id is string => Boolean(id)),
          ...linkedIds,
        ])];
        await prisma.$transaction([
          prisma.mediaReference.deleteMany({ where: { postId: post.id } }),
          ...assetIds.map((assetId) => prisma.mediaReference.create({ data: { assetId, postId: post.id } })),
        ]);
      }
    })().catch((error) => {
      backfillPromise = null;
      throw error;
    });
  }
  return backfillPromise;
}
