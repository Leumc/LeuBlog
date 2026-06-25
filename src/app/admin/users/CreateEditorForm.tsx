"use client";

import { useActionState } from "react";
import { createEditor, type UserActionState } from "./actions";

export default function CreateEditorForm() {
  const [state, action, pending] = useActionState<UserActionState, FormData>(createEditor, {});
  return (
    <div className="panel">
      <div className="h">
        <h2>新建编者</h2>
      </div>
      <div className="b">
        <form action={action} className="grid3">
          <div className="fld">
            <label>邮箱</label>
            <input name="email" type="email" required />
          </div>
          <div className="fld">
            <label>用户名（登录用）</label>
            <input name="username" required />
          </div>
          <div className="fld">
            <label>显示名（可空）</label>
            <input name="displayName" />
          </div>
          <div className="fld">
            <label>初始密码（≥6 位）</label>
            <input name="password" type="text" required />
          </div>
          {state.error && (
            <div className="note" style={{ gridColumn: "1 / -1", color: "var(--aaccent)", background: "var(--accent-soft)", borderColor: "#edc9c6" }}>
              {state.error}
            </div>
          )}
          {state.ok && (
            <div className="note" style={{ gridColumn: "1 / -1", color: "var(--ok)", background: "var(--ok-bg)", borderColor: "#cfe9d8" }}>
              {state.ok}
            </div>
          )}
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="btn primary" disabled={pending}>
              {pending ? "创建中…" : "＋ 新建编者"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
