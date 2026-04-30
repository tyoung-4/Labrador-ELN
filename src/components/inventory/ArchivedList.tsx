"use client";

import React, { useState, useEffect, useCallback } from "react";

type EntityType = "reagent" | "cell_line" | "plasmid" | "protein_stock";

interface ArchivedItem {
  id: string;
  name: string;
  entityType: EntityType;
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
  location: string | null;
  owner: string | null;
  notes: string | null;
  // Optional type-specific fields
  category?: string;
  species?: string | null;
  backbone?: string | null;
  concentration?: number | null;
  concUnit?: string | null;
}

const ENTITY_LABELS: Record<EntityType, string> = {
  reagent: "Reagent",
  cell_line: "Cell Line",
  plasmid: "Plasmid",
  protein_stock: "Protein Stock",
};

const ENTITY_COLORS: Record<EntityType, string> = {
  reagent: "text-teal-400",
  cell_line: "text-purple-400",
  plasmid: "text-blue-400",
  protein_stock: "text-pink-400",
};

const ENTITY_ROUTES: Record<EntityType, string> = {
  reagent: "reagents",
  cell_line: "celllines",
  plasmid: "plasmids",
  protein_stock: "proteinstocks",
};

function ArchivedItemCard({
  item,
  currentUser,
  onRestored,
  onDeleted,
}: {
  item: ArchivedItem;
  currentUser: string;
  onRestored: () => void;
  onDeleted: () => void;
}) {
  const [expanded,    setExpanded]    = useState(false);
  const [restoring,   setRestoring]   = useState(false);
  const [deleteStep,  setDeleteStep]  = useState<0 | 1 | 2>(0);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting,    setDeleting]    = useState(false);

  const isOwner = currentUser === item.owner || currentUser === "Admin";

  const handleRestore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Restore "${item.name}" to the active inventory?`)) return;
    setRestoring(true);
    try {
      await fetch("/api/inventory/unarchive", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify({ entityType: item.entityType, entityId: item.id }),
      });
      onRestored();
    } catch {
      setRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (deleteInput !== "DELETE") return;
    setDeleting(true);
    try {
      await fetch(`/api/inventory/${ENTITY_ROUTES[item.entityType]}/${item.id}`, {
        method: "DELETE",
        headers: { "x-user-name": currentUser },
      });
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  const archivedDate = item.archivedAt
    ? new Date(item.archivedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/80 font-semibold">{item.name}</span>
            <span className={`text-xs font-medium ${ENTITY_COLORS[item.entityType]}`}>
              {ENTITY_LABELS[item.entityType]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-white/30 text-xs flex-wrap">
            {archivedDate && <span>Archived {archivedDate}</span>}
            {item.archivedBy && <span>by {item.archivedBy}</span>}
            {item.location && <span>&#x1F4CD; {item.location}</span>}
          </div>
        </div>
        <span className="text-white/30 text-xs">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="border-t border-white/10 px-4 py-3 space-y-1.5 text-xs text-white/50">
          {item.archiveReason && (
            <p className="text-amber-400/70">Reason: {item.archiveReason}</p>
          )}
          {/* Type-specific detail */}
          {item.entityType === "reagent" && item.category && (
            <p>Category: {item.category}</p>
          )}
          {item.entityType === "cell_line" && item.species && (
            <p>Species: {item.species}</p>
          )}
          {item.entityType === "plasmid" && item.backbone && (
            <p>Backbone: {item.backbone}</p>
          )}
          {item.entityType === "protein_stock" && item.concentration !== null && item.concentration !== undefined && (
            <p>Concentration: {item.concentration.toLocaleString()} {item.concUnit ?? ""}</p>
          )}
          {item.owner && <p>Owner: {item.owner}</p>}
          {item.notes && <p className="whitespace-pre-wrap text-white/40">{item.notes}</p>}

          {/* Actions */}
          <div className="pt-1 space-y-2">
            {/* Restore */}
            <div>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="text-teal-400/70 hover:text-teal-400 transition-colors disabled:opacity-50"
              >
                {restoring ? "Restoring…" : "Restore to inventory"}
              </button>
            </div>

            {/* Delete — owner/Admin only, two-step */}
            {isOwner && deleteStep === 0 && (
              <div>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteStep(1); }}
                  className="text-red-400/50 hover:text-red-400 transition-colors text-xs"
                >
                  Delete permanently
                </button>
              </div>
            )}

            {isOwner && deleteStep === 1 && (
              <div
                className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-red-300 text-xs font-semibold">Permanently delete &ldquo;{item.name}&rdquo;?</p>
                <p className="text-white/50 text-xs">This cannot be undone. The item and all associated data will be permanently removed.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteStep(2)}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                  >
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setDeleteStep(0)}
                    className="text-white/40 hover:text-white/70 text-xs px-2 py-1 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {isOwner && deleteStep === 2 && (
              <div
                className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-red-300 text-xs font-semibold">Type DELETE to confirm</p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                  className="w-full rounded bg-white/5 border border-white/10 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-red-400/50 font-mono"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleteInput !== "DELETE" || deleting}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
                  >
                    {deleting ? "Deleting…" : "Confirm Delete"}
                  </button>
                  <button
                    onClick={() => { setDeleteStep(0); setDeleteInput(""); }}
                    className="text-white/40 hover:text-white/70 text-xs px-2 py-1 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArchivedList({ search, currentUser }: { search: string; currentUser: string }) {
  const [items,      setItems]      = useState<ArchivedItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filterType, setFilterType] = useState<EntityType | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/archived?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch {
      // leave as-is on error
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const filtered = filterType === "all" ? items : items.filter((i) => i.entityType === filterType);

  const typeCounts: Record<string, number> = { all: items.length };
  for (const item of items) {
    typeCounts[item.entityType] = (typeCounts[item.entityType] ?? 0) + 1;
  }

  if (loading) return <div className="text-white/40 text-sm py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Type filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "reagent", "cell_line", "plasmid", "protein_stock"] as const).map((t) => {
          const count = typeCounts[t] ?? 0;
          if (t !== "all" && count === 0) return null;
          const label = t === "all" ? "All" : ENTITY_LABELS[t as EntityType];
          return (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterType === t
                  ? "bg-white/15 text-white"
                  : "text-white/40 hover:text-white/70 bg-white/5"
              }`}
            >
              {label} {count > 0 && <span className="opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-white/30 text-sm py-12 text-center">
          {items.length === 0 ? "No archived items." : "No items match this filter."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <ArchivedItemCard
              key={`${item.entityType}-${item.id}`}
              item={item}
              currentUser={currentUser}
              onRestored={load}
              onDeleted={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
