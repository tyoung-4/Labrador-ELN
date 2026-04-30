"use client";

import React, { useState, useEffect, useCallback } from "react";
import CellLineForm from "./CellLineForm";
import AddBatchModal from "./AddBatchModal";
import KebabMenu, { KebabMenuItem, ArchiveConfirm, FlagPrompt } from "./KebabMenu";

interface CellLine {
  id: string;
  name: string;
  species: string | null;
  tissue: string | null;
  morphology: string | null;
  passage: number | null;
  location: string | null;
  owner: string | null;
  notes: string | null;
  tags: string[];
  markedForArchive: boolean;
  useParentThreshold: boolean;
  _count: { researchNotes: number };
}

interface CellLinePassage {
  id: string;
  passage: number | null;
  vialCount: number | null;
  freezeBackDate: string | null;
  frozenBy: string | null;
  storageLocation: string | null;
  notes: string | null;
  lowThresholdType: string | null;
  lowThresholdAmber: number | null;
  lowThresholdRed: number | null;
  createdBy: string | null;
  createdAt: string;
  attachments: { id: string }[];
}

// ── Per-card sub-component ────────────────────────────────────────────────────

function CellLineCard({
  item,
  currentUser,
  expanded,
  passages,
  onToggle,
  onEdit,
  onReload,
  onAddBatch,
}: {
  item: CellLine;
  currentUser: string;
  expanded: boolean;
  passages: CellLinePassage[];
  onToggle: () => void;
  onEdit: () => void;
  onReload: () => void;
  onAddBatch: () => void;
}) {
  const isOwner = currentUser === item.owner || currentUser === "Admin";
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [flagging,       setFlagging]       = useState(false);
  const [toast,          setToast]          = useState("");

  const handleArchive = async () => {
    await fetch("/api/inventory/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-name": currentUser },
      body: JSON.stringify({ entityType: "cell_line", entityId: item.id }),
    });
    setConfirmArchive(false);
    onReload();
  };

  const handleFlag = async (note: string) => {
    await fetch("/api/inventory/mark-for-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-name": currentUser },
      body: JSON.stringify({ entityType: "cell_line", entityId: item.id, note: note || undefined }),
    });
    setFlagging(false);
    setToast("Flagged for archive");
    setTimeout(() => setToast(""), 3000);
    onReload();
  };

  return (
    <div className={`bg-white/5 border rounded-xl overflow-hidden ${item.markedForArchive ? "border-orange-500/40" : "border-white/10"}`}>
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-white/5"
        onClick={onToggle}
      >
        <span className="text-white font-semibold flex-1">
          {item.name}
          {item.markedForArchive && (
            <span className="ml-2 text-orange-400/70 text-xs font-normal">⚑ flagged</span>
          )}
        </span>

        {/* Summary metadata */}
        <div className="flex items-center gap-2 text-white/40 text-xs">
          {item.species && <span>{item.species}</span>}
          {item.passage !== null && <span>P{item.passage}</span>}
          {item.location && <span>&#x1F4CD; {item.location}</span>}
        </div>

        {/* + Passage */}
        <button
          onClick={(e) => { e.stopPropagation(); onAddBatch(); }}
          className="rounded border border-white/20 bg-white/5 hover:bg-white/15 px-2 py-0.5 text-white/60 hover:text-white text-xs transition-colors flex-shrink-0"
        >
          + Passage
        </button>

        {/* Kebab */}
        <KebabMenu>
          {isOwner ? (
            <>
              <KebabMenuItem onClick={onEdit}>Edit</KebabMenuItem>
              <KebabMenuItem
                onClick={() => setConfirmArchive(true)}
                className="text-amber-400/70 hover:text-amber-400"
              >
                Archive
              </KebabMenuItem>
            </>
          ) : item.markedForArchive ? (
            <span className="px-3 py-1.5 text-sm text-orange-400/40 block">⚑ Already flagged</span>
          ) : (
            <KebabMenuItem
              onClick={() => setFlagging(true)}
              className="text-orange-400/70 hover:text-orange-400"
            >
              Flag for Archive
            </KebabMenuItem>
          )}
        </KebabMenu>

        {/* Expand chevron */}
        <span className="text-white/30 text-xs flex-shrink-0">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Inline archive confirm */}
      {confirmArchive && (
        <div className="px-4">
          <ArchiveConfirm
            name={item.name}
            onConfirm={handleArchive}
            onCancel={() => setConfirmArchive(false)}
          />
        </div>
      )}

      {/* Inline flag prompt */}
      {flagging && (
        <div className="px-4">
          <FlagPrompt
            name={item.name}
            onSubmit={handleFlag}
            onCancel={() => setFlagging(false)}
          />
        </div>
      )}

      {toast && <p className="px-4 pb-2 text-green-400/80 text-xs">{toast}</p>}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/10 px-4 py-3 space-y-1 text-xs text-white/50">
          {item.tissue     && <p>Tissue: {item.tissue}</p>}
          {item.morphology && <p>Morphology: {item.morphology}</p>}
          {item.owner      && <p>Owner: {item.owner}</p>}
          {item.notes      && <p className="whitespace-pre-wrap">{item.notes}</p>}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.tags.map((t) => (
                <span key={t} className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}

          {/* ── Passages ── */}
          {passages.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-white/30 uppercase tracking-wide text-[10px] font-semibold mb-1">Passages ({passages.length})</p>
              {passages.map((p) => (
                <div key={p.id} className="rounded bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/60 space-y-0.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    {p.passage    != null && <span className="font-medium text-white/80">P{p.passage}</span>}
                    {p.vialCount  != null && <span>{p.vialCount} vials</span>}
                    {p.freezeBackDate     && <span>Frozen {new Date(p.freezeBackDate).toLocaleDateString()}</span>}
                    {p.storageLocation    && <span>📍 {p.storageLocation}</span>}
                    {p.attachments.length > 0 && (
                      <span className="text-white/30">📎 {p.attachments.length}</span>
                    )}
                    {p.lowThresholdAmber != null && (
                      <span className="text-amber-400/70">⚠️ ≤{p.lowThresholdAmber}</span>
                    )}
                  </div>
                  {p.frozenBy  && <p className="text-white/30">Frozen by: {p.frozenBy}</p>}
                  {p.notes     && <p className="whitespace-pre-wrap">{p.notes}</p>}
                  <p className="text-white/20">Added {new Date(p.createdAt).toLocaleDateString()}{p.createdBy ? ` by ${p.createdBy}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Parent list component ─────────────────────────────────────────────────────

export default function CellLinesList({ search, currentUser, refetchTrigger }: { search: string; currentUser: string; refetchTrigger?: number }) {
  const [items,          setItems]          = useState<CellLine[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [expandedIds,    setExpandedIds]    = useState<Set<string>>(new Set());
  const [editingItem,    setEditingItem]    = useState<CellLine | null>(null);
  const [addBatchItemId, setAddBatchItemId] = useState<string | null>(null);
  const [passagesMap,    setPassagesMap]    = useState<Record<string, CellLinePassage[]>>({});
  const [loadedIds,      setLoadedIds]      = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/celllines?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch { /* leave as-is */ } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load, refetchTrigger]);

  async function loadPassages(id: string) {
    if (loadedIds.has(id)) return;
    try {
      const res = await fetch(`/api/inventory/celllines/${id}/passages`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPassagesMap((prev) => ({ ...prev, [id]: data }));
        setLoadedIds((prev) => new Set([...prev, id]));
      }
    } catch { /* ignore */ }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); loadPassages(id); }
      return n;
    });
  }

  const addBatchItem = addBatchItemId ? items.find((i) => i.id === addBatchItemId) : null;

  if (loading) return <div className="text-white/40 text-sm py-8 text-center">Loading…</div>;
  if (!items.length) return <div className="text-white/40 text-sm py-12 text-center">No cell lines yet.</div>;

  return (
    <>
      <div className="space-y-2">
        {items.map((item) => (
          <CellLineCard
            key={item.id}
            item={item}
            currentUser={currentUser}
            expanded={expandedIds.has(item.id)}
            passages={passagesMap[item.id] ?? []}
            onToggle={() => toggleExpand(item.id)}
            onEdit={() => setEditingItem(item)}
            onReload={load}
            onAddBatch={() => setAddBatchItemId(item.id)}
          />
        ))}
      </div>

      {/* Add Passage modal */}
      {addBatchItem && (
        <AddBatchModal
          itemType="cellline"
          itemId={addBatchItem.id}
          itemName={addBatchItem.name}
          currentUser={currentUser}
          useParentThreshold={addBatchItem.useParentThreshold ?? true}
          onSuccess={(passage) => {
            setPassagesMap((prev) => ({
              ...prev,
              [addBatchItem.id]: [passage, ...(prev[addBatchItem.id] ?? [])],
            }));
            setAddBatchItemId(null);
          }}
          onClose={() => setAddBatchItemId(null)}
        />
      )}

      {/* Edit cell line modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-white font-bold">Edit Cell Line</h2>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <CellLineForm
                currentUser={currentUser}
                existing={editingItem}
                allCellLines={[]}
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
