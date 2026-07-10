import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { getSessionUser } from "@/lib/auth";
import { allowedExt, randomStorageName, resolveUploadDirectory, uploadUrl } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";
import { ensureMediaSchema } from "@/lib/media-schema";
import { ensureCategoryDirectory, joinMediaPath } from "@/lib/media-storage";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "未提供文件" }, { status: 400 });
  }
  if (!allowedExt(file.name)) {
    return NextResponse.json({ ok: false, error: "不支持的文件类型" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "文件过大（上限 8MB）" }, { status: 400 });
  }

  await ensureMediaSchema();

  const requestedCategoryId = String(form.get("categoryId") || "").trim() || null;
  const categoryId = requestedCategoryId
    ? (await prisma.mediaCategory.findUnique({ where: { id: requestedCategoryId }, select: { id: true } }))?.id
    : null;
  if (requestedCategoryId && !categoryId) {
    return NextResponse.json({ ok: false, error: "目标文件夹不存在" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  const name = `${randomStorageName(16)}${ext}`;
  const relativeDir = await ensureCategoryDirectory(categoryId ?? null);
  const targetDir = resolveUploadDirectory(relativeDir);
  if (!targetDir) return NextResponse.json({ ok: false, error: "目标路径无效" }, { status: 400 });
  await mkdir(targetDir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  const fullPath = path.join(targetDir, name);
  const relativePath = joinMediaPath(relativeDir, name);
  await writeFile(fullPath, buf);

  // 显示名与随机物理路径分离；移动文件时由媒体管理操作同步更新文章引用。
  try {
    const asset = await prisma.mediaAsset.create({
      data: {
        filename: name,
        displayName: file.name.slice(0, 160),
        categoryId: categoryId ?? null,
        storage: { create: { relativePath } },
      },
    });
    return NextResponse.json({
      ok: true,
      id: asset.id,
      displayName: asset.displayName,
      url: uploadUrl(relativePath),
    });
  } catch {
    await unlink(fullPath).catch(() => undefined);
    return NextResponse.json({ ok: false, error: "保存媒体信息失败" }, { status: 500 });
  }
}
