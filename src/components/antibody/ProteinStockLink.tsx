"use client";

import { useEffect, useState } from "react";

// Optional link between an antibody design and a physical ProteinStock in
// Inventory — the lightweight bridge to assay data. The link lives on
// Antibody.proteinStockId (PATCH /api/antibodies/[id]).

type Stock = { id: string; name: string };

export default function ProteinStockLink({
  antibodyId, currentProteinStockId, proteinStockName, canEdit, onLinkChange,
}: {
  antibodyId: string;
  currentProteinStockId: string | null;
  proteinStockName?: string | null;
  canEdit: boolean;
  onLinkChange: () => void;
}) {
  const [availableStocks, setAvailableStocks] = useState<Stock[]>([]);
  const [selectedStockId, setSelectedStockId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canEdit || currentProteinStockId) return;
    fetch("/api/inventory/proteinstocks")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAvailableStocks(Array.isArray(d) ? d.map((s: Stock) => ({ id: s.id, name: s.name })) : []))
      .catch(() => setAvailableStocks([]));
  }, [canEdit, currentProteinStockId]);

  async function patchStock(proteinStockId: string | null) {
    setBusy(true);
    const res = await fetch(`/api/antibodies/${antibodyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proteinStockId }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) { setSelectedStockId(""); onLinkChange(); }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-semibold text-sm">Linked Protein Stock</h3>
        <span className="text-xs text-gray-600">Connects this design to physical material</span>
      </div>

      {currentProteinStockId ? (
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
          <div>
            <span className="text-white text-sm">🧪 {proteinStockName ?? "Linked stock"}</span>
            <p className="text-xs text-gray-500">Physical material in Inventory</p>
          </div>
          <div className="flex gap-3">
            <a href="/inventory?tab=proteins" className="text-xs text-blue-400 hover:underline">View in Inventory →</a>
            {canEdit && (
              <button onClick={() => patchStock(null)} disabled={busy} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40">Unlink</button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-gray-600 text-sm mb-2">Not linked to a protein stock yet.</p>
          {canEdit && (
            <div className="flex gap-2">
              <select value={selectedStockId} onChange={(e) => setSelectedStockId(e.target.value)}
                className="flex-1 rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2">
                <option value="">Select a protein stock…</option>
                {availableStocks.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={() => patchStock(selectedStockId)} disabled={!selectedStockId || busy}
                className="rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm px-3 py-2">
                Link
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
