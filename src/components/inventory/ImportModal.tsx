"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import type { ImportCategory } from "@/app/api/inventory/import/route";

// ── Types ──────────────────────────────────────────────────────────────────
interface SheetInfo {
  name: string;
  rowCount: number;
  firstRow: string[];
}

interface ColumnMapping {
  header: string;   // spreadsheet column header (always unique)
  field: string;    // ELN field name, or "" to skip
}

interface MappedRow {
  [key: string]: unknown;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

const NULL_NAME_VALUES = new Set(["taken", "empty", "n/a", "na", "-", "--", ""]);

// ELN fields per category
const CATEGORY_FIELDS: Record<ImportCategory, { value: string; label: string }[]> = {
  reagent: [
    { value: "name", label: "Name *" },
    { value: "category", label: "Category" },
    { value: "quantity", label: "Quantity" },
    { value: "initialQuantity", label: "Initial Quantity" },
    { value: "unit", label: "Unit" },
    { value: "concentration", label: "Concentration" },
    { value: "concUnit", label: "Conc. Unit" },
    { value: "location", label: "Location" },
    { value: "lotNumber", label: "Lot Number" },
    { value: "catalogNumber", label: "Catalog #" },
    { value: "vendor", label: "Vendor/Supplier" },
    { value: "expiryDate", label: "Expiry Date" },
    { value: "owner", label: "Owner" },
    { value: "lowStockThreshold", label: "Low Stock Threshold" },
    { value: "notes", label: "Notes" },
    { value: "tags", label: "Tags" },
  ],
  antibody: [
    { value: "name", label: "Name *" },
    { value: "quantity", label: "Quantity" },
    { value: "unit", label: "Unit" },
    { value: "concentration", label: "Concentration" },
    { value: "concUnit", label: "Conc. Unit" },
    { value: "location", label: "Location" },
    { value: "lotNumber", label: "Lot Number" },
    { value: "catalogNumber", label: "Catalog #" },
    { value: "vendor", label: "Vendor/Supplier" },
    { value: "expiryDate", label: "Expiry Date" },
    { value: "owner", label: "Owner" },
    { value: "notes", label: "Notes" },
  ],
  cellLine: [
    { value: "name", label: "Name *" },
    { value: "species", label: "Species" },
    { value: "tissue", label: "Tissue" },
    { value: "morphology", label: "Morphology" },
    { value: "passage", label: "Passage #" },
    { value: "location", label: "Location" },
    { value: "owner", label: "Owner" },
    { value: "notes", label: "Notes" },
    { value: "tags", label: "Tags" },
  ],
  plasmid: [
    { value: "name", label: "Name *" },
    { value: "backbone", label: "Backbone" },
    { value: "insert", label: "Insert" },
    { value: "resistance", label: "Resistance" },
    { value: "promoter", label: "Promoter" },
    { value: "location", label: "Location" },
    { value: "owner", label: "Owner" },
    { value: "notes", label: "Notes" },
    { value: "tags", label: "Tags" },
  ],
  proteinStock: [
    { value: "name", label: "Name *" },
    { value: "concentration", label: "Concentration" },
    { value: "concUnit", label: "Conc. Unit" },
    { value: "volume", label: "Volume" },
    { value: "volUnit", label: "Vol. Unit" },
    { value: "purity", label: "Purity" },
    { value: "location", label: "Location" },
    { value: "owner", label: "Owner" },
    { value: "notes", label: "Notes" },
    { value: "tags", label: "Tags" },
  ],
};

// Auto-suggest rules: [headerRegex, fieldName]
const AUTO_SUGGEST_RULES: [RegExp, string][] = [
  [/^name$/i, "name"],
  [/\bname\b/i, "name"],
  [/\bquantit/i, "quantity"],
  [/\bamount\b/i, "quantity"],
  [/\bvol(ume)?\b/i, "volume"],
  [/\bconc(entration)?\b/i, "concentration"],
  [/\bunit\b/i, "unit"],
  [/\bloc(ation)?\b/i, "location"],
  [/\broom\b/i, "location"],
  [/\bfreezer\b/i, "location"],
  [/\bfridge\b/i, "location"],
  [/\bposition\b/i, "location"],
  [/\blot\b/i, "lotNumber"],
  [/\bcat(alog)?[\s#]*/i, "catalogNumber"],
  [/\bitem\s*#/i, "catalogNumber"],
  [/\bvendor\b/i, "vendor"],
  [/\bsuppli/i, "vendor"],
  [/\bmanuf/i, "vendor"],
  [/\bexpir/i, "expiryDate"],
  [/\buse[\s-]?by/i, "expiryDate"],
  [/\bowner\b/i, "owner"],
  [/\buser\b/i, "owner"],
  [/\bnote/i, "notes"],
  [/\bcomment/i, "notes"],
  [/\bspecies\b/i, "species"],
  [/\btissue\b/i, "tissue"],
  [/\bpassage\b/i, "passage"],
  [/\bbackbone\b/i, "backbone"],
  [/\binsert\b/i, "insert"],
  [/\bresist/i, "resistance"],
  [/\bpromoter\b/i, "promoter"],
  [/\bpurit/i, "purity"],
  [/\btag\b/i, "tags"],
];

function autoSuggest(header: string, category: ImportCategory): string {
  const fields = CATEGORY_FIELDS[category].map((f) => f.value);
  for (const [regex, field] of AUTO_SUGGEST_RULES) {
    if (regex.test(header) && fields.includes(field)) return field;
  }
  return "";
}

export default function ImportModal({
  currentUser,
  onClose,
  onImportComplete,
}: {
  currentUser: string;
  onClose: () => void;
  onImportComplete: (tab: ImportCategory) => void;
}) {
  const [step, setStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [rawData, setRawData] = useState<Record<string, (string | null)[][]>>({});
  const [selectedSheet, setSelectedSheet] = useState("");
  const [useSheetAsLocation, setUseSheetAsLocation] = useState(false);
  const [category, setCategory] = useState<ImportCategory>("reagent");
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: File processing ────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheetData: Record<string, (string | null)[][]> = {};
    const sheetInfos: SheetInfo[] = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const rows: (string | null)[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: null,
        blankrows: true,
        raw: false,
        dateNF: "yyyy-mm-dd",
      });
      sheetData[name] = rows;
      const nonEmpty = rows.filter((r) => r.some((c) => c !== null && c !== ""));
      const firstRow = (rows[0] ?? []).map((c) => (c === null ? "" : String(c)));
      sheetInfos.push({ name, rowCount: nonEmpty.length, firstRow });
    }
    setRawData(sheetData);
    setSheets(sheetInfos);
    setSelectedSheet(wb.SheetNames[0] ?? "");
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert("Please upload an Excel (.xlsx, .xls) or CSV file.");
      return;
    }
    processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Step 2: Column mapping ─────────────────────────────────────────────
  const sheetRows = useMemo(() => rawData[selectedSheet] ?? [], [rawData, selectedSheet]);

  const headers = useMemo(() => {
    // Find first row where >40% cells are non-empty strings < 60 chars
    for (let i = 0; i < Math.min(sheetRows.length, 10); i++) {
      const row = sheetRows[i];
      if (!row) continue;
      const filled = row.filter((c) => c !== null && String(c).trim().length > 0 && String(c).trim().length < 60);
      if (filled.length >= Math.max(1, row.length * 0.4)) {
        return row.map((c, idx) => (c !== null && String(c).trim() ? String(c).trim() : `Column ${idx + 1}`));
      }
    }
    return (sheetRows[0] ?? []).map((c, i) => (c ? String(c) : `Column ${i + 1}`));
  }, [sheetRows]);

  const dataRows = useMemo(() => {
    // Skip header row
    const headerRowIdx = sheetRows.findIndex((row) => {
      if (!row) return false;
      const filled = row.filter((c) => c !== null && String(c).trim().length > 0 && String(c).trim().length < 60);
      return filled.length >= Math.max(1, row.length * 0.4);
    });
    return sheetRows.slice(headerRowIdx + 1);
  }, [sheetRows]);

  const initMappings = useCallback(() => {
    const m: ColumnMapping[] = headers.map((h) => ({
      header: h,
      field: autoSuggest(h, category),
    }));
    setMappings(m);
    setSelectedRowIds(new Set());
  }, [headers, category]);

  // ── Step 3: Preview rows ───────────────────────────────────────────────
  const allMappedRows = useMemo(() => {
    return dataRows
      .map((row, idx) => {
        if (!row || row.every((c) => c === null || c === "")) return null;
        const obj: MappedRow = {};
        mappings.forEach((m, i) => {
          if (m.field && row[i] !== null && row[i] !== undefined) {
            // If multiple cols map to same field, append
            if (obj[m.field] !== undefined) {
              obj[m.field] = `${obj[m.field]}; ${row[i]}`;
            } else {
              obj[m.field] = row[i];
            }
          }
        });
        if (useSheetAsLocation && !obj.location) obj.location = selectedSheet;
        return { row: obj, idx };
      })
      .filter((item): item is { row: MappedRow; idx: number } => {
        if (!item) return false;
        const n = item.row.name;
        if (n === undefined || n === null) return false;
        const ns = String(n).trim().toLowerCase();
        return ns.length > 0 && !NULL_NAME_VALUES.has(ns);
      });
  }, [dataRows, mappings, useSheetAsLocation, selectedSheet]);

  // initialize selected rows when moving to step 3
  const goToPreview = useCallback(() => {
    setSelectedRowIds(new Set(allMappedRows.map((r) => r.idx)));
    setStep(3);
  }, [allMappedRows]);

  // ── Step 4: Import ─────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    setImporting(true);
    const selectedRows = allMappedRows
      .filter((r) => selectedRowIds.has(r.idx))
      .map((r) => r.row);
    try {
      const res = await fetch("/api/inventory/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, rows: selectedRows }),
      });
      const data = await res.json();
      setResult(data);
      setStep(4);
    } catch (e) {
      setResult({ created: 0, skipped: 0, errors: [String(e)] });
      setStep(4);
    } finally {
      setImporting(false);
    }
  }, [allMappedRows, selectedRowIds, category]);

  const nameNotMapped = mappings.length > 0 && !mappings.some((m) => m.field === "name");

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Import from Excel</h2>
            <p className="text-xs text-white/40 mt-0.5">
              Step {step} of 4 &mdash;{" "}
              {step === 1 ? "Upload File" : step === 2 ? "Map Columns" : step === 3 ? "Preview & Select" : "Done"}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">&#x2715;</button>
        </div>

        {/* Step progress */}
        <div className="flex gap-1 px-6 pt-3 flex-shrink-0">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-teal-400" : "bg-white/10"}`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${isDragging ? "border-teal-400 bg-teal-400/10" : "border-white/20 hover:border-white/40"}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-4xl mb-3">&#x1F4C2;</div>
                <p className="text-white/70 font-medium">Drop your Excel or CSV file here</p>
                <p className="text-white/30 text-sm mt-1">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              {fileName && (
                <p className="text-teal-400 text-sm text-center">&#x2713; Loaded: {fileName}</p>
              )}

              {sheets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-white/60 text-sm font-medium">Select sheet:</p>
                  {sheets.map((s) => (
                    <label key={s.name} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer">
                      <input
                        type="radio"
                        name="sheet"
                        value={s.name}
                        checked={selectedSheet === s.name}
                        onChange={() => setSelectedSheet(s.name)}
                        className="accent-teal-400"
                      />
                      <div>
                        <p className="text-white text-sm font-medium">{s.name}</p>
                        <p className="text-white/40 text-xs">{s.rowCount} rows &middot; Headers: {s.firstRow.slice(0, 5).filter(Boolean).join(", ")}{s.firstRow.length > 5 ? "…" : ""}</p>
                      </div>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 mt-2 text-sm text-white/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useSheetAsLocation}
                      onChange={(e) => setUseSheetAsLocation(e.target.checked)}
                      className="accent-teal-400"
                    />
                    Use sheet name as Location
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Map columns */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-white/60 text-sm mb-2 font-medium">Import as:</p>
                <div className="flex flex-wrap gap-2">
                  {(["reagent", "antibody", "cellLine", "plasmid", "proteinStock"] as ImportCategory[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCategory(c); setMappings(headers.map((h) => ({ header: h, field: autoSuggest(h, c) }))); }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${category === c ? "bg-teal-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
                    >
                      {c === "reagent" ? "Reagent" : c === "antibody" ? "Antibody" : c === "cellLine" ? "Cell Line" : c === "plasmid" ? "Plasmid" : "Protein Stock"}
                    </button>
                  ))}
                </div>
              </div>

              {nameNotMapped && (
                <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg px-4 py-2 text-amber-300 text-sm">
                  No column is mapped to &quot;Name&quot; &mdash; rows cannot be imported without a name.
                </div>
              )}

              <div className="overflow-auto rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="text-left px-4 py-2 text-white/50 font-medium">Spreadsheet Column</th>
                      <th className="text-left px-4 py-2 text-white/50 font-medium">Maps to ELN Field</th>
                      <th className="text-left px-4 py-2 text-white/50 font-medium">Sample Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((m, i) => {
                      const samples = dataRows.slice(0, 3).map((r) => r?.[i]).filter((v) => v !== null && v !== "").slice(0, 3);
                      const autoSuggested = autoSuggest(m.header, category) !== "" && m.field === autoSuggest(m.header, category);
                      return (
                        <tr key={m.header} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2 text-white/80 font-mono text-xs">{m.header}</td>
                          <td className="px-4 py-2">
                            <select
                              value={m.field}
                              onChange={(e) => {
                                const updated = [...mappings];
                                updated[i] = { ...m, field: e.target.value };
                                setMappings(updated);
                              }}
                              className={`bg-white/10 text-white rounded-lg px-2 py-1 text-xs border outline-none w-full ${autoSuggested ? "border-teal-400/60" : "border-white/20"}`}
                            >
                              <option value="">— skip —</option>
                              {CATEGORY_FIELDS[category].map((f) => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-white/40 text-xs">{samples.join(", ") || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-shrink-0">
                <p className="text-white/60 text-sm">
                  <span className="text-white font-medium">{allMappedRows.length}</span> rows ready &middot;{" "}
                  <span className="text-teal-400 font-medium">{selectedRowIds.size}</span> selected
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedRowIds(new Set(allMappedRows.map((r) => r.idx)))}
                    className="text-xs text-white/50 hover:text-teal-400 transition-colors"
                  >
                    Select all
                  </button>
                  <span className="text-white/20">&middot;</span>
                  <button
                    onClick={() => setSelectedRowIds(new Set())}
                    className="text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              <div className="overflow-auto rounded-xl border border-white/10" style={{ maxHeight: "calc(100vh - 420px)" }}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#1a1a2e]">
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-3 py-2 w-8"></th>
                      {mappings.filter((m) => m.field).map((m) => (
                        <th key={m.header} className="text-left px-3 py-2 text-white/50 font-medium whitespace-nowrap">{m.field}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allMappedRows.map(({ row, idx }) => (
                      <tr
                        key={idx}
                        className={`border-b border-white/5 cursor-pointer transition-colors ${selectedRowIds.has(idx) ? "bg-teal-400/5" : "opacity-50"}`}
                        onClick={() => {
                          const next = new Set(selectedRowIds);
                          if (next.has(idx)) next.delete(idx); else next.add(idx);
                          setSelectedRowIds(next);
                        }}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            readOnly
                            checked={selectedRowIds.has(idx)}
                            className="accent-teal-400"
                          />
                        </td>
                        {mappings.filter((m) => m.field).map((m) => (
                          <td key={m.header} className="px-3 py-2 text-white/70 max-w-[180px] truncate">
                            {row[m.field] !== undefined ? String(row[m.field]) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 4 && result && (
            <div className="flex flex-col items-center justify-center py-10 gap-6 text-center">
              <div className="text-6xl">{result.errors.length > 0 ? "⚠️" : "✅"}</div>
              <div>
                <p className="text-white text-xl font-bold mb-1">Import Complete</p>
                <p className="text-white/50 text-sm">{fileName}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                <div className="bg-teal-500/20 rounded-xl p-4">
                  <p className="text-teal-400 text-2xl font-bold">{result.created}</p>
                  <p className="text-white/50 text-xs mt-1">Created</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white text-2xl font-bold">{result.skipped}</p>
                  <p className="text-white/50 text-xs mt-1">Skipped</p>
                </div>
                <div className="bg-red-500/10 rounded-xl p-4">
                  <p className="text-red-400 text-2xl font-bold">{result.errors.length}</p>
                  <p className="text-white/50 text-xs mt-1">Errors</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-left">
                  <p className="text-red-400 text-xs font-medium mb-2">Errors:</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-red-300 text-xs">{e}</p>
                  ))}
                </div>
              )}
              <button
                onClick={() => { onImportComplete(category); onClose(); }}
                className="bg-teal-500 hover:bg-teal-400 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Go to Inventory &rarr;
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 4 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 flex-shrink-0">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : onClose()}
              className="px-4 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-sm transition-colors"
            >
              {step === 1 ? "Cancel" : "← Back"}
            </button>
            {step === 1 && (
              <button
                disabled={!selectedSheet}
                onClick={() => { initMappings(); setStep(2); }}
                className="bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
              >
                Next: Map Columns &rarr;
              </button>
            )}
            {step === 2 && (
              <button
                disabled={nameNotMapped}
                onClick={goToPreview}
                className="bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
              >
                Next: Preview &rarr;
              </button>
            )}
            {step === 3 && (
              <button
                disabled={selectedRowIds.size === 0 || importing}
                onClick={handleImport}
                className="bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
              >
                {importing ? "Importing…" : `Import ${selectedRowIds.size} rows →`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
