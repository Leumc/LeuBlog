"use client";

import { useActionState } from "react";
import { unlockPostAction, type UnlockState } from "@/app/(reading)/posts/[slug]/unlock-actions";

export default function ArticleGate({
  slug,
  title,
  note,
}: {
  slug: string;
  title: string;
  note: string | null;
}) {
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(
    unlockPostAction,
    {},
  );

  return (
    <div className="wrap gate">
      <div className="gate-lock">⊘</div>
      <h1>{title}</h1>
      <div className="gate-note">
        {note ? note : "本文需要访问许可密钥才能阅读。"}
      </div>
      <form action={formAction} className="gate-form">
        <input type="hidden" name="slug" value={slug} />
        <input
          type="password"
          name="key"
          placeholder="输入访问许可密钥"
          autoComplete="off"
          autoFocus
        />
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "校验中…" : "解锁阅读"}
        </button>
        {state.error && <p className="gate-err">{state.error}</p>}
      </form>
    </div>
  );
}
