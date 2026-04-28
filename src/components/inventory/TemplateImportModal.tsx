"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  TEMPLATE_CONFIGS,
  TEMPLATE_TYPES_ORDERED,
  generateTemplate,
  type TemplateType,
  type TemplateConfig,
} from "@/lib/inventoryTemplates";

// ── Types ────────────────────────────────────────────────────────────────────

type ParsedRow = Record<string, string | null>;

type ValidatedRow = ParsedRow & {
  _rowIndex: number;
  _missingRequired: string[]; // required fields that are empty (name already guaranteed filled)
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

type Step = 1 | 2 | 3 | 4;

// ── Props ─────────────────────────────────────────────────────────────────────

interface TemplateImportModalProps {
  currentUser: string;
  onClose: () => void;
  onImportComplete: (type: TemplateType) => void;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function downloadBlob(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STEP_LABELS: Record<Step, string> = {
  1: "Choose Template",
  2: "Upload & Validate",
  3: "Preview",
  4: "Done",
};

// ── Main component ────────────────────────────────────────────────────────────

export default function TemplateImportModal({
  currentUser,
  onClose,
  onImportComplete,
}: TemplateImportModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedType, setSelectedType] = useState<TemplateType | null>(null);
  const [downloading, setDownloading] = useState<TemplateType | null>(null);

  // Step 2 state
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 state
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());

  // Step 4 state
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const config: TemplateConfig | null = selectedType ? TEMPLATE_CONFIGS[selectedType] : null;

  // ── Download ───────────────────────────────────────────────────────────────

  const handleDownload = useCallback(async (type: TemplateType) => {
    setDownloading(type);
    try {
      const bytes = await generateTemplate(type);
      downloadBlob(bytes, TEMPLATE_CONFIGS[type].filename);
    } catch (e) {
      console.error("Template generation failed:", e);
    } finally {
      setDownloading(null);
    }
  }, []);

  // ── File parsing / validation ──────────────────────────────────────────────

  const handleFile = useCallback(
    async (file: File, type: TemplateType) => {
      setUploadError(null);
      setUploadWarning(null);
      const cfg = TEMPLATE_CONFIGS[type];

      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array", raw: false, dateNF: "yyyy-mm-dd" });

        // Prefer "Data" sheet; fall back to first sheet
        const sheetName = wb.SheetNames.includes("Data") ? "Data" : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        const rows: (string | null)[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: null,
          blankrows: false,
          raw: false,
        });

        if (rows.length === 0) {
          setUploadError("The file appears to be empty.");
          return;
        }

        // Find header row — first row with >40% non-empty cells
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row = rows[i];
          if (!row) continue;
          const filled = row.filter((c) => c !== null && String(c).trim().length > 0);
          if (filled.length >= Math.max(1, row.length * 0.4)) {
            headerRowIdx = i;
            break;
          }
        }
        if (headerRowIdx === -1) {
          setUploadError("Could not detect a header row in this file.");
          return;
        }

        // Normalize headers — strip asterisks/spaces, lowercase
        const rawHeaders = (rows[headerRowIdx] ?? []).map((h) =>
          h ? String(h).trim().replace(/\s*\*\s*$/, "").trim() : ""
        );

        // Map canonical column names to detected column index
        const canonicalColumns = cfg.fields.map((f) => f.column);
        const colIndexMap: Record<string, number> = {};
        for (const canon of canonicalColumns) {
          // Match by canonical name OR by label (case-insensitive)
          const idx = rawHeaders.findIndex(
            (h) =>
              h.toLowerCase() === canon.toLowerCase() ||
              h.toLowerCase() ===
                (cfg.fields.find((f) => f.column === canon)?.label
                  ?.replace(/\s*\*\s*$/, "")
                  .trim()
                  .toLowerCase() ?? "")
          );
          if (idx !== -1) colIndexMap[canon] = idx;
        }

        // Check required columns
        const requiredColumns = cfg.fields.filter((f) => f.required).map((f) => f.column);
        const missingRequired = requiredColumns.filter((c) => !(c in colIndexMap));
        if (missingRequired.length > 0) {
          setUploadError(
            `Missing required columns: ${missingRequired.join(", ")}. Please use the official template.`
          );
          return;
        }

        // Warn about unknown columns
        const knownLower = new Set(canonicalColumns.map((c) => c.toLowerCase()));
        const unknownCols = rawHeaders.filter(
          (h) => h.trim() && !knownLower.has(h.toLowerCase())
        );
        if (unknownCols.length > 0) {
          setUploadWarning(
            `Unknown columns ignored: ${unknownCols.join(", ")}`
          );
        }

        // Parse data rows (skip the header row and example row if it matches example values)
        const dataRows = rows.slice(headerRowIdx + 1);
        const parsed: ValidatedRow[] = [];
        let skipped = 0;

        dataRows.forEach((row, relIdx) => {
          if (!row) return;
          // Extract name — must be present
          const nameIdx = colIndexMap["name"];
          const nameVal =
            nameIdx !== undefined ? (row[nameIdx] ?? "") : "";
          const nameTrimmed = String(nameVal).trim();
          if (!nameTrimmed) {
            skipped++;
            return;
          }

          // Build mapped row
          const obj = { _rowIndex: relIdx, _missingRequired: [] as string[] } as ValidatedRow;
          for (const canon of canonicalColumns) {
            const idx = colIndexMap[canon];
            const val = idx !== undefined ? (row[idx] ?? null) : null;
            obj[canon] = val !== null ? String(val).trim() || null : null;
          }

          // Check other required fields
          const missingInRow = requiredColumns
            .filter((c) => c !== "name" && !obj[c]);
          obj._missingRequired = missingInRow;

          parsed.push(obj);
        });

        if (parsed.length === 0) {
          setUploadError("No valid rows found (all rows are either empty or missing a name).");
          return;
        }

        setValidatedRows(parsed);
        setSkippedCount(skipped);
        setSelectedRowIndices(new Set(parsed.map((_, i) => i)));
        setStep(3);
      } catch (e) {
        setUploadError(`Failed to parse file: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    []
  );

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!selectedType) return;
    setImporting(true);
    const rowsToImport = validatedRows
      .filter((_, i) => selectedRowIndices.has(i))
      .map(({ _rowIndex, _missingRequired, ...rest }) => rest);

    try {
      const res = await fetch("/api/inventory/import-template", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-name": currentUser },
        body: JSON.stringify({ type: selectedType, rows: rowsToImport }),
      });
      const data = await res.json();
      setResult(data);
      setStep(4);
    } catch (e) {
      setResult({ imported: 0, skipped: 0, errors: [String(e)] });
      setStep(4);
    } finally {
      setImporting(false);
    }
  }, [selectedType, validatedRows, selectedRowIndices, currentUser]);

  // ── Progress bar ───────────────────────────────────────────────────────────

  const stepProgress = useMemo(() => {
    const steps: Step[] = [1, 2, 3, 4];
    return steps.map((s) => ({
      s,
      label: STEP_LABELS[s],
      active: s === step,
      done: s < step,
    }));
  }, [step]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Import Stocks</h2>
            <p className="text-xs text-white/40 mt-0.5">
              Step {step} of 4 — {STEP_LABELS[step]}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-3 flex-shrink-0">
          {stepProgress.map(({ s, done, active }) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                done || active ? "bg-teal-400" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">

          {/* ── Step 1: Type selector ────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-white/60 text-sm">
                Choose a template type to download or upload a completed template.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TEMPLATE_TYPES_ORDERED.map((type) => {
                  const cfg = TEMPLATE_CONFIGS[type];
                  const isDownloading = downloading === type;
                  return (
                    <div
                      key={type}
                      className={`rounded-xl border p-4 transition-all ${
                        selectedType === type
                          ? "border-teal-400/60 bg-teal-400/5"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm">{cfg.displayName}</p>
                          <p className="text-zinc-500 text-xs mt-0.5 leading-snug">{cfg.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownload(type)}
                          disabled={isDownloading}
                          className="flex-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs px-3 py-1.5 transition-colors disabled:opacity-50"
                        >
                          {isDownloading ? "Generating…" : "⬇ Download Template"}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedType(type);
                            setUploadError(null);
                            setUploadWarning(null);
                            setStep(2);
                          }}
                          className="flex-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs px-3 py-1.5 font-medium transition-colors"
                        >
                          ⬆ Upload Filled Template
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 2: Upload ───────────────────────────────────────────── */}
          {step === 2 && config && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{config.icon}</span>
                <div>
                  <p className="text-white font-medium">{config.displayName} Template</p>
                  <p className="text-zinc-500 text-xs">Upload your completed Excel or CSV file</p>
                </div>
              </div>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-white/20 rounded-xl p-10 text-center cursor-pointer hover:border-teal-400/40 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file, selectedType!);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-4xl mb-3">📂</div>
                <p className="text-white/70 font-medium text-sm">Drop your file here or click to browse</p>
                <p className="text-white/30 text-xs mt-1">.xlsx, .xls, .csv accepted</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f, selectedType!);
                  }}
                />
              </div>

              {/* Template hint */}
              <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 text-xs text-white/50">
                <span>💡</span>
                <span>
                  Don't have the template yet?{" "}
                  <button
                    onClick={() => handleDownload(selectedType!)}
                    className="text-teal-400 hover:text-teal-300 underline underline-offset-2"
                  >
                    Download {config.displayName} template
                  </button>
                </span>
              </div>

              {/* Errors / warnings */}
              {uploadError && (
                <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                  ❌ {uploadError}
                </div>
              )}
              {uploadWarning && !uploadError && (
                <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-sm">
                  ⚠️ {uploadWarning}
                </div>
              )}

              {/* Required columns reference */}
              <div>
                <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">Required columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {config.fields.filter((f) => f.required).map((f) => (
                    <span key={f.column} className="text-xs bg-red-500/10 text-red-300 border border-red-500/20 rounded px-2 py-0.5 font-mono">
                      {f.column}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ──────────────────────────────────────────── */}
          {step === 3 && config && (
            <div className="space-y-3">
              {/* Summary banner */}
              <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-white font-medium">{validatedRows.length} rows ready</span>
                  {skippedCount > 0 && (
                    <span className="text-zinc-500">{skippedCount} skipped (no name)</span>
                  )}
                  <span className="text-teal-400">{selectedRowIndices.size} selected</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedRowIndices(new Set(validatedRows.map((_, i) => i)))}
                    className="text-xs text-zinc-500 hover:text-teal-400 transition-colors"
                  >
                    Select all
                  </button>
                  <span className="text-white/20">·</span>
                  <button
                    onClick={() => setSelectedRowIndices(new Set())}
                    className="text-xs text-zinc-500 hover:text-white/80 transition-colors"
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              {/* Amber warning rows hint */}
              {validatedRows.some((r) => r._missingRequired.length > 0) && (
                <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl px-4 py-2 text-amber-300 text-xs">
                  ⚠️ Rows highlighted in amber are missing some required fields — they are included by default but can be unchecked.
                </div>
              )}

              {/* Preview table */}
              <div
                className="overflow-auto rounded-xl border border-zinc-700 bg-zinc-900"
                style={{ maxHeight: "calc(100vh - 440px)" }}
              >
                <table className="w-full text-xs bg-zinc-900">
                  <thead className="sticky top-0">
                    <tr className="bg-zinc-800 border-b border-zinc-700">
                      <th className="px-3 py-2 w-8" />
                      {config.fields.map((f) => (
                        <th
                          key={f.column}
                          className={`text-left px-3 py-2 font-medium whitespace-nowrap ${
                            f.required ? "text-red-300" : "text-zinc-400"
                          }`}
                        >
                          {f.column}
                          {f.required && <span className="ml-0.5 text-red-400">*</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validatedRows.map((row, idx) => {
                      const hasMissing = row._missingRequired.length > 0;
                      const checked = selectedRowIndices.has(idx);
                      return (
                        <tr
                          key={idx}
                          className={`border-b cursor-pointer transition-colors ${
                            hasMissing
                              ? checked
                                ? "border-amber-500/20 bg-amber-900/20 hover:bg-amber-900/30"
                                : "border-amber-500/10 bg-amber-900/10 opacity-50"
                              : checked
                              ? "border-zinc-800 hover:bg-zinc-800/50"
                              : "border-zinc-800 opacity-40"
                          }`}
                          onClick={() => {
                            const next = new Set(selectedRowIndices);
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                            setSelectedRowIndices(next);
                          }}
                        >
                          <td className="px-3 py-1.5">
                            <input
                              type="checkbox"
                              readOnly
                              checked={checked}
                              className="accent-teal-400"
                            />
                          </td>
                          {config.fields.map((f) => {
                            const val = row[f.column];
                            const isMissing = hasMissing && row._missingRequired.includes(f.column);
                            return (
                              <td
                                key={f.column}
                                className={`px-3 py-1.5 max-w-[180px] truncate ${
                                  isMissing
                                    ? "text-amber-400"
                                    : "text-zinc-300"
                                }`}
                                title={val ?? ""}
                              >
                                {isMissing && !val ? (
                                  <span className="text-amber-500/60 italic">missing</span>
                                ) : (
                                  val ?? <span className="text-zinc-600">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Step 4: Result ───────────────────────────────────────────── */}
          {step === 4 && result && (
            <div className="flex flex-col items-center justify-center py-10 gap-6 text-center">
              <div className="text-6xl">
                {result.errors.length > 0 ? "⚠️" : "✅"}
              </div>
              <div>
                <p className="text-white text-xl font-bold mb-1">Import Complete</p>
                <p className="text-white/50 text-sm">{config?.displayName}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                <div className="bg-teal-500/20 rounded-xl p-4">
                  <p className="text-teal-400 text-2xl font-bold">{result.imported}</p>
                  <p className="text-white/50 text-xs mt-1">Imported</p>
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
                onClick={() => {
                  if (selectedType) onImportComplete(selectedType);
                  onClose();
                }}
                className="bg-teal-500 hover:bg-teal-400 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Go to Inventory →
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 4 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 flex-shrink-0">
            <button
              onClick={() => {
                if (step === 1) { onClose(); return; }
                if (step === 2) { setUploadError(null); setUploadWarning(null); setStep(1); return; }
                if (step === 3) { setStep(2); return; }
              }}
              className="px-4 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-sm transition-colors"
            >
              {step === 1 ? "Cancel" : "← Back"}
            </button>

            {step === 3 && (
              <button
                disabled={selectedRowIndices.size === 0 || importing}
                onClick={handleImport}
                className="bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
              >
                {importing ? "Importing…" : `Import ${selectedRowIndices.size} rows →`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
