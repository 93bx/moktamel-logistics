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
}

export function FileUpload({
  purpose_code,
  label,
  required = false,
  fileId,
  onFileIdChange,
  accept = "image/*",
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
          id={`file-upload-${purpose_code}`}
        />
        <label
          htmlFor={`file-upload-${purpose_code}`}
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

