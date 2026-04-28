"use client";

import React, { useState } from "react";

type ProteinBatchFormProps = {
  proteinStockId: string;
  proteinName: string;
  currentUser: string;
  existing?: any;
  onSuccess: (batch: any) => void;
  onCancel: () => void;
};

function generateBatchIdPreview(proteinName: string, date: string): string {
  if (!date) return "";
  const prefix = proteinName
    .replace(/[^A-Za-z0-9]/g, "")
    .substring(0, 6)
    .toUpperCase();
  const dateStr = date.replace(/-/g, "");
  return `${prefix}-${dateStr}-A`;
}

export default function ProteinBatchForm({
  proteinStockId,
  proteinName,
  currentUser,
  existing,
  onSuccess,
  onCancel,
}: ProteinBatchFormProps) {
  const isEdit = Boolean(existing);

  const [purificationDate, setPurificationDate] = useState(
    existing?.purificationDate
      ? new Date(existing.purificationDate).toISOString().slice(0, 10)
      : ""
  );
  const [initialVolume, setInitialVolume] = useState(
    existing?.initialVolume != null ? String(existing.initialVolume) : ""
  );
  const [concentration, setConcentration] = useState(
    existing?.concentration != null ? String(existing.concentration) : ""
  );
  const [mw, setMw] = useState(existing?.mw != null ? String(existing.mw) : "");
  const [extinctionCoeff, setExtinctionCoeff] = useState(
    existing?.extinctionCoeff != null ? String(existing.extinctionCoeff) : ""
  );
  const [a280Ratio, setA280Ratio] = useState(
    existing?.a280 != null ? String(existing.a280) : ""
  );
  const [storageBuffer, setStorageBuffer] = useState(existing?.storageBuffer ?? "");
  const [storageLocationText, setStorageLocationText] = useState(
    existing?.storageLocationText ?? ""
  );
  const [lowThresholdType, setLowThresholdType] = useState(
    existing?.lowThresholdType ?? "none"
  );
  const [lowThresholdAmber, setLowThresholdAmber] = useState(
    existing?.lowThresholdAmber != null ? String(existing.lowThresholdAmber) : ""
  );
  const [lowThresholdRed, setLowThresholdRed] = useState(
    existing?.lowThresholdRed != null ? String(existing.lowThresholdRed) : ""
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showWarning, setShowWarning] = useState(false);

  const thresholdError =
    lowThresholdType !== "none" &&
    lowThresholdAmber &&
    lowThresholdRed &&
    parseFloat(lowThresholdRed) >= parseFloat(lowThresholdAmber);

  const canSubmit =
    !submitting &&
    !thresholdError &&
    (isEdit ? true : Boolean(purificationDate && initialVolume && Number(initialVolume) > 0));

  const batchIdPreview = isEdit
    ? existing.batchId
    : generateBatchIdPreview(proteinName, purificationDate);

  async function doSubmit(warningShown = false) {
    setSubmitting(true);
    setError("");
    try {
      let res: Response;
      if (isEdit) {
        res = await fetch(
          `/api/inventory/proteinstocks/${proteinStockId}/batches/${existing.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-user-name": currentUser },
            body: JSON.stringify({
              concentration: concentration ? Number(concentration) : null,
              mw: mw ? Number(mw) : null,
              extinctionCoeff: extinctionCoeff ? Number(extinctionCoeff) : null,
              a280: a280Ratio ? Number(a280Ratio) : null,
              storageBuffer: storageBuffer || null,
              storageLocationText: storageLocationText || null,
              lowThresholdType: lowThresholdType !== "none" ? lowThresholdType : null,
              lowThresholdAmber: lowThresholdAmber ? Number(lowThresholdAmber) : null,
              lowThresholdRed: lowThresholdRed ? Number(lowThresholdRed) : null,
              notes: notes || null,
              warningShown,
            }),
          }
        );
      } else {
        res = await fetch(`/api/inventory/proteinstocks/${proteinStockId}/batches`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-name": currentUser },
          body: JSON.stringify({
            purificationDate,
            initialVolume: Number(initialVolume),
            concentration: concentration ? Number(concentration) : null,
            mw: mw ? Number(mw) : null,
            extinctionCoeff: extinctionCoeff ? Number(extinctionCoeff) : null,
            a280: a280Ratio ? Number(a280Ratio) : null,
            storageBuffer: storageBuffer || null,
            storageLocationText: storageLocationText || null,
            lowThresholdType: lowThresholdType !== "none" ? lowThresholdType : null,
            lowThresholdAmber: lowThresholdAmber ? Number(lowThresholdAmber) : null,
            lowThresholdRed: lowThresholdRed ? Number(lowThresholdRed) : null,
            notes: notes || null,
            createdBy: currentUser,
          }),
        });
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save batch");
      }
      const batch = await res.json();
      onSuccess(batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving batch");
      setSubmitting(false);
    }
  }

  function handleSaveClick() {
    if (isEdit) {
      setShowWarning(true);
    } else {
      doSubmit(false);
    }
  }

  // Warning confirmation modal
  if (showWarning) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
        <div className="bg-gray-900 border border-amber-500/50 rounded-xl p-6 w-full max-w-md mx-4">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-amber-400 text-2xl">⚠️</span>
            <div>
              <h3 className="text-white font-bold mb-1">Edit Completed Batch</h3>
              <p className="text-gray-300 text-sm">
                You are editing a field on a completed batch. This change will be
                logged in the audit history. Continue?
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { setShowWarning(false); setSubmitting(false); }}
              className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowWarning(false); doSubmit(true); }}
              className="text-sm rounded bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 font-medium transition-colors"
            >
              Save &amp; Log Change
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Purification Date */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Purification Date <span className="text-red-400">*</span>
        </label>
        {isEdit ? (
          <p className="text-white/60 text-sm px-3 py-2 bg-white/5 rounded border border-white/10">
            {new Date(existing.purificationDate).toLocaleDateString()}
            <span className="text-gray-600 text-xs ml-2">(immutable)</span>
          </p>
        ) : (
          <input
            type="date"
            value={purificationDate}
            onChange={(e) => setPurificationDate(e.target.value)}
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30"
          />
        )}
      </div>

      {/* Batch ID preview / display */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          {isEdit ? "Batch ID (cannot be changed)" : "Batch ID Preview"}
        </label>
        <p className="text-white/60 text-sm font-mono px-3 py-2 bg-white/5 rounded border border-white/10">
          {batchIdPreview || <span className="text-gray-600 italic">select a date</span>}
        </p>
      </div>

      {/* Initial Volume */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Initial Volume (µL) <span className="text-red-400">*</span>
        </label>
        {isEdit ? (
          <p className="text-white/60 text-sm px-3 py-2 bg-white/5 rounded border border-white/10">
            {existing.initialVolume.toLocaleString()} µL
            <span className="text-gray-600 text-xs ml-2">(immutable)</span>
          </p>
        ) : (
          <input
            type="number"
            value={initialVolume}
            onChange={(e) => setInitialVolume(e.target.value)}
            min="1"
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        )}
      </div>

      {/* Current Volume — always read-only */}
      {isEdit && (
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            Current Volume (managed via usage events)
          </label>
          <p className="text-white/60 text-sm px-3 py-2 bg-white/5 rounded border border-white/10">
            {existing.currentVolume.toLocaleString()} µL
          </p>
        </div>
      )}

      {/* Concentration */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Concentration (mg/mL)
        </label>
        <input
          type="number"
          value={concentration}
          onChange={(e) => setConcentration(e.target.value)}
          min="0"
          step="0.01"
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* MW & Extinction Coefficient */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            MW (kDa)
          </label>
          <input
            type="number"
            value={mw}
            onChange={(e) => setMw(e.target.value)}
            min="0"
            step="0.1"
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            Extinction Coeff (M⁻¹cm⁻¹)
          </label>
          <input
            type="number"
            value={extinctionCoeff}
            onChange={(e) => setExtinctionCoeff(e.target.value)}
            min="0"
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        </div>
      </div>

      {/* A280/260 Ratio */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          A280/260 Ratio
        </label>
        <input
          type="number"
          value={a280Ratio}
          onChange={(e) => setA280Ratio(e.target.value)}
          min="0"
          step="0.01"
          placeholder="e.g. 1.8"
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
        <p className="text-gray-500 text-xs mt-1">
          Ratio &gt; 1.7 indicates low nucleic acid contamination
        </p>
      </div>

      {/* Storage Buffer */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Storage Buffer
        </label>
        <input
          type="text"
          value={storageBuffer}
          onChange={(e) => setStorageBuffer(e.target.value)}
          placeholder="e.g. 20 mM HEPES pH 7.4, 150 mM NaCl, 5% glycerol"
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Storage Location */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Storage Location
        </label>
        <input
          type="text"
          value={storageLocationText}
          onChange={(e) => setStorageLocationText(e.target.value)}
          placeholder="e.g. -80°C Freezer 1 → Shelf 2 → Box 3 → A4"
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
        <p className="text-gray-500 text-xs mt-1">
          Full structured location selector coming soon
        </p>
      </div>

      {/* Low Stock Warning */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Low Stock Warning
        </label>
        <div className="flex gap-2 mb-2">
          {["none", "volume", "mass", "percentage"].map((t) => (
            <button
              key={t}
              onClick={() => setLowThresholdType(t)}
              className={`text-sm rounded px-3 py-1.5 border transition-colors ${
                lowThresholdType === t
                  ? "bg-purple-500/20 border-purple-500 text-purple-300"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
              }`}
            >
              {t === "none" ? "None" : t === "volume" ? "Volume (µL)" : t === "mass" ? "Mass (mg)" : "Percentage (%)"}
            </button>
          ))}
        </div>
        {lowThresholdType !== "none" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">⚠ Amber warning</label>
              <input
                type="number"
                value={lowThresholdAmber}
                onChange={(e) => setLowThresholdAmber(e.target.value)}
                min="0"
                className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">🔴 Red warning</label>
              <input
                type="number"
                value={lowThresholdRed}
                onChange={(e) => setLowThresholdRed(e.target.value)}
                min="0"
                className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        )}
        {thresholdError && (
          <p className="text-red-400 text-xs mt-1">
            Red threshold must be lower than amber threshold.
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-2 border-t border-white/10 mt-4">
        <button
          onClick={onCancel}
          className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveClick}
          disabled={!canSubmit}
          className={`text-sm rounded px-4 py-2 font-medium transition-colors ${
            !canSubmit
              ? "bg-purple-600/40 text-white/40 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700 text-white"
          }`}
        >
          {submitting ? "Saving..." : isEdit ? "Save Changes" : "Add Batch"}
        </button>
      </div>
    </div>
  );
}
