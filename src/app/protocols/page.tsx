"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Editor from "@/components/Editor";
import EntryList from "@/components/EntryList";
import AppTopNav from "@/components/AppTopNav";
import { ELN_USERS, USER_STORAGE_KEY } from "@/components/AppTopNav";
import { Q5_TEMPLATE_ENTRY_ID } from "@/lib/defaultTemplates";
import { TECHNIQUE_OPTIONS, type Entry } from "@/models/entry";

type CurrentUser = {
  id: string;
  name: string;
  role: "ADMIN" | "MEMBER";
};

const FINN_USER:  CurrentUser = { id: "finn-user",  name: "Finn",  role: "MEMBER" };
const JAKE_USER:  CurrentUser = { id: "jake-user",  name: "Jake",  role: "MEMBER" };
const ADMIN_USER: CurrentUser = { id: "admin-user", name: "Admin", role: "ADMIN"  };

function userFromId(id: string): CurrentUser {
  if (id === "admin-user") return ADMIN_USER;
  if (id === "jake-user")  return JAKE_USER;
  return FINN_USER;
}

const TECHNIQUE_TABS = [
  { id: "ALL",                      label: "All Protocols",           icon: "📚" },
  { id: "CLONING",                  label: "Cloning",                 icon: "🧬" },
  { id: "EXPRESSION_PURIFICATION",  label: "Expression & Purification",icon: "📈" },
  { id: "MASS_SPEC",                label: "Mass Spectrometry",       icon: "🧪" },
  { id: "ANTIBODY_CHARACTERIZATION",label: "Antibody Characterization",icon: "🧫" },
  { id: "CELL_CULTURE",             label: "Cell Culture",            icon: "🧬" },
  { id: "SAMPLE_PREP_QC",           label: "Sample Prep & QC",        icon: "🧊" },
] as const;

function normalizeTechniqueBucket(technique: string): (typeof TECHNIQUE_TABS)[number]["id"] {
  const v = technique.toLowerCase();
  if (v.includes("clon")) return "CLONING";
  if (v.includes("mass") || v.includes("ms")) return "MASS_SPEC";
  if (v.includes("expression") || v.includes("purif")) return "EXPRESSION_PURIFICATION";
  if (v.includes("flow") || v.includes("elisa") || v.includes("western") || v.includes("antibody")) return "ANTIBODY_CHARACTERIZATION";
  if (v.includes("cell") || v.includes("transfection")) return "CELL_CULTURE";
  return "SAMPLE_PREP_QC";
}

export default function ProtocolsPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── User (synced with global AppTopNav selection) ──────────────────────────
  const [currentUser, setCurrentUser] = useState<CurrentUser>(FINN_USER);

  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) setCurrentUser(userFromId(stored));

    function handleStorage(e: StorageEvent) {
      if (e.key === USER_STORAGE_KEY && e.newValue) {
        setCurrentUser(userFromId(e.newValue));
        setSelected(null);
        setEditorMode("create");
        setEditorOpen(false);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // ── Entries state ──────────────────────────────────────────────────────────
  const [entries, setEntries]     = useState<Entry[]>([]);
  const [selected, setSelected]   = useState<Entry | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty]     = useState(false);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [keyword,         setKeyword]         = useState("");
  const [techniqueFilter, setTechniqueFilter] = useState<(typeof TECHNIQUE_TABS)[number]["id"]>("ALL");
  const [authorFilter,    setAuthorFilter]    = useState("ALL");
  const [sortBy,          setSortBy]          = useState<"newest" | "oldest" | "technique" | "author">("newest");

  const authHeaders = useMemo(() => ({
    "x-user-id":   currentUser.id,
    "x-user-name": currentUser.name,
    "x-user-role": currentUser.role,
  }), [currentUser]);

  const jsonHeaders = useMemo(() => ({
    ...authHeaders,
    "Content-Type": "application/json",
  }), [authHeaders]);

  // ── Permissions ────────────────────────────────────────────────────────────
  const canEdit   = (e: Entry) => e.id !== Q5_TEMPLATE_ENTRY_ID && (currentUser.role === "ADMIN" || Boolean(e.authorId && e.authorId === currentUser.id));
  const canDelete = (e: Entry) => e.id !== Q5_TEMPLATE_ENTRY_ID && (currentUser.role === "ADMIN" || Boolean(e.authorId && e.authorId === currentUser.id));

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/entries", { headers: authHeaders });
      if (res.ok) {
        setEntries((await res.json()) as Entry[]);
      } else {
        console.error("Failed to load entries:", res.status);
        setEntries([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  // ── Auto-open from todo link (?open=<entryId>) ─────────────────────────────
  // When navigated here from a todo protocol badge, open that protocol's editor
  // immediately, then clean the param from the URL so refresh doesn't re-open.
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    handleSelect(openId);
    router.replace("/protocols", { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave(payload: Partial<Entry>) {
    if (payload.id === Q5_TEMPLATE_ENTRY_ID) {
      setSaveError("This template is permanent. Clone it first to create an editable copy.");
      return;
    }
    setLoading(true);
    setSaveError(null);
    try {
      const isUpdate = editorMode === "edit" && Boolean(payload.id);
      const res = await fetch(isUpdate ? `/api/entries/${payload.id}` : "/api/entries", {
        method: isUpdate ? "PUT" : "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ title: payload.title, description: payload.description, body: payload.body, technique: payload.technique }),
      });
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json())?.error || ""; } catch { detail = await res.text().catch(() => ""); }
        setSaveError(`${isUpdate ? "Update" : "Create"} failed (${res.status})${detail ? `: ${detail}` : ""}`);
        return;
      }
      const saved = (await res.json()) as Entry;
      setEntries((s) => isUpdate ? s.map((e) => e.id === saved.id ? saved : e) : [saved, ...s]);
      setEditorMode("edit");
      setSelected(saved);
      setIsDirty(false);
    } finally {
      setLoading(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry || !canDelete(entry)) return;
    if (!window.confirm("Are you sure you want to delete this entry? It cannot be recovered once deleted.")) return;
    if (!window.confirm("Please confirm again that you want to permanently delete this entry.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/entries/${id}`, { method: "DELETE", headers: authHeaders });
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json())?.error || ""; } catch { detail = await res.text().catch(() => ""); }
        setSaveError(res.status === 409 ? (detail || "Cannot delete: related runs exist.") : `Delete failed (${res.status})${detail ? `: ${detail}` : ""}`);
        return;
      }
      setEntries((s) => s.filter((e) => e.id !== id));
      setSaveError(null);
      if (selected?.id === id) closeEditor();
    } finally {
      setLoading(false);
    }
  }

  // ── Open / close editor ────────────────────────────────────────────────────
  function closeEditor() {
    setSelected(null);
    setEditorMode("create");
    setIsDirty(false);
    setEditorOpen(false);
    setSaveError(null);
  }

  async function handleSelect(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/entries/${id}`, { headers: authHeaders });
      if (res.ok) {
        const data = (await res.json()) as Entry;
        setEditorMode("edit");
        setSelected(data);
        setIsDirty(false);
        setEditorOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry || !canEdit(entry)) return;
    await handleSelect(id);
  }

  async function handleClone(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/entries/${id}`, { method: "POST", headers: authHeaders });
      if (!res.ok) { console.error("Failed to clone entry:", res.status); return; }
      const cloned = (await res.json()) as Entry;
      setEntries((s) => [cloned, ...s]);
      setSelected(cloned);
      setEditorMode("edit");
      setIsDirty(false);
      setEditorOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunProtocol() {
    if (!selected) return;
    if (!window.confirm(`Run Protocol: ${selected.title}?`)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/protocol-runs", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ sourceEntryId: selected.id }),
      });
      if (!res.ok) { console.error("Failed to create run:", res.status); return; }
      const run = (await res.json()) as { id: string };
      router.push(`/runs?runId=${run.id}&sourceEntryId=${selected.id}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Filter / sort ──────────────────────────────────────────────────────────
  const authorOptions = useMemo(() => {
    const names = Array.from(new Set(entries.map((e) => e.author?.name || "Unknown")));
    return names.sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      const author = entry.author?.name || "Unknown";
      const bucket = normalizeTechniqueBucket(entry.technique || "General");
      return (
        (techniqueFilter === "ALL" || bucket === techniqueFilter) &&
        (authorFilter === "ALL" || author === authorFilter) &&
        (!q || `${entry.title} ${entry.description} ${entry.technique} ${author} ${entry.body}`.toLowerCase().includes(q))
      );
    });
    filtered.sort((a, b) => {
      if (a.id === Q5_TEMPLATE_ENTRY_ID) return -1;
      if (b.id === Q5_TEMPLATE_ENTRY_ID) return 1;
      if (sortBy === "oldest")    return a.createdAt.localeCompare(b.createdAt);
      if (sortBy === "technique") return (a.technique || "General").localeCompare(b.technique || "General");
      if (sortBy === "author")    return (a.author?.name || "Unknown").localeCompare(b.author?.name || "Unknown");
      return b.createdAt.localeCompare(a.createdAt);
    });
    return filtered;
  }, [entries, keyword, techniqueFilter, authorFilter, sortBy]);

  const canRunProtocol = editorOpen && editorMode === "edit" && Boolean(selected) && !isDirty;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col gap-3 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      {/* Action bar — Library + Generate only (no "Protocol Editor" tab) */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setEditorMode("create");
            setSelected(null);
            setIsDirty(false);
            setSaveError(null);
            setEditorOpen(true);
          }}
          className="ml-auto rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500"
        >
          Generate New Protocol
        </button>
      </div>

      {/* Protocol Library */}
      <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
        {/* Technique filter pills */}
        <div className="mb-3 flex flex-wrap gap-2">
          {TECHNIQUE_TABS.map((tab) => {
            const count = tab.id === "ALL"
              ? entries.length
              : entries.filter((e) => normalizeTechniqueBucket(e.technique || "General") === tab.id).length;
            return (
              <button
                key={tab.id}
                onClick={() => setTechniqueFilter(tab.id)}
                className={`rounded border px-2 py-1 text-xs ${
                  techniqueFilter === tab.id
                    ? "border-indigo-500 bg-indigo-600 text-white"
                    : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label} <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search + sort */}
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search keyword"
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500"
          />
          <select
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="ALL">All authors</option>
            {authorOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="technique">Sort: Technique</option>
            <option value="author">Sort: Author</option>
          </select>
        </div>

        <EntryList
          entries={filteredEntries}
          canEdit={canEdit}
          canDelete={canDelete}
          onSelect={handleSelect}
          onEdit={handleEdit}
          onClone={handleClone}
          onDelete={handleDelete}
        />
      </div>

      {/* ── Editor Modal Overlay ── */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 pt-12"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeEditor(); }}
        >
          <div className="w-full max-w-5xl rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/80">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-zinc-100">
                  {editorMode === "edit" ? (selected?.title || "Edit Protocol") : "New Protocol"}
                </h2>
                {canRunProtocol && (
                  <button
                    onClick={handleRunProtocol}
                    disabled={loading}
                    className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    ▶ Run Protocol
                  </button>
                )}
                {isDirty && (
                  <span className="text-[10px] text-zinc-500">(unsaved — save before running)</span>
                )}
              </div>
              <button
                onClick={closeEditor}
                className="rounded px-2 py-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Close editor"
              >
                ✕
              </button>
            </div>

            {/* Error banner */}
            {saveError && (
              <div className="mx-5 mt-3 rounded border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
                {saveError}
              </div>
            )}

            {/* Editor */}
            <div className="p-4">
              <Editor
                initial={selected ?? undefined}
                currentAuthorName={currentUser.name}
                onSave={handleSave}
                onCancel={closeEditor}
                onDirtyChange={setIsDirty}
                saving={loading}
                protocolShell={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
