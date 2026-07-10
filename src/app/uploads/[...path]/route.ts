import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UPLOAD_DIR, contentTypeFor, resolveUploadPath } from "@/lib/uploads";

export const dynamic = "force-dynamic";

async function mediaResponse(
  params: Promise<{ path: string[] }>,
  head = false,
): Promise<Response> {
  const segments = (await params).path;
  let relativePath: string;
  try {
    relativePath = segments.map((segment) => decodeURIComponent(segment)).join("/");
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const candidate = resolveUploadPath(relativePath);
  if (!candidate) return new NextResponse(null, { status: 404 });

  try {
    const [root, actual] = await Promise.all([realpath(UPLOAD_DIR), realpath(candidate)]);
    if (actual !== root && !actual.startsWith(root + path.sep)) {
      return new NextResponse(null, { status: 404 });
    }
    const info = await stat(actual);
    if (!info.isFile()) return new NextResponse(null, { status: 404 });
    const headers = {
      "Content-Type": contentTypeFor(relativePath),
      "Content-Length": String(info.size),
      "Cache-Control": "public, max-age=2592000, immutable",
      "X-Content-Type-Options": "nosniff",
    };
    return new Response(head ? null : await readFile(actual), { headers });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return mediaResponse(params);
}

export async function HEAD(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return mediaResponse(params, true);
}
