import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { renderMarkdown } from "@/lib/markdown";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { markdown } = await req.json();
    const html = await renderMarkdown(String(markdown || ""));
    return NextResponse.json({ ok: true, html });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
