"use client";

import { useTranslations } from "next-intl";
import { Eye, Download, Printer } from "lucide-react";

export interface CandidateImageCardProps {
  src: string;
  alt: string;
  label: string;
  downloadFilename?: string;
  onView: () => void;
}

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

export function CandidateImageCard({
  src,
  alt,
  label,
  downloadFilename = "image",
  onView,
}: CandidateImageCardProps) {
  const t = useTranslations("common");

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadImage(src, downloadFilename);
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    printImage(src, label);
  };

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    onView();
  };

  return (
    <div>
      <label className="text-sm font-medium text-primary/60">{label}</label>
      <div className="group relative mt-2 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
        <img
          src={src}
          alt={alt}
          className="max-h-64 w-full object-contain"
        />
        <div
          className="absolute inset-0 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
          tabIndex={0}
        >
          <button
            type="button"
            onClick={handleView}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition hover:bg-white dark:bg-zinc-800 dark:hover:bg-zinc-700"
            aria-label={t("view")}
            title={t("view")}
          >
            <Eye className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition hover:bg-white dark:bg-zinc-800 dark:hover:bg-zinc-700"
            aria-label={t("download")}
            title={t("download")}
          >
            <Download className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg transition hover:bg-white dark:bg-zinc-800 dark:hover:bg-zinc-700"
            aria-label={t("print")}
            title={t("print")}
          >
            <Printer className="h-7 w-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
