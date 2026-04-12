"use client";

import { useState, useRef, useEffect } from "react";
import type { Attachment } from "@/hooks/useTopicSocket";

interface Props {
  attachment: Attachment;
}

export function AttachmentImage({ attachment }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle cached images: if the browser already has the image, onLoad won't fire
  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <>
      {/* Thumbnail */}
      <button
        type="button"
        onClick={() => setLightbox(true)}
        aria-label={`Ver imagem: ${attachment.name}`}
        className="block text-left rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity"
        style={{ width: 300, maxWidth: "100%" }}
      >
        {/* Placeholder while loading */}
        {!loaded && !error && (
          <div
            className="animate-pulse bg-bg-subtle rounded-lg"
            style={{ width: 300, height: 180, maxWidth: "100%" }}
          />
        )}
        {error ? (
          <div
            className="flex items-center justify-center bg-bg-subtle rounded-lg text-text-3 text-[12px]"
            style={{ width: 300, height: 120 }}
          >
            Imagem indisponível
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={attachment.url}
            alt={attachment.name}
            onLoad={() => setLoaded(true)}
            onError={() => { setLoaded(true); setError(true); }}
            className="rounded-lg object-cover"
            style={{
              maxWidth: 300,
              maxHeight: 300,
              display: loaded ? "block" : "none",
            }}
          />
        )}
      </button>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            aria-label="Fechar"
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:opacity-70 transition-opacity"
            onClick={() => setLightbox(false)}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
