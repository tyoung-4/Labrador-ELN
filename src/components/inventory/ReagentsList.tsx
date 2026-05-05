"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import ReagentForm from "./ReagentForm";
import AddBatchModal from "./AddBatchModal";
import KebabMenu, { KebabMenuItem, ArchiveConfirm, FlagPrompt } from "./KebabMenu";
import EditLotModal from "./EditLotModal";
import type { ReagentLotForEdit } from "./EditLotModal";
import InlineTagPills from "./InlineTagPills";
import type { TagAssignmentSummary } from "./InlineTagPills";
import TagInput from "@/components/tags/TagInput";

interface Reagent {
  id: string;
  name: string;
  category: string;
  quantity: number | null;
  initialQuantity: number | null;
  unit: string | null;
  concentration: number | null;
  concUnit: string | null;
  location: string | null;
  lotNumber: string | null;
  catalogNumber: string | null;
  vendor: string | null;
  expiryDate: string | null;
  owner: string | null;
  notes: string | null;
  tags: string[];
  lowStockThreshold: number | null;
  lowThresholdType: string | null;
  lowThresholdAmber: number | null;
  lowThresholdRed: number | null;
  useParentThreshold: boolean;
  markedForArchive: boolean;
  _count: { researchNotes: number; usageEvents: number };
  lotSummary: { count: number; totalQuantity: number };
  tagAssignments: TagAssignmentSummary[];
}

interface ReagentLot extends ReagentLotForEdit {
  attachments: { id: string }[];
}

function getReagentStockStatus(
  quantity: number | null,
  thresholdType: string | null,
  amber: number | null,
  red: number | null
): "red" | "amber" | null {
  if (quantity === null || !thresholdType || thresholdType === "none" || (amber === null && red === null)) return null;
  if (red !== null && quantity <= red) return "red";
  if (amber !== null && quantity <= amber) return "amber";
  return null;
}

function expiryStatus(expiryDate: string | null): "expired" | "soon" | null {
  if (!expiryDate) return null;
  const now   = Date.now();
  const expMs = new Date(expiryDate).getTime();
  if (expMs < now) return "expired";
  if (expMs - now < 30 * 24 * 60 * 60 * 1000) return "soon";
  return null;
}

// ── LotCard ───────────────────────────────────────────────────────────────────

function LotCard({
  lot,
  reagentId,
  currentUser,
  isOwner,
  useParentThreshold,
  onUpdated,
  onDeleted,
}: {
  lot: ReagentLot;
  reagentId: string;
  currentUser: string;
  isOwner: boolean;
  useParentThreshold: boolean;
  onUpdated: (updated: ReagentLot) => void;
  onDeleted: () => void;
}) {
  const [editingLot,       setEditingLot]       = useState(false);
  const [confirmDelete,    setConfirmDelete]     = useState(false);
  const [deleting,         setDeleting]          = useState(false);
  const [showUse,          setShowUse]           = useState(false);
  const [usePopoverPos,    setUsePopoverPos]     = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const [useAmount,        setUseAmount]         = useState("");
  const [useError,         setUseError]          = useState("");
  const [submittingUse,    setSubmittingUse]     = useState(false);
  const [showArchive,      setShowArchive]       = useState(false);
  const [archiving,        setArchiving]         = useState(false);
  const useBtnRef = useRef<HTMLButtonElement>(null);

  const expiry = expiryStatus(lot.expiryDate);

  useEffect(() => {
    if (!showUse) return;
    const close = () => { setShowUse(false); setUseAmount(""); setUseError(""); };
    const id = setTimeout(() => document.addEventListener("mousedown", close), 0);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", close); };
  }, [showUse]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/inventory/reagents/${reagentId}/lots/${lot.id}`, {
        method: "DELETE",
        headers: { "x-user-name": currentUser },
      });
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  const handleUseAmountChange = (val: string) => {
    setUseAmount(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > lot.quantity) {
      setUseError(`Cannot exceed available quantity (${lot.quantity} ${lot.unit})`);
    } else {
      setUseError("");
    }
  };

  const handleLogUse = async () => {
    const amount = parseInt(useAmount, 10);
    if (isNaN(amount) || amount <= 0 || amount > lot.quantity) return;
    setSubmittingUse(true);
    setUseError("");
    try {
      // 1. Log usage event
      await fetch(`/api/inventory/reagents/${reagentId}/lots/${lot.id}/usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify({ volumeUsed: amount, usedBy: currentUser, date: new Date().toISOString() }),
      });

      // 2. Decrement quantity via PATCH
      const newQty = lot.quantity - amount;
      const patchRes = await fetch(`/api/inventory/reagents/${reagentId}/lots/${lot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify({ quantity: newQty }),
      });
      if (patchRes.ok) {
        const updated = await patchRes.json();
        onUpdated(updated);
        setShowUse(false);
        setUseAmount("");
        if (newQty === 0) setShowArchive(true);
      } else {
        setUseError("Failed to update quantity");
      }
    } catch {
      setUseError("Network error — please try again");
    } finally {
      setSubmittingUse(false);
    }
  };

  const handleArchiveLot = async () => {
    setArchiving(true);
    try {
      await fetch("/api/inventory/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify({ entityType: "reagent_lot", entityId: lot.id }),
      });
      onDeleted(); // remove from active list
    } catch {
      setArchiving(false);
    }
  };

  const useAmountNum = parseInt(useAmount, 10);
  const canLogUse = !isNaN(useAmountNum) && useAmountNum > 0 && useAmountNum <= lot.quantity;

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 space-y-2">
      {/* Main lot row */}
      <div className="flex items-start gap-2">
        {/* Left: quantity + metadata */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Quantity — large and bold */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-white font-bold text-base leading-none">
              {lot.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
            <span className="text-white/50 text-xs">{lot.unit}</span>
          </div>

          {/* Dates */}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            {lot.receivedDate && (
              <span className="text-white/40">
                Received {new Date(lot.receivedDate).toLocaleDateString()}
              </span>
            )}
            {lot.expiryDate && (
              <span className={
                expiry === "expired" ? "text-red-400 font-medium"
                : expiry === "soon"  ? "text-amber-400"
                : "text-white/40"
              }>
                Exp {new Date(lot.expiryDate).toLocaleDateString()}
                {expiry === "expired" && " · Expired"}
                {expiry === "soon"    && " · Expiring soon"}
              </span>
            )}
          </div>

          {/* Lot number + supplier */}
          {(lot.lotNumber || lot.supplier) && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-white/40">
              {lot.lotNumber && <span>Lot #{lot.lotNumber}</span>}
              {lot.supplier  && <span>{lot.supplier}</span>}
            </div>
          )}

          {/* Received by + added */}
          <p className="text-[11px] text-white/25">
            {lot.receivedBy ? `Received by: ${lot.receivedBy} · ` : ""}
            Added {new Date(lot.createdAt).toLocaleDateString()}
          </p>

          {lot.notes && <p className="text-xs text-white/40 whitespace-pre-wrap">{lot.notes}</p>}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
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
            className="rounded border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 text-xs px-2 py-1 transition-colors"
          >
            − Use
          </button>
          <KebabMenu>
            <KebabMenuItem onClick={() => setEditingLot(true)}>Edit</KebabMenuItem>
            {isOwner && (
              <KebabMenuItem
                onClick={() => setConfirmDelete(true)}
                className="text-red-400/70 hover:text-red-400"
              >
                Delete
              </KebabMenuItem>
            )}
          </KebabMenu>
        </div>
      </div>

      {/* − Use floating popover (portal) */}
      {showUse && typeof document !== "undefined" && createPortal(
        <div
          style={{ position: "fixed", top: usePopoverPos.top, right: usePopoverPos.right, zIndex: 9999 }}
          className="bg-gray-900 border border-white/10 rounded-lg shadow-xl p-3 space-y-2"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} max={lot.quantity} step={1}
              value={useAmount}
              onChange={(e) => handleUseAmountChange(e.target.value)}
              autoFocus
              className="w-20 rounded bg-white/10 border border-white/20 text-white text-sm px-2 py-1 focus:outline-none focus:border-teal-400/50"
            />
            <span className="text-white/40 text-xs">{lot.unit}</span>
          </div>
          {useError && <p className="text-red-400 text-xs max-w-[180px]">{useError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleLogUse}
              disabled={submittingUse || !canLogUse}
              className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {submittingUse ? "Logging…" : "Log Use"}
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

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
          <p className="text-red-300 text-xs font-semibold">Permanently delete this lot?</p>
          <p className="text-white/50 text-xs">This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete} disabled={deleting}
              className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
            >
              {deleting ? "Deleting…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-white/40 hover:text-white text-xs px-2 py-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Archive prompt — shown after lot hits 0 */}
      {showArchive && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
          <p className="text-amber-300 text-xs font-semibold">This lot is now empty. Archive it?</p>
          <div className="flex gap-2">
            <button
              onClick={handleArchiveLot} disabled={archiving}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
            >
              {archiving ? "Archiving…" : "Archive Lot"}
            </button>
            <button
              onClick={() => setShowArchive(false)}
              className="text-white/40 hover:text-white text-xs px-2 py-1 transition-colors"
            >
              Keep
            </button>
          </div>
        </div>
      )}

      {/* Edit Lot modal */}
      {editingLot && (
        <EditLotModal
          reagentId={reagentId}
          lot={lot}
          currentUser={currentUser}
          useParentThreshold={useParentThreshold}
          onSaved={(updated) => { onUpdated(updated); setEditingLot(false); }}
          onClose={() => setEditingLot(false)}
        />
      )}
    </div>
  );
}

// ── ReagentCard ───────────────────────────────────────────────────────────────
// Step 3: no + Lot, no ⋮, no chevron — those live in the group header only.
// Step 4: no quantity update row; TOTAL STOCK computed from lots.
// Step 5/6/7: lot cards with Edit/Delete kebab and − Use popover.

function ReagentCard({
  item,
  currentUser,
  lots,
  onLotsChanged,
}: {
  item: Reagent;
  currentUser: string;
  lots: ReagentLot[];
  onLotsChanged: (newLots: ReagentLot[]) => void;
}) {
  const isOwner = currentUser === item.owner || currentUser === "Admin";

  const stockStatus = getReagentStockStatus(
    item.quantity, item.lowThresholdType, item.lowThresholdAmber, item.lowThresholdRed
  );

  const pct =
    item.initialQuantity && item.quantity !== null
      ? Math.max(0, Math.min(100, (item.quantity / item.initialQuantity) * 100))
      : null;

  const totalStock = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const totalUnit  = item.unit ?? (lots[0]?.unit ?? "");

  function handleLotUpdated(updated: ReagentLot) {
    onLotsChanged(lots.map((l) => (l.id === updated.id ? updated : l)));
  }

  function handleLotDeleted(lotId: string) {
    onLotsChanged(lots.filter((l) => l.id !== lotId));
  }

  return (
    <div className="px-4 py-3">
      {/* Metadata row — no action buttons (Step 3) */}
      <div className="flex items-center gap-2 flex-wrap">
        {stockStatus && (
          <span className={`text-xs font-medium ${stockStatus === "red" ? "text-red-400" : "text-amber-400"}`}>
            {stockStatus === "red" ? "🔴" : "⚠️"} Low stock
          </span>
        )}
        {item.concentration !== null && (
          <span className="text-white/40 text-xs">{item.concentration.toLocaleString()} {item.concUnit ?? ""}</span>
        )}
        {item.location && <span className="text-white/40 text-xs">&#x1F4CD; {item.location}</span>}
        <span className="text-white/30 text-xs bg-white/10 px-2 py-0.5 rounded-full">{item.category}</span>
      </div>

      {pct !== null && (
        <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden w-32">
          <div
            className={`h-full rounded-full transition-all ${pct < 20 ? "bg-red-400" : pct < 40 ? "bg-amber-400" : "bg-teal-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Item metadata */}
      <div className="mt-3 space-y-1 text-xs text-white/50">
        {item.catalogNumber && <p>Catalog: {item.catalogNumber}</p>}
        {item.vendor        && <p>Vendor: {item.vendor}</p>}
        {item.owner         && <p>Owner: {item.owner}</p>}
        {item.notes         && <p className="text-white/40 whitespace-pre-wrap">{item.notes}</p>}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.tags.map((t) => (
              <span key={t} className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}
        {item.lowThresholdType && item.lowThresholdType !== "none" && (
          <div className="flex items-center gap-3">
            <span className="text-white/30">Low stock alerts:</span>
            {item.lowThresholdAmber !== null && <span className="text-amber-400">⚠️ {item.lowThresholdAmber} {item.unit ?? ""}</span>}
            {item.lowThresholdRed   !== null && <span className="text-red-400">🔴 {item.lowThresholdRed} {item.unit ?? ""}</span>}
          </div>
        )}
      </div>

      {/* Lots section (Step 5) */}
      {lots.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-white/30 uppercase tracking-wide text-[10px] font-semibold">
            Lots ({lots.length})
          </p>
          {lots.map((lot) => (
            <LotCard
              key={lot.id}
              lot={lot}
              reagentId={item.id}
              currentUser={currentUser}
              isOwner={isOwner}
              useParentThreshold={item.useParentThreshold}
              onUpdated={handleLotUpdated}
              onDeleted={() => handleLotDeleted(lot.id)}
            />
          ))}
        </div>
      )}

      {/* TOTAL STOCK — computed from active lots (Step 4) */}
      <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
        <span className="text-white/30 uppercase tracking-wide text-[10px] font-semibold">Total Stock</span>
        <span className="text-white/70 text-sm">
          {lots.length > 0
            ? `${totalStock.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${totalUnit}`
            : "No active lots"}
        </span>
      </div>
    </div>
  );
}

// ── Group header sub-component (always-visible row with + Lot and kebab) ──────

function ReagentGroupHeader({
  stocks,
  currentUser,
  groupStatus,
  anyMarked,
  groupExpanded,
  onToggleGroup,
  onAddBatch,
  onEdit,
  onReload,
}: {
  stocks: Reagent[];
  currentUser: string;
  groupStatus: "red" | "amber" | null;
  anyMarked: boolean;
  groupExpanded: boolean;
  onToggleGroup: () => void;
  onAddBatch: (id: string) => void;
  onEdit: (item: Reagent) => void;
  onReload: () => void;
}) {
  const primaryStock = stocks[0];
  const isOwner = currentUser === primaryStock.owner || currentUser === "Admin";
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [flagging,       setFlagging]       = useState(false);
  const [toast,          setToast]          = useState("");

  const handleArchive = async () => {
    await fetch("/api/inventory/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-name": currentUser },
      body: JSON.stringify({ entityType: "reagent", entityId: primaryStock.id }),
    });
    setConfirmArchive(false);
    onReload();
  };

  const handleFlag = async (note: string) => {
    await fetch("/api/inventory/mark-for-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-name": currentUser },
      body: JSON.stringify({ entityType: "reagent", entityId: primaryStock.id, note: note || undefined }),
    });
    setFlagging(false);
    setToast("Flagged for archive");
    setTimeout(() => setToast(""), 3000);
    onReload();
  };

  return (
    <>
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggleGroup}
      >
        <span className="text-white font-semibold flex-1">
          {primaryStock.name}
          {anyMarked && <span className="ml-2 text-orange-400/70 text-xs font-normal">⚑ flagged</span>}
        </span>

        {/* Status + lot summary + tags */}
        <div className="flex items-center gap-2 flex-wrap">
          {groupStatus === "red"   && <span className="text-red-400 text-xs">🔴 Low stock</span>}
          {groupStatus === "amber" && !anyMarked && <span className="text-amber-400 text-xs">⚠️ Low stock</span>}
          {(() => {
            const totalLots = stocks.reduce((s, r) => s + (r.lotSummary?.count ?? 0), 0);
            const totalQty  = stocks.reduce((s, r) => s + (r.lotSummary?.totalQuantity ?? 0), 0);
            const unit = primaryStock.unit ?? "";
            if (totalLots > 0) {
              return (
                <span className="text-white/30 text-xs">
                  {totalLots} lot{totalLots !== 1 ? "s" : ""} · {totalQty.toLocaleString(undefined, { maximumFractionDigits: 4 })} {unit}
                </span>
              );
            }
            return <span className="text-white/20 text-xs">No lots</span>;
          })()}
          <InlineTagPills tagAssignments={primaryStock.tagAssignments} />
        </div>

        {/* + Lot */}
        <button
          onClick={(e) => { e.stopPropagation(); onAddBatch(primaryStock.id); }}
          className="rounded border border-white/20 bg-white/5 hover:bg-white/15 px-2 py-0.5 text-white/60 hover:text-white text-xs transition-colors flex-shrink-0"
        >
          + Lot
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
    </>
  );
}

// ── Parent list component ─────────────────────────────────────────────────────

export default function ReagentsList({
  search, currentUser, refetchTrigger,
}: {
  search: string; currentUser: string; refetchTrigger?: number;
}) {
  const [reagents,       setReagents]       = useState<Reagent[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [expandedIds,    setExpandedIds]    = useState<Set<string>>(new Set());
  const [editingItem,    setEditingItem]    = useState<Reagent | null>(null);
  const [addBatchItemId, setAddBatchItemId] = useState<string | null>(null);
  const [lotsMap,        setLotsMap]        = useState<Record<string, ReagentLot[]>>({});
  const [loadedIds,      setLoadedIds]      = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/reagents?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (Array.isArray(data)) setReagents(data);
    } catch { /* leave as-is */ } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load, refetchTrigger]);

  async function loadLots(id: string) {
    if (loadedIds.has(id)) return;
    try {
      const res = await fetch(`/api/inventory/reagents/${id}/lots`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setLotsMap((prev) => ({ ...prev, [id]: data }));
        setLoadedIds((prev) => new Set([...prev, id]));
      }
    } catch { /* ignore */ }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); loadLots(id); }
      return next;
    });
  };

  const addBatchItem = addBatchItemId ? reagents.find((r) => r.id === addBatchItemId) : null;

  if (loading) return <div className="text-white/40 text-sm py-8 text-center">Loading…</div>;
  if (!reagents.length) return (
    <div className="text-white/40 text-sm py-12 text-center">
      No reagents/consumables yet.{" "}
      <span className="text-white/20">Import from Excel or add manually.</span>
    </div>
  );

  // Group by name
  const groups = new Map<string, Reagent[]>();
  for (const r of reagents) {
    const key = r.name.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <>
      <div className="space-y-3">
        {[...groups.entries()].map(([key, stocks]) => {
          const groupStatus = stocks.reduce<"red" | "amber" | null>((worst, s) => {
            const st = getReagentStockStatus(s.quantity, s.lowThresholdType, s.lowThresholdAmber, s.lowThresholdRed);
            if (st === "red") return "red";
            if (st === "amber" && worst !== "red") return "amber";
            return worst;
          }, null);
          const anyMarked    = stocks.some((s) => s.markedForArchive);
          const groupExpanded = stocks.some((s) => expandedIds.has(s.id));

          return (
            <div
              key={key}
              className={`bg-white/5 border rounded-xl overflow-hidden ${
                anyMarked        ? "border-orange-500/40"
                : groupStatus === "red"   ? "border-red-500/60"
                : groupStatus === "amber" ? "border-amber-500/60"
                : "border-white/10"
              }`}
            >
              {/* Group header — single source of + Lot, ⋮, chevron */}
              <ReagentGroupHeader
                stocks={stocks}
                currentUser={currentUser}
                groupStatus={groupStatus}
                anyMarked={anyMarked}
                groupExpanded={groupExpanded}
                onToggleGroup={() => stocks.forEach((s) => toggleExpand(s.id))}
                onAddBatch={(id) => setAddBatchItemId(id)}
                onEdit={(item) => setEditingItem(item)}
                onReload={load}
              />

              {groupExpanded && (
                <div className={`border-t divide-y ${
                  groupStatus === "red"   ? "border-red-500/20 divide-red-500/10"
                  : groupStatus === "amber" ? "border-amber-500/20 divide-amber-500/10"
                  : "border-white/10 divide-white/5"
                }`}>
                  {stocks.map((r) => (
                    <ReagentCard
                      key={r.id}
                      item={r}
                      currentUser={currentUser}
                      lots={lotsMap[r.id] ?? []}
                      onLotsChanged={(newLots) => setLotsMap((prev) => ({ ...prev, [r.id]: newLots }))}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Lot modal */}
      {addBatchItem && (
        <AddBatchModal
          itemType="reagent"
          itemId={addBatchItem.id}
          itemName={addBatchItem.name}
          currentUser={currentUser}
          parentUnit={addBatchItem.unit ?? undefined}
          useParentThreshold={addBatchItem.useParentThreshold ?? true}
          onSuccess={(lot) => {
            setLotsMap((prev) => ({
              ...prev,
              [addBatchItem.id]: [lot, ...(prev[addBatchItem.id] ?? [])],
            }));
            setAddBatchItemId(null);
          }}
          onClose={() => setAddBatchItemId(null)}
        />
      )}

      {/* Edit reagent modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-white font-bold">Edit Reagent</h2>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <ReagentForm
                currentUser={currentUser}
                existing={editingItem}
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
