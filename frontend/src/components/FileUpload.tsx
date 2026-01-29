"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";

interface FileUploadProps {
  purpose_code: string;
  label: string;
  required?: boolean;
  fileId: string | null;
  onFileIdChange: (fileId: string | null) => void;
  accept?: string;
  /** Card style: dashed border, icon, label inside card. Use with icon prop. */
  variant?: "default" | "card";
  /** Icon shown in card variant (e.g. FileImage, Plane from lucide-react). */
  icon?: React.ReactNode;
}

export function FileUpload({
  purpose_code,
  label,
  required = false,
  fileId,
  onFileIdChange,
  accept = "*/*",
  variant = "default",
  icon,
}: FileUploadProps) {
  const t = useTranslations();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    setUploadedFileName(file.name);

    try {
      // Step 1: Get upload URL from backend
      const uploadUrlRes = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        }),
      });

      if (!uploadUrlRes.ok) {
        const data = await uploadUrlRes.json().catch(() => null);
        throw new Error(data?.message ?? "Failed to get upload URL");
      }

      const { file_id, upload_url } = await uploadUrlRes.json();

      // Step 2: Upload file directly to MinIO
      const uploadRes = await fetch(upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file to storage");
      }

      // Step 3: Update parent with file_id
      onFileIdChange(file_id);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
      setUploadedFileName(null);
      onFileIdChange(null);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    setUploadedFileName(null);
    onFileIdChange(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const inputId = `file-upload-${purpose_code}`;

  if (variant === "card") {
    return (
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          id={inputId}
        />
        <label
          htmlFor={inputId}
          className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-md cursor-pointer transition-colors dark:border-zinc-600 dark:hover:border-zinc-500 border-zinc-300 hover:border-zinc-400 ${
            uploading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {icon && <span className="w-8 h-8 text-zinc-500 mb-2 [&>svg]:w-8 [&>svg]:h-8">{icon}</span>}
          <span className="text-xs text-center text-primary">
            {label} {required && "*"}
          </span>
          {(uploadedFileName || fileId) && (
            <span className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate w-full text-center">
              {uploading ? t("common.uploading") || "Uploading..." : uploadedFileName || t("common.fileUploaded") || "File uploaded"}
            </span>
          )}
        </label>
        {(uploadedFileName || fileId) && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-1 hover:bg-red-600 disabled:opacity-50"
            aria-label={t("common.remove") || "Remove"}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {error && (
          <div className="text-xs text-red-700 mt-1 text-center">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-sm text-primary">
        {label} {required && "*"}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          id={inputId}
        />
        <label
          htmlFor={inputId}
          className={`flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary cursor-pointer hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 ${
            uploading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {uploading
            ? t("common.uploading") || "Uploading..."
            : uploadedFileName || fileId
            ? uploadedFileName || t("common.fileUploaded") || "File uploaded"
            : t("common.uploadFile") || "Upload File"}
        </label>
        {uploadedFileName || fileId ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-900 hover:bg-red-100 disabled:opacity-50"
          >
            {t("common.remove") || "Remove"}
          </button>
        ) : null}
      </div>
      {error && (
        <div className="text-xs text-red-700">{error}</div>
      )}
    </div>
  );
}

