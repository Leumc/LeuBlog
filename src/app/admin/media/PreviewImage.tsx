"use client";

import { useState } from "react";
import ImageLightbox from "@/components/ImageLightbox";

export default function PreviewImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="media-thumbnail" type="button" onClick={() => setOpen(true)} aria-label={`预览 ${alt}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} />
      </button>
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
