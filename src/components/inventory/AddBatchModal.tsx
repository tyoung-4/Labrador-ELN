"use client";

import React, { useState, useRef } from "react";
import ProteinBatchForm from "./ProteinBatchForm";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BatchItemType = "reagent" | "cellline" | "plasmid" | "proteinstock";

interface AddBatchModalProps {
  itemType:        BatchItemType;
  itemId:          string;
  itemName:        string;
  currentUser:     string;
  parentUnit?:     string;       // pre-fill unit for reagent lots
  useParentThreshold?: boolean;  // if false, show per-batch threshold section
  onSuccess:       (batch: any) => void;
  onClose:         () => void;
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

const INPUT = "w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30";
const LABEL = "text-xs text-gray-400 uppercase tracking-wide mb-1 block";

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

function ThresholdSection({
  thresholdType, setThresholdType,
  amber, setAmber,
  red, setRed,
}: {
  thresholdType: string; setThresholdType: (v: string) => void;
  amber: string; setAmber: (v: string) => void;
  red: string; setRed: (v: string) => void;
}) {
  const thresholdError =
    thresholdType !== "none" && amber && red &&
    parseFloat(red) >= parseFloat(amber);

  return (
    <div>
      <label className={LABEL}>Low Stock Warning</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {["none", "volume", "mass", "count"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setThresholdType(t)}
            className={`text-xs rounded px-3 py-1 border transition-colors ${
              thresholdType === t
                ? "bg-purple-500/20 border-purple-500 text-purple-300"
                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
            }`}
          >
            {t === "none" ? "None" : t === "volume" ? "Volume (µL)" : t === "mass" ? "Mass (mg)" : "Count"}
          </button>
        ))}
      </div>
      {thresholdType !== "none" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">⚠️ Amber threshold</label>
            <input type="number" min="0" step="0.1" value={amber}
              onChange={(e) => setAmber(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">🔴 Red threshold</label>
            <input type="number" min="0" step="0.1" value={red}
              onChange={(e) => setRed(e.target.value)} className={INPUT} />
          </div>
        </div>
      )}
      {thresholdError && (
        <p className="text-red-400 text-xs mt-1">Red threshold must be less than amber threshold.</p>
      )}
    </div>
  );
}

// ─── File attachment section ─────────────────────────────────────────────────

interface PendingFile { file: File; id: string; }

function AttachmentPicker({
  files, setFiles,
}: {
  files: PendingFile[];
  setFiles: React.Dispatch<React.SetStateAction<PendingFile[]>>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = Array.from(incoming).map((f) => ({ file: f, id: crypto.randomUUID() }));
    setFiles((prev) => [...prev, ...next]);
  }

  return (
    <div>
      <label className={LABEL}>Attachments</label>
      <div
        className={`rounded border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
          dragging ? "border-purple-500/60 bg-purple-500/10" : "border-white/10 hover:border-white/20"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <p className="text-xs text-gray-500">Drag &amp; drop files here, or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map(({ file, id }) => (
            <li key={id} className="flex items-center justify-between text-xs text-white/60 bg-white/5 rounded px-2 py-1">
              <span className="truncate">{file.name}</span>
              <span className="ml-2 shrink-0 text-white/30">
                {file.size > 1024 * 1024
                  ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                  : `${Math.round(file.size / 1024)} KB`}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((f) => f.id !== id)); }}
                className="ml-2 text-white/30 hover:text-red-400 transition-colors"
              >✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function uploadFiles(files: PendingFile[], fkField: string, fkValue: string) {
  for (const { file } of files) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append(fkField, fkValue);
    await fetch("/api/inventory/attachments", { method: "POST", body: fd });
  }
}

// ─── Reagent Lot form ─────────────────────────────────────────────────────────

function ReagentLotForm({
  itemId, currentUser, parentUnit, useParentThreshold, onSuccess, onCancel,
}: {
  itemId: string; currentUser: string; parentUnit?: string;
  useParentThreshold: boolean;
  onSuccess: (lot: any) => void; onCancel: () => void;
}) {
  const [lotNumber,      setLotNumber]      = useState("");
  const [quantity,       setQuantity]       = useState("");
  const [unit,           setUnit]           = useState(parentUnit ?? "");
  const [supplier,       setSupplier]       = useState("");
  const [catalogNumber,  setCatalogNumber]  = useState("");
  const [expiryDate,     setExpiryDate]     = useState("");
  const [receivedDate,   setReceivedDate]   = useState("");
  const [receivedBy,     setReceivedBy]     = useState(currentUser);
  const [notes,          setNotes]          = useState("");
  const [thresholdType,  setThresholdType]  = useState("none");
  const [amber,          setAmber]          = useState("");
  const [red,            setRed]            = useState("");
  const [files,          setFiles]          = useState<PendingFile[]>([]);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState("");

  const canSubmit = !submitting && !!quantity && Number(quantity) > 0 && !!unit.trim();

  async function handleSubmit() {
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/inventory/reagents/${itemId}/lots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify({
          lotNumber:      lotNumber.trim()    || null,
          quantity:       Number(quantity),
          unit:           unit.trim(),
          supplier:       supplier.trim()     || null,
          catalogNumber:  catalogNumber.trim()|| null,
          expiryDate:     expiryDate          || null,
          receivedDate:   receivedDate        || null,
          receivedBy:     receivedBy.trim()   || currentUser,
          notes:          notes.trim()        || null,
          lowThresholdType:  useParentThreshold ? null : (thresholdType !== "none" ? thresholdType : null),
          lowThresholdAmber: !useParentThreshold && thresholdType !== "none" && amber ? Number(amber) : null,
          lowThresholdRed:   !useParentThreshold && thresholdType !== "none" && red   ? Number(red)   : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create lot");
      const lot = await res.json();
      if (files.length > 0) await uploadFiles(files, "reagentLotId", lot.id);
      onSuccess(lot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving lot");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Lot Number">
          <input type="text" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Received Date">
          <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={<>Quantity <span className="text-red-400">*</span></>}>
          <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={INPUT} />
        </Field>
        <Field label={<>Unit <span className="text-red-400">*</span></>}>
          <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="mL, mg, boxes…" className={INPUT} />
        </Field>
      </div>
      <Field label="Supplier">
        <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} className={INPUT} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Catalog Number">
          <input type="text" value={catalogNumber} onChange={(e) => setCatalogNumber(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Expiry Date">
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Field label="Received By">
        <input type="text" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
      </Field>
      {!useParentThreshold && (
        <ThresholdSection
          thresholdType={thresholdType} setThresholdType={setThresholdType}
          amber={amber} setAmber={setAmber} red={red} setRed={setRed}
        />
      )}
      <AttachmentPicker files={files} setFiles={setFiles} />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <FormFooter onCancel={onCancel} onSubmit={handleSubmit} canSubmit={canSubmit} submitting={submitting} />
    </div>
  );
}

// ─── Cell Line Passage form ───────────────────────────────────────────────────

function CellLinePassageForm({
  itemId, currentUser, useParentThreshold, onSuccess, onCancel,
}: {
  itemId: string; currentUser: string;
  useParentThreshold: boolean;
  onSuccess: (passage: any) => void; onCancel: () => void;
}) {
  const [passage,          setPassage]          = useState("");
  const [vialCount,        setVialCount]        = useState("");
  const [freezeBackDate,   setFreezeBackDate]   = useState("");
  const [freezingSolution, setFreezingSolution] = useState("");
  const [frozenBy,         setFrozenBy]         = useState(currentUser);
  const [storageLocation,  setStorageLocation]  = useState("");
  const [notes,            setNotes]            = useState("");
  const [thresholdType,    setThresholdType]    = useState("none");
  const [amber,            setAmber]            = useState("");
  const [red,              setRed]              = useState("");
  const [files,            setFiles]            = useState<PendingFile[]>([]);
  const [submitting,       setSubmitting]       = useState(false);
  const [error,            setError]            = useState("");

  const canSubmit = !submitting;

  async function handleSubmit() {
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/inventory/celllines/${itemId}/passages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify({
          passage:         passage       ? Number(passage)    : null,
          vialCount:       vialCount     ? Number(vialCount)  : null,
          freezeBackDate:  freezeBackDate   || null,
          freezingSolution: freezingSolution.trim() || null,
          frozenBy:        frozenBy.trim()          || currentUser,
          storageLocation: storageLocation.trim()   || null,
          notes:           notes.trim()             || null,
          lowThresholdType:  useParentThreshold ? null : (thresholdType !== "none" ? thresholdType : null),
          lowThresholdAmber: !useParentThreshold && thresholdType !== "none" && amber ? Number(amber) : null,
          lowThresholdRed:   !useParentThreshold && thresholdType !== "none" && red   ? Number(red)   : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create passage");
      const p = await res.json();
      if (files.length > 0) await uploadFiles(files, "cellLinePassageId", p.id);
      onSuccess(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving passage");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Passage #">
          <input type="number" min="0" value={passage} onChange={(e) => setPassage(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Vial Count">
          <input type="number" min="0" value={vialCount} onChange={(e) => setVialCount(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Field label="Freeze-Back Date">
        <input type="date" value={freezeBackDate} onChange={(e) => setFreezeBackDate(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Freezing Solution">
        <input type="text" value={freezingSolution} onChange={(e) => setFreezingSolution(e.target.value)}
          placeholder="e.g. 90% FBS + 10% DMSO" className={INPUT} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Frozen By">
          <input type="text" value={frozenBy} onChange={(e) => setFrozenBy(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Storage Location">
          <input type="text" value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)}
            placeholder="e.g. LN₂ tank 2, box 4" className={INPUT} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
      </Field>
      {!useParentThreshold && (
        <ThresholdSection
          thresholdType={thresholdType} setThresholdType={setThresholdType}
          amber={amber} setAmber={setAmber} red={red} setRed={setRed}
        />
      )}
      <AttachmentPicker files={files} setFiles={setFiles} />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <FormFooter onCancel={onCancel} onSubmit={handleSubmit} canSubmit={canSubmit} submitting={submitting} />
    </div>
  );
}

// ─── Plasmid Prep form ────────────────────────────────────────────────────────

function PlasmidPrepForm({
  itemId, currentUser, useParentThreshold, onSuccess, onCancel,
}: {
  itemId: string; currentUser: string;
  useParentThreshold: boolean;
  onSuccess: (prep: any) => void; onCancel: () => void;
}) {
  const [prepDate,          setPrepDate]          = useState("");
  const [prepType,          setPrepType]          = useState("");
  const [concentration,     setConcentration]     = useState("");
  const [volume,            setVolume]            = useState("");
  const [preparedBy,        setPreparedBy]        = useState(currentUser);
  const [sequenceVerified,  setSequenceVerified]  = useState(false);
  const [notes,             setNotes]             = useState("");
  const [thresholdType,     setThresholdType]     = useState("none");
  const [amber,             setAmber]             = useState("");
  const [red,               setRed]               = useState("");
  const [files,             setFiles]             = useState<PendingFile[]>([]);
  const [submitting,        setSubmitting]        = useState(false);
  const [error,             setError]             = useState("");

  const canSubmit = !submitting;

  async function handleSubmit() {
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/inventory/plasmids/${itemId}/preps`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify({
          prepDate:        prepDate        || null,
          prepType:        prepType.trim() || null,
          concentration:   concentration   ? Number(concentration) : null,
          volume:          volume          ? Number(volume)        : null,
          preparedBy:      preparedBy.trim() || currentUser,
          sequenceVerified,
          notes:           notes.trim()   || null,
          lowThresholdType:  useParentThreshold ? null : (thresholdType !== "none" ? thresholdType : null),
          lowThresholdAmber: !useParentThreshold && thresholdType !== "none" && amber ? Number(amber) : null,
          lowThresholdRed:   !useParentThreshold && thresholdType !== "none" && red   ? Number(red)   : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create prep");
      const prep = await res.json();
      if (files.length > 0) await uploadFiles(files, "plasmidPrepId", prep.id);
      onSuccess(prep);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving prep");
      setSubmitting(false);
    }
  }

  const PREP_TYPES = ["Miniprep", "Maxiprep", "Gigaprep", "Other"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Prep Date">
          <input type="date" value={prepDate} onChange={(e) => setPrepDate(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Prep Type">
          <select value={prepType} onChange={(e) => setPrepType(e.target.value)}
            className={`${INPUT} appearance-none`}>
            <option value="">— select —</option>
            {PREP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Concentration (ng/µL)">
          <input type="number" min="0" step="any" value={concentration} onChange={(e) => setConcentration(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Volume (µL)">
          <input type="number" min="0" step="any" value={volume} onChange={(e) => setVolume(e.target.value)} className={INPUT} />
        </Field>
      </div>
      <Field label="Prepared By">
        <input type="text" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} className={INPUT} />
      </Field>
      <div className="flex items-center gap-2">
        <input
          id="seqVerified"
          type="checkbox"
          checked={sequenceVerified}
          onChange={(e) => setSequenceVerified(e.target.checked)}
          className="rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500"
        />
        <label htmlFor="seqVerified" className="text-sm text-white/70 cursor-pointer">
          Sequence verified
        </label>
      </div>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
      </Field>
      {!useParentThreshold && (
        <ThresholdSection
          thresholdType={thresholdType} setThresholdType={setThresholdType}
          amber={amber} setAmber={setAmber} red={red} setRed={setRed}
        />
      )}
      <AttachmentPicker files={files} setFiles={setFiles} />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <FormFooter onCancel={onCancel} onSubmit={handleSubmit} canSubmit={canSubmit} submitting={submitting} />
    </div>
  );
}

// ─── Shared footer buttons ────────────────────────────────────────────────────

function FormFooter({
  onCancel, onSubmit, canSubmit, submitting,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  submitting: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2 border-t border-white/10 mt-2">
      <button onClick={onCancel} className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors">
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`text-sm rounded px-4 py-2 font-medium transition-colors ${
          !canSubmit
            ? "bg-purple-600/40 text-white/40 cursor-not-allowed"
            : "bg-purple-600 hover:bg-purple-700 text-white"
        }`}
      >
        {submitting ? "Saving…" : "Add Batch"}
      </button>
    </div>
  );
}

// ─── Modal titles ─────────────────────────────────────────────────────────────

const TITLES: Record<BatchItemType, string> = {
  reagent:      "Add Reagent Lot",
  cellline:     "Add Cell Line Passage",
  plasmid:      "Add Plasmid Prep",
  proteinstock: "Add Protein Batch",
};

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function AddBatchModal({
  itemType,
  itemId,
  itemName,
  currentUser,
  parentUnit,
  useParentThreshold = true,
  onSuccess,
  onClose,
}: AddBatchModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-white font-bold">{TITLES[itemType]}</h2>
            <p className="text-xs text-white/40 mt-0.5">{itemName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {itemType === "reagent" && (
            <ReagentLotForm
              itemId={itemId}
              currentUser={currentUser}
              parentUnit={parentUnit}
              useParentThreshold={useParentThreshold}
              onSuccess={onSuccess}
              onCancel={onClose}
            />
          )}
          {itemType === "cellline" && (
            <CellLinePassageForm
              itemId={itemId}
              currentUser={currentUser}
              useParentThreshold={useParentThreshold}
              onSuccess={onSuccess}
              onCancel={onClose}
            />
          )}
          {itemType === "plasmid" && (
            <PlasmidPrepForm
              itemId={itemId}
              currentUser={currentUser}
              useParentThreshold={useParentThreshold}
              onSuccess={onSuccess}
              onCancel={onClose}
            />
          )}
          {itemType === "proteinstock" && (
            <ProteinBatchForm
              proteinStockId={itemId}
              proteinName={itemName}
              currentUser={currentUser}
              onSuccess={onSuccess}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
