"use client";

import React, { useState } from "react";

type PlasmidFormProps = {
  currentUser: string;
  existing?: any;
  availableRuns: Array<{ id: string; title: string; runId: string }>;
  onSuccess: (plasmid: any) => void;
  onCancel: () => void;
};

export default function PlasmidForm({
  currentUser,
  existing,
  availableRuns,
  onSuccess,
  onCancel,
}: PlasmidFormProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [resistance, setResistance] = useState(existing?.resistance ?? "");
  const [backbone, setBackbone] = useState(existing?.backbone ?? "");
  const [insert, setInsert] = useState(existing?.insert ?? "");
  const [hostOrganism, setHostOrganism] = useState(existing?.hostOrganism ?? "");
  const [linkedRunIds, setLinkedRunIds] = useState<string[]>(existing?.linkedRunIds ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const url = existing ? `/api/inventory/plasmids/${existing.id}` : "/api/inventory/plasmids";
      const res = await fetch(url, {
        method: existing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": currentUser,
        },
        body: JSON.stringify({
          name: name.trim(),
          resistance: resistance.trim() || null,
          backbone: backbone.trim() || null,
          insert: insert.trim() || null,
          promoter: hostOrganism.trim() || null,
          location: null,
          ...(existing ? {} : { owner: currentUser }),
          notes: notes.trim() || null,
          tags: [],
        }),
      });
      if (!res.ok) throw new Error(existing ? "Failed to update plasmid" : "Failed to create plasmid");
      const item = await res.json();
      onSuccess(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating plasmid");
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
          placeholder="e.g. pET28a-CD38-His6"
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Resistance */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Resistance Marker
        </label>
        <input
          type="text"
          value={resistance}
          onChange={(e) => setResistance(e.target.value)}
          placeholder="Ampicillin, Kanamycin..."
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Backbone & Insert */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            Backbone
          </label>
          <input
            type="text"
            value={backbone}
            onChange={(e) => setBackbone(e.target.value)}
            placeholder="pET28a, pcDNA3.1..."
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            Insert
          </label>
          <input
            type="text"
            value={insert}
            onChange={(e) => setInsert(e.target.value)}
            placeholder="CD38-His6, GFP..."
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        </div>
      </div>

      {/* Host Organism */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Host Organism
        </label>
        <input
          type="text"
          value={hostOrganism}
          onChange={(e) => setHostOrganism(e.target.value)}
          placeholder="E. coli DH5α, HEK293T..."
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

      {/* Attachment note */}
      <p className="text-xs text-gray-500 italic">
        Save the plasmid first to attach SnapGene files (.dna, .gb, .gbk).
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
          {submitting ? "Saving..." : existing ? "Save Changes" : "Add Plasmid"}
        </button>
      </div>
    </div>
  );
}
