"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import AppTopNav from "@/components/AppTopNav";
import * as XLSX from "xlsx";
import { ENTRY_TYPE_CONFIGS, ENTRY_TYPE_KEYS, type FieldDef } from "@/lib/entryTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mapping = Record<string, number | null>; // fieldKey → column index

type Step =
  | { kind: "home" }
  | { kind: "upload" }
  | { kind: "entity"; fileName: string; headers: string[]; rows: string[][] }
  | { kind: "map"; fileName: string; headers: string[]; rows: string[][]; entityKey: string; mapping: Mapping }
  | { kind: "preview"; fileName: string; headers: string[]; rows: string[][]; entityKey: string; mapping: Mapping }
  | { kind: "done"; entityKey: string; count: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colLabel(n: number): string {
  let s = "";
  n += 1;
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

function autoMap(headers: string[], fields: FieldDef[]): Mapping {
  const map: Mapping = {};
  for (const f of fields) {
    const idx = headers.findIndex(
      (h) =>
        h.toLowerCase().trim() === f.label.toLowerCase() ||
        h.toLowerCase().trim() === f.key.toLowerCase()
    );
    map[f.key] = idx >= 0 ? idx : null;
  }
  // Always try to auto-map title and body
  if (!("title" in map)) {
    const ti = headers.findIndex((h) => ["title", "name", "entry name"].includes(h.toLowerCase().trim()));
    map["__title"] = ti >= 0 ? ti : null;
  }
  if (!("body" in map)) {
    const bi = headers.findIndex((h) => ["body", "notes", "description", "content"].includes(h.toLowerCase().trim()));
    map["__body"] = bi >= 0 ? bi : null;
  }
  return map;
}

function parseFile(
  file: File,
  onResult: (headers: string[], rows: string[][]) => void
) {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target?.result;
    const wb = isExcel
      ? XLSX.read(data as ArrayBuffer, { type: "array" })
      : XLSX.read(data as string, { type: "string" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const all: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
    if (all.length < 2) { onResult([], []); return; }
    const headers = all[0].map(String);
    const rows = all.slice(1).map((r) => headers.map((_, i) => String(r[i] ?? "")));
    onResult(headers, rows);
  };
  if (isExcel) reader.readAsArrayBuffer(file);
  else reader.readAsText(file, "UTF-8");
}

// ─── Accent palette for entry types ──────────────────────────────────────────

const TYPE_ACCENT: Record<string, { border: string; text: string; bg: string; hover: string }> = {
  GENERAL:    { border: "border-zinc-500/40",   text: "text-zinc-300",   bg: "bg-zinc-500/10",   hover: "hover:bg-zinc-500/20"   },
  EXPERIMENT: { border: "border-emerald-500/40", text: "text-emerald-300", bg: "bg-emerald-500/10", hover: "hover:bg-emerald-500/20" },
  PROTOCOL:   { border: "border-sky-500/40",    text: "text-sky-300",    bg: "bg-sky-500/10",    hover: "hover:bg-sky-500/20"    },
  NOTE:       { border: "border-violet-500/40", text: "text-violet-300", bg: "bg-violet-500/10", hover: "hover:bg-violet-500/20" },
};

function accent(key: string) {
  return TYPE_ACCENT[key] ?? TYPE_ACCENT["GENERAL"];
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Upload", "Entry Type", "Map Columns", "Preview", "Done"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="mb-6 flex items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  done ? "bg-emerald-600 text-white" : active ? "bg-indigo-600 text-white" : "bg-zinc-700 text-zinc-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] ${active ? "text-zinc-200" : "text-zinc-500"}`}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`mx-1 h-px flex-1 ${done ? "bg-emerald-600" : "bg-zinc-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MigrationPage() {
  const [step, setStep] = useState<Step>({ kind: "home" });
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const stepIndex =
    step.kind === "home" ? -1 :
    step.kind === "upload" ? 0 :
    step.kind === "entity" ? 1 :
    step.kind === "map" ? 2 :
    step.kind === "preview" ? 3 : 4;

  // ── File handling ────────────────────────────────────────────────────────────

  function handleFile(file: File) {
    parseFile(file, (headers, rows) => {
      if (headers.length === 0) return;
      setStep({ kind: "entity", fileName: file.name, headers, rows });
    });
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  // ── Save to entries API ───────────────────────────────────────────────────────

  async function doImport(entityKey: string, mapping: Mapping, rows: string[][]) {
    if (step.kind !== "preview") return;

    const config = ENTRY_TYPE_CONFIGS[entityKey];
    let count = 0;

    for (const row of rows) {
      const typedFields: Record<string, string> = {};
      for (const field of config.fields) {
        const col = mapping[field.key];
        if (col !== null && col !== undefined) typedFields[field.key] = row[col] ?? "";
      }

      const titleCol = mapping["__title"];
      const bodyCol = mapping["__body"];
      const title = titleCol !== null && titleCol !== undefined ? (row[titleCol] ?? "").trim() : "";
      const body = bodyCol !== null && bodyCol !== undefined ? (row[bodyCol] ?? "") : "";

      const payload = {
        title: title || `Imported ${config.label}`,
        body,
        entryType: entityKey,
        typedData: { typed: typedFields, custom: [] },
      };

      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) count++;
    }

    setStep({ kind: "done", entityKey, count });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Home
        </Link>
        <span className="text-xs text-zinc-700">/</span>
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Data Migration</p>
      </div>

      {/* ── Home screen ──────────────────────────────────────────────────────── */}
      {step.kind === "home" && (
        <div className="mx-auto w-full max-w-2xl">
          <p className="mb-1 text-lg font-semibold text-zinc-100">Import Data into the ELN</p>
          <p className="mb-6 text-sm text-zinc-400">
            Bulk-import existing lab records from spreadsheets into typed ELN entries.
            Each row becomes one entry with its structured fields automatically filled.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Spreadsheets — active */}
            <button
              onClick={() => setStep({ kind: "upload" })}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-left transition hover:bg-emerald-500/20"
            >
              <p className="mb-1 text-2xl">📊</p>
              <p className="mb-1 font-semibold text-emerald-200">Spreadsheets</p>
              <p className="text-xs text-zinc-400">
                Import from Excel (.xlsx, .xls) or CSV files. Map columns to ELN fields and
                preview before importing.
              </p>
            </button>

            {/* Paper notebook — placeholder */}
            <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/50 p-5 opacity-50">
              <p className="mb-1 text-2xl">📓</p>
              <p className="mb-1 font-semibold text-zinc-400">Paper Notebook</p>
              <p className="mb-2 text-xs text-zinc-500">
                Scan and digitise paper lab notebooks.
              </p>
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">In progress</span>
            </div>

            {/* Other — placeholder */}
            <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/50 p-5 opacity-50 sm:col-span-2">
              <p className="mb-1 text-2xl">🗂️</p>
              <p className="mb-1 font-semibold text-zinc-400">Other (images, sequences, raw data)</p>
              <p className="mb-2 text-xs text-zinc-500">
                Import gel images, sequencing files, spectra, and other raw data files.
              </p>
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">In progress</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload step ──────────────────────────────────────────────────────── */}
      {step.kind === "upload" && (
        <div className="mx-auto w-full max-w-xl">
          <StepBar current={0} />
          <p className="mb-4 font-medium text-zinc-200">Upload a spreadsheet</p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition ${
              dragOver ? "border-indigo-400 bg-indigo-500/10" : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
            }`}
          >
            <span className="text-3xl">📂</span>
            <p className="text-sm text-zinc-300">Drag & drop or click to browse</p>
            <p className="text-xs text-zinc-500">.xlsx, .xls, .csv — first row must be a header row</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onFileInput}
            />
          </div>
          <button
            onClick={() => setStep({ kind: "home" })}
            className="mt-4 text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Back
          </button>
        </div>
      )}

      {/* ── Choose entry type ─────────────────────────────────────────────────── */}
      {step.kind === "entity" && (
        <div className="mx-auto w-full max-w-xl">
          <StepBar current={1} />
          <p className="mb-1 font-medium text-zinc-200">What kind of entries are you importing?</p>
          <p className="mb-4 text-xs text-zinc-400">
            File: <span className="text-zinc-300">{step.fileName}</span> — {step.rows.length} data rows,{" "}
            {step.headers.length} columns
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ENTRY_TYPE_KEYS.map((key) => {
              const cfg = ENTRY_TYPE_CONFIGS[key];
              const a = accent(key);
              return (
                <button
                  key={key}
                  onClick={() => {
                    const mapping = autoMap(step.headers, cfg.fields);
                    setStep({ kind: "map", fileName: step.fileName, headers: step.headers, rows: step.rows, entityKey: key, mapping });
                  }}
                  className={`rounded-xl border p-4 text-left transition ${a.border} ${a.bg} ${a.hover}`}
                >
                  <p className="mb-0.5 text-lg">{cfg.icon}</p>
                  <p className={`font-semibold ${a.text}`}>{cfg.label}</p>
                  <p className="mt-1 text-xs text-zinc-400">{cfg.description}</p>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setStep({ kind: "upload" })}
            className="mt-4 text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← Back
          </button>
        </div>
      )}

      {/* ── Map columns ──────────────────────────────────────────────────────── */}
      {step.kind === "map" && (() => {
        const cfg = ENTRY_TYPE_CONFIGS[step.entityKey];
        const a = accent(step.entityKey);

        // All mappable fields: built-in title/body + typed fields
        const allFields: { key: string; label: string; required?: boolean }[] = [
          { key: "__title", label: "Entry Title", required: true },
          { key: "__body",  label: "Entry Body / Notes" },
          ...cfg.fields.map((f) => ({ key: f.key, label: f.label })),
        ];

        return (
          <div className="mx-auto w-full max-w-2xl">
            <StepBar current={2} />
            <p className="mb-1 font-medium text-zinc-200">Map your columns to ELN fields</p>
            <p className="mb-4 text-xs text-zinc-400">
              Importing as <span className={`font-semibold ${a.text}`}>{cfg.icon} {cfg.label}</span>
              {" "}— {step.rows.length} rows from{" "}
              <span className="text-zinc-300">{step.fileName}</span>
            </p>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <span>ELN Field</span>
                <span />
                <span>Your Column</span>
              </div>
              <div className="space-y-2">
                {allFields.map(({ key, label, required }) => (
                  <div key={key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <span className="text-sm text-zinc-200">
                      {label}
                      {required && <span className="ml-1 text-xs text-red-400">*</span>}
                    </span>
                    <span className="text-xs text-zinc-600">→</span>
                    <select
                      value={step.mapping[key] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : Number(e.target.value);
                        setStep({ ...step, mapping: { ...step.mapping, [key]: val } });
                      }}
                      className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
                    >
                      <option value="">— skip —</option>
                      {step.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {colLabel(i)}: {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep({ kind: "entity", fileName: step.fileName, headers: step.headers, rows: step.rows })}
                className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep({ kind: "preview", fileName: step.fileName, headers: step.headers, rows: step.rows, entityKey: step.entityKey, mapping: step.mapping })}
                className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500"
              >
                Preview →
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Preview ──────────────────────────────────────────────────────────── */}
      {step.kind === "preview" && (() => {
        const cfg = ENTRY_TYPE_CONFIGS[step.entityKey];
        const a = accent(step.entityKey);
        const previewRows = step.rows.slice(0, 8);

        // Columns that are actually mapped (in display order)
        const allFields: { key: string; label: string }[] = [
          { key: "__title", label: "Title" },
          { key: "__body",  label: "Body" },
          ...cfg.fields.map((f) => ({ key: f.key, label: f.label })),
        ];
        const mappedFields = allFields.filter((f) => {
          const col = step.mapping[f.key];
          return col !== null && col !== undefined;
        });

        return (
          <div className="mx-auto w-full max-w-4xl">
            <StepBar current={3} />
            <p className="mb-1 font-medium text-zinc-200">Preview — first {previewRows.length} rows</p>
            <p className="mb-4 text-xs text-zinc-400">
              {step.rows.length} {cfg.label} entries will be created in the ELN.
              {step.rows.length > 8 && ` Showing first 8.`}
            </p>

            {/* Flex-based grid to avoid global table CSS */}
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              {/* Header row */}
              <div className="flex min-w-0 border-b border-zinc-700 bg-zinc-800">
                {mappedFields.map((f) => (
                  <div key={f.key} className={`min-w-[120px] flex-1 px-3 py-2 text-xs font-semibold ${a.text}`}>
                    {f.label}
                  </div>
                ))}
              </div>
              {/* Data rows */}
              {previewRows.map((row, ri) => (
                <div
                  key={ri}
                  className="flex min-w-0 border-b border-zinc-800/60 bg-zinc-900 last:border-0"
                >
                  {mappedFields.map((f) => {
                    const col = step.mapping[f.key];
                    const val = col !== null && col !== undefined ? (row[col] ?? "") : "";
                    return (
                      <div
                        key={f.key}
                        className="min-w-[120px] flex-1 overflow-hidden px-3 py-2 text-xs text-zinc-300"
                        title={val}
                      >
                        <span className="line-clamp-2">{val || <span className="text-zinc-600">—</span>}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep({ kind: "map", fileName: step.fileName, headers: step.headers, rows: step.rows, entityKey: step.entityKey, mapping: step.mapping })}
                className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                ← Back
              </button>
              <button
                onClick={() => doImport(step.entityKey, step.mapping, step.rows)}
                className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
              >
                ✓ Import {step.rows.length} entries
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Done ─────────────────────────────────────────────────────────────── */}
      {step.kind === "done" && (() => {
        const cfg = ENTRY_TYPE_CONFIGS[step.entityKey];
        const a = accent(step.entityKey);
        return (
          <div className="mx-auto w-full max-w-md text-center">
            <StepBar current={4} />
            <p className="mb-2 text-4xl">✅</p>
            <p className="mb-1 text-lg font-semibold text-zinc-100">Import complete!</p>
            <p className="mb-6 text-sm text-zinc-400">
              <span className={`font-semibold ${a.text}`}>{step.count}</span> {cfg.label.toLowerCase()}{" "}
              {step.count === 1 ? "entry was" : "entries were"} added to the ELN.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/entries"
                className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500"
              >
                View in Entries →
              </Link>
              <button
                onClick={() => setStep({ kind: "home" })}
                className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Import more
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
