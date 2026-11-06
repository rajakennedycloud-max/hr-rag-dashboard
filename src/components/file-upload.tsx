"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";

interface FileUploadProps {
  candidateId: string;
  fileType: "resignationProof" | "kycDocuments" | "resume" | "general";
  currentFile: string | null;
  onUploadSuccess: (filePath: string) => void;
  onFileDelete: () => void;
}

const LABELS: Record<string, string> = {
  resignationProof: "Resignation Proof",
  kycDocuments: "KYC Documents",
  resume: "Resume",
  general: "Other Document",
};

export default function FileUpload({
  candidateId,
  fileType,
  currentFile,
  onUploadSuccess,
  onFileDelete,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("candidateId", candidateId);
      formData.append("fileType", fileType);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Upload failed");
        return;
      }
      onUploadSuccess(result.filePath);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (!currentFile) return;
    setUploading(true);
    try {
      const res = await fetch(
        `/api/upload?candidateId=${candidateId}&filePath=${encodeURIComponent(currentFile)}`,
        { method: "DELETE" }
      );
      if (res.ok) onFileDelete();
      else setError("Delete failed");
    } catch {
      setError("Delete failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-700">{LABELS[fileType]}</span>
        {currentFile && (
          <button
            onClick={remove}
            disabled={uploading}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Remove file"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {currentFile ? (
        <a
          href={currentFile}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-brand-600 hover:bg-brand-50 transition-colors"
        >
          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{currentFile.split("/").pop()}</span>
        </a>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {uploading ? "Uploading..." : "Upload file"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
