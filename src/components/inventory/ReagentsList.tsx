"use client";

import React, { useState, useEffect, useCallback } from "react";
import ReagentForm from "./ReagentForm";
import AddBatchModal from "./AddBatchModal";
import KebabMenu, { KebabMenuItem, ArchiveConfirm, FlagPrompt } from "./KebabMenu";

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
}

interface ReagentLot {
  id: string;
  lotNumber: string | null;
  quantity: number;
  unit: string;
  supplier: string | null;
  expiryDate: string | null;
  receivedDate: string | null;
  receivedBy: string | null;
  notes: string | null;
  lowThresholdAmber: number | null;
  lowThresholdRed: number | null;
  createdAt: string;
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

// ── Per-card sub-component ────────────────────────────────────────────────────

function ReagentCard({
  item,
  currentUser,
  expanded,
  lots,
  onToggle,
  onQuantityUpdated,
  onEdit,
  onReload,
  onAddBatch,
}: {
  item: Reagent;
  currentUser: string;
  expanded: boolean;
  lots: ReagentLot[];
  onToggle: () => void;
  onQuantityUpdated: (id: string, qty: number) => void;
  onEdit: () => void;
  onReload: () => void;
  onAddBatch: () => void;
}) {
  const [editingQuantity,  setEditingQuantity]  = useState(false);
  const [quantityInput,    setQuantityInput]    = useState(item.quantity?.toString() ?? "");
  const [isSavingQuantity, setIsSavingQuantity] = useState(false);
  const [confirmArchive,   setConfirmArchive]   = useState(false);
  const [flagging,         setFlagging]         = useState(false);
  const [toast,            setToast]            = useState("");

  const isOwner = currentUser === item.owner || currentUser === "Admin";

  const stockStatus = getReagentStockStatus(
    item.quantity, item.lowThresholdType, item.lowThresholdAmber, item.lowThresholdRed
  );

  useEffect(() => {
    if (!editingQuantity) setQuantityInput(item.quantity?.toString() ?? "");
  }, [item.quantity, editingQuantity]);

  const pct =
    item.initialQuantity && item.quantity !== null
      ? Math.max(0, Math.min(100, (item.quantity / item.initialQuantity) * 100))
      : null;

  async function handleSaveQuantity() {
    const newQuantity = Math.round(parseFloat(quantityInput));
    if (isNaN(newQuantity) || newQuantity < 0) return;
    setIsSavingQuantity(true);
    try {
      const res = await fetch(`/api/inventory/reagents/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify({ quantity: newQuantity }),
      });
      if (res.ok) { setEditingQuantity(false); onQuantityUpdated(item.id, newQuantity); }
      else { const d = await res.json(); console.error("Failed to update quantity:", d.error); }
    } finally { setIsSavingQuantity(false); }
  }

  const handleArchive = async () => {
    await fetch("/api/inventory/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-name": currentUser },
      body: JSON.stringify({ entityType: "reagent", entityId: item.id }),
    });
    setConfirmArchive(false);
    onReload();
  };

  const handleFlag = async (note: string) => {
    await fetch("/api/inventory/mark-for-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-name": currentUser },
      body: JSON.stringify({ entityType: "reagent", entityId: item.id, note: note || undefined }),
    });
    setFlagging(false);
    setToast("Flagged for archive");
    setTimeout(() => setToast(""), 3000);
    onReload();
  };

  return (
    <div className="px-4 py-3">
      {/* Summary row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {stockStatus && (
              <span className={`text-sm font-medium ${stockStatus === "red" ? "text-red-400" : "text-amber-400"}`}>
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
        </div>

        {/* + Lot */}
        <button
          onClick={(e) => { e.stopPropagation(); onAddBatch(); }}
          className="rounded border border-white/20 bg-white/5 hover:bg-white/15 px-2 py-0.5 text-white/60 hover:text-white text-xs transition-colors flex-shrink-0"
        >
          + Lot
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

        {/* Expand */}
        <button onClick={onToggle} className="text-white/30 hover:text-white/70 text-xs transition-colors flex-shrink-0">
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
        <div className="mt-3 space-y-2 text-xs text-white/50">
          {item.lotNumber    && <p>Lot: {item.lotNumber}</p>}
          {item.catalogNumber && <p>Catalog: {item.catalogNumber}</p>}
          {item.vendor       && <p>Vendor: {item.vendor}</p>}
          {item.expiryDate   && <p>Expires: {new Date(item.expiryDate).toLocaleDateString()}</p>}
          {item.owner        && <p>Owner: {item.owner}</p>}
          {item.notes        && <p className="text-white/40 whitespace-pre-wrap">{item.notes}</p>}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.tags.map((t) => (
                <span key={t} className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full text-xs">{t}</span>
              ))}
            </div>
          )}

          {item.lowThresholdType && item.lowThresholdType !== "none" && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>Low stock alerts:</span>
              {item.lowThresholdAmber !== null && <span className="text-amber-400">⚠️ {item.lowThresholdAmber} {item.unit ?? item.lowThresholdType}</span>}
              {item.lowThresholdRed   !== null && <span className="text-red-400">🔴 {item.lowThresholdRed} {item.unit ?? item.lowThresholdType}</span>}
            </div>
          )}

          {/* ── Lots ── */}
          {lots.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-white/30 uppercase tracking-wide text-[10px] font-semibold mb-1">Lots ({lots.length})</p>
              {lots.map((lot) => (
                <div key={lot.id} className="rounded bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/60 space-y-0.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    {lot.lotNumber     && <span className="font-medium text-white/80">{lot.lotNumber}</span>}
                    <span>{lot.quantity.toLocaleString()} {lot.unit}</span>
                    {lot.expiryDate    && <span>Exp {new Date(lot.expiryDate).toLocaleDateString()}</span>}
                    {lot.supplier      && <span>{lot.supplier}</span>}
                    {lot.attachments.length > 0 && <span className="text-white/30">📎 {lot.attachments.length}</span>}
                    {lot.lowThresholdAmber != null && <span className="text-amber-400/70">⚠️ ≤{lot.lowThresholdAmber}</span>}
                  </div>
                  {lot.receivedBy   && <p className="text-white/30">Received by: {lot.receivedBy}{lot.receivedDate ? ` · ${new Date(lot.receivedDate).toLocaleDateString()}` : ""}</p>}
                  {lot.notes        && <p className="whitespace-pre-wrap">{lot.notes}</p>}
                  <p className="text-white/20">Added {new Date(lot.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}

          {/* Inline quantity update — owner/Admin only */}
          {isOwner && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 uppercase tracking-wide">Quantity</span>
                {!editingQuantity ? (
                  <>
                    <span className="text-white text-sm">
                      {item.quantity !== null
                        ? `${item.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${item.unit ?? ""}`
                        : "Not set"}
                    </span>
                    <button
                      onClick={() => { setQuantityInput(item.quantity?.toString() ?? ""); setEditingQuantity(true); }}
                      className="text-xs text-gray-500 hover:text-white border border-white/10 rounded px-2 py-0.5 ml-1 transition-colors"
                    >Update</button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} step={1} value={quantityInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuantityInput(val.includes(".") ? String(Math.round(parseFloat(val))) : val);
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveQuantity(); if (e.key === "Escape") setEditingQuantity(false); }}
                      autoFocus
                      className="w-24 rounded bg-white/10 border border-white/20 text-white text-sm px-2 py-1 focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-gray-400 text-sm">{item.unit ?? ""}</span>
                    <button
                      onClick={handleSaveQuantity} disabled={isSavingQuantity || quantityInput === ""}
                      className="text-xs rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-2 py-1"
                    >{isSavingQuantity ? "..." : "Save"}</button>
                    <button onClick={() => setEditingQuantity(false)} className="text-xs text-gray-500 hover:text-white px-1">Cancel</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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

  function handleQuantityUpdated(id: string, newQuantity: number) {
    setReagents((prev) => prev.map((r) => (r.id === id ? { ...r, quantity: newQuantity } : r)));
  }

  const addBatchItem = addBatchItemId ? reagents.find((r) => r.id === addBatchItemId) : null;

  if (loading) return <div className="text-white/40 text-sm py-8 text-center">Loading…</div>;
  if (!reagents.length) return (
    <div className="text-white/40 text-sm py-12 text-center">
      No reagents yet.{" "}
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
                anyMarked ? "border-orange-500/40"
                : groupStatus === "red"   ? "border-red-500/60"
                : groupStatus === "amber" ? "border-amber-500/60"
                : "border-white/10"
              }`}
            >
              {/* Group header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => stocks.forEach((s) => toggleExpand(s.id))}
              >
                <span className="text-white font-semibold flex-1">
                  {stocks[0].name}
                  {anyMarked && <span className="ml-2 text-orange-400/70 text-xs font-normal">⚑ flagged</span>}
                </span>
                <div className="flex items-center gap-2">
                  {groupStatus === "red"   && <span className="text-red-400 text-xs">🔴 Low stock</span>}
                  {groupStatus === "amber" && !anyMarked && <span className="text-amber-400 text-xs">⚠️ Low stock</span>}
                  <span className="text-white/30 text-xs">{stocks.length} stock{stocks.length !== 1 ? "s" : ""}</span>
                  <span className="text-white/30 text-sm">{groupExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

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
                      expanded={expandedIds.has(r.id)}
                      lots={lotsMap[r.id] ?? []}
                      onToggle={() => toggleExpand(r.id)}
                      onQuantityUpdated={handleQuantityUpdated}
                      onEdit={() => setEditingItem(r)}
                      onReload={load}
                      onAddBatch={() => setAddBatchItemId(r.id)}
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
