"use client";

import { useState } from "react";
import { deleteAccessKey, resetUsage, revokeCoverage } from "@/app/admin/access-keys/actions";
import AccessKeyForm, { type AccessKeyInit } from "./AccessKeyForm";

interface AccessKeyCardProps {
  init: AccessKeyInit;
  usedCount: number;
  maxUses: number | null;
  active: boolean;
  decryptFailed: boolean;
  validityLabel: string;
  posts: { id: string; title: string }[];
}

export default function AccessKeyCard({
  init,
  usedCount,
  maxUses,
  active,
  decryptFailed,
  validityLabel,
  posts,
}: AccessKeyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const statsLine = [
    `已用 ${usedCount}${maxUses === null ? "" : ` / ${maxUses}`} 次`,
    `覆盖 ${posts.length} 篇`,
    validityLabel ? validityLabel : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="keycard">
      {/* Header row */}
      <div className="keycard-head">
        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--aink)" }}>
          ⊘ {init.label || "（未命名密钥）"}
        </span>
        <span
          className="keycard-badge"
          style={{
            background: active ? "var(--ok-bg)" : "#eef0f3",
            color: active ? "var(--ok)" : "var(--soft)",
          }}
        >
          {active ? "启用" : "停用"}
        </span>
        <span className="keycard-stats">{statsLine}</span>
      </div>

      {/* Secret row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13 }}>
        {decryptFailed ? (
          <span style={{ color: "#c0392b", fontSize: 12 }}>
            无法解密（AUTH_SECRET 可能已更换）
          </span>
        ) : (
          <>
            <span style={{ color: "var(--soft)" }}>
              密钥：{revealed ? init.secret : "••••••••"}
            </span>
            <button
              type="button"
              className="btn sm"
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? "隐藏" : "显示"}
            </button>
          </>
        )}
      </div>

      {/* Actions row */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn sm"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "收起" : "编辑"}
        </button>
        <form action={resetUsage}>
          <input type="hidden" name="id" value={init.id} />
          <button type="submit" className="btn sm">重置次数</button>
        </form>
        <form action={deleteAccessKey}>
          <input type="hidden" name="id" value={init.id} />
          <button type="submit" className="btn sm danger">删除</button>
        </form>
      </div>

      {/* Applied articles */}
      <div style={{ marginTop: 10 }}>
        {posts.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--amuted)", margin: 0 }}>
            未应用于任何文章（在文章编辑页指派）
          </p>
        ) : (
          <div className="keycard-posts">
            {posts.map((p) => (
              <span key={p.id} className="keycard-chip">
                <span style={{ fontSize: 12, color: "var(--soft)" }}>{p.title}</span>
                <form action={revokeCoverage} style={{ display: "inline" }}>
                  <input type="hidden" name="keyId" value={init.id} />
                  <input type="hidden" name="postId" value={p.id} />
                  <button type="submit" className="btn sm danger" style={{ padding: "1px 6px", fontSize: 11 }}>
                    撤销
                  </button>
                </form>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Inline edit form */}
      {expanded && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--aline)", paddingTop: 14 }}>
          <AccessKeyForm init={init} />
        </div>
      )}
    </div>
  );
}
