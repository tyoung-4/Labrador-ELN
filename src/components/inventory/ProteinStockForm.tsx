"use client";

import React, { useState } from "react";

type ProteinStockFormProps = {
  currentUser: string;
  existing?: any;
  availablePlasmids: Array<{ id: string; name: string }>;
  onSuccess: (stock: any) => void;
  onCancel: () => void;
};

export default function ProteinStockForm({
  currentUser,
  existing,
  availablePlasmids,
  onSuccess,
  onCancel,
}: ProteinStockFormProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [plasmidId, setPlasmidId] = useState(existing?.plasmidId ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/inventory/proteinstocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": currentUser,
        },
        body: JSON.stringify({
          name: name.trim(),
          owner: currentUser,
          notes: notes.trim() || null,
          tags: [],
        }),
      });
      if (!res.ok) throw new Error("Failed to create protein stock");
      const item = await res.json();
      onSuccess(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating protein stock");
      setSubmitting(false);
    }
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
          placeholder="e.g. CD38-His6, EGFR-Fc"
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Plasmid Selection */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Source Plasmid
        </label>
        <select
          value={plasmidId}
          onChange={(e) => setPlasmidId(e.target.value)}
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30"
        >
          <option value="">None</option>
          {availablePlasmids.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

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

      {/* Info note */}
      <p className="text-xs text-gray-500 italic mt-2">
        After creating the protein stock, open it to add purification batches
        with volume, concentration, and storage location.
      </p>

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
          {submitting ? "Adding..." : "Add Protein Stock"}
        </button>
      </div>
    </div>
  );
}
