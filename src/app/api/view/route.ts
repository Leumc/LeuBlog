import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordView } from "@/lib/views";

export async function POST(req: Request) {
  try {
    const { slug } = await req.json();
    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const post = await prisma.post.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!post) return NextResponse.json({ ok: false }, { status: 404 });
    await recordView(post.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
