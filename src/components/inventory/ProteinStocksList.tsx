"use client";

import React, { useState, useEffect, useCallback } from "react";
import ArchiveButton from "./ArchiveButton";
import MarkForArchiveButton from "./MarkForArchiveButton";
import ProteinStockForm from "./ProteinStockForm";
import ProteinBatchForm from "./ProteinBatchForm";

interface ProteinBatch {
  id: string;
  batchId: string;
  purificationDate: string;
  initialVolume: number;
  currentVolume: number;
  concentration: number | null;
  mw: number | null;
  extinctionCoeff: number | null;
  a280: number | null;
  storageBuffer: string | null;
  storageLocationText: string | null;
  lowThresholdType: string | null;
  lowThresholdAmber: number | null;
  lowThresholdRed: number | null;
  notes: string | null;
  createdBy: string | null;
}

interface ProteinStock {
  id: string;
  name: string;
  concentration: number | null;
  concUnit: string | null;
  volume: number | null;
  volUnit: string | null;
  purity: string | null;
  location: string | null;
  owner: string | null;
  notes: string | null;
  tags: string[];
  markedForArchive: boolean;
  useParentThreshold: boolean;
  _count: { researchNotes: number; usageEvents: number };
}

// Per-stock UI state for batch management
interface StockUIState {
  showBatchForm: boolean;
  editingBatch: ProteinBatch | null;
  batches: ProteinBatch[];
  batchesLoaded: boolean;
}

export default function ProteinStocksList({
  search,
  currentUser,
  refetchTrigger,
}: {
  search: string;
  currentUser: string;
  refetchTrigger?: number;
}) {
  const [items, setItems] = useState<ProteinStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<ProteinStock | null>(null);
  const [stockUI, setStockUI] = useState<Record<string, StockUIState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/proteinstocks?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch {
      // leave items as-is on error
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load, refetchTrigger]);

  const loadBatches = useCallback(async (stockId: string) => {
    try {
      const res = await fetch(`/api/inventory/proteinstocks/${stockId}/batches`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setStockUI((prev) => ({
          ...prev,
          [stockId]: {
            ...(prev[stockId] ?? { showBatchForm: false, editingBatch: null }),
            batches: data,
            batchesLoaded: true,
          },
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  const getStockUI = (id: string): StockUIState =>
    stockUI[id] ?? { showBatchForm: false, editingBatch: null, batches: [], batchesLoaded: false };

  const updateStockUI = (id: string, patch: Partial<StockUIState>) => {
    setStockUI((prev) => ({ ...prev, [id]: { ...getStockUI(id), ...patch } }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this protein stock?")) return;
    await fetch(`/api/inventory/proteinstocks/${id}`, { method: "DELETE" });
    load();
  };

  const toggleExpand = (stockId: string) => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(stockId)) {
        n.delete(stockId);
      } else {
        n.add(stockId);
        // Load batches on first expand
        if (!getStockUI(stockId).batchesLoaded) {
          loadBatches(stockId);
        }
      }
      return n;
    });
  };

  const isOwner = (item: ProteinStock) =>
    currentUser === item.owner || currentUser === "Admin";

  if (loading) return <div className="text-white/40 text-sm py-8 text-center">Loading…</div>;
  if (!items.length)
    return <div className="text-white/40 text-sm py-12 text-center">No protein stocks yet.</div>;

  // Group by name
  const groups = new Map<string, ProteinStock[]>();
  for (const r of items) {
    const key = r.name.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <>
      <div className="space-y-3">
        {[...groups.entries()].map(([key, stocks]) => {
          const groupExpanded = stocks.some((s) => expandedIds.has(s.id));
          const anyMarked = stocks.some((s) => s.markedForArchive);
          return (
            <div
              key={key}
              className={`bg-white/5 border rounded-xl overflow-hidden ${
                anyMarked ? "border-orange-500/40" : "border-white/10"
              }`}
            >
              {/* Group header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5"
                onClick={() => {
                  const allExpanded = stocks.every((s) => expandedIds.has(s.id));
                  if (allExpanded) {
                    setExpandedIds((prev) => {
                      const n = new Set(prev);
                      stocks.forEach((s) => n.delete(s.id));
                      return n;
                    });
                  } else {
                    stocks.forEach((s) => {
                      if (!expandedIds.has(s.id)) toggleExpand(s.id);
                    });
                  }
                }}
              >
                <span className="text-white font-semibold flex-1">
                  {stocks[0].name}
                  {anyMarked && (
                    <span className="ml-2 text-orange-400/70 text-xs font-normal">⚑ flagged</span>
                  )}
                </span>
                <span className="text-white/30 text-xs">
                  {stocks.length} stock{stocks.length !== 1 ? "s" : ""}
                </span>
                <span className="text-white/30 text-sm">{groupExpanded ? "▲" : "▼"}</span>
              </div>

              {/* Expanded stocks */}
              {groupExpanded && (
                <div className="border-t border-white/10 divide-y divide-white/5">
                  {stocks.map((item) => {
                    const expanded = expandedIds.has(item.id);
                    const ui = getStockUI(item.id);
                    return (
                      <div key={item.id} className="px-4 py-3">
                        {/* Stock row summary */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 text-xs text-white/60 flex flex-wrap gap-2">
                            {item.concentration !== null && (
                              <span>
                                {item.concentration.toLocaleString()} {item.concUnit ?? ""}
                              </span>
                            )}
                            {item.volume !== null && (
                              <span>
                                {item.volume.toLocaleString()} {item.volUnit ?? ""}
                              </span>
                            )}
                            {item.purity && <span>Purity: {item.purity}</span>}
                            {item.location && <span>&#x1F4CD; {item.location}</span>}
                            {item.markedForArchive && (
                              <span className="text-orange-400/60">⚑ flagged</span>
                            )}
                          </div>
                          {isOwner(item) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStockUI(item.id, { showBatchForm: true });
                              }}
                              className="text-xs rounded bg-white/10 hover:bg-white/20 border border-white/10 text-white px-2 py-1 transition-colors"
                            >
                              + Add Batch
                            </button>
                          )}
                          <button
                            onClick={() => toggleExpand(item.id)}
                            className="text-white/30 hover:text-white/70 text-xs"
                          >
                            {expanded ? "▲ Less" : "▼ More"}
                          </button>
                        </div>

                        {/* Expanded detail */}
                        {expanded && (
                          <div className="mt-2 space-y-2 text-xs text-white/50">
                            {item.owner && <p>Owner: {item.owner}</p>}
                            {item.notes && <p className="whitespace-pre-wrap">{item.notes}</p>}
                            {item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Batch list */}
                            {ui.batches.length > 0 && (
                              <div className="mt-2 space-y-2">
                                <p className="text-white/30 text-xs uppercase tracking-wide">Batches</p>
                                {ui.batches.map((batch) => (
                                  <div
                                    key={batch.id}
                                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 space-y-1"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-white/80 font-mono text-xs">{batch.batchId}</span>
                                      {isOwner(item) && (
                                        <button
                                          onClick={() =>
                                            updateStockUI(item.id, { editingBatch: batch })
                                          }
                                          className="text-xs text-gray-400 hover:text-white border border-white/10 rounded px-2 py-0.5 transition-colors"
                                        >
                                          Edit Batch
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-white/40">
                                      <span>
                                        {new Date(batch.purificationDate).toLocaleDateString()}
                                      </span>
                                      <span>{batch.currentVolume.toLocaleString()} µL remaining</span>
                                      {batch.concentration !== null && (
                                        <span>{batch.concentration} mg/mL</span>
                                      )}
                                      {batch.a280 !== null && (
                                        <span>A280/260: {batch.a280}</span>
                                      )}
                                      {batch.storageBuffer && (
                                        <span className="truncate max-w-xs">{batch.storageBuffer}</span>
                                      )}
                                      {batch.storageLocationText && (
                                        <span>&#x1F4CD; {batch.storageLocationText}</span>
                                      )}
                                    </div>
                                    {batch.notes && (
                                      <p className="text-white/30 text-xs whitespace-pre-wrap">
                                        {batch.notes}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {ui.batchesLoaded && ui.batches.length === 0 && (
                              <p className="text-white/20 text-xs italic">No batches yet.</p>
                            )}

                            <div className="flex items-center gap-4 mt-1 flex-wrap">
                              {isOwner(item) && (
                                <button
                                  onClick={() => setEditingItem(item)}
                                  className="text-xs text-gray-400 hover:text-white border border-white/10 rounded px-2 py-1 transition-colors"
                                >
                                  Edit
                                </button>
                              )}
                              <MarkForArchiveButton
                                entityType="protein_stock"
                                entityId={item.id}
                                entityName={item.name}
                                currentUser={currentUser}
                                alreadyMarked={item.markedForArchive}
                                onMarked={load}
                              />
                              <ArchiveButton
                                entityType="protein_stock"
                                entityId={item.id}
                                entityName={item.name}
                                currentUser={currentUser}
                                onArchived={load}
                              />
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="text-red-400/60 hover:text-red-400 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Add Batch modal */}
                        {ui.showBatchForm && (
                          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                            <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
                              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
                                <h2 className="text-white font-bold">Add Batch — {item.name}</h2>
                                <button
                                  onClick={() => updateStockUI(item.id, { showBatchForm: false })}
                                  className="text-gray-400 hover:text-white text-xl leading-none"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="px-6 py-4 overflow-y-auto flex-1">
                                <ProteinBatchForm
                                  proteinStockId={item.id}
                                  proteinName={item.name}
                                  currentUser={currentUser}
                                  onSuccess={() => {
                                    updateStockUI(item.id, {
                                      showBatchForm: false,
                                      batchesLoaded: false,
                                    });
                                    loadBatches(item.id);
                                  }}
                                  onCancel={() => updateStockUI(item.id, { showBatchForm: false })}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Edit Batch modal */}
                        {ui.editingBatch && (
                          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                            <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
                              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
                                <h2 className="text-white font-bold">
                                  Edit Batch — {ui.editingBatch.batchId}
                                </h2>
                                <button
                                  onClick={() => updateStockUI(item.id, { editingBatch: null })}
                                  className="text-gray-400 hover:text-white text-xl leading-none"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="px-6 py-4 overflow-y-auto flex-1">
                                <ProteinBatchForm
                                  proteinStockId={item.id}
                                  proteinName={item.name}
                                  currentUser={currentUser}
                                  existing={ui.editingBatch}
                                  onSuccess={() => {
                                    updateStockUI(item.id, { editingBatch: null });
                                    loadBatches(item.id);
                                  }}
                                  onCancel={() => updateStockUI(item.id, { editingBatch: null })}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit protein stock modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-white font-bold">Edit Protein Stock</h2>
              <button
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <ProteinStockForm
                currentUser={currentUser}
                existing={editingItem}
                availablePlasmids={[]}
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
