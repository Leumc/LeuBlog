"use client";

import { useEffect, type ReactNode } from "react";

/** 轻量确认 modal：Esc / 点 backdrop / 取消按钮 关闭；确认按钮回调 onConfirm。
 *  样式用 .admin .modal-backdrop / .admin .modal（见 globals.css）。 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>{title}</h3>
        <div className="modal-body">{description}</div>
        <div className="modal-actions">
          <button type="button" className="btn sm" onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" className="btn primary sm" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
