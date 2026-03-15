"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { capitalizeTag } from "@/utils/capitalizeTag";

// ─── Types ────────────────────────────────────────────────────────────────────

type TagType = "PROJECT" | "GENERAL";

interface TagSummary {
  id: string;
  name: string;
  type: TagType;
  color: string;
}

interface Assignment {
  tagId: string;
  tag: TagSummary;
}

export interface TagInputProps {
  entityType: "RUN" | "ENTRY" | "INVENTORY" | "KNOWLEDGE_HUB";
  entityId: string;
  currentUser: string;
  entityOwner: string;
  existingAssignments: Assignment[];
  onAssignmentsChange?: (assignments: Assignment[]) => void;
  readOnly?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<TagInputProps["entityType"], string> = {
  RUN: "run",
  ENTRY: "entry",
  INVENTORY: "inventory item",
  KNOWLEDGE_HUB: "knowledge hub item",
};

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

// ─── Hex color validation ──────────────────────────────────────────────────────

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

// ─── Pill background color (20% opacity) ─────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

/** A single colored tag pill */
function TagPill({
  assignment,
  showRemove,
  onRemoveClick,
}: {
  assignment: Assignment;
  showRemove: boolean;
  onRemoveClick: (assignment: Assignment) => void;
}) {
  const { tag } = assignment;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium text-white"
      style={{ backgroundColor: hexToRgba(tag.color, 0.2), border: `1px solid ${tag.color}` }}
    >
      {tag.type === "PROJECT" && <span className="text-xs">📁</span>}
      <span>{tag.name}</span>
      {showRemove && (
        <button
          type="button"
          onClick={() => onRemoveClick(assignment)}
          className="ml-0.5 rounded-full p-0.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label={`Remove tag ${tag.name}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
          </svg>
        </button>
      )}
    </span>
  );
}

/** Removal confirmation popover */
function RemovalPopover({
  assignment,
  entityLabel,
  onConfirm,
  onCancel,
}: {
  assignment: Assignment;
  entityLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute z-50 mt-1 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl w-64">
      <p className="text-sm text-zinc-200 mb-3">
        Remove{" "}
        <span className="font-semibold text-white">{assignment.tag.name}</span>{" "}
        from this {entityLabel}?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition-colors"
        >
          Remove
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md bg-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** New tag creation dialog */
function NewTagDialog({
  initialName,
  entityType,
  entityId,
  currentUser,
  onCreated,
  onCancel,
}: {
  initialName: string;
  entityType: string;
  entityId: string;
  currentUser: string;
  onCreated: (assignment: Assignment) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(() => capitalizeTag(initialName));
  const [tagType, setTagType] = useState<TagType>("GENERAL");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [hexInput, setHexInput] = useState(PRESET_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyExistsMsg, setAlreadyExistsMsg] = useState("");
  const [nameError, setNameError] = useState("");

  // Update capitalized preview as user types
  function handleNameChange(val: string) {
    // Restrict to allowed chars
    const cleaned = val.replace(/[^A-Za-z0-9.\-]/g, "");
    setName(capitalizeTag(cleaned));
    setNameError("");
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
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setSubmitting(true);
    setAlreadyExistsMsg("");
    try {
      // Create or find existing tag
      const tagRes = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: tagType, color, createdBy: currentUser }),
      });
      const tagData = (await tagRes.json()) as { exists: boolean; tag: TagSummary };

      if (tagData.exists) {
        setAlreadyExistsMsg(
          `Tag "${tagData.tag.name}" already exists — it has been added instead`
        );
        // Brief delay so user sees message, then assign
        await new Promise((r) => setTimeout(r, 1200));
      }

      // Assign to entity
      const assignRes = await fetch("/api/tags/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagId: tagData.tag.id,
          entityType,
          entityId,
          assignedBy: currentUser,
        }),
      });
      const assignData = (await assignRes.json()) as {
        success: boolean;
        assignment: Assignment;
      };
      onCreated(assignData.assignment);
    } catch (err) {
      console.error("Failed to create/assign tag:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">Create New Tag</h2>

        {/* Name field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            placeholder="Tag name"
            disabled={submitting}
          />
          {nameError && (
            <p className="mt-1 text-xs text-red-400">{nameError}</p>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            Preview: <span className="text-zinc-300 font-medium">{name || "—"}</span>
          </p>
        </div>

        {/* Type selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Type
          </label>
          <div className="flex gap-2">
            {(["GENERAL", "PROJECT"] as TagType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTagType(t)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  tagType === t
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                }`}
                disabled={submitting}
              >
                {t === "PROJECT" ? "📁 Project" : "General"}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Color
          </label>
          <div className="grid grid-cols-6 gap-2 mb-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handlePresetSelect(c)}
                className={`w-8 h-8 rounded-full transition-transform ${
                  color === c ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-900" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                disabled={submitting}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 border border-zinc-600"
              style={{ backgroundColor: isValidHex(hexInput) ? hexInput : color }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder="#6366f1"
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none font-mono"
              disabled={submitting}
            />
          </div>
        </div>

        {/* Already-exists message */}
        {alreadyExistsMsg && (
          <div className="mb-3 rounded-md bg-amber-900/40 border border-amber-700/50 px-3 py-2 text-sm text-amber-300">
            {alreadyExistsMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Creating…" : "Create & Add Tag"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main TagInput component ──────────────────────────────────────────────────

export default function TagInput({
  entityType,
  entityId,
  currentUser,
  entityOwner,
  existingAssignments,
  onAssignmentsChange,
  readOnly = false,
}: TagInputProps) {
  const isOwner = currentUser === entityOwner || currentUser === "Admin";
  const canEdit = isOwner && !readOnly;
  const entityLabel = ENTITY_LABELS[entityType];

  // ── State ──────────────────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState<Assignment[]>(existingAssignments);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<TagSummary[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const [removingAssignment, setRemovingAssignment] = useState<Assignment | null>(null);
  const [showNewTagDialog, setShowNewTagDialog] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Sync external assignments ─────────────────────────────────────────────
  useEffect(() => {
    setAssignments(existingAssignments);
  }, [existingAssignments]);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setRemovingAssignment(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // ── Debounced search ───────────────────────────────────────────────────────
  const searchTags = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!q.trim()) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }
      try {
        const res = await fetch(`/api/tags?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as TagSummary[];
        // Filter out already-assigned tags
        const assigned = new Set(assignments.map((a) => a.tagId));
        setSuggestions(data.filter((t) => !assigned.has(t.id)));
        setShowDropdown(true);
        setHighlightedIdx(-1);
      } catch (err) {
        console.error("Tag search error:", err);
      }
    }, 200);
  }, [assignments]);

  function handleInputChange(val: string) {
    setInputValue(val);
    searchTags(val);
  }

  // ── Assign an existing tag ────────────────────────────────────────────────
  async function assignTag(tag: TagSummary) {
    setShowDropdown(false);
    setInputValue("");
    setSuggestions([]);
    try {
      const res = await fetch("/api/tags/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagId: tag.id,
          entityType,
          entityId,
          assignedBy: currentUser,
        }),
      });
      const data = (await res.json()) as { success: boolean; assignment: Assignment };
      const updated = [...assignments, data.assignment];
      setAssignments(updated);
      onAssignmentsChange?.(updated);
    } catch (err) {
      console.error("Assign tag error:", err);
    }
  }

  // ── Handle Enter key in input ─────────────────────────────────────────────
  async function handleEnter() {
    // If dropdown item highlighted, select it
    if (highlightedIdx >= 0 && suggestions[highlightedIdx]) {
      assignTag(suggestions[highlightedIdx]);
      return;
    }

    const q = inputValue.trim();
    if (!q) return;

    // Exact match check (case-insensitive)
    try {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as TagSummary[];
      const exact = data.find(
        (t) => t.name.toLowerCase() === capitalizeTag(q).toLowerCase()
      );
      if (exact) {
        const alreadyAssigned = assignments.some((a) => a.tagId === exact.id);
        if (!alreadyAssigned) {
          assignTag(exact);
        }
        setInputValue("");
        setShowDropdown(false);
        return;
      }
    } catch (err) {
      console.error("Tag lookup error:", err);
    }

    // No match — open new tag dialog
    setNewTagName(q);
    setShowNewTagDialog(true);
    setShowDropdown(false);
    setInputValue("");
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEnter();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  // ── Remove tag ─────────────────────────────────────────────────────────────
  async function handleConfirmRemove(assignment: Assignment) {
    setRemovingAssignment(null);
    try {
      await fetch("/api/tags/assign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagId: assignment.tagId,
          entityType,
          entityId,
          requestedBy: currentUser,
        }),
      });
      const updated = assignments.filter((a) => a.tagId !== assignment.tagId);
      setAssignments(updated);
      onAssignmentsChange?.(updated);
    } catch (err) {
      console.error("Remove tag error:", err);
    }
  }

  // ── New tag created callback ───────────────────────────────────────────────
  function handleTagCreated(assignment: Assignment) {
    const updated = [...assignments, assignment];
    setAssignments(updated);
    onAssignmentsChange?.(updated);
    setShowNewTagDialog(false);
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (!canEdit) {
    // Non-owner / read-only view
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {assignments.map((a) => (
          <TagPill key={a.tagId} assignment={a} showRemove={false} onRemoveClick={() => {}} />
        ))}
        <div className="relative inline-block">
          <span
            className="cursor-default text-zinc-500 hover:text-zinc-300 transition-colors"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label="Only the owner or Admin can edit tags"
          >
            🔒
          </span>
          {showTooltip && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 shadow-lg border border-zinc-700 pointer-events-none z-10">
              Only the owner or Admin can edit tags
            </div>
          )}
        </div>
      </div>
    );
  }

  // Owner / editable view
  return (
    <div ref={containerRef} className="relative">
      {/* Pills row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {assignments.map((a) => (
          <div key={a.tagId} className="relative">
            <TagPill
              assignment={a}
              showRemove
              onRemoveClick={(assignment) => {
                setRemovingAssignment(
                  removingAssignment?.tagId === assignment.tagId ? null : assignment
                );
              }}
            />
            {removingAssignment?.tagId === a.tagId && (
              <RemovalPopover
                assignment={a}
                entityLabel={entityLabel}
                onConfirm={() => handleConfirmRemove(a)}
                onCancel={() => setRemovingAssignment(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue && setShowDropdown(suggestions.length > 0)}
          placeholder="Add tag…"
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
        />

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-40 mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
            {suggestions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-500 italic">
                No existing tags match — press Enter to create
              </div>
            ) : (
              suggestions.map((tag, idx) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => assignTag(tag)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    idx === highlightedIdx
                      ? "bg-indigo-700/40 text-white"
                      : "text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  {/* Color swatch */}
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1">{tag.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      tag.type === "PROJECT"
                        ? "bg-emerald-900/50 text-emerald-300"
                        : "bg-zinc-700 text-zinc-400"
                    }`}
                  >
                    {tag.type}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* New tag dialog */}
      {showNewTagDialog && (
        <NewTagDialog
          initialName={newTagName}
          entityType={entityType}
          entityId={entityId}
          currentUser={currentUser}
          onCreated={handleTagCreated}
          onCancel={() => setShowNewTagDialog(false)}
        />
      )}
    </div>
  );
}
