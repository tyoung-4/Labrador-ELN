"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { suggestShortTag } from "@/utils/capitalizeTag";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TagSummary {
  id: string;
  name: string;
  type: string;
}

export interface ShortTagModalProps {
  projectName: string;
  projectTagId: string;
  projectColor: string;
  currentUser: string;
  onComplete: (shortTagId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#06b6d4",
  "#64748b",
  "#1e293b",
];

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShortTagModal({
  projectName,
  projectTagId,
  projectColor,
  currentUser,
  onComplete,
}: ShortTagModalProps) {
  const router = useRouter();

  const suggested = suggestShortTag(projectName);
  const [name, setName] = useState(suggested);
  const [color, setColor] = useState(projectColor);
  const [hexInput, setHexInput] = useState(projectColor);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameChecking, setNameChecking] = useState(false);
  const [isUnique, setIsUnique] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validate name format
  function validateFormat(val: string): string | null {
    if (!val.trim()) return "Short tag name is required";
    if (!/^[A-Z0-9.\-]+$/i.test(val)) return "Only letters, numbers, . and - are allowed";
    return null;
  }

  // Debounced uniqueness check
  const checkUniqueness = useCallback((val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const formatErr = validateFormat(val);
    if (formatErr) {
      setIsUnique(null);
      setNameChecking(false);
      return;
    }
    setNameChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tags?q=${encodeURIComponent(val.trim())}`);
        const tags = (await res.json()) as TagSummary[];
        const conflict = tags.find(
          (t) => t.name.toLowerCase() === val.trim().toLowerCase()
        );
        setIsUnique(!conflict);
        if (conflict) {
          const typeLabel = conflict.type === "PROJECT" ? "project" : "general";
          setNameError(`"${conflict.name}" already exists as a ${typeLabel} tag`);
        } else {
          setNameError(null);
        }
      } catch {
        setIsUnique(null);
      } finally {
        setNameChecking(false);
      }
    }, 300);
  }, []);

  // Run initial uniqueness check on mount for the suggested value
  useEffect(() => {
    checkUniqueness(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleNameChange(val: string) {
    // Strip disallowed characters live
    const cleaned = val.replace(/[^A-Za-z0-9.\-]/g, "").toUpperCase();
    setName(cleaned);
    setSubmitError(null);
    const formatErr = validateFormat(cleaned);
    setNameError(formatErr);
    if (!formatErr) checkUniqueness(cleaned);
    else {
      setIsUnique(null);
      setNameChecking(false);
    }
  }

  function handlePresetSelect(c: string) {
    setColor(c);
    setHexInput(c);
  }

  function handleHexChange(val: string) {
    setHexInput(val);
    if (isValidHex(val)) setColor(val);
  }

  async function handleSubmit() {
    const formatErr = validateFormat(name);
    if (formatErr || !isUnique || nameChecking || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // 1. Create the short tag
      const tagRes = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type: "PROJECT", color, createdBy: currentUser }),
      });
      const tagData = (await tagRes.json()) as {
        exists?: boolean;
        tag?: TagSummary;
        error?: string;
      };

      if (!tagData.tag) {
        setSubmitError(tagData.error ?? "Failed to create short tag");
        setIsSubmitting(false);
        return;
      }

      if (tagData.exists) {
        setSubmitError(`"${tagData.tag.name}" already exists — choose a different name`);
        setIsSubmitting(false);
        return;
      }

      // 2. Link the short tag to the parent project tag
      const linkRes = await fetch(`/api/projects/${projectTagId}/short-tag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortTagId: tagData.tag.id }),
      });
      if (!linkRes.ok) {
        const linkData = (await linkRes.json()) as { error?: string };
        setSubmitError(linkData.error ?? "Failed to link short tag to project");
        setIsSubmitting(false);
        return;
      }

      // 3. Notify parent, then navigate
      onComplete(tagData.tag.id);
      router.push(`/projects/${projectTagId}`);
    } catch {
      setSubmitError("Network error — please try again");
      setIsSubmitting(false);
    }
  }

  const canSubmit =
    !validateFormat(name) &&
    isUnique === true &&
    !nameChecking &&
    !isSubmitting;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
      <div className="mx-4 w-full max-w-md rounded-xl border border-white/10 bg-gray-900 p-6 shadow-2xl">

        {/* Header */}
        <h2 className="mb-1 text-xl font-semibold text-white">
          Create a Short Tag for this Project
        </h2>
        <p className="mb-5 text-sm text-zinc-400">
          This tag will appear on all items linked to this project and will always link back to it.
        </p>

        {/* ── Short Tag Name ─────────────────────────────────────── */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-300">
            Short Tag Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={suggested}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            disabled={isSubmitting}
          />
          {nameChecking && (
            <p className="mt-1 text-xs text-zinc-500">Checking availability…</p>
          )}
          {!nameChecking && nameError && (
            <p className="mt-1 text-xs text-red-400">{nameError}</p>
          )}
          {!nameChecking && !nameError && isUnique === true && name.trim() && (
            <p className="mt-1 text-xs text-emerald-400">Name is available</p>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            Letters, numbers, <code className="text-zinc-400">.</code> and <code className="text-zinc-400">-</code> only
          </p>
        </div>

        {/* ── Color ─────────────────────────────────────────────── */}
        <div className="mb-5">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
            Color
            <span
              className="inline-block h-4 w-4 rounded-full border border-zinc-600"
              style={{ backgroundColor: color }}
            />
          </label>
          <div className="mb-2 grid grid-cols-6 gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => handlePresetSelect(c)}
                className={`h-8 w-8 rounded-full transition-transform ${
                  color === c
                    ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-gray-900"
                    : "hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                disabled={isSubmitting}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 flex-shrink-0 rounded-full border border-zinc-600"
              style={{ backgroundColor: isValidHex(hexInput) ? hexInput : color }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder="#6366f1"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* ── Submit error ──────────────────────────────────────── */}
        {submitError && (
          <div className="mb-4 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-300">
            {submitError}
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? "Creating…" : "Create Short Tag"}
        </button>
      </div>
    </div>
  );
}
