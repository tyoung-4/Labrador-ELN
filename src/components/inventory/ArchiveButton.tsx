"use client";

import React, { useState } from "react";

type EntityType = "reagent" | "cell_line" | "plasmid" | "protein_stock";
type Stage = "idle" | "warn1" | "warn2" | "busy";

interface Props {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  currentUser: string;
  onArchived: () => void;
}

export default function ArchiveButton({ entityType, entityId, entityName, currentUser, onArchived }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [reason, setReason] = useState("");

  const handleFirstClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStage("warn1");
  };

  const handleConfirmWarn1 = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStage("warn2");
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStage("idle");
    setReason("");
  };

  const handleConfirmArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setStage("busy");
    try {
      await fetch("/api/inventory/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify({ entityType, entityId, reason: reason.trim() || undefined }),
      });
      onArchived();
    } catch {
      setStage("warn2");
    }
  };

  if (stage === "idle") {
    return (
      <button
        onClick={handleFirstClick}
        className="text-amber-400/60 hover:text-amber-400 transition-colors text-xs"
      >
        Archive
      </button>
    );
  }

  if (stage === "warn1") {
    return (
      <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
        <p className="text-amber-300 text-xs font-semibold">Archive &ldquo;{entityName}&rdquo;?</p>
        <p className="text-white/50 text-xs">
          Archived items are hidden from all inventory lists. This action is reversible from the Archived tab.
        </p>
        <div className="flex gap-2">
          <button onClick={handleConfirmWarn1} className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-3 py-1 rounded-lg transition-colors">
            Continue
          </button>
          <button onClick={handleCancel} className="text-white/40 hover:text-white/70 text-xs px-2 py-1 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (stage === "warn2") {
    return (
      <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
        <p className="text-amber-300 text-xs font-semibold">Confirm archive</p>
        <p className="text-white/50 text-xs">
          Are you sure? All other lab members will be notified.
        </p>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs placeholder-white/30 outline-none focus:border-amber-400/50"
        />
        <div className="flex gap-2">
          <button
            onClick={handleConfirmArchive}
            className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
          >
            Archive Now
          </button>
          <button onClick={handleCancel} className="text-white/40 hover:text-white/70 text-xs px-2 py-1 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // busy
  return (
    <span className="text-amber-400/40 text-xs">Archiving…</span>
  );
}
