"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import AppTopNav, { USER_STORAGE_KEY, ELN_USERS } from "@/components/AppTopNav";
import { ENTRY_TYPE_CONFIGS, ENTRY_TYPE_KEYS } from "@/lib/entryTypes";
import type { CustomField } from "@/lib/entryTypes";
import type { Entry } from "@/models/entry";
import { TECHNIQUE_OPTIONS } from "@/models/entry";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProtocolRun = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  sourceEntry?: {
    id: string;
    title: string;
    technique?: string;
    author?: { id: string; name: string | null; role: string } | null;
  } | null;
  runner?: { id: string; name: string | null; role: string } | null;
};

type FlowState =
  | "list"
  | "ingest_q"
  | "run_select"
  | "entry_type"
  | "entry_form"
  | "free_entry";

type CsvParsed = { headers: string[]; rows: string[][] };

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  GENERAL:            "bg-zinc-700 text-zinc-300",
  EXPERIMENT:         "bg-violet-800/70 text-violet-100",
  PROTOCOL:           "bg-emerald-800/70 text-emerald-100",
  NOTE:               "bg-sky-800/70 text-sky-100",
  CELL_LINE:          "bg-pink-800/70 text-pink-100",
  PROTEIN:            "bg-cyan-800/70 text-cyan-100",
  REAGENT:            "bg-orange-800/70 text-orange-100",
  CHROMATOGRAPHY_RUN: "bg-amber-800/70 text-amber-100",
};

const INPUT_CLS =
  "w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50";

// ─── Utils ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function parseCsv(text: string): CsvParsed {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((l) => l.split(",").map((c) => c.trim()));
  return { headers, rows };
}

// ─── Small components ─────────────────────────────────────────────────────────

function FF({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const cls =
    status === "IN_PROGRESS"
      ? "bg-green-700/60 text-green-200"
      : "bg-zinc-600/60 text-zinc-300";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status === "IN_PROGRESS" ? "Active" : "Completed"}
    </span>
  );
}

function CsvPreview({ data }: { data: CsvParsed }) {
  if (!data.headers.length) return null;
  const preview = data.rows.slice(0, 8);
  return (
    <div className="mt-2 overflow-x-auto rounded border border-zinc-700">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-zinc-800">
            {data.headers.map((h, i) => (
              <th
                key={i}
                className="border-b border-zinc-700 px-2 py-1 text-left font-semibold text-zinc-300"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((row, ri) => (
            <tr key={ri} className="border-b border-zinc-800/40 even:bg-zinc-900/30">
              {row.map((cell, ci) => (
                <td key={ci} className="px-2 py-1 text-zinc-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.rows.length > 8 && (
        <p className="px-2 py-1 text-[10px] text-zinc-500">
          …and {data.rows.length - 8} more rows
        </p>
      )}
    </div>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  const type = entry.entryType ?? "GENERAL";
  const cfg = ENTRY_TYPE_CONFIGS[type] ?? ENTRY_TYPE_CONFIGS["GENERAL"];
  const badge = TYPE_BADGE[type] ?? TYPE_BADGE["GENERAL"];

  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:border-zinc-700">
      <span
        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge}`}
      >
        {cfg.icon} {cfg.label}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-100">{entry.title}</p>
        {entry.description && (
          <p className="mt-0.5 truncate text-xs text-zinc-500">{entry.description}</p>
        )}
        {entry.linkedRun && (
          <Link
            href={`/runs/${entry.linkedRun.id}`}
            className="mt-1 inline-flex items-center gap-1 rounded border border-green-700/40 bg-green-900/20 px-1.5 py-0.5 text-[10px] text-green-300 transition hover:bg-green-900/30"
          >
            ▶ {entry.linkedRun.title}
            {entry.linkedRun.status === "IN_PROGRESS" && (
              <span className="rounded bg-green-700/50 px-1 text-[9px]">Active</span>
            )}
          </Link>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[11px] text-zinc-500">{fmtDate(entry.createdAt)}</p>
        {entry.author?.name && (
          <p className="text-[11px] text-zinc-600">{entry.author.name}</p>
        )}
      </div>
    </div>
  );
}

function RunCard({ run, onSelect }: { run: ProtocolRun; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-start gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-3 py-2.5 text-left transition hover:border-amber-600/40 hover:bg-zinc-800"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-100">{run.title}</p>
        {run.sourceEntry && (
          <p className="text-xs text-zinc-500">
            {run.sourceEntry.title}
            {run.sourceEntry.technique ? ` · ${run.sourceEntry.technique}` : ""}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <RunStatusBadge status={run.status} />
        <p className="mt-0.5 text-[11px] text-zinc-600">{fmtDate(run.createdAt)}</p>
        {run.runner?.name && (
          <p className="text-[11px] text-zinc-600">{run.runner.name}</p>
        )}
      </div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IngestionPage() {
  // ── Auth ────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState(ELN_USERS[0].id);

  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored && ELN_USERS.find((u) => u.id === stored)) setUserId(stored);
    const handler = (e: StorageEvent) => {
      if (
        e.key === USER_STORAGE_KEY &&
        e.newValue &&
        ELN_USERS.find((u) => u.id === e.newValue)
      ) {
        setUserId(e.newValue!);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // ── Data ────────────────────────────────────────────────────────────────
  const [runs, setRuns] = useState<ProtocolRun[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Flow ────────────────────────────────────────────────────────────────
  const [flow, setFlow] = useState<FlowState>("list");
  const [selectedRun, setSelectedRun] = useState<ProtocolRun | null>(null);
  const [selType, setSelType] = useState("GENERAL");

  // ── Typed entry form ────────────────────────────────────────────────────
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fTech, setFTech] = useState("General");
  const [fTyped, setFTyped] = useState<Record<string, string>>({});
  const [fCustom, setFCustom] = useState<CustomField[]>([]);
  const [fBody, setFBody] = useState("");
  const [fFiles, setFFiles] = useState<File[]>([]);
  const [csvMap, setCsvMap] = useState<Record<string, CsvParsed>>({});

  // ── Free entry form ─────────────────────────────────────────────────────
  const [freeTags, setFreeTags] = useState("");
  const [freeBody, setFreeBody] = useState("");
  const [freeFiles, setFreeFiles] = useState<File[]>([]);
  const [freeRunId, setFreeRunId] = useState("");

  // ── Save state ──────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── List / search ───────────────────────────────────────────────────────
  const [listQ, setListQ] = useState("");
  const [listType, setListType] = useState("");

  // ── Run selector ────────────────────────────────────────────────────────
  const [runQ, setRunQ] = useState("");
  const [activeOpen, setActiveOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const u = ELN_USERS.find((u) => u.id === userId) ?? ELN_USERS[0];
    const fh: HeadersInit = {
      "x-user-id": u.id,
      "x-user-name": u.name,
      "x-user-role": u.role,
    };
    try {
      const [eRes, rRes] = await Promise.all([
        fetch("/api/entries", { headers: fh }),
        fetch("/api/protocol-runs", { headers: fh }),
      ]);
      if (eRes.ok) setEntries(await eRes.json());
      else setFetchError("Failed to load entries");
      if (rRes.ok) setRuns(await rRes.json());
    } catch {
      setFetchError("Network error loading data");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  function resetTypedForm() {
    setFTitle("");
    setFDesc("");
    setFTech("General");
    setFTyped({});
    setFCustom([]);
    setFBody("");
    setFFiles([]);
    setCsvMap({});
    setSaveError(null);
  }

  function resetFreeForm() {
    setFTitle("");
    setFreeTags("");
    setFreeBody("");
    setFreeFiles([]);
    setFreeRunId("");
    setSaveError(null);
  }

  function goHome() {
    setFlow("list");
    setSelectedRun(null);
    setSelType("GENERAL");
    resetTypedForm();
    resetFreeForm();
  }

  function handleCsvUpload(fieldKey: string, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCsv(String(e.target?.result ?? ""));
      setCsvMap((prev) => ({ ...prev, [fieldKey]: parsed }));
      setFTyped((prev) => ({ ...prev, [fieldKey]: JSON.stringify(parsed) }));
    };
    reader.readAsText(file);
  }

  function getHeaders(): HeadersInit {
    const u = ELN_USERS.find((u) => u.id === userId) ?? ELN_USERS[0];
    return {
      "Content-Type": "application/json",
      "x-user-id": u.id,
      "x-user-name": u.name,
      "x-user-role": u.role,
    };
  }

  function getFileHeaders(): HeadersInit {
    const u = ELN_USERS.find((u) => u.id === userId) ?? ELN_USERS[0];
    return { "x-user-id": u.id, "x-user-name": u.name, "x-user-role": u.role };
  }

  // ── Save typed entry ────────────────────────────────────────────────────
  async function saveTypedEntry() {
    const cfg = ENTRY_TYPE_CONFIGS[selType];
    const missing = (cfg?.fields ?? [])
      .filter((f) => f.required && !fTyped[f.key]?.trim())
      .map((f) => f.label);
    if (!fTitle.trim()) {
      setSaveError("Title is required.");
      return;
    }
    if (missing.length) {
      setSaveError(`Required fields missing: ${missing.join(", ")}`);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        title: fTitle.trim(),
        description: fDesc.trim(),
        technique: fTech,
        entryType: selType,
        typedData: { typed: fTyped, custom: fCustom },
        body: fBody,
        ...(selectedRun ? { linkedRunId: selectedRun.id } : {}),
      };
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(err.error ?? "Save failed");
        return;
      }
      const created = (await res.json()) as Entry;
      for (const file of fFiles) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/entries/${created.id}/attachments`, {
          method: "POST",
          headers: getFileHeaders(),
          body: fd,
        });
      }
      await fetchAll();
      goHome();
    } catch {
      setSaveError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Save free entry ─────────────────────────────────────────────────────
  async function saveFreeEntry() {
    if (!fTitle.trim()) {
      setSaveError("Title is required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        title: fTitle.trim(),
        description: "",
        technique: "General",
        entryType: "GENERAL",
        typedData: {
          typed: {
            _isUnstructured: "true",
            ...(freeTags.trim() ? { _tags: freeTags.trim() } : {}),
          },
          custom: [],
        },
        body: freeBody,
        ...(freeRunId ? { linkedRunId: freeRunId } : {}),
      };
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(err.error ?? "Save failed");
        return;
      }
      const created = (await res.json()) as Entry;
      for (const file of freeFiles) {
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`/api/entries/${created.id}/attachments`, {
          method: "POST",
          headers: getFileHeaders(),
          body: fd,
        });
      }
      await fetchAll();
      goHome();
    } catch {
      setSaveError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Filtered data ────────────────────────────────────────────────────────
  const filteredEntries = entries.filter((e) => {
    if (listType && e.entryType !== listType) return false;
    if (!listQ.trim()) return true;
    const q = listQ.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      (e.description?.toLowerCase().includes(q) ?? false) ||
      (e.author?.name?.toLowerCase().includes(q) ?? false)
    );
  });

  const searchedRuns = runs.filter((r) => {
    if (!runQ.trim()) return true;
    const q = runQ.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      (r.sourceEntry?.title?.toLowerCase().includes(q) ?? false)
    );
  });
  const activeRuns = searchedRuns.filter((r) => r.status === "IN_PROGRESS");
  const completedRuns = searchedRuns.filter((r) => r.status === "COMPLETED");

  // ── Current entry type config ─────────────────────────────────────────
  const cfg = ENTRY_TYPE_CONFIGS[selType];
  const coreFields = (cfg?.fields ?? []).filter(
    (f) => !f.section || f.section === "core"
  );
  const structuredFields = (cfg?.fields ?? []).filter(
    (f) => f.section === "structured"
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col gap-4 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👾</span>
          <h1 className="text-lg font-bold text-amber-300">Data Ingestion</h1>
        </div>
        {flow !== "list" && (
          <button
            onClick={goHome}
            className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700"
          >
            ← Back to list
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── LIST VIEW ─────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {flow === "list" && (
        <>
          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setFlow("ingest_q")}
              className="rounded-lg border border-amber-600/50 bg-amber-600/15 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-600/25"
            >
              👾 Ingest Data
            </button>
            <button
              onClick={() => {
                resetFreeForm();
                setFlow("free_entry");
              }}
              className="rounded-lg border border-zinc-600/50 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
            >
              ✏️ Free Entry
            </button>
          </div>

          {fetchError && (
            <p className="rounded border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
              {fetchError}
            </p>
          )}

          {/* Search + type filter */}
          <div className="flex items-center gap-2">
            <input
              value={listQ}
              onChange={(e) => setListQ(e.target.value)}
              placeholder="Search entries…"
              className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            <select
              value={listType}
              onChange={(e) => setListType(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none"
            >
              <option value="">All types</option>
              {ENTRY_TYPE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {ENTRY_TYPE_CONFIGS[k].icon} {ENTRY_TYPE_CONFIGS[k].label}
                </option>
              ))}
            </select>
            <button
              onClick={fetchAll}
              className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
              title="Refresh"
            >
              ↻
            </button>
          </div>

          {/* Entry list */}
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : filteredEntries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-700 py-12 text-center">
              <p className="text-2xl">👾</p>
              <p className="mt-2 text-sm text-zinc-500">
                No entries yet.{" "}
                <button
                  onClick={() => setFlow("ingest_q")}
                  className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
                >
                  Ingest Data
                </button>{" "}
                or{" "}
                <button
                  onClick={() => {
                    resetFreeForm();
                    setFlow("free_entry");
                  }}
                  className="text-zinc-300 underline underline-offset-2 hover:text-zinc-100"
                >
                  Free Entry
                </button>{" "}
                to get started.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredEntries.map((e) => (
                <EntryCard key={e.id} entry={e} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── IS THIS EXPERIMENTAL DATA? ────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {flow === "ingest_q" && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-8 shadow-2xl">
            <p className="mb-1 text-center text-3xl">👾</p>
            <h2 className="mb-2 text-center text-base font-bold text-zinc-100">
              Ingest Data
            </h2>
            <p className="mb-6 text-center text-sm text-zinc-400">
              Is this data tied to a protocol run?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setRunQ("");
                  setActiveOpen(true);
                  setCompletedOpen(false);
                  setFlow("run_select");
                }}
                className="w-full rounded-lg border border-green-700/50 bg-green-900/20 px-4 py-3 text-sm font-semibold text-green-200 transition hover:bg-green-900/30"
              >
                ✅ Yes — link to a run
              </button>
              <button
                onClick={() => {
                  setSelectedRun(null);
                  setSelType("GENERAL");
                  resetTypedForm();
                  setFlow("entry_type");
                }}
                className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
              >
                ➡️ No — standalone entry
              </button>
            </div>
            <button
              onClick={goHome}
              className="mt-5 w-full text-xs text-zinc-600 transition hover:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── RUN SELECTOR ─────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {flow === "run_select" && (
        <div className="flex max-w-2xl flex-col gap-4">
          <h2 className="text-base font-bold text-zinc-200">
            Select a Protocol Run
          </h2>

          <input
            value={runQ}
            onChange={(e) => setRunQ(e.target.value)}
            placeholder="Search runs by title or protocol…"
            className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />

          {/* Active runs */}
          <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
            <button
              onClick={() => setActiveOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-green-300 transition hover:bg-zinc-800/50"
            >
              <span>▶ Active Runs ({activeRuns.length})</span>
              <span className="text-zinc-500">{activeOpen ? "▲" : "▼"}</span>
            </button>
            {activeOpen && (
              <div className="flex flex-col gap-1 border-t border-zinc-800 p-2">
                {activeRuns.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-zinc-600">
                    No active runs
                  </p>
                ) : (
                  activeRuns.map((r) => (
                    <RunCard
                      key={r.id}
                      run={r}
                      onSelect={() => {
                        setSelectedRun(r);
                        resetTypedForm();
                        setFlow("entry_type");
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Completed runs */}
          <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900">
            <button
              onClick={() => setCompletedOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-800/50"
            >
              <span>✅ Completed Runs ({completedRuns.length})</span>
              <span className="text-zinc-500">{completedOpen ? "▲" : "▼"}</span>
            </button>
            {completedOpen && (
              <div className="flex flex-col gap-1 border-t border-zinc-800 p-2">
                {completedRuns.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-zinc-600">
                    No completed runs
                  </p>
                ) : (
                  completedRuns.map((r) => (
                    <RunCard
                      key={r.id}
                      run={r}
                      onSelect={() => {
                        setSelectedRun(r);
                        resetTypedForm();
                        setFlow("entry_type");
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── ENTRY TYPE GRID ──────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {flow === "entry_type" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-zinc-200">
              Select Entry Type
            </h2>
            {selectedRun && (
              <span className="rounded border border-green-700/40 bg-green-900/20 px-2 py-0.5 text-xs text-green-300">
                ↳ {selectedRun.title}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ENTRY_TYPE_KEYS.map((key) => {
              const c = ENTRY_TYPE_CONFIGS[key];
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelType(key);
                    resetTypedForm();
                    setFlow("entry_form");
                  }}
                  className="flex flex-col items-start gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-left transition hover:border-amber-600/50 hover:bg-zinc-800"
                >
                  <span className="text-2xl">{c.icon}</span>
                  <span className="text-sm font-semibold text-zinc-100">
                    {c.label}
                  </span>
                  <span className="text-[11px] leading-snug text-zinc-500">
                    {c.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TYPED ENTRY FORM ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {flow === "entry_form" && (
        <div className="flex max-w-2xl flex-col gap-5">
          {/* Form header */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">{cfg?.icon}</span>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                {cfg?.label} Entry
              </h2>
              {selectedRun && (
                <p className="text-xs text-green-400">
                  ↳ Linked run: {selectedRun.title}
                </p>
              )}
            </div>
          </div>

          {saveError && (
            <p className="rounded border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
              {saveError}
            </p>
          )}

          <FF label="Title *">
            <input
              value={fTitle}
              onChange={(e) => setFTitle(e.target.value)}
              placeholder={`${cfg?.label ?? ""} — ${new Date().toLocaleDateString()}`}
              className={INPUT_CLS}
            />
          </FF>

          <FF label="Description">
            <input
              value={fDesc}
              onChange={(e) => setFDesc(e.target.value)}
              placeholder="Short description (max 100 chars)"
              maxLength={100}
              className={INPUT_CLS}
            />
          </FF>

          <FF label="Technique">
            <select
              value={fTech}
              onChange={(e) => setFTech(e.target.value)}
              className={INPUT_CLS}
            >
              {TECHNIQUE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FF>

          {/* ── Core typed fields ─────────────────────────────────────── */}
          {coreFields.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                {cfg?.label} Fields
              </p>
              {coreFields.map((field) => (
                <FF
                  key={field.key}
                  label={`${field.label}${field.required ? " *" : ""}`}
                >
                  {field.type === "textarea" ? (
                    <textarea
                      value={fTyped[field.key] ?? ""}
                      onChange={(e) =>
                        setFTyped((p) => ({
                          ...p,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      rows={3}
                      className={`${INPUT_CLS} resize-y`}
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={fTyped[field.key] ?? ""}
                      onChange={(e) =>
                        setFTyped((p) => ({
                          ...p,
                          [field.key]: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                    >
                      <option value="">Select…</option>
                      {field.options?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "date" ? (
                    <input
                      type="date"
                      value={fTyped[field.key] ?? ""}
                      onChange={(e) =>
                        setFTyped((p) => ({
                          ...p,
                          [field.key]: e.target.value,
                        }))
                      }
                      className={INPUT_CLS}
                    />
                  ) : (
                    <input
                      value={fTyped[field.key] ?? ""}
                      onChange={(e) =>
                        setFTyped((p) => ({
                          ...p,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      className={INPUT_CLS}
                    />
                  )}
                </FF>
              ))}
            </div>
          )}

          {/* ── Structured fields ─────────────────────────────────────── */}
          {structuredFields.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-zinc-700" />
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Structured Data
                </p>
                <div className="h-px flex-1 bg-zinc-700" />
              </div>
              {structuredFields.map((field) => (
                <FF key={field.key} label={field.label}>
                  {field.type === "csv_trace" ? (
                    <div>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleCsvUpload(field.key, f);
                        }}
                        className="block text-xs text-zinc-400 file:mr-3 file:rounded file:border file:border-zinc-600 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-zinc-200 file:transition file:hover:bg-zinc-600"
                      />
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {field.placeholder}
                      </p>
                      {csvMap[field.key] && (
                        <CsvPreview data={csvMap[field.key]} />
                      )}
                    </div>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={fTyped[field.key] ?? ""}
                      onChange={(e) =>
                        setFTyped((p) => ({
                          ...p,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      rows={3}
                      className={`${INPUT_CLS} resize-y`}
                    />
                  ) : (
                    <input
                      value={fTyped[field.key] ?? ""}
                      onChange={(e) =>
                        setFTyped((p) => ({
                          ...p,
                          [field.key]: e.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      className={INPUT_CLS}
                    />
                  )}
                </FF>
              ))}
            </div>
          )}

          {/* ── Notes ─────────────────────────────────────────────────── */}
          <FF label="Notes">
            <textarea
              value={fBody}
              onChange={(e) => setFBody(e.target.value)}
              placeholder="Additional notes, observations, or comments…"
              rows={4}
              className={`${INPUT_CLS} resize-y`}
            />
          </FF>

          {/* ── File attachments ──────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-zinc-400">Attachments</p>
            <input
              type="file"
              multiple
              onChange={(e) => {
                setFFiles((prev) => [
                  ...prev,
                  ...Array.from(e.target.files ?? []),
                ]);
                e.target.value = "";
              }}
              className="block text-xs text-zinc-400 file:mr-3 file:rounded file:border file:border-zinc-600 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-zinc-200 file:transition file:hover:bg-zinc-600"
            />
            {fFiles.length > 0 && (
              <ul className="flex flex-col gap-1">
                {fFiles.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs"
                  >
                    <span className="text-zinc-300">{f.name}</span>
                    <button
                      onClick={() =>
                        setFFiles((p) => p.filter((_, j) => j !== i))
                      }
                      className="ml-2 text-zinc-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Custom KV fields ──────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Custom Fields
              </p>
              <button
                onClick={() =>
                  setFCustom((p) => [
                    ...p,
                    { id: crypto.randomUUID(), key: "", value: "" },
                  ])
                }
                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 transition hover:text-zinc-200"
              >
                + Add
              </button>
            </div>
            {fCustom.map((cf, idx) => (
              <div key={cf.id} className="flex items-center gap-2">
                <input
                  value={cf.key}
                  onChange={(e) =>
                    setFCustom((p) =>
                      p.map((x, i) =>
                        i === idx ? { ...x, key: e.target.value } : x
                      )
                    )
                  }
                  placeholder="Key"
                  className={`${INPUT_CLS} w-36`}
                />
                <input
                  value={cf.value}
                  onChange={(e) =>
                    setFCustom((p) =>
                      p.map((x, i) =>
                        i === idx ? { ...x, value: e.target.value } : x
                      )
                    )
                  }
                  placeholder="Value"
                  className={`${INPUT_CLS} flex-1`}
                />
                <button
                  onClick={() =>
                    setFCustom((p) => p.filter((_, i) => i !== idx))
                  }
                  className="shrink-0 text-zinc-500 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* ── Actions ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={saveTypedEntry}
              disabled={saving}
              className="rounded-lg border border-amber-600/60 bg-amber-600/20 px-5 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-600/30 disabled:opacity-50"
            >
              {saving ? "Saving…" : "💾 Save Entry"}
            </button>
            <button
              onClick={goHome}
              className="text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── FREE ENTRY FORM ──────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {flow === "free_entry" && (
        <div className="flex max-w-2xl flex-col gap-5">
          <h2 className="text-base font-bold text-zinc-200">✏️ Free Entry</h2>

          {saveError && (
            <p className="rounded border border-red-700/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
              {saveError}
            </p>
          )}

          <FF label="Title *">
            <input
              value={fTitle}
              onChange={(e) => setFTitle(e.target.value)}
              placeholder="Entry title"
              className={INPUT_CLS}
            />
          </FF>

          <FF label="Tags">
            <input
              value={freeTags}
              onChange={(e) => setFreeTags(e.target.value)}
              placeholder="Comma-separated (e.g. purification, protocol-note)"
              className={INPUT_CLS}
            />
          </FF>

          <FF label="Body">
            <textarea
              value={freeBody}
              onChange={(e) => setFreeBody(e.target.value)}
              placeholder="Notes, observations, or any free-form content…"
              rows={8}
              className={`${INPUT_CLS} resize-y`}
            />
          </FF>

          {/* Attachments */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-zinc-400">Attachments</p>
            <input
              type="file"
              multiple
              onChange={(e) => {
                setFreeFiles((prev) => [
                  ...prev,
                  ...Array.from(e.target.files ?? []),
                ]);
                e.target.value = "";
              }}
              className="block text-xs text-zinc-400 file:mr-3 file:rounded file:border file:border-zinc-600 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-zinc-200 file:transition file:hover:bg-zinc-600"
            />
            {freeFiles.length > 0 && (
              <ul className="flex flex-col gap-1">
                {freeFiles.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs"
                  >
                    <span className="text-zinc-300">{f.name}</span>
                    <button
                      onClick={() =>
                        setFreeFiles((p) => p.filter((_, j) => j !== i))
                      }
                      className="ml-2 text-zinc-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <FF label="Link to Run (optional)">
            <select
              value={freeRunId}
              onChange={(e) => setFreeRunId(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">— No run —</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.status === "IN_PROGRESS" ? "Active" : "Completed"})
                </option>
              ))}
            </select>
          </FF>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={saveFreeEntry}
              disabled={saving}
              className="rounded-lg border border-zinc-600/60 bg-zinc-700/40 px-5 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "💾 Save Entry"}
            </button>
            <button
              onClick={goHome}
              className="text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
