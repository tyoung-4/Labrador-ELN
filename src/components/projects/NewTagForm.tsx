"use client";

import { useEffect, useState } from "react";
import { capitalizeTag } from "@/utils/capitalizeTag";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#1e293b",
];

type NewTagFormProps = {
  currentUser: string;
  onSuccess: (tag: unknown) => void;
  onCancel: () => void;
};

export default function NewTagForm({ currentUser, onSuccess, onCancel }: NewTagFormProps) {
  const [name,        setName]        = useState("");
  const [color,       setColor]       = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState("");
  const [nameError,   setNameError]   = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounced live uniqueness check
  useEffect(() => {
    if (!name.trim()) { setNameError(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/tags?q=${encodeURIComponent(name.trim())}`);
        const data = (await res.json()) as Array<{ name: string; type: string }>;
        const exact = data.find(
          (t) => t.name.toLowerCase() === name.trim().toLowerCase()
        );
        if (exact) {
          setNameError(`"${exact.name}" already exists as a ${exact.type === "PROJECT" ? "Project" : "General"} tag`);
        } else {
          setNameError(null);
        }
      } catch {
        setNameError(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [name]);

  async function handleSubmit() {
    if (!name.trim() || !color || nameError || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        name.trim(),
          type:        "GENERAL",
          color,
          description: description.trim() || undefined,
          createdBy:   currentUser,
        }),
      });
      const data = (await res.json()) as { exists?: boolean; tag?: { type: string }; error?: string };
      if (res.ok && !data.exists) {
        onSuccess(data);
      } else if (data.exists) {
        setNameError(`"${name.trim()}" already exists as a ${data.tag?.type === "PROJECT" ? "Project" : "General"} tag`);
      } else {
        setError(data.error ?? "Failed to create tag");
      }
    } catch {
      setError("Network error — please try again");
    }
    setIsSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Tag Name */}
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
          Tag Name *
        </label>
        <input
          type="text"
          autoFocus
          placeholder="e.g. CD38, Optimization, In-Vivo"
          value={name}
          onChange={(e) => setName(capitalizeTag(e.target.value))}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
        />
        {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
      </div>

      {/* Color */}
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
          Color *
        </label>
        <div className="mb-2 flex flex-wrap gap-2">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              onClick={() => setColor(preset)}
              className={`h-7 w-7 rounded-full border-2 transition-all ${
                color === preset ? "scale-110 border-white" : "border-transparent"
              }`}
              style={{ backgroundColor: preset }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Custom:</span>
          <input
            type="text"
            placeholder="#hex"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-24 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
          />
          {color && (
            <div
              className="h-5 w-5 rounded-full border border-white/20"
              style={{ backgroundColor: color }}
            />
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
          Description{" "}
          <span className="normal-case text-gray-600">(optional)</span>
        </label>
        <textarea
          placeholder="Brief description of this tag..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full resize-none rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-white/10 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-400 transition-colors hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !color || !!nameError || isSubmitting}
          className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? "Creating…" : "Create Tag"}
        </button>
      </div>

    </div>
  );
}
