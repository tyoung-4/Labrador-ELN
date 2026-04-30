"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// ── KebabMenuItem ─────────────────────────────────────────────────────────────

export function KebabMenuItem({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/5 transition-colors ${className ?? "text-white/70 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

// ── KebabMenu ─────────────────────────────────────────────────────────────────

export default function KebabMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Defer listener so the opening click doesn't immediately close
    const id = setTimeout(() => document.addEventListener("mousedown", close), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="text-white/40 hover:text-white/70 text-lg leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 transition-colors flex-shrink-0"
        title="More options"
        aria-label="More options"
      >
        ⋮
      </button>
      {open && createPortal(
        <div
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="min-w-[150px] rounded-lg border border-white/10 bg-gray-900 shadow-xl py-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
}

// ── ArchiveConfirm ────────────────────────────────────────────────────────────

export function ArchiveConfirm({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div
      className="my-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-amber-300 text-xs font-semibold">Archive &ldquo;{name}&rdquo;?</p>
      <p className="text-white/50 text-xs">
        It will be moved to the Archived tab. This action is reversible.
      </p>
      <div className="flex gap-2">
        <button
          onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}
          disabled={busy}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
        >
          {busy ? "Archiving…" : "Archive"}
        </button>
        <button
          onClick={onCancel}
          className="text-white/40 hover:text-white/70 text-xs px-2 py-1 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── FlagPrompt ────────────────────────────────────────────────────────────────

export function FlagPrompt({
  name,
  onSubmit,
  onCancel,
}: {
  name: string;
  onSubmit: (note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div
      className="my-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-orange-300 text-xs font-semibold">Flag &ldquo;{name}&rdquo; for archive?</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason for flagging (optional)"
        rows={2}
        className="w-full rounded bg-white/5 border border-white/10 text-white text-xs px-2 py-1.5 resize-none focus:outline-none focus:border-white/30"
      />
      <div className="flex gap-2">
        <button
          onClick={async () => { setBusy(true); await onSubmit(note); setBusy(false); }}
          disabled={busy}
          className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
        >
          {busy ? "Submitting…" : "Submit"}
        </button>
        <button
          onClick={onCancel}
          className="text-white/40 hover:text-white/70 text-xs px-2 py-1 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
