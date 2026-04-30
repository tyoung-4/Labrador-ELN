"use client";

import React, { useState, useEffect, useCallback } from "react";
import ArchiveButton from "./ArchiveButton";
import MarkForArchiveButton from "./MarkForArchiveButton";
import PlasmidForm from "./PlasmidForm";
import AddBatchModal from "./AddBatchModal";

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
  useParentThreshold: boolean;
  _count: { researchNotes: number };
}

interface PlasmidPrep {
  id: string;
  prepDate: string | null;
  prepType: string | null;
  concentration: number | null;
  volume: number | null;
  preparedBy: string | null;
  sequenceVerified: boolean;
  notes: string | null;
  lowThresholdType: string | null;
  lowThresholdAmber: number | null;
  lowThresholdRed: number | null;
  createdBy: string | null;
  createdAt: string;
  attachments: { id: string }[];
}

export default function PlasmidsList({ search, currentUser, refetchTrigger }: { search: string; currentUser: string; refetchTrigger?: number }) {
  const [items,          setItems]          = useState<Plasmid[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [expandedIds,    setExpandedIds]    = useState<Set<string>>(new Set());
  const [editingItem,    setEditingItem]    = useState<Plasmid | null>(null);
  const [addBatchItemId, setAddBatchItemId] = useState<string | null>(null);
  const [prepsMap,       setPrepsMap]       = useState<Record<string, PlasmidPrep[]>>({});
  const [loadedIds,      setLoadedIds]      = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/plasmids?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch { /* leave as-is */ } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load, refetchTrigger]);

  async function loadPreps(id: string) {
    if (loadedIds.has(id)) return;
    try {
      const res = await fetch(`/api/inventory/plasmids/${id}/preps`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPrepsMap((prev) => ({ ...prev, [id]: data }));
        setLoadedIds((prev) => new Set([...prev, id]));
      }
    } catch { /* ignore */ }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); loadPreps(id); }
      return n;
    });
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this plasmid?")) return;
    await fetch(`/api/inventory/plasmids/${id}`, { method: "DELETE" });
    load();
  };

  const addBatchItem = addBatchItemId ? items.find((i) => i.id === addBatchItemId) : null;

  if (loading) return <div className="text-white/40 text-sm py-8 text-center">Loading…</div>;
  if (!items.length) return <div className="text-white/40 text-sm py-12 text-center">No plasmids yet.</div>;

  return (
    <>
      <div className="space-y-2">
        {items.map((item) => {
          const expanded = expandedIds.has(item.id);
          const preps = prepsMap[item.id] ?? [];
          return (
            <div
              key={item.id}
              className={`bg-white/5 border rounded-xl overflow-hidden ${item.markedForArchive ? "border-orange-500/40" : "border-white/10"}`}
            >
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5"
                onClick={() => toggleExpand(item.id)}
              >
                <span className="text-white font-semibold flex-1">
                  {item.name}
                  {item.markedForArchive && (
                    <span className="ml-2 text-orange-400/70 text-xs font-normal">⚑ flagged</span>
                  )}
                </span>
                <div className="flex items-center gap-2 text-white/40 text-xs">
                  {item.backbone   && <span>{item.backbone}</span>}
                  {item.resistance && <span className="bg-white/10 px-2 py-0.5 rounded-full">{item.resistance}</span>}
                  {item.location   && <span>&#x1F4CD; {item.location}</span>}
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddBatchItemId(item.id); }}
                    className="rounded border border-white/20 bg-white/5 hover:bg-white/15 px-2 py-0.5 text-white/60 hover:text-white transition-colors"
                  >
                    + Prep
                  </button>
                  <span>{expanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-white/10 px-4 py-3 space-y-1 text-xs text-white/50">
                  {item.insert   && <p>Insert: {item.insert}</p>}
                  {item.promoter && <p>Promoter: {item.promoter}</p>}
                  {item.owner    && <p>Owner: {item.owner}</p>}
                  {item.notes    && <p className="whitespace-pre-wrap">{item.notes}</p>}
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.tags.map((t) => <span key={t} className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">{t}</span>)}
                    </div>
                  )}

                  {/* ── Preps ── */}
                  {preps.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-white/30 uppercase tracking-wide text-[10px] font-semibold mb-1">Preps ({preps.length})</p>
                      {preps.map((p) => (
                        <div key={p.id} className="rounded bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/60 space-y-0.5">
                          <div className="flex items-center gap-3 flex-wrap">
                            {p.prepType       && <span className="font-medium text-white/80">{p.prepType}</span>}
                            {p.prepDate       && <span>{new Date(p.prepDate).toLocaleDateString()}</span>}
                            {p.concentration != null && <span>{p.concentration} ng/µL</span>}
                            {p.volume        != null && <span>{p.volume} µL</span>}
                            {p.sequenceVerified      && <span className="text-green-400/70">✓ seq verified</span>}
                            {p.attachments.length > 0 && (
                              <span className="text-white/30">📎 {p.attachments.length}</span>
                            )}
                          </div>
                          {p.preparedBy && <p className="text-white/30">Prepared by: {p.preparedBy}</p>}
                          {p.notes      && <p className="whitespace-pre-wrap">{p.notes}</p>}
                          <p className="text-white/20">Added {new Date(p.createdAt).toLocaleDateString()}{p.createdBy ? ` by ${p.createdBy}` : ""}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    {(currentUser === item.owner || currentUser === "Admin") && (
                      <button
                        onClick={() => setEditingItem(item)}
                        className="text-xs text-gray-400 hover:text-white border border-white/10 rounded px-2 py-1 transition-colors"
                      >Edit</button>
                    )}
                    <MarkForArchiveButton
                      entityType="plasmid" entityId={item.id} entityName={item.name}
                      currentUser={currentUser} alreadyMarked={item.markedForArchive} onMarked={load}
                    />
                    <ArchiveButton
                      entityType="plasmid" entityId={item.id} entityName={item.name}
                      currentUser={currentUser} onArchived={load}
                    />
                    <button onClick={() => handleDelete(item.id)} className="text-red-400/60 hover:text-red-400 transition-colors">Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Prep modal */}
      {addBatchItem && (
        <AddBatchModal
          itemType="plasmid"
          itemId={addBatchItem.id}
          itemName={addBatchItem.name}
          currentUser={currentUser}
          useParentThreshold={addBatchItem.useParentThreshold ?? true}
          onSuccess={(prep) => {
            setPrepsMap((prev) => ({
              ...prev,
              [addBatchItem.id]: [prep, ...(prev[addBatchItem.id] ?? [])],
            }));
            setAddBatchItemId(null);
          }}
          onClose={() => setAddBatchItemId(null)}
        />
      )}

      {/* Edit plasmid modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-white font-bold">Edit Plasmid</h2>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <PlasmidForm
                currentUser={currentUser}
                existing={editingItem}
                availableRuns={[]}
                onSuccess={() => { setEditingItem(null); load(); }}
                onCancel={() => setEditingItem(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
