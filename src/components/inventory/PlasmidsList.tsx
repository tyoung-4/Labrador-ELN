"use client";

import React, { useState, useEffect, useCallback } from "react";
import ArchiveButton from "./ArchiveButton";
import MarkForArchiveButton from "./MarkForArchiveButton";
import PlasmidForm from "./PlasmidForm";

interface Plasmid {
  id: string;
  name: string;
  backbone: string | null;
  insert: string | null;
  resistance: string | null;
  promoter: string | null;
  location: string | null;
  owner: string | null;
  notes: string | null;
  tags: string[];
  markedForArchive: boolean;
  _count: { researchNotes: number };
}

export default function PlasmidsList({ search, currentUser, refetchTrigger }: { search: string; currentUser: string; refetchTrigger?: number }) {
  const [items, setItems] = useState<Plasmid[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<Plasmid | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/plasmids?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch {
      // leave items as-is on error
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load, refetchTrigger]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this plasmid?")) return;
    await fetch(`/api/inventory/plasmids/${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="text-white/40 text-sm py-8 text-center">Loading…</div>;
  if (!items.length) return <div className="text-white/40 text-sm py-12 text-center">No plasmids yet.</div>;

  return (
    <>
    <div className="space-y-2">
      {items.map((item) => {
        const expanded = expandedIds.has(item.id);
        return (
          <div
            key={item.id}
            className={`bg-white/5 border rounded-xl overflow-hidden ${item.markedForArchive ? "border-orange-500/40" : "border-white/10"}`}
          >
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5"
              onClick={() => setExpandedIds((prev) => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })}
            >
              <span className="text-white font-semibold flex-1">
                {item.name}
                {item.markedForArchive && (
                  <span className="ml-2 text-orange-400/70 text-xs font-normal">⚑ flagged</span>
                )}
              </span>
              <div className="flex items-center gap-2 text-white/40 text-xs">
                {item.backbone && <span>{item.backbone}</span>}
                {item.resistance && <span className="bg-white/10 px-2 py-0.5 rounded-full">{item.resistance}</span>}
                {item.location && <span>&#x1F4CD; {item.location}</span>}
                <span>{expanded ? "▲" : "▼"}</span>
              </div>
            </div>
            {expanded && (
              <div className="border-t border-white/10 px-4 py-3 space-y-1 text-xs text-white/50">
                {item.insert && <p>Insert: {item.insert}</p>}
                {item.promoter && <p>Promoter: {item.promoter}</p>}
                {item.owner && <p>Owner: {item.owner}</p>}
                {item.notes && <p className="whitespace-pre-wrap">{item.notes}</p>}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.tags.map((t) => <span key={t} className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">{t}</span>)}
                  </div>
                )}
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  {(currentUser === item.owner || currentUser === "Admin") && (
                    <button
                      onClick={() => setEditingItem(item)}
                      className="text-xs text-gray-400 hover:text-white border border-white/10 rounded px-2 py-1 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  <MarkForArchiveButton
                    entityType="plasmid"
                    entityId={item.id}
                    entityName={item.name}
                    currentUser={currentUser}
                    alreadyMarked={item.markedForArchive}
                    onMarked={load}
                  />
                  <ArchiveButton
                    entityType="plasmid"
                    entityId={item.id}
                    entityName={item.name}
                    currentUser={currentUser}
                    onArchived={load}
                  />
                  <button onClick={() => handleDelete(item.id)} className="text-red-400/60 hover:text-red-400 transition-colors">Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>

      {/* Edit plasmid modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-white font-bold">Edit Plasmid</h2>
              <button
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <PlasmidForm
                currentUser={currentUser}
                existing={editingItem}
                availableRuns={[]}
                onSuccess={() => {
                  setEditingItem(null);
                  load();
                }}
                onCancel={() => setEditingItem(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
