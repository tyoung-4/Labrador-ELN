"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { capitalizeTag } from "@/utils/capitalizeTag";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tag {
  id: string;
  name: string;
  type: string;
  color: string;
  createdBy: string;
  createdAt: string;
  description?: string | null;
  startDate?: string | null;
}

interface MemberUser {
  id: string;
  name: string | null;
}

export interface NewProjectFormProps {
  currentUser: string;
  onSuccess: (newTag: Tag) => void;
  onCancel: () => void;
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

export default function NewProjectForm({
  currentUser,
  onSuccess,
  onCancel,
}: NewProjectFormProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [hexInput, setHexInput] = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [availableMembers, setAvailableMembers] = useState<MemberUser[]>([]);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [nameConflict, setNameConflict] = useState<string | null>(null);
  const [nameChecking, setNameChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load available members on mount
  useEffect(() => {
    fetch("/api/projects/members")
      .then((r) => r.json())
      .then((users: MemberUser[]) => {
        setAvailableMembers(users);
        // Find the owner's DB userId (match by name)
        const owner = users.find(
          (u) => u.name?.toLowerCase() === currentUser.toLowerCase()
        );
        if (owner) {
          setOwnerUserId(owner.id);
          setSelectedMemberIds([owner.id]);
        }
      })
      .catch(console.error);
  }, [currentUser]);

  // Debounced name uniqueness check
  const checkNameUniqueness = useCallback((val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setNameConflict(null);
      setNameChecking(false);
      return;
    }
    setNameChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tags?q=${encodeURIComponent(val.trim())}`);
        const tags = (await res.json()) as Array<{ name: string; type: string }>;
        const conflict = tags.find(
          (t) => t.name.toLowerCase() === val.trim().toLowerCase()
        );
        if (conflict) {
          const typeLabel = conflict.type === "PROJECT" ? "Project" : "General";
          setNameConflict(
            `A tag named "${conflict.name}" already exists as a ${typeLabel} tag`
          );
        } else {
          setNameConflict(null);
        }
      } catch {
        setNameConflict(null);
      } finally {
        setNameChecking(false);
      }
    }, 300);
  }, []);

  function handleNameChange(val: string) {
    const capitalized = capitalizeTag(val);
    setName(capitalized);
    setSubmitError(null);
    checkNameUniqueness(capitalized);
  }

  function handlePresetSelect(c: string) {
    setColor(c);
    setHexInput(c);
  }

  function handleHexChange(val: string) {
    setHexInput(val);
    if (isValidHex(val)) setColor(val);
  }

  function toggleMember(userId: string) {
    if (userId === ownerUserId) return; // owner always selected
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function handleSubmit() {
    if (!name.trim() || !color || nameConflict || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/projects/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          description: description.trim() || undefined,
          startDate: startDate || undefined,
          memberUserIds: selectedMemberIds,
          createdBy: currentUser,
        }),
      });
      const data = (await res.json()) as { success?: boolean; tag?: Tag; error?: string };
      if (res.ok && data.tag) {
        onSuccess(data.tag);
      } else {
        setSubmitError(data.error ?? "Failed to create project");
      }
    } catch {
      setSubmitError("Network error — please try again");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = name.trim() !== "" && color !== "" && !nameConflict && !nameChecking && !isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-white/10 bg-gray-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <h2 className="mb-5 text-xl font-semibold text-white">New Project</h2>

        {/* ── Project Name ───────────────────────────────────────── */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-300">
            Project Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. CD38 Antibody Characterization"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            disabled={isSubmitting}
          />
          {nameChecking && (
            <p className="mt-1 text-xs text-zinc-500">Checking availability…</p>
          )}
          {nameConflict && !nameChecking && (
            <p className="mt-1 text-xs text-red-400">{nameConflict}</p>
          )}
        </div>

        {/* ── Color ─────────────────────────────────────────────── */}
        <div className="mb-4">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
            Project Color <span className="text-red-400">*</span>
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

        {/* ── Description ───────────────────────────────────────── */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-300">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief overview of this project…"
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            disabled={isSubmitting}
          />
        </div>

        {/* ── Owner (read-only) ─────────────────────────────────── */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-300">Owner</label>
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-400">
            {currentUser}
          </div>
        </div>

        {/* ── Start Date ────────────────────────────────────────── */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-300">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none [color-scheme:dark]"
            disabled={isSubmitting}
          />
          <p className="mt-1 text-xs text-zinc-500">
            Optional. If set, this date is shown as the project start date. The ELN
            creation date is always preserved internally.
          </p>
        </div>

        {/* ── Lab Members ───────────────────────────────────────── */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Lab Members
          </label>
          {availableMembers.length === 0 ? (
            <p className="text-xs text-zinc-500">No users found.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableMembers.map((user) => {
                const isOwner = user.id === ownerUserId;
                const isSelected = selectedMemberIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleMember(user.id)}
                    disabled={isOwner || isSubmitting}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-600/30 text-indigo-200"
                        : "border-zinc-600 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    } ${isOwner ? "cursor-default opacity-80" : "cursor-pointer"}`}
                  >
                    {isSelected && <span className="text-xs">✓</span>}
                    {user.name ?? "Unknown"}
                    {isOwner && (
                      <span className="ml-1 text-[10px] text-indigo-400">(owner)</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Submit error ──────────────────────────────────────── */}
        {submitError && (
          <div className="mb-4 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-300">
            {submitError}
          </div>
        )}

        {/* ── Footer buttons ────────────────────────────────────── */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Creating…" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
