"use client";

import { useState } from "react";

export type Binder = {
  id: string;
  type: string;
  name: string;
  attachPoint?: string | null;
  description?: string | null;
};

const BINDER_TYPES = ["MEDITOPE", "FCR_BINDER", "CUSTOM"] as const;
const binderLabel = (t: string) => (t === "MEDITOPE" ? "Meditope" : t === "FCR_BINDER" ? "FcR Binder" : "Custom");
const INPUT = "w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2";

export default function BinderSection({
  antibodyId, binders, canEdit, onBindersChange,
}: {
  antibodyId: string;
  binders: Binder[];
  canEdit: boolean;
  onBindersChange: () => void;
}) {
  const [showAddBinder, setShowAddBinder] = useState(false);
  const [binderType, setBinderType] = useState<string>("MEDITOPE");
  const [binderName, setBinderName] = useState("");
  const [attachPoint, setAttachPoint] = useState("");
  const [binderDescription, setBinderDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAddBinder() {
    if (!binderName.trim() || busy) return;
    setBusy(true);
    // Identity comes from the session actor — no createdBy sent.
    const res = await fetch(`/api/antibodies/${antibodyId}/binders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: binderType,
        name: binderName.trim(),
        attachPoint: attachPoint.trim() || undefined,
        description: binderDescription.trim() || undefined,
      }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) {
      setBinderName(""); setAttachPoint(""); setBinderDescription(""); setBinderType("MEDITOPE");
      setShowAddBinder(false);
      onBindersChange();
    }
  }

  async function handleDeleteBinder(id: string) {
    if (busy) return;
    setBusy(true);
    const res = await fetch(`/api/antibodies/${antibodyId}/binders/${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res && res.ok) onBindersChange();
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Binders</h3>
        {canEdit && (
          <button onClick={() => setShowAddBinder((v) => !v)}
            className="text-xs rounded bg-pink-500/20 border border-pink-500/40 text-pink-300 px-2 py-1">
            + Add Binder
          </button>
        )}
      </div>

      {binders.length === 0 ? (
        <p className="text-gray-600 text-sm">
          No binders attached. Meditopes, FcR binders, or custom conjugates can be added here.
        </p>
      ) : (
        <div className="space-y-2">
          {binders.map((binder) => (
            <div key={binder.id} className="flex items-center justify-between rounded-lg border border-pink-500/30 bg-pink-500/5 p-3">
              <div>
                <span className="text-xs rounded bg-pink-500/20 text-pink-300 px-1.5 py-0.5">{binderLabel(binder.type)}</span>
                <span className="text-white text-sm ml-2">{binder.name}</span>
                {binder.attachPoint && <span className="text-xs text-gray-500 ml-2">@ {binder.attachPoint}</span>}
                {binder.description && <p className="text-gray-500 text-xs mt-1">{binder.description}</p>}
              </div>
              {canEdit && (
                <button onClick={() => handleDeleteBinder(binder.id)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddBinder && canEdit && (
        <div className="mt-3 border-t border-white/10 pt-3 space-y-3">
          <div className="flex gap-2">
            {BINDER_TYPES.map((t) => (
              <button key={t} onClick={() => setBinderType(t)}
                className={`text-xs rounded px-2 py-1 border ${binderType === t ? "bg-pink-500/20 border-pink-500 text-pink-300" : "bg-white/5 border-white/10 text-gray-400"}`}>
                {binderLabel(t)}
              </button>
            ))}
          </div>
          <input type="text" placeholder="Binder name" value={binderName} onChange={(e) => setBinderName(e.target.value)} className={INPUT} />
          <input type="text" placeholder="Attach point (optional)" value={attachPoint} onChange={(e) => setAttachPoint(e.target.value)} className={INPUT} />
          <textarea placeholder="Description (optional)" value={binderDescription} onChange={(e) => setBinderDescription(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
          <button onClick={handleAddBinder} disabled={!binderName.trim() || busy}
            className="w-full rounded bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-sm py-2">
            {busy ? "Adding…" : "Add Binder"}
          </button>
        </div>
      )}
    </div>
  );
}
