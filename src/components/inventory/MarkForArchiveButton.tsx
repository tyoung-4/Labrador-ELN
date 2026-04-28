"use client";

import React, { useState } from "react";

type EntityType = "reagent" | "cell_line" | "plasmid" | "protein_stock";
type Stage = "idle" | "confirm" | "busy" | "done";

interface Props {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  currentUser: string;
  alreadyMarked?: boolean;
  onMarked: () => void;
}

export default function MarkForArchiveButton({ entityType, entityId, entityName, currentUser, alreadyMarked, onMarked }: Props) {
  const [stage, setStage] = useState<Stage>(alreadyMarked ? "done" : "idle");
  const [note, setNote] = useState("");

  if (alreadyMarked && stage === "idle") {
    return (
      <span className="text-orange-400/60 text-xs">⚑ Flagged for archive</span>
    );
  }

  if (stage === "done") {
    return (
      <span className="text-orange-400/60 text-xs">⚑ Flagged for archive</span>
    );
  }

  if (stage === "idle") {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setStage("confirm"); }}
        className="text-orange-400/60 hover:text-orange-400 transition-colors text-xs"
      >
        ⚑ Flag for archive
      </button>
    );
  }

  if (stage === "confirm") {
    return (
      <div className="mt-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
        <p className="text-orange-300 text-xs font-semibold">Flag &ldquo;{entityName}&rdquo; for archive?</p>
        <p className="text-white/50 text-xs">
          All lab members will receive a notification and the item will be highlighted as pending review.
        </p>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs placeholder-white/30 outline-none focus:border-orange-400/50"
        />
        <div className="flex gap-2">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              setStage("busy");
              try {
                await fetch("/api/inventory/mark-for-archive", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-user-name": currentUser },
                  body: JSON.stringify({ entityType, entityId, note: note.trim() || undefined }),
                });
                setStage("done");
                onMarked();
              } catch {
                setStage("confirm");
              }
            }}
            className="bg-orange-500 hover:bg-orange-400 text-black text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
          >
            Flag for Archive
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setStage("idle"); setNote(""); }}
            className="text-white/40 hover:text-white/70 text-xs px-2 py-1 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // busy
  return <span className="text-orange-400/40 text-xs">Flagging…</span>;
}
