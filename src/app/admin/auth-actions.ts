"use server";

import { redirect } from "next/navigation";
import { authenticate, createSession, destroySession } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") || "");
  const password = String(formData.get("password") || "");
  const remember = formData.get("remember") === "on";
  const from = String(formData.get("from") || "/admin");

  if (!identifier || !password) {
    return { error: "请输入用户名/邮箱与密码" };
  }
  const user = await authenticate(identifier, password);
  if (!user) {
    return { error: "用户名或密码错误，或账号已被禁用" };
  }
  await createSession(user, remember);
  redirect(from.startsWith("/admin") ? from : "/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
