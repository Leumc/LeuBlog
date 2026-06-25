import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getSessionUser } from "@/lib/auth";
import { UPLOAD_DIR, allowedExt } from "@/lib/uploads";

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

  const ext = path.extname(file.name).toLowerCase();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, name), buf);

  return NextResponse.json({ ok: true, url: `/uploads/${name}` });
}
