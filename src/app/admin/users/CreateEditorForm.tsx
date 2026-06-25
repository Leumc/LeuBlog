"use client";

import { useActionState } from "react";
import { createEditor, type UserActionState } from "./actions";

export default function CreateEditorForm() {
  const [state, action, pending] = useActionState<UserActionState, FormData>(
    createEditor,
    {},
  );
  return (
    <form
      action={action}
      className="mb-6 grid grid-cols-1 gap-3 bg-white p-5 text-sm shadow-sm sm:grid-cols-2"
    >
      <input name="email" type="email" placeholder="邮箱" required className="border border-neutral-300 px-2 py-1.5" />
      <input name="username" placeholder="用户名（登录用）" required className="border border-neutral-300 px-2 py-1.5" />
      <input name="displayName" placeholder="显示名（可空）" className="border border-neutral-300 px-2 py-1.5" />
      <input name="password" type="text" placeholder="初始密码（≥6 位）" required className="border border-neutral-300 px-2 py-1.5" />
      {state.error && (
        <p className="border border-accent bg-paper-2 px-3 py-2 text-accent sm:col-span-2">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="border border-green-400 bg-green-50 px-3 py-2 text-green-700 sm:col-span-2">
          {state.ok}
        </p>
      )}
      <div className="sm:col-span-2">
        <button
          disabled={pending}
          className="bg-accent px-4 py-2 text-white hover:bg-accent-2 disabled:opacity-60"
        >
          {pending ? "创建中…" : "创建编者"}
        </button>
      </div>
    </form>
  );
}
