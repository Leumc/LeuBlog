"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt ? `预览图片：${alt}` : "预览图片"}
      onClick={onClose}
    >
      <button
        className="image-lightbox-close"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="关闭图片预览"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onClick={(event) => event.stopPropagation()} />
    </div>,
    document.body,
  );
}
