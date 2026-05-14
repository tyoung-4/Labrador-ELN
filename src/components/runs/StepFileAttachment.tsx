"use client";

import { useEffect, useRef, useState } from "react";

type StepFile = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
};

type Props = {
  runId: string;
  stepId: string;
  userId: string;
  authHeaders: Record<string, string>;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function StepFileAttachment({ runId, stepId, userId, authHeaders }: Props) {
  const [files, setFiles] = useState<StepFile[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasFetchedRef = useRef(false);

  // Fetch files for this step on first expand
  useEffect(() => {
    if (!expanded || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  async function fetchFiles() {
    try {
      const res = await fetch(`/api/runs/${runId}/files`, { headers: authHeaders });
      if (!res.ok) return;
      const grouped: Record<string, StepFile[]> = await res.json();
      const stepFiles = grouped[stepId] ?? [];
      setFiles(stepFiles);
      // Auto-expand if files exist
      if (stepFiles.length > 0) setExpanded(true);
    } catch {
      // non-critical
    }
  }

  // Auto-expand if files exist on first mount (fetch without waiting for expand)
  useEffect(() => {
    async function probe() {
      try {
        const res = await fetch(`/api/runs/${runId}/files`, { headers: authHeaders });
        if (!res.ok) return;
        const grouped: Record<string, StepFile[]> = await res.json();
        const stepFiles = grouped[stepId] ?? [];
        if (stepFiles.length > 0) {
          setFiles(stepFiles);
          setExpanded(true);
          hasFetchedRef.current = true;
        }
      } catch {
        // non-critical
      }
    }
    probe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError("File exceeds the 50 MB limit.");
      e.target.value = "";
      return;
    }
    setError(null);
    setUploading(true);
    setUploadProgress(0);
    try {
      // 1. Get presigned upload URL
      const urlRes = await fetch(`/api/runs/${runId}/files/upload-url`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ stepId, fileName: file.name, fileSize: file.size, mimeType: file.type || "application/octet-stream" }),
      });
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to get upload URL");
      }
      const { uploadUrl, fileKey } = (await urlRes.json()) as { uploadUrl: string; fileKey: string };

      // 2. PUT directly to R2 (browser → R2, no server proxy)
      await uploadWithProgress(file, uploadUrl, setUploadProgress);

      // 3. Confirm upload — create DB record
      const confirmRes = await fetch(`/api/runs/${runId}/files`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          fileKey,
          uploadedBy: userId,
        }),
      });
      if (!confirmRes.ok) throw new Error("Upload confirmed but failed to save record");
      const newFile: StepFile = await confirmRes.json();
      setFiles((prev) => [...prev, newFile]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = "";
    }
  }

  async function handleDownload(file: StepFile) {
    try {
      const res = await fetch(`/api/runs/${runId}/files/${file.id}/url`, { headers: authHeaders });
      if (!res.ok) throw new Error("Could not get download URL");
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank", "noopener");
    } catch {
      setError("Could not open file. Please try again.");
    }
  }

  async function handleDelete(file: StepFile) {
    if (!window.confirm(`Delete "${file.fileName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/runs/${runId}/files`, {
        method: "DELETE",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch {
      setError("Failed to delete file. Please try again.");
    }
  }

  return (
    <div className="mt-1">
      {/* Toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition"
      >
        <span>📎</span>
        <span>
          {files.length > 0 ? `Files (${files.length})` : "Files"}
        </span>
        <span className="opacity-50">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-1.5 rounded border border-zinc-700/60 bg-zinc-900/60 p-2">
          {/* File list */}
          {files.length > 0 && (
            <ul className="mb-2 space-y-1">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded bg-zinc-800/60 px-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-xs text-zinc-200">{f.fileName}</span>
                  <span className="shrink-0 text-[10px] text-zinc-500">{formatBytes(f.fileSize)}</span>
                  <button
                    onClick={() => handleDownload(f)}
                    title="Download"
                    className="shrink-0 text-xs text-zinc-400 hover:text-sky-300 transition"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleDelete(f)}
                    title="Delete file"
                    className="shrink-0 text-xs text-zinc-600 hover:text-red-400 transition"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Upload controls */}
          {uploading ? (
            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded bg-zinc-700">
                <div
                  className="h-full rounded bg-indigo-500 transition-all duration-200"
                  style={{ width: `${uploadProgress ?? 0}%` }}
                />
              </div>
              <span className="shrink-0 text-[10px] text-zinc-400">{uploadProgress ?? 0}%</span>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 rounded border border-dashed border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:border-indigo-500 hover:text-indigo-300 transition"
            >
              📎 Attach file
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Error */}
          {error && (
            <p className="mt-1 text-[10px] text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// XHR-based upload with progress tracking (fetch API doesn't support upload progress)
function uploadWithProgress(
  file: File,
  url: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.send(file);
  });
}
