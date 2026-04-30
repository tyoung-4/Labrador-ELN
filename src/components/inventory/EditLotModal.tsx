"use client";

import React, { useState } from "react";

export interface ReagentLotForEdit {
  id: string;
  lotNumber: string | null;
  quantity: number;
  unit: string;
  supplier: string | null;
  catalogNumber: string | null;
  expiryDate: string | null;
  receivedDate: string | null;
  receivedBy: string | null;
  notes: string | null;
  lowThresholdType: string | null;
  lowThresholdAmber: number | null;
  lowThresholdRed: number | null;
  createdAt: string;
}

interface Props {
  reagentId: string;
  lot: ReagentLotForEdit;
  currentUser: string;
  useParentThreshold: boolean;
  onSaved: (updated: ReagentLotForEdit & { attachments: { id: string }[] }) => void;
  onClose: () => void;
}

export default function EditLotModal({ reagentId, lot, currentUser, useParentThreshold, onSaved, onClose }: Props) {
  const [form, setForm] = useState({
    lotNumber:        lot.lotNumber      ?? "",
    quantity:         lot.quantity.toString(),
    unit:             lot.unit,
    supplier:         lot.supplier       ?? "",
    catalogNumber:    lot.catalogNumber  ?? "",
    expiryDate:       lot.expiryDate     ? lot.expiryDate.split("T")[0]    : "",
    receivedDate:     lot.receivedDate   ? lot.receivedDate.split("T")[0]  : "",
    notes:            lot.notes          ?? "",
    lowThresholdType:  lot.lowThresholdType  ?? "none",
    lowThresholdAmber: lot.lowThresholdAmber != null ? lot.lowThresholdAmber.toString() : "",
    lowThresholdRed:   lot.lowThresholdRed   != null ? lot.lowThresholdRed.toString()   : "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k: keyof typeof form, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty < 0) { setError("Quantity must be 0 or greater"); return; }
    if (!form.unit.trim()) { setError("Unit is required"); return; }

    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        lotNumber:     form.lotNumber    || null,
        quantity:      qty,
        unit:          form.unit.trim(),
        supplier:      form.supplier     || null,
        catalogNumber: form.catalogNumber || null,
        expiryDate:    form.expiryDate    || null,
        receivedDate:  form.receivedDate  || null,
        notes:         form.notes         || null,
      };
      if (!useParentThreshold) {
        body.lowThresholdType  = form.lowThresholdType === "none" ? null : form.lowThresholdType;
        body.lowThresholdAmber = form.lowThresholdAmber ? parseFloat(form.lowThresholdAmber) : null;
        body.lowThresholdRed   = form.lowThresholdRed   ? parseFloat(form.lowThresholdRed)   : null;
      }

      const res = await fetch(`/api/inventory/reagents/${reagentId}/lots/${lot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save");
        return;
      }
      const updated = await res.json();
      onSaved(updated);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-white font-bold">Edit Lot</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {/* Read-only fields */}
          <div className="grid grid-cols-2 gap-4 pb-3 border-b border-white/10">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Received By</p>
              <p className="text-white/70 text-sm">{lot.receivedBy ?? "—"}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Added</p>
              <p className="text-white/70 text-sm">{new Date(lot.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Lot Number */}
          <div>
            <label className="text-white/60 text-xs uppercase tracking-wide">Lot Number</label>
            <input
              type="text" value={form.lotNumber} onChange={(e) => set("lotNumber", e.target.value)}
              className="mt-1 w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-teal-400/50 transition-colors"
            />
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/60 text-xs uppercase tracking-wide">Quantity</label>
              <input
                type="number" min={0} value={form.quantity} onChange={(e) => set("quantity", e.target.value)}
                className="mt-1 w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-teal-400/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-white/60 text-xs uppercase tracking-wide">Unit</label>
              <input
                type="text" value={form.unit} onChange={(e) => set("unit", e.target.value)}
                className="mt-1 w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-teal-400/50 transition-colors"
              />
            </div>
          </div>

          {/* Supplier */}
          <div>
            <label className="text-white/60 text-xs uppercase tracking-wide">Supplier</label>
            <input
              type="text" value={form.supplier} onChange={(e) => set("supplier", e.target.value)}
              className="mt-1 w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-teal-400/50 transition-colors"
            />
          </div>

          {/* Catalog Number */}
          <div>
            <label className="text-white/60 text-xs uppercase tracking-wide">Catalog Number</label>
            <input
              type="text" value={form.catalogNumber} onChange={(e) => set("catalogNumber", e.target.value)}
              className="mt-1 w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-teal-400/50 transition-colors"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/60 text-xs uppercase tracking-wide">Received Date</label>
              <input
                type="date" value={form.receivedDate} onChange={(e) => set("receivedDate", e.target.value)}
                className="mt-1 w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-teal-400/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-white/60 text-xs uppercase tracking-wide">Expiry Date</label>
              <input
                type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)}
                className="mt-1 w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-teal-400/50 transition-colors"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-white/60 text-xs uppercase tracking-wide">Notes</label>
            <textarea
              value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3}
              className="mt-1 w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-teal-400/50 transition-colors resize-none"
            />
          </div>

          {/* Per-lot thresholds — only if parent doesn't use its own */}
          {!useParentThreshold && (
            <div className="pt-2 border-t border-white/10 space-y-3">
              <p className="text-white/40 text-xs uppercase tracking-wide">Low Stock Thresholds</p>
              <select
                value={form.lowThresholdType}
                onChange={(e) => set("lowThresholdType", e.target.value)}
                className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-teal-400/50"
              >
                <option value="none">None</option>
                <option value="volume">Volume</option>
                <option value="mass">Mass</option>
                <option value="count">Count</option>
              </select>
              {form.lowThresholdType !== "none" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-amber-400/70 text-xs">⚠️ Amber threshold</label>
                    <input
                      type="number" min={0} value={form.lowThresholdAmber}
                      onChange={(e) => set("lowThresholdAmber", e.target.value)}
                      className="mt-1 w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-amber-400/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-red-400/70 text-xs">🔴 Red threshold</label>
                    <input
                      type="number" min={0} value={form.lowThresholdRed}
                      onChange={(e) => set("lowThresholdRed", e.target.value)}
                      className="mt-1 w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-red-400/50 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex gap-3 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || !form.unit.trim() || form.quantity === ""}
            className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={onClose}
            className="px-4 text-white/50 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
