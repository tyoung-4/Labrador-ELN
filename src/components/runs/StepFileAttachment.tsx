"use client";

import { useEffect, useRef, useState } from "react";
import FileAnnotationModal from "./FileAnnotationModal";

type StepFile = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  notes: string;
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

function fileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "📎";
  if (mimeType === "application/pdf") return "📄";
  if (
    mimeType === "text/csv" ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel")
  )
    return "📊";
  if (mimeType.startsWith("text/")) return "📝";
  if (mimeType.startsWith("video/")) return "🎬";
  return "📎";
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ── FileCard ─────────────────────────────────────────────────────────────────

type FileCardProps = {
  file: StepFile;
  runId: string;
  userId: string;
  authHeaders: Record<string, string>;
  onDelete: (file: StepFile) => void;
  onNotesSaved: (fileId: string, notes: string) => void;
};

function FileCard({ file, runId, userId, authHeaders, onDelete, onNotesSaved }: FileCardProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbLoading, setThumbLoading] = useState(file.mimeType.startsWith("image/"));
  const [notesDraft, setNotesDraft] = useState(file.notes ?? "");
  const [savedFlash, setSavedFlash] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);
  const [hasAnnotation, setHasAnnotation] = useState(false);
  const [annotateOpen, setAnnotateOpen] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if annotation exists on mount
  useEffect(() => {
    fetch(`/api/files/${file.id}/annotation`, { headers: authHeaders })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setHasAnnotation(!!d))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isImage = file.mimeType.startsWith("image/");

  // The app streams the file itself (local disk or R2) — one URL for both the
  // <img> thumbnail and downloading. The session cookie is sent automatically.
  const fileUrl = `/api/runs/${runId}/files/${file.id}/download`;

  useEffect(() => {
    if (isImage) {
      setThumbUrl(fileUrl);
      setThumbLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDownload() {
    window.open(fileUrl, "_blank", "noopener");
  }

  function handleOpenThumb() {
    handleDownload();
  }

  async function handleNoteBlur() {
    if (notesDraft === (file.notes ?? "")) return;
    try {
      const res = await fetch(`/api/runs/${runId}/files`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id, notes: notesDraft }),
      });
      if (!res.ok) return;
      onNotesSaved(file.id, notesDraft);
      setSavedFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSavedFlash(false), 1500);
    } catch {
      // silently ignore
    }
  }

  return (
    <li className="flex flex-col gap-1 rounded-lg border border-zinc-700/60 bg-zinc-800/70 p-2">
      {/* Top row: thumb/icon + meta + actions */}
      <div className="flex items-start gap-2">
        {/* Thumbnail / icon box */}
        <div
          className={`relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-700/50 bg-zinc-900/80 ${isImage && thumbUrl ? "cursor-pointer" : ""}`}
          onClick={isImage ? handleOpenThumb : undefined}
        >
          {isImage ? (
            thumbLoading ? (
              <span className="animate-spin text-base text-zinc-500">⟳</span>
            ) : thumbUrl ? (
              <img
                src={thumbUrl}
                alt={file.fileName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl">📎</span>
            )
          ) : (
            <span className="text-2xl">{fileIcon(file.mimeType)}</span>
          )}
        </div>

        {/* Filename + size + actions */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">
              {file.fileName}
            </span>
            <span className="shrink-0 text-[10px] text-zinc-500">{formatBytes(file.fileSize)}</span>
            <button
              onClick={handleDownload}
              title="Download"
              className="shrink-0 text-xs text-zinc-400 transition hover:text-sky-300"
            >
              ↓
            </button>
            <button
              onClick={() => setAnnotateOpen(true)}
              title="Annotate"
              className="relative shrink-0 text-xs text-zinc-500 transition hover:text-indigo-300"
            >
              🔬
              {hasAnnotation && (
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
            <button
              onClick={() => onDelete(file)}
              title="Delete file"
              className="shrink-0 text-xs text-zinc-600 transition hover:text-red-400"
            >
              🗑
            </button>
          </div>

          {/* Notes */}
          <div className="relative mt-0.5">
            {notesFocused ? (
              <textarea
                autoFocus
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => { setNotesFocused(false); handleNoteBlur(); }}
                placeholder="Add a note..."
                rows={2}
                className="w-full resize-none rounded border border-zinc-600/60 bg-zinc-900/60 px-1.5 py-1 text-[11px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500/60"
              />
            ) : (
              <input
                type="text"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onFocus={() => setNotesFocused(true)}
                onBlur={handleNoteBlur}
                placeholder="Add a note..."
                className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-[11px] text-zinc-400 placeholder-zinc-600 outline-none transition hover:border-zinc-700/60 focus:border-indigo-500/60 focus:bg-zinc-900/60 focus:text-zinc-300"
              />
            )}
            {savedFlash && (
              <span className="absolute right-0 top-0 text-[10px] text-emerald-400 transition-opacity">
                Saved
              </span>
            )}
          </div>
        </div>
      </div>
      {annotateOpen && (
        <FileAnnotationModal
          file={{ id: file.id, fileName: file.fileName, mimeType: file.mimeType, runId }}
          authHeaders={authHeaders}
          currentUserId={userId}
          onClose={() => setAnnotateOpen(false)}
          onAnnotationChange={setHasAnnotation}
        />
      )}
    </li>
  );
}

// ── StepFileAttachment ────────────────────────────────────────────────────────

export default function StepFileAttachment({ runId, stepId, userId, authHeaders }: Props) {
  const [files, setFiles] = useState<StepFile[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!expanded || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Probe on mount — auto-expand if files exist
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

  async function fetchFiles() {
    try {
      const res = await fetch(`/api/runs/${runId}/files`, { headers: authHeaders });
      if (!res.ok) return;
      const grouped: Record<string, StepFile[]> = await res.json();
      setFiles(grouped[stepId] ?? []);
    } catch {
      // non-critical
    }
  }

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
      // Single server-mediated upload (works with local disk or R2, offline-safe).
      const form = new FormData();
      form.append("file", file);
      form.append("stepId", stepId);
      form.append("uploadedBy", userId);

      const newFile = await uploadWithProgress(
        `/api/runs/${runId}/files`,
        form,
        authHeaders,
        setUploadProgress,
      );
      setFiles((prev) => [...prev, newFile]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = "";
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

  function handleNotesSaved(fileId: string, notes: string) {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, notes } : f)));
  }

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-zinc-500 transition hover:text-zinc-300"
      >
        <span>📎</span>
        <span>{files.length > 0 ? `Files (${files.length})` : "Files"}</span>
        <span className="opacity-50">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-1.5 rounded border border-zinc-700/60 bg-zinc-900/60 p-2">
          {files.length > 0 && (
            <ul className="mb-2 space-y-2">
              {files.map((f) => (
                <FileCard
                  key={f.id}
                  file={f}
                  runId={runId}
                  userId={userId}
                  authHeaders={authHeaders}
                  onDelete={handleDelete}
                  onNotesSaved={handleNotesSaved}
                />
              ))}
            </ul>
          )}

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
              className="flex items-center gap-1 rounded border border-dashed border-zinc-600 px-2 py-1 text-xs text-zinc-400 transition hover:border-indigo-500 hover:text-indigo-300"
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

          {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

function uploadWithProgress(
  url: string,
  form: FormData,
  authHeaders: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<StepFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    // Forward the app's auth headers (do NOT set Content-Type — the browser sets
    // the multipart boundary automatically).
    for (const [k, v] of Object.entries(authHeaders)) xhr.setRequestHeader(k, v);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText) as StepFile); }
        catch { reject(new Error("Upload succeeded but response was invalid")); }
      } else {
        let msg = `Upload failed: HTTP ${xhr.status}`;
        try { msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg; } catch {}
        reject(new Error(msg));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.send(form);
  });
}
