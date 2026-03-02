"use client";

import { useState, useRef, type DragEvent } from "react";
import * as XLSX from "xlsx";
import AppTopNav from "@/components/AppTopNav";
import Link from "next/link";

// ─── Accent colour lookup — full strings required for Tailwind JIT ────────────

const ACCENTS = {
  amber:  { border: "border-amber-500/40",  text: "text-amber-300",  bg: "bg-amber-500/10"  },
  sky:    { border: "border-sky-500/40",    text: "text-sky-300",    bg: "bg-sky-500/10"    },
  violet: { border: "border-violet-500/40", text: "text-violet-300", bg: "bg-violet-500/10" },
  rose:   { border: "border-rose-500/40",   text: "text-rose-300",   bg: "bg-rose-500/10"   },
} as const;

type AccentKey = keyof typeof ACCENTS;

// ─── Entity definitions ───────────────────────────────────────────────────────

type EntityField = { key: string; label: string; required?: true };

const ENTITIES: Record<string, {
  label: string;
  icon: string;
  accent: AccentKey;
  storageKey: string;
  invPath: string;
  fields: EntityField[];
}> = {
  reagents: {
    label: "Reagents",
    icon: "🧪",
    accent: "amber",
    storageKey: "eln-imported-reagents",
    invPath: "/inventory/reagents",
    fields: [
      { key: "name",          label: "Name",              required: true },
      { key: "casNumber",     label: "CAS Number" },
      { key: "concentration", label: "Concentration" },
      { key: "vendor",        label: "Vendor" },
      { key: "catalogNumber", label: "Catalog #" },
      { key: "location",      label: "Storage Location" },
      { key: "notes",         label: "Notes" },
    ],
  },
  stocks: {
    label: "Stocks",
    icon: "📦",
    accent: "sky",
    storageKey: "eln-imported-stocks",
    invPath: "/inventory/stocks",
    fields: [
      { key: "name",     label: "Name",             required: true },
      { key: "type",     label: "Type" },
      { key: "amount",   label: "Amount" },
      { key: "unit",     label: "Unit" },
      { key: "location", label: "Storage Location" },
      { key: "notes",    label: "Notes" },
    ],
  },
  plasmids: {
    label: "Plasmids",
    icon: "🔬",
    accent: "violet",
    storageKey: "eln-imported-plasmids",
    invPath: "/inventory/plasmids",
    fields: [
      { key: "name",       label: "Name",                required: true },
      { key: "backbone",   label: "Backbone" },
      { key: "insert",     label: "Insert" },
      { key: "resistance", label: "Antibiotic Resistance" },
      { key: "location",   label: "Storage Location" },
      { key: "notes",      label: "Notes" },
    ],
  },
  cellLines: {
    label: "Cell Lines",
    icon: "🦠",
    accent: "rose",
    storageKey: "eln-imported-cell-lines",
    invPath: "/inventory/cell-lines",
    fields: [
      { key: "name",     label: "Name",             required: true },
      { key: "species",  label: "Species" },
      { key: "passage",  label: "Passage #" },
      { key: "location", label: "Storage Location" },
      { key: "notes",    label: "Notes" },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Zero-based column index → "A", "B", …, "Z", "AA", "AB", … */
function colLabel(i: number): string {
  if (i < 26) return String.fromCharCode(65 + i);
  return (
    String.fromCharCode(64 + Math.floor(i / 26)) +
    String.fromCharCode(65 + (i % 26))
  );
}

/** Try to auto-match file headers to entity field labels / keys */
function autoMap(headers: string[], fields: EntityField[]): Mapping {
  const map: Mapping = {};
  for (const f of fields) {
    const idx = headers.findIndex(
      h =>
        h.toLowerCase().trim() === f.label.toLowerCase() ||
        h.toLowerCase().trim() === f.key.toLowerCase()
    );
    map[f.key] = idx >= 0 ? idx : null;
  }
  return map;
}

// ─── Wizard state (discriminated union) ───────────────────────────────────────

type Mapping = Record<string, number | null>;

type Step =
  | { kind: "home" }
  | { kind: "upload" }
  | { kind: "entity";  fileName: string; headers: string[]; rows: string[][] }
  | { kind: "map";     fileName: string; headers: string[]; rows: string[][]; entityKey: string; mapping: Mapping }
  | { kind: "preview"; fileName: string; headers: string[]; rows: string[][]; entityKey: string; mapping: Mapping }
  | { kind: "done";    entityKey: string; count: number };

const WIZARD_STEPS = ["Upload", "Choose type", "Map columns", "Preview", "Done"] as const;
const STEP_IDX: Partial<Record<Step["kind"], number>> = {
  upload: 0, entity: 1, map: 2, preview: 3, done: 4,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MigrationPage() {
  const [step, setStep]           = useState<Step>({ kind: "home" });
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── File parsing ────────────────────────────────────────────────────────────

  function parseFile(file: File) {
    setParseError(null);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader  = new FileReader();

    reader.onload = e => {
      try {
        // CSV files: read as UTF-8 text (avoids multi-byte garbling of special
        // characters like °, µ, etc.). Excel files: read as binary ArrayBuffer.
        const data = e.target?.result;
        const wb   = isExcel
          ? XLSX.read(data as ArrayBuffer, { type: "array" })
          : XLSX.read(data as string,      { type: "string" });

        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
          raw:    false,
        }) as unknown[][];

        if (raw.length < 2) {
          setParseError("The file appears empty or has only one row.");
          return;
        }

        const headers = (raw[0] as unknown[]).map(h => String(h ?? "").trim());

        if (headers.every(h => h === "")) {
          setParseError("Could not detect column headers in the first row.");
          return;
        }

        // Build rows, skip entirely empty ones
        const rows = raw
          .slice(1)
          .map(r => headers.map((_, i) => String((r as unknown[])[i] ?? "")))
          .filter(row => row.some(cell => cell.trim() !== ""));

        if (rows.length === 0) {
          setParseError("No data rows found after the header row.");
          return;
        }

        setStep({ kind: "entity", fileName: file.name, headers, rows });
      } catch {
        setParseError(
          "Failed to parse the file. Please check it's a valid .xlsx, .xls, or .csv."
        );
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, "UTF-8");
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) parseFile(f);
  }

  // ── Import confirmation ──────────────────────────────────────────────────────

  function doImport() {
    if (step.kind !== "preview") return;
    const entity = ENTITIES[step.entityKey];

    const records = step.rows.map(row => {
      const obj: Record<string, string> = {
        id:         crypto.randomUUID(),
        importedAt: new Date().toISOString(),
      };
      for (const field of entity.fields) {
        const col = step.mapping[field.key];
        if (col !== null && col !== undefined) obj[field.key] = row[col] ?? "";
      }
      return obj;
    });

    try {
      const existing: unknown[] = JSON.parse(
        localStorage.getItem(entity.storageKey) ?? "[]"
      );
      localStorage.setItem(
        entity.storageKey,
        JSON.stringify([...existing, ...records])
      );
    } catch { /* storage unavailable */ }

    setStep({ kind: "done", entityKey: step.entityKey, count: records.length });
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const stepIdx = step.kind in STEP_IDX
    ? STEP_IDX[step.kind as keyof typeof STEP_IDX]!
    : undefined;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col gap-5 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs">
        <Link href="/" className="text-zinc-600 transition hover:text-zinc-400">
          Home
        </Link>
        <span className="text-zinc-700">/</span>
        <span className={step.kind === "home" ? "text-zinc-300" : "text-zinc-500"}>
          Data Migration
        </span>
        {step.kind !== "home" && (
          <>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-300">Spreadsheets</span>
          </>
        )}
      </nav>

      {/* Title */}
      <div>
        <p className="text-lg font-bold text-zinc-100">Data Migration</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Import existing lab data into the ELN
        </p>
      </div>

      {/* Wizard progress bar (steps 0–3; step 4 = done shows its own UI) */}
      {stepIdx !== undefined && stepIdx < 4 && (
        <div className="flex flex-wrap items-center gap-0">
          {WIZARD_STEPS.map((label, i) => (
            <div key={i} className="flex items-center">
              {i > 0 && (
                <div
                  className={`h-px w-8 shrink-0 ${
                    i <= stepIdx ? "bg-indigo-500" : "bg-zinc-800"
                  }`}
                />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold transition ${
                    i < stepIdx
                      ? "bg-indigo-600 text-white"
                      : i === stepIdx
                      ? "bg-indigo-500 text-white ring-2 ring-indigo-400/30"
                      : "bg-zinc-800 text-zinc-600"
                  }`}
                >
                  {i < stepIdx ? "✓" : i + 1}
                </div>
                <span
                  className={`text-[10px] font-medium ${
                    i === stepIdx ? "text-zinc-300" : "text-zinc-600"
                  }`}
                >
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────────── HOME ──────────────────────────────────────── */}
      {step.kind === "home" && (
        <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">

          {/* Spreadsheets — live */}
          <button
            onClick={() => setStep({ kind: "upload" })}
            className="group flex flex-col items-start gap-3 rounded-xl border border-emerald-500/40 bg-zinc-900 p-6 text-left transition hover:border-emerald-400/60 hover:bg-zinc-800/80"
          >
            <span className="text-3xl">📊</span>
            <div>
              <p className="font-semibold text-emerald-300">Spreadsheets</p>
              <p className="mt-1 text-xs text-zinc-500">
                Import .xlsx or .csv files with visual column mapping.
              </p>
            </div>
            <span className="mt-auto rounded border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              Available
            </span>
          </button>

          {/* Paper Notebook — coming soon */}
          <div className="flex cursor-not-allowed flex-col items-start gap-3 rounded-xl border border-zinc-700/40 bg-zinc-900 p-6 opacity-50">
            <span className="text-3xl">📓</span>
            <div>
              <p className="font-semibold text-zinc-400">Paper Notebook</p>
              <p className="mt-1 text-xs text-zinc-600">
                Photograph pages for OCR-assisted data entry.
              </p>
            </div>
            <span className="mt-auto rounded border border-zinc-700/40 bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
              In progress…
            </span>
          </div>

          {/* Other — coming soon */}
          <div className="flex cursor-not-allowed flex-col items-start gap-3 rounded-xl border border-zinc-700/40 bg-zinc-900 p-6 opacity-50">
            <span className="text-3xl">🗂</span>
            <div>
              <p className="font-semibold text-zinc-400">Other</p>
              <p className="mt-1 text-xs text-zinc-600">
                Images, DNA files, instrument exports, and more.
              </p>
            </div>
            <span className="mt-auto rounded border border-zinc-700/40 bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
              In progress…
            </span>
          </div>
        </div>
      )}

      {/* ─────────────────────── UPLOAD ────────────────────────────────────── */}
      {step.kind === "upload" && (
        <div className="max-w-lg space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-14 text-center transition ${
              isDragging
                ? "border-indigo-400/70 bg-indigo-500/10"
                : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30"
            }`}
          >
            <span className="text-5xl">📂</span>
            <div>
              <p className="font-medium text-zinc-300">
                Drop your file here, or click to browse
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Accepts .xlsx, .xls, and .csv
              </p>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) parseFile(f);
              e.target.value = ""; // allow re-selecting same file
            }}
          />

          {parseError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
              ⚠ {parseError}
            </p>
          )}

          <button
            onClick={() => { setParseError(null); setStep({ kind: "home" }); }}
            className="text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            ← Back
          </button>
        </div>
      )}

      {/* ─────────────────────── ENTITY SELECT ─────────────────────────────── */}
      {step.kind === "entity" && (
        <div className="max-w-2xl space-y-5">
          <div>
            <p className="text-sm font-medium text-zinc-200">
              What type of data are you importing?
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">{step.fileName}</span>
              {" · "}
              {step.headers.length} column{step.headers.length !== 1 ? "s" : ""}
              {" · "}
              {step.rows.length} data row{step.rows.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(ENTITIES).map(([key, entity]) => {
              const ac = ACCENTS[entity.accent];
              return (
                <button
                  key={key}
                  onClick={() => {
                    if (step.kind !== "entity") return;
                    const mapping = autoMap(step.headers, entity.fields);
                    setStep({
                      kind:      "map",
                      fileName:  step.fileName,
                      headers:   step.headers,
                      rows:      step.rows,
                      entityKey: key,
                      mapping,
                    });
                  }}
                  className={`flex flex-col items-start gap-2 rounded-xl border bg-zinc-900 p-4 text-left transition hover:bg-zinc-800/60 ${ac.border}`}
                >
                  <span className="text-2xl">{entity.icon}</span>
                  <p className={`text-sm font-semibold ${ac.text}`}>
                    {entity.label}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    {entity.fields.length} fields
                  </p>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setStep({ kind: "upload" })}
            className="text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            ← Back
          </button>
        </div>
      )}

      {/* ─────────────────────── MAP COLUMNS ───────────────────────────────── */}
      {step.kind === "map" && (() => {
        const entity = ENTITIES[step.entityKey];
        const ac     = ACCENTS[entity.accent];

        const requiredUnmapped = entity.fields.filter(
          f => f.required &&
            (step.mapping[f.key] === null || step.mapping[f.key] === undefined)
        );

        const autoMatched = Object.values(step.mapping).filter(v => v !== null).length;

        return (
          <div className="max-w-xl space-y-5">
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Map your file columns →{" "}
                <span className={ac.text}>{entity.label}</span> fields
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {step.headers.length} columns detected
                {autoMatched > 0 && (
                  <span className="text-indigo-400">
                    {" · "}{autoMatched} auto-matched ✓
                  </span>
                )}
              </p>
            </div>

            {/* Mapping table */}
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              {/* Column headers */}
              <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2">
                <span className="w-40 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  ELN Field
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Your column
                </span>
              </div>

              {entity.fields.map((field, i) => (
                <div
                  key={field.key}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    i < entity.fields.length - 1 ? "border-b border-zinc-800/50" : ""
                  }`}
                >
                  <label className="w-40 shrink-0 text-xs font-medium text-zinc-300">
                    {field.label}
                    {field.required && (
                      <span className="ml-1 text-red-400">*</span>
                    )}
                  </label>

                  <select
                    value={
                      step.mapping[field.key] === null ||
                      step.mapping[field.key] === undefined
                        ? ""
                        : String(step.mapping[field.key])
                    }
                    onChange={e => {
                      if (step.kind !== "map") return;
                      const v = e.target.value === ""
                        ? null
                        : parseInt(e.target.value);
                      setStep({
                        ...step,
                        mapping: { ...step.mapping, [field.key]: v },
                      });
                    }}
                    className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500/60 focus:outline-none"
                  >
                    <option value="">(skip)</option>
                    {step.headers.map((h, ci) => (
                      <option key={ci} value={ci}>
                        {colLabel(ci)}: {h || `(column ${ci + 1})`}
                      </option>
                    ))}
                  </select>

                  {/* Matched indicator */}
                  {step.mapping[field.key] !== null &&
                   step.mapping[field.key] !== undefined && (
                    <span className="shrink-0 text-[10px] text-indigo-400">✓</span>
                  )}
                </div>
              ))}
            </div>

            {/* Validation notice */}
            {requiredUnmapped.length > 0 && (
              <p className="text-xs text-red-400">
                Required field{requiredUnmapped.length > 1 ? "s" : ""}{" "}
                {requiredUnmapped.map(f => `"${f.label}"`).join(", ")}{" "}
                must be mapped before continuing.
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (step.kind !== "map") return;
                  setStep({
                    kind:     "entity",
                    fileName: step.fileName,
                    headers:  step.headers,
                    rows:     step.rows,
                  });
                }}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
              >
                ← Back
              </button>
              <button
                disabled={requiredUnmapped.length > 0}
                onClick={() => {
                  if (step.kind !== "map") return;
                  setStep({
                    kind:      "preview",
                    fileName:  step.fileName,
                    headers:   step.headers,
                    rows:      step.rows,
                    entityKey: step.entityKey,
                    mapping:   step.mapping,
                  });
                }}
                className="rounded bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Preview →
              </button>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────── PREVIEW ───────────────────────────────────── */}
      {step.kind === "preview" && (() => {
        const entity       = ENTITIES[step.entityKey];
        const mappedFields = entity.fields.filter(
          f => step.mapping[f.key] !== null && step.mapping[f.key] !== undefined
        );
        const previewCount = Math.min(step.rows.length, 8);
        const remaining    = step.rows.length - previewCount;

        return (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-zinc-200">
                Preview —{" "}
                <span className="text-zinc-100">{step.rows.length}</span>{" "}
                {entity.label.toLowerCase()} ready to import
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Showing first {previewCount} of {step.rows.length} rows ·{" "}
                {mappedFields.length} field{mappedFields.length !== 1 ? "s" : ""} mapped
              </p>
            </div>

            {/* Flex-based preview grid (avoids global table CSS) */}
            <div className="overflow-x-auto rounded-xl border border-zinc-800 text-xs">

              {/* Header row */}
              <div className="flex border-b border-zinc-800 bg-zinc-900 px-3 py-2.5">
                <div className="w-8 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  #
                </div>
                {mappedFields.map(f => (
                  <div
                    key={f.key}
                    className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600"
                  >
                    {f.label}
                    {f.required && <span className="ml-0.5 text-red-400">*</span>}
                  </div>
                ))}
              </div>

              {/* Data rows */}
              {step.rows.slice(0, previewCount).map((row, i) => (
                <div
                  key={i}
                  className={`flex px-3 py-2 hover:bg-zinc-800/30 ${
                    i < previewCount - 1 ? "border-b border-zinc-800/50" : ""
                  }`}
                >
                  <div className="w-8 shrink-0 text-zinc-600">{i + 1}</div>
                  {mappedFields.map(f => (
                    <div
                      key={f.key}
                      className="min-w-0 flex-1 truncate pr-3 text-zinc-300"
                    >
                      {row[step.mapping[f.key]!] || (
                        <span className="text-zinc-700">—</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {remaining > 0 && (
                <p className="border-t border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[10px] text-zinc-600">
                  … and {remaining} more row{remaining !== 1 ? "s" : ""}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (step.kind !== "preview") return;
                  setStep({
                    kind:      "map",
                    fileName:  step.fileName,
                    headers:   step.headers,
                    rows:      step.rows,
                    entityKey: step.entityKey,
                    mapping:   step.mapping,
                  });
                }}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
              >
                ← Back
              </button>
              <button
                onClick={doImport}
                className="rounded bg-emerald-600 px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                Import {step.rows.length} {entity.label} →
              </button>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────── DONE ──────────────────────────────────────── */}
      {step.kind === "done" && (() => {
        const entity = ENTITIES[step.entityKey];
        const ac     = ACCENTS[entity.accent];

        return (
          <div className="flex max-w-sm flex-col gap-5">
            <div className="flex items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-2xl">
                ✓
              </div>
              <div>
                <p className="font-semibold text-emerald-300">Import complete!</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {step.count} {entity.label.toLowerCase()} saved successfully.
                </p>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-zinc-600">
              Data is stored locally and will appear in the{" "}
              <span className={ac.text}>{entity.label}</span> inventory module
              once that section is fully built out.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStep({ kind: "home" })}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
              >
                Import another file
              </button>
              <Link
                href={entity.invPath}
                className={`rounded border px-3 py-1.5 text-xs font-medium transition hover:opacity-80 ${ac.border} ${ac.text} ${ac.bg}`}
              >
                Go to {entity.label} →
              </Link>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
