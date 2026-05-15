"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import ProteinStockForm from "./ProteinStockForm";
import ProteinBatchForm from "./ProteinBatchForm";
import AddBatchModal from "./AddBatchModal";
import KebabMenu, { KebabMenuItem, ArchiveConfirm, FlagPrompt } from "./KebabMenu";
import InlineTagPills from "./InlineTagPills";
import type { TagAssignmentSummary } from "./InlineTagPills";

interface ProteinBatch {
  id: string;
  batchId: string;
  purificationDate: string;
  initialVolume: number;
  currentVolume: number;
  concentration: number | null;
  volumeUnit: string | null;
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
  plasmid?: { name: string } | null;
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
  tagAssignments: TagAssignmentSummary[];
}

interface StockUIState {
  showBatchForm: boolean;
  editingBatch: ProteinBatch | null;
  batches: ProteinBatch[];
  batchesLoaded: boolean;
}

// ── Protein Batch Card sub-component ──────────────────────────────────────────

function ProteinBatchCard({
  batch,
  stockId,
  currentUser,
  isOwner,
  onUpdated,
  onDeleted,
  onEdit,
}: {
  batch: ProteinBatch;
  stockId: string;
  currentUser: string;
  isOwner: boolean;
  onUpdated: (updated: ProteinBatch) => void;
  onDeleted: () => void;
  onEdit: () => void;
}) {
  const unit = batch.volumeUnit ?? "µL";
  const [showUse,       setShowUse]       = useState(false);
  const [usePopoverPos, setUsePopoverPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [useAmount,     setUseAmount]     = useState("");
  const [useError,      setUseError]      = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [depleted,      setDepleted]      = useState(false);
  const [archiving,     setArchiving]     = useState(false);
  const useBtnRef = useRef<HTMLButtonElement>(null);

  const isDepleted = batch.currentVolume <= 0;

  // Computed mg remaining
  let mgRemaining: string;
  if (batch.currentVolume != null && batch.concentration != null) {
    const mg = unit === "mL"
      ? batch.currentVolume * batch.concentration
      : (batch.currentVolume * batch.concentration) / 1000;
    mgRemaining = mg.toFixed(2) + " mg remaining";
  } else {
    mgRemaining = "— mg remaining";
  }

  useEffect(() => {
    if (!showUse) return;
    const close = () => { setShowUse(false); setUseAmount(""); setUseError(""); };
    const id = setTimeout(() => document.addEventListener("mousedown", close), 0);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", close); };
  }, [showUse]);

  const useAmountNum = parseFloat(useAmount);
  const canLogUse = !isNaN(useAmountNum) && useAmountNum > 0 && useAmountNum <= batch.currentVolume;

  const handleUseAmountChange = (val: string) => {
    setUseAmount(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n > batch.currentVolume) {
      setUseError(`Cannot exceed remaining volume (${batch.currentVolume} ${unit})`);
    } else {
      setUseError("");
    }
  };

  const handleLogUse = async () => {
    if (!canLogUse) return;
    setSubmitting(true);
    setUseError("");
    try {
      const newVolume = Math.max(0, batch.currentVolume - useAmountNum);
      const res = await fetch(
        `/api/inventory/proteinstocks/${stockId}/batches/${batch.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-user-name": currentUser },
          body: JSON.stringify({ currentVolume: newVolume }),
        }
      );
      if (res.ok) {
        const updated = await res.json();
        onUpdated(updated);
        setShowUse(false);
        setUseAmount("");
        if (newVolume === 0) setDepleted(true);
      } else {
        setUseError("Failed to update volume");
      }
    } catch {
      setUseError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveBatch = async () => {
    setArchiving(true);
    try {
      await fetch("/api/inventory/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify({ entityType: "protein_batch", entityId: batch.id }),
      });
      onDeleted();
    } catch {
      setArchiving(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 space-y-1">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-white/80 font-mono text-xs">{batch.batchId}</span>
        <div className="flex items-center gap-1">
          {/* − Use button */}
          <button
            ref={useBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              if (!showUse && useBtnRef.current) {
                const rect = useBtnRef.current.getBoundingClientRect();
                setUsePopoverPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
              }
              setShowUse((v) => !v);
              setUseError("");
              setUseAmount("");
            }}
            disabled={isDepleted}
            title={isDepleted ? "No volume remaining" : undefined}
            className={`rounded border text-xs px-2 py-0.5 transition-colors ${
              isDepleted
                ? "border-white/5 bg-white/3 text-white/20 cursor-not-allowed"
                : "border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 hover:text-teal-300"
            }`}
          >
            − Use
          </button>
          {isOwner && (
            <button
              onClick={() => onEdit()}
              className="text-xs text-gray-400 hover:text-white border border-white/10 rounded px-2 py-0.5 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Batch details */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-white/40 text-xs">
        <span>{new Date(batch.purificationDate).toLocaleDateString()}</span>
        <span>{batch.currentVolume.toLocaleString()} {unit} remaining</span>
        {batch.concentration !== null && <span>{batch.concentration} mg/mL</span>}
        <span className="text-white/30">{mgRemaining}</span>
        {batch.a280 !== null && <span>A280/260: {batch.a280}</span>}
        {batch.storageBuffer && <span className="truncate max-w-xs">{batch.storageBuffer}</span>}
        {batch.storageLocationText && <span>&#x1F4CD; {batch.storageLocationText}</span>}
      </div>

      {batch.notes && (
        <p className="text-white/30 text-xs whitespace-pre-wrap">{batch.notes}</p>
      )}

      {/* Volume depleted prompt */}
      {depleted && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2 mt-2">
          <p className="text-amber-300 text-xs font-semibold">Volume depleted. Archive this batch?</p>
          <div className="flex gap-2">
            <button
              onClick={handleArchiveBatch}
              disabled={archiving}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
            >
              {archiving ? "Archiving…" : "Archive"}
            </button>
            <button
              onClick={() => setDepleted(false)}
              className="text-white/40 hover:text-white text-xs px-2 transition-colors"
            >
              Keep
            </button>
          </div>
        </div>
      )}

      {/* − Use floating popover (portal) */}
      {showUse && typeof document !== "undefined" && createPortal(
        <div
          style={{ position: "fixed", top: usePopoverPos.top, right: usePopoverPos.right, zIndex: 9999 }}
          className="bg-gray-900 border border-white/10 rounded-lg shadow-xl p-3 space-y-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0.1}
              max={batch.currentVolume}
              step={0.1}
              value={useAmount}
              onChange={(e) => handleUseAmountChange(e.target.value)}
              autoFocus
              className="w-20 rounded bg-white/10 border border-white/20 text-white text-sm px-2 py-1 focus:outline-none focus:border-teal-400/50"
            />
            <span className="text-white/40 text-xs">{unit}</span>
          </div>
          {useError && <p className="text-red-400 text-xs max-w-[180px]">{useError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleLogUse}
              disabled={submitting || !canLogUse}
              className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {submitting ? "Logging…" : "Log Use"}
            </button>
            <button
              onClick={() => { setShowUse(false); setUseAmount(""); setUseError(""); }}
              className="text-white/40 hover:text-white text-xs px-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Per-stock card sub-component ──────────────────────────────────────────────

function ProteinStockCard({
  item,
  currentUser,
  expanded,
  ui,
  onToggle,
  onEdit,
  onReload,
  onUpdateUI,
  onLoadBatches,
}: {
  item: ProteinStock;
  currentUser: string;
  expanded: boolean;
  ui: StockUIState;
  onToggle: () => void;
  onEdit: () => void;
  onReload: () => void;
  onUpdateUI: (patch: Partial<StockUIState>) => void;
  onLoadBatches: () => void;
}) {
  const isOwner = currentUser === item.owner || currentUser === "Admin";
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [flagging,       setFlagging]       = useState(false);
  const [toast,          setToast]          = useState("");

  const handleArchive = async () => {
    await fetch("/api/inventory/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-name": currentUser },
      body: JSON.stringify({ entityType: "protein_stock", entityId: item.id }),
    });
    setConfirmArchive(false);
    onReload();
  };

  const handleFlag = async (note: string) => {
    await fetch("/api/inventory/mark-for-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-name": currentUser },
      body: JSON.stringify({ entityType: "protein_stock", entityId: item.id, note: note || undefined }),
    });
    setFlagging(false);
    setToast("Flagged for archive");
    setTimeout(() => setToast(""), 3000);
    onReload();
  };

  const updateBatch = (batchId: string, updated: ProteinBatch) => {
    onUpdateUI({ batches: ui.batches.map((b) => (b.id === batchId ? updated : b)) });
  };

  const deleteBatch = (batchId: string) => {
    onUpdateUI({ batches: ui.batches.filter((b) => b.id !== batchId) });
  };

  return (
    <div className="px-4 py-3">
      {/* Stock summary row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 text-xs text-white/60 flex flex-wrap gap-2">
          {item.concentration !== null && (
            <span>{item.concentration.toLocaleString()} {item.concUnit ?? ""}</span>
          )}
          {item.volume !== null && (
            <span>{item.volume.toLocaleString()} {item.volUnit ?? ""}</span>
          )}
          {item.purity && <span>Purity: {item.purity}</span>}
          {item.location && <span>&#x1F4CD; {item.location}</span>}
          {item.markedForArchive && (
            <span className="text-orange-400/60">⚑ flagged</span>
          )}
        </div>

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

        {/* Expand */}
        <button
          onClick={onToggle}
          className="text-white/30 hover:text-white/70 text-xs flex-shrink-0"
        >
          {expanded ? "▲ Less" : "▼ More"}
        </button>
      </div>

      {/* Inline archive confirm */}
      {confirmArchive && (
        <ArchiveConfirm
          name={item.name}
          onConfirm={handleArchive}
          onCancel={() => setConfirmArchive(false)}
        />
      )}

      {/* Inline flag prompt */}
      {flagging && (
        <FlagPrompt
          name={item.name}
          onSubmit={handleFlag}
          onCancel={() => setFlagging(false)}
        />
      )}

      {toast && <p className="text-green-400/80 text-xs mt-1">{toast}</p>}

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-2 space-y-2 text-xs text-white/50">
          {item.owner && <p>Owner: {item.owner}</p>}
          <p>Plasmid: {item.plasmid?.name ?? "—"}</p>
          {item.notes && <p className="whitespace-pre-wrap">{item.notes}</p>}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((t) => (
                <span key={t} className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}

          {/* Batch list */}
          {ui.batches.length > 0 && (
            <div className="mt-2 space-y-2">
              <p className="text-white/30 text-xs uppercase tracking-wide">Batches</p>
              {ui.batches.map((batch) => (
                <ProteinBatchCard
                  key={batch.id}
                  batch={batch}
                  stockId={item.id}
                  currentUser={currentUser}
                  isOwner={isOwner}
                  onUpdated={(updated) => updateBatch(batch.id, updated)}
                  onDeleted={() => deleteBatch(batch.id)}
                  onEdit={() => onUpdateUI({ editingBatch: batch })}
                />
              ))}
            </div>
          )}

          {ui.batchesLoaded && ui.batches.length === 0 && (
            <p className="text-white/20 text-xs italic">No batches yet.</p>
          )}
        </div>
      )}

      {/* Add Batch modal */}
      {ui.showBatchForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-white font-bold">Add Batch — {item.name}</h2>
              <button
                onClick={() => onUpdateUI({ showBatchForm: false })}
                className="text-gray-400 hover:text-white text-xl leading-none"
              >✕</button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <ProteinBatchForm
                proteinStockId={item.id}
                proteinName={item.name}
                currentUser={currentUser}
                onSuccess={() => {
                  onUpdateUI({ showBatchForm: false, batchesLoaded: false });
                  onLoadBatches();
                }}
                onCancel={() => onUpdateUI({ showBatchForm: false })}
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
              <h2 className="text-white font-bold">Edit Batch — {ui.editingBatch.batchId}</h2>
              <button
                onClick={() => onUpdateUI({ editingBatch: null })}
                className="text-gray-400 hover:text-white text-xl leading-none"
              >✕</button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <ProteinBatchForm
                proteinStockId={item.id}
                proteinName={item.name}
                currentUser={currentUser}
                existing={ui.editingBatch}
                onSuccess={() => {
                  onUpdateUI({ editingBatch: null });
                  onLoadBatches();
                }}
                onCancel={() => onUpdateUI({ editingBatch: null })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Group header sub-component (always-visible row with + Add Batch and kebab) ─

function ProteinGroupHeader({
  stocks,
  currentUser,
  anyMarked,
  groupExpanded,
  onToggleGroup,
  onEdit,
  onReload,
  onBatchCreated,
}: {
  stocks: ProteinStock[];
  currentUser: string;
  anyMarked: boolean;
  groupExpanded: boolean;
  onToggleGroup: () => void;
  onEdit: (item: ProteinStock) => void;
  onReload: () => void;
  onBatchCreated: (stockId: string) => void;
}) {
  const primaryStock = stocks[0];
  const isOwner = currentUser === primaryStock.owner || currentUser === "Admin";
  const [showBatchModal,  setShowBatchModal]  = useState(false);
  const [confirmArchive,  setConfirmArchive]  = useState(false);
  const [flagging,        setFlagging]        = useState(false);
  const [toast,           setToast]           = useState("");

  const handleArchive = async () => {
    await fetch("/api/inventory/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-name": currentUser },
      body: JSON.stringify({ entityType: "protein_stock", entityId: primaryStock.id }),
    });
    setConfirmArchive(false);
    onReload();
  };

  const handleFlag = async (note: string) => {
    await fetch("/api/inventory/mark-for-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-name": currentUser },
      body: JSON.stringify({ entityType: "protein_stock", entityId: primaryStock.id, note: note || undefined }),
    });
    setFlagging(false);
    setToast("Flagged for archive");
    setTimeout(() => setToast(""), 3000);
    onReload();
  };

  return (
    <>
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-white/5"
        onClick={onToggleGroup}
      >
        <div className="flex-1 min-w-0">
          <span className="text-white font-semibold">
            {primaryStock.name}
            {anyMarked && (
              <span className="ml-2 text-orange-400/70 text-xs font-normal">⚑ flagged</span>
            )}
          </span>
          {primaryStock.plasmid?.name && (
            <span className="ml-2 text-white/30 text-xs font-normal">{primaryStock.plasmid.name}</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/30 text-xs">
            {stocks.length} stock{stocks.length !== 1 ? "s" : ""}
          </span>
          <InlineTagPills tagAssignments={primaryStock.tagAssignments} />
        </div>

        {/* + Add Batch */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowBatchModal(true); }}
          className="rounded border border-white/20 bg-white/5 hover:bg-white/15 px-2 py-0.5 text-white/60 hover:text-white text-xs transition-colors flex-shrink-0"
        >
          + Add Batch
        </button>

        {/* Kebab */}
        <KebabMenu>
          {isOwner ? (
            <>
              <KebabMenuItem onClick={() => onEdit(primaryStock)}>Edit</KebabMenuItem>
              <KebabMenuItem
                onClick={() => setConfirmArchive(true)}
                className="text-amber-400/70 hover:text-amber-400"
              >
                Archive
              </KebabMenuItem>
            </>
          ) : anyMarked ? (
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

        {/* Chevron */}
        <span className="text-white/30 text-sm flex-shrink-0">{groupExpanded ? "▲" : "▼"}</span>
      </div>

      {confirmArchive && (
        <div className="px-4">
          <ArchiveConfirm name={primaryStock.name} onConfirm={handleArchive} onCancel={() => setConfirmArchive(false)} />
        </div>
      )}
      {flagging && (
        <div className="px-4">
          <FlagPrompt name={primaryStock.name} onSubmit={handleFlag} onCancel={() => setFlagging(false)} />
        </div>
      )}
      {toast && <p className="px-4 pb-2 text-green-400/80 text-xs">{toast}</p>}

      {showBatchModal && (
        <AddBatchModal
          itemType="proteinstock"
          itemId={primaryStock.id}
          itemName={primaryStock.name}
          currentUser={currentUser}
          onSuccess={() => { setShowBatchModal(false); onBatchCreated(primaryStock.id); }}
          onClose={() => setShowBatchModal(false)}
        />
      )}
    </>
  );
}

// ── Parent list component ─────────────────────────────────────────────────────

export default function ProteinStocksList({
  search,
  currentUser,
  refetchTrigger,
}: {
  search: string;
  currentUser: string;
  refetchTrigger?: number;
}) {
  const [items,       setItems]       = useState<ProteinStock[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<ProteinStock | null>(null);
  const [stockUI,     setStockUI]     = useState<Record<string, StockUIState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/proteinstocks?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch { /* leave as-is */ } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load, refetchTrigger]);

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
    } catch { /* ignore */ }
  }, []);

  const getStockUI = (id: string): StockUIState =>
    stockUI[id] ?? { showBatchForm: false, editingBatch: null, batches: [], batchesLoaded: false };

  const updateStockUI = (id: string, patch: Partial<StockUIState>) => {
    setStockUI((prev) => ({ ...prev, [id]: { ...getStockUI(id), ...patch } }));
  };

  const toggleExpand = (stockId: string) => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(stockId)) {
        n.delete(stockId);
      } else {
        n.add(stockId);
        if (!getStockUI(stockId).batchesLoaded) loadBatches(stockId);
      }
      return n;
    });
  };

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
              <ProteinGroupHeader
                stocks={stocks}
                currentUser={currentUser}
                anyMarked={anyMarked}
                groupExpanded={groupExpanded}
                onToggleGroup={() => {
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
                onEdit={(item) => setEditingItem(item)}
                onReload={load}
                onBatchCreated={(stockId) => loadBatches(stockId)}
              />

              {/* Expanded stocks */}
              {groupExpanded && (
                <div className="border-t border-white/10 divide-y divide-white/5">
                  {stocks.map((item) => (
                    <ProteinStockCard
                      key={item.id}
                      item={item}
                      currentUser={currentUser}
                      expanded={expandedIds.has(item.id)}
                      ui={getStockUI(item.id)}
                      onToggle={() => toggleExpand(item.id)}
                      onEdit={() => setEditingItem(item)}
                      onReload={load}
                      onUpdateUI={(patch) => updateStockUI(item.id, patch)}
                      onLoadBatches={() => loadBatches(item.id)}
                    />
                  ))}
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
              >✕</button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <ProteinStockForm
                currentUser={currentUser}
                existing={editingItem}
                availablePlasmids={[]}
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
