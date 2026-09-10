import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureMediaSchema } from "@/lib/media-schema";
import { assetRelativePath } from "@/lib/media-storage";
import {
  UPLOAD_DIR,
  contentTypeFor,
  downloadContentDisposition,
  resolveUploadPath,
} from "@/lib/uploads";

export const dynamic = "force-dynamic";

async function downloadResponse(
  params: Promise<{ id: string }>,
  head = false,
): Promise<Response> {
  await ensureMediaSchema();
  const { id } = await params;
  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    include: { storage: true },
  });
  if (!asset) return new NextResponse(null, { status: 404 });

  const relativePath = assetRelativePath(asset);
  const candidate = resolveUploadPath(relativePath);
  if (!candidate) return new NextResponse(null, { status: 404 });

  try {
    const [root, actual] = await Promise.all([realpath(UPLOAD_DIR), realpath(candidate)]);
    if (actual !== root && !actual.startsWith(root + path.sep)) {
      return new NextResponse(null, { status: 404 });
    }
    const info = await stat(actual);
    if (!info.isFile()) return new NextResponse(null, { status: 404 });

    const displayName = asset.displayName || asset.filename;
    const headers = {
      "Content-Type": contentTypeFor(relativePath),
      "Content-Length": String(info.size),
      "Content-Disposition": downloadContentDisposition(displayName),
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    };
    return new Response(head ? null : await readFile(actual), { headers });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return downloadResponse(params);
}

export async function HEAD(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return downloadResponse(params, true);
}
