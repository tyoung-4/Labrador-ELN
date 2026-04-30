"use client";

import React, { useState } from "react";

type CellLineFormProps = {
  currentUser: string;
  existing?: any;
  allCellLines: Array<{ id: string; name: string }>;
  availableRuns: Array<{ id: string; title: string; runId: string }>;
  onSuccess: (cellLine: any) => void;
  onCancel: () => void;
};

export default function CellLineForm({
  currentUser,
  existing,
  allCellLines,
  availableRuns,
  onSuccess,
  onCancel,
}: CellLineFormProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [species, setSpecies] = useState(existing?.species ?? "");
  const [tissue, setTissue] = useState(existing?.tissue ?? "");
  const [vialCount, setVialCount] = useState(existing?.vialCount ?? "");
  const [passage, setPassage] = useState(existing?.passage ?? "");
  const [storageLocation, setStorageLocation] = useState(existing?.location ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [useParentThreshold, setUseParentThreshold] = useState(existing?.useParentThreshold ?? true);
  const [linkedRunIds, setLinkedRunIds] = useState<string[]>(existing?.linkedRunIds ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const url = existing ? `/api/inventory/celllines/${existing.id}` : "/api/inventory/celllines";
      const res = await fetch(url, {
        method: existing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": currentUser,
        },
        body: JSON.stringify({
          name: name.trim(),
          species: species.trim() || null,
          tissue: tissue.trim() || null,
          passage: passage ? parseInt(passage) : null,
          location: storageLocation.trim() || null,
          ...(existing ? {} : { owner: currentUser }),
          useParentThreshold,
          notes: notes.trim() || null,
          tags: [],
        }),
      });
      if (!res.ok) throw new Error(existing ? "Failed to update cell line" : "Failed to create cell line");
      const item = await res.json();
      onSuccess(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating cell line");
      setSubmitting(false);
    }
  };

  const toggleRunId = (runId: string) => {
    setLinkedRunIds((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]
    );
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Species */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Species
        </label>
        <input
          type="text"
          value={species}
          onChange={(e) => setSpecies(e.target.value)}
          placeholder="Human, Mouse, Rat..."
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Tissue */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Tissue
        </label>
        <input
          type="text"
          value={tissue}
          onChange={(e) => setTissue(e.target.value)}
          placeholder="HEK293T, Jurkat, CHO..."
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Vial Count & Passage */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            Vial Count
          </label>
          <input
            type="number"
            value={vialCount}
            onChange={(e) => setVialCount(e.target.value)}
            min="0"
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            Passage
          </label>
          <input
            type="number"
            value={passage}
            onChange={(e) => setPassage(e.target.value)}
            min="0"
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        </div>
      </div>

      {/* Storage Location */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Storage Location
        </label>
        <input
          type="text"
          value={storageLocation}
          onChange={(e) => setStorageLocation(e.target.value)}
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Linked Runs */}
      {availableRuns.length > 0 && (
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            Linked Runs
          </label>
          <div className="space-y-1 max-h-32 overflow-y-auto rounded bg-white/5 border border-white/10 p-2">
            {availableRuns.map((run) => (
              <label key={run.id} className="flex items-center gap-2 text-sm text-white cursor-pointer hover:text-white/80">
                <input
                  type="checkbox"
                  checked={linkedRunIds.includes(run.id)}
                  onChange={() => toggleRunId(run.id)}
                  className="rounded"
                />
                <span>{run.title} ({run.runId})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Threshold mode — owner/Admin only, edit mode only */}
      {existing && (
        <div className="flex items-center gap-2">
          <input
            id="cellUseParentThreshold"
            type="checkbox"
            checked={useParentThreshold}
            onChange={(e) => setUseParentThreshold(e.target.checked)}
            className="rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500"
          />
          <label htmlFor="cellUseParentThreshold" className="text-sm text-white/70 cursor-pointer">
            Use item-level low stock threshold
          </label>
          {!useParentThreshold && (
            <span className="text-xs text-white/30">— each passage can set its own</span>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-2 border-t border-white/10 mt-4">
        <button
          onClick={onCancel}
          className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || submitting}
          className={`text-sm rounded px-4 py-2 font-medium transition-colors ${
            !name.trim() || submitting
              ? "bg-purple-600/40 text-white/40 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700 text-white"
          }`}
        >
          {submitting ? "Saving..." : existing ? "Save Changes" : "Add Cell Line"}
        </button>
      </div>
    </div>
  );
}
