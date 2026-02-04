"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Download, Printer } from "lucide-react";

export interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageTitle: string;
  downloadFilename?: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "image";
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function printImage(url: string, title: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <!DOCTYPE html>
    <html>
      <head><title>${title}</title></head>
      <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
        <img src="${url}" alt="${title}" style="max-width:100%;height:auto;" />
      </body>
    </html>
  `);
  w.document.close();
  w.onload = () => {
    w.print();
    w.close();
  };
}

export function ImageViewerModal({
  isOpen,
  onClose,
  imageUrl,
  imageTitle,
  downloadFilename = "image",
}: ImageViewerModalProps) {
  const t = useTranslations("common");
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, translateX: 0, translateY: 0 });

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetZoom();
    }
  }, [isOpen, resetZoom]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const preventWheelScroll = (e: WheelEvent) => {
      if (containerRef.current?.contains(e.target as Node)) e.preventDefault();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      document.addEventListener("wheel", preventWheelScroll, { passive: false });
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
      document.removeEventListener("wheel", preventWheelScroll);
    };
  }, [isOpen, onClose]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      translateX: translate.x,
      translateY: translate.y,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || scale <= 1) return;
      setTranslate({
        x: dragStart.current.translateX + e.clientX - dragStart.current.x,
        y: dragStart.current.translateY + e.clientY - dragStart.current.y,
      });
    },
    [isDragging, scale]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleDownload = () => downloadImage(imageUrl, downloadFilename);
  const handlePrint = () => printImage(imageUrl, imageTitle);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={containerRef}
        className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Corner actions */}
        <div className="absolute right-2 top-2 z-10 flex gap-2 rounded-lg bg-black/50 p-2">
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-md p-2 text-white hover:bg-white/20"
            aria-label={t("download")}
            title={t("download")}
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-md p-2 text-white hover:bg-white/20"
            aria-label={t("print")}
            title={t("print")}
          >
            <Printer className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-white hover:bg-white/20"
            aria-label={t("back")}
            title={t("back")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Zoomable image area - large hit area for wheel zoom */}
        <div
          className="flex min-h-[70vh] min-w-[70vw] max-h-[85vh] max-w-[85vw] items-center justify-center overflow-hidden rounded-lg"
          onWheel={handleWheel}
          style={{ cursor: scale > 1 && isDragging ? "grabbing" : scale > 1 ? "grab" : "default" }}
        >
          <div
            className="inline-block origin-center select-none"
            style={{
              transform: `scale(${scale}) translate(${translate.x}px, ${translate.y}px)`,
            }}
            onMouseDown={handleMouseDown}
          >
            <img
              src={imageUrl}
              alt={imageTitle}
              className="max-h-[85vh] max-w-[85vw] object-contain"
              draggable={false}
            />
          </div>
        </div>
        {scale !== 1 && (
          <button
            type="button"
            onClick={resetZoom}
            className="mt-2 rounded-md bg-white/90 px-3 py-1.5 text-sm text-primary dark:bg-zinc-800"
          >
            {t("resetZoom")}
          </button>
        )}
      </div>
    </div>
  );
}
