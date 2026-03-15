"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Editor from "@/components/Editor";
import AppTopNav from "@/components/AppTopNav";
import { USER_STORAGE_KEY } from "@/components/AppTopNav";
import { Q5_TEMPLATE_ENTRY_ID } from "@/lib/defaultTemplates";
import { TECHNIQUE_OPTIONS, PROTOCOL_TECHNIQUES, type Entry } from "@/models/entry";
import { parseTypedData } from "@/lib/entryTypes";
import { printProtocol } from "@/utils/printProtocol";
import { parseProtocolBody } from "@/utils/parseProtocolBody";
import TagInput from "@/components/tags/TagInput";
import TagDisplay from "@/components/tags/TagDisplay";

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

// ─── Version helpers ──────────────────────────────────────────────────────────

function getTypedField(entry: Entry, key: string): string | undefined {
  const raw = entry.typedData;
  if (!raw || typeof raw !== "object") return undefined;
  return (raw as { typed?: Record<string, string> }).typed?.[key] || undefined;
}

function getSemVer(entry: Entry): string {
  return getTypedField(entry, "_semVer") || "1.0";
}

function getParentId(entry: Entry): string | undefined {
  return getTypedField(entry, "_parentId");
}

function bumpSemVer(current: string, type: "major" | "minor"): string {
  const parts = current.split(".");
  const major = parseInt(parts[0] || "1", 10);
  const minor = parseInt(parts[1] || "0", 10);
  if (type === "major") return `${major + 1}.0`;
  return `${major}.${minor + 1}`;
}

function compareSemVer(a: string, b: string): number {
  const [aMaj = 0, aMin = 0] = a.split(".").map((n) => parseInt(n || "0", 10));
  const [bMaj = 0, bMin = 0] = b.split(".").map((n) => parseInt(n || "0", 10));
  if (aMaj !== bMaj) return aMaj - bMaj;
  return aMin - bMin;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Version Bump Modal ───────────────────────────────────────────────────────

function VersionBumpModal({
  payload,
  currentSemVer,
  onDecide,
  onCancel,
}: {
  payload: Partial<Entry>;
  currentSemVer: string;
  onDecide: (type: "major" | "minor") => void;
  onCancel: () => void;
}) {
  const [showGuide, setShowGuide] = useState(false);
  const majorVer = bumpSemVer(currentSemVer, "major");
  const minorVer = bumpSemVer(currentSemVer, "minor");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl shadow-black/80">
        <h3 className="mb-1 text-sm font-semibold text-zinc-100">
          Save &ldquo;{payload.title}&rdquo;
        </h3>
        <p className="mb-4 text-xs text-zinc-400">
          Currently{" "}
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-300">
            v{currentSemVer}
          </span>
          {" "}— is this a major or minor change?
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => onDecide("major")}
            className="rounded border border-orange-500/40 bg-orange-500/10 py-2.5 text-sm font-medium text-orange-200 transition hover:bg-orange-500/20"
          >
            Major
            <span className="mt-0.5 block text-[11px] font-normal text-orange-300/70">
              → v{majorVer}
            </span>
          </button>
          <button
            onClick={() => onDecide("minor")}
            className="rounded border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20"
          >
            Minor
            <span className="mt-0.5 block text-[11px] font-normal text-emerald-300/70">
              → v{minorVer}
            </span>
          </button>
        </div>

        <button
          onClick={() => setShowGuide((v) => !v)}
          className="mb-3 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
        >
          {showGuide ? "Hide guide ▴" : "Not sure? ▾"}
        </button>

        {showGuide && (
          <div className="mb-3 space-y-2 rounded border border-zinc-700 bg-zinc-800/60 p-3 text-xs">
            <div>
              <p className="font-semibold text-emerald-300">Minor change (x.Y)</p>
              <p className="mt-0.5 text-zinc-400">
                Text edits, concentration or incubation time updates, within-step wording changes,
                description or materials list edits
              </p>
            </div>
            <div>
              <p className="font-semibold text-orange-300">Major change (X.0)</p>
              <p className="mt-0.5 text-zinc-400">
                Adding or deleting entire sections or steps, restructuring the procedure,
                adding or removing protocol components
              </p>
            </div>
          </div>
        )}

        <button
          onClick={onCancel}
          className="text-xs text-zinc-600 hover:text-zinc-400"
        >
          Cancel save
        </button>
      </div>
    </div>
  );
}

// ─── New Protocol Creation Modal ─────────────────────────────────────────────

function NewProtocolModal({
  onClose,
  onCreated,
  jsonHeaders,
}: {
  onClose:    () => void;
  onCreated:  (entry: Entry) => void;
  jsonHeaders: Record<string, string>;
}) {
  const [name,       setName]       = useState("");
  const [technique,  setTechnique]  = useState("General");
  const [shortDesc,  setShortDesc]  = useState("");
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [creating,   setCreating]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Debounced uniqueness check — fires 500 ms after the user stops typing
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameStatus("idle");
      return;
    }
    setNameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/protocols/check-name?name=${encodeURIComponent(trimmed)}`);
        const data = (await res.json()) as { available: boolean };
        setNameStatus(data.available ? "available" : "taken");
      } catch {
        setNameStatus("idle");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [name]);

  const canCreate = Boolean(
    name.trim() && technique && nameStatus === "available" && !creating
  );

  async function handleCreate() {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/protocols", {
        method:  "POST",
        headers: jsonHeaders,
        body:    JSON.stringify({
          name:             name.trim(),
          technique,
          shortDescription: shortDesc.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? `Failed to create protocol (${res.status}).`);
        return;
      }
      const entry = (await res.json()) as Entry;
      onCreated(entry);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl shadow-black/80">
        <h2 className="mb-5 text-base font-semibold text-zinc-100">New Protocol</h2>

        {/* Protocol Name */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-zinc-300">
            Protocol Name <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") onClose(); }}
            placeholder="e.g. Q5 Site-Directed Mutagenesis"
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          <div className="mt-1 h-4 text-xs">
            {nameStatus === "checking"  && <span className="text-zinc-500">Checking…</span>}
            {nameStatus === "available" && name.trim() && <span className="text-emerald-400">✓ Name available</span>}
            {nameStatus === "taken"     && <span className="text-red-400">✗ Name already in use</span>}
          </div>
        </div>

        {/* Technique */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-zinc-300">
            Technique <span className="text-red-400">*</span>
          </label>
          <select
            value={technique}
            onChange={(e) => setTechnique(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          >
            {PROTOCOL_TECHNIQUES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Short Description */}
        <div className="mb-5">
          <label className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-300">
            <span>Short Description</span>
            <span className={`font-normal ${shortDesc.length > 90 ? "text-orange-400" : "text-zinc-500"}`}>
              {shortDesc.length}/100
            </span>
          </label>
          <textarea
            value={shortDesc}
            onChange={(e) => setShortDesc(e.target.value.slice(0, 100))}
            rows={2}
            placeholder="Brief one-liner describing this protocol (optional)"
            className="w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => void handleCreate()}
            disabled={!canCreate}
            className="flex-1 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "Creating…" : "Create Protocol"}
          </button>
          <button
            onClick={onClose}
            disabled={creating}
            className="rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Technique tabs ───────────────────────────────────────────────────────────

const TECHNIQUE_TABS = [
  { id: "ALL",                      label: "All Protocols",            icon: "📚" },
  { id: "CLONING",                  label: "Cloning",                  icon: "🧬" },
  { id: "EXPRESSION_PURIFICATION",  label: "Expression & Purification", icon: "📈" },
  { id: "MASS_SPEC",                label: "Mass Spectrometry",        icon: "🧪" },
  { id: "ANTIBODY_CHARACTERIZATION",label: "Antibody Characterization", icon: "🧫" },
  { id: "CELL_CULTURE",             label: "Cell Culture",             icon: "🧬" },
  { id: "SAMPLE_PREP_QC",           label: "Sample Prep & QC",         icon: "🧊" },
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

// ─── Protocol families (grouping) ────────────────────────────────────────────

type ProtocolFamily = {
  representative: Entry; // latest version shown in list
  allVersions: Entry[];
};

function buildFamilies(entries: Entry[]): ProtocolFamily[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const childrenMap = new Map<string, Entry[]>();
  const rootIds: string[] = [];

  for (const entry of entries) {
    const parentId = getParentId(entry);
    if (parentId && byId.has(parentId)) {
      const arr = childrenMap.get(parentId) ?? [];
      arr.push(entry);
      childrenMap.set(parentId, arr);
    } else {
      rootIds.push(entry.id);
    }
  }

  // Recursively collect all descendants of a node
  function collectAll(id: string, visited: Set<string>): Entry[] {
    if (visited.has(id)) return [];
    visited.add(id);
    const entry = byId.get(id);
    if (!entry) return [];
    const children = childrenMap.get(id) ?? [];
    return [entry, ...children.flatMap((c) => collectAll(c.id, visited))];
  }

  const families: ProtocolFamily[] = [];
  const visited = new Set<string>();

  for (const rootId of rootIds) {
    const allVersions = collectAll(rootId, visited);
    // Sort descending by semVer — representative = latest
    const sorted = [...allVersions].sort((a, b) =>
      compareSemVer(getSemVer(b), getSemVer(a))
    );
    families.push({ representative: sorted[0], allVersions });
  }

  return families;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
  const [entries, setEntries]       = useState<Entry[]>([]);
  const [selected, setSelected]     = useState<Entry | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [isDirty, setIsDirty]       = useState(false);

  // Pending payload waiting for version bump decision
  const [pendingPayload, setPendingPayload] = useState<Partial<Entry> | null>(null);

  // Run confirmation dialog
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // New Protocol creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Amber nudge banner — shown after save if protocol has no PROJECT tag
  const [showTagNudge, setShowTagNudge] = useState(false);

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
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    handleSelect(openId);
    router.replace("/protocols", { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Core save logic ────────────────────────────────────────────────────────

  /** Final save — called after version bump is decided (or null for new entries) */
  async function doSave(payload: Partial<Entry>, bumpType: "major" | "minor" | null) {
    setPendingPayload(null);
    setLoading(true);
    setSaveError(null);

    let finalPayload = { ...payload };
    const isUpdate = editorMode === "edit" && Boolean(finalPayload.id);

    // Apply semVer bump for updates
    if (bumpType && selected) {
      const currentSemVer = getSemVer(selected);
      const newSemVer = bumpSemVer(currentSemVer, bumpType);
      const rawTd = finalPayload.typedData ?? selected.typedData;
      const td = parseTypedData(rawTd);
      td.typed._semVer = newSemVer;
      finalPayload = { ...finalPayload, typedData: td };
    }

    // For new protocols, ensure _semVer is initialised to "1.0"
    if (!isUpdate) {
      const td = parseTypedData(finalPayload.typedData);
      if (!td.typed._semVer) td.typed._semVer = "1.0";
      finalPayload = { ...finalPayload, typedData: td };
    }

    try {
      const res = await fetch(isUpdate ? `/api/entries/${finalPayload.id}` : "/api/entries", {
        method: isUpdate ? "PUT" : "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          title:       finalPayload.title,
          description: finalPayload.description,
          body:        finalPayload.body,
          technique:   finalPayload.technique,
          entryType:   finalPayload.entryType,
          typedData:   finalPayload.typedData,
        }),
      });
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json())?.error || ""; } catch { detail = await res.text().catch(() => ""); }
        setSaveError(`${isUpdate ? "Update" : "Create"} failed (${res.status})${detail ? `: ${detail}` : ""}`);
        return;
      }
      const saved = (await res.json()) as Entry;
      // Preserve tagAssignments — they are managed via /api/tags/assign, not the entry save
      const existingTagAssignments = selected?.tagAssignments ?? [];
      const mergedSaved: Entry = { ...saved, tagAssignments: existingTagAssignments };
      setEntries((s) => isUpdate ? s.map((e) => e.id === saved.id ? mergedSaved : e) : [mergedSaved, ...s]);
      setEditorMode("edit");
      setSelected(mergedSaved);
      setIsDirty(false);
      // Show nudge banner if protocol has no PROJECT tag
      const hasProjectTag = existingTagAssignments.some((a) => a.tag.type === "PROJECT");
      setShowTagNudge(!hasProjectTag);
    } finally {
      setLoading(false);
    }
  }

  /** Entry point for saving — intercepts to show version bump modal for edits */
  async function handleSave(payload: Partial<Entry>) {
    if (payload.id === Q5_TEMPLATE_ENTRY_ID) {
      setSaveError("This template is permanent. Clone it first to create an editable copy.");
      return;
    }
    const isUpdate = editorMode === "edit" && Boolean(payload.id);

    // Block save if nothing changed
    if (isUpdate && !isDirty) {
      setSaveError("No changes detected — modify the protocol before saving.");
      return;
    }

    // New protocols: save immediately (no version bump prompt)
    if (!isUpdate) {
      await doSave(payload, null);
      return;
    }

    // Existing protocols: show version bump modal
    setPendingPayload(payload);
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
    setPendingPayload(null);
    setShowTagNudge(false);
  }

  async function handleSelect(id: string) {
    setLoading(true);
    setSaveError(null);

    // Inner fetch with one auto-retry for Turbopack dev cold-start (308 mismatch)
    async function attempt(): Promise<boolean> {
      const res = await fetch(`/api/entries/${id}`, { headers: authHeaders });
      if (!res.ok) {
        setSaveError(`Failed to load protocol (${res.status}). Please try again.`);
        return false;
      }
      const data = (await res.json()) as Entry;
      // Wrong shape = Turbopack served wrong route before compilation finished
      if (!data || Array.isArray(data) || !("id" in data)) return false;
      setEditorMode("edit");
      setSelected(data);
      setIsDirty(false);
      setEditorOpen(true);
      setShowTagNudge(false);
      return true;
    }

    try {
      const ok = await attempt();
      if (!ok) {
        // One retry after a short pause (handles cold-start 308 or wrong payload)
        await new Promise(r => setTimeout(r, 600));
        const ok2 = await attempt();
        if (!ok2) setSaveError("Network error — could not load protocol. Please try again.");
      }
    } catch (e) {
      console.error("handleSelect network error:", e);
      try {
        await new Promise(r => setTimeout(r, 600));
        await attempt();
      } catch {
        setSaveError("Network error — could not load protocol. Please try again.");
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
    setSaveError(null);
    try {
      const res = await fetch(`/api/entries/${id}`, { method: "POST", headers: authHeaders });
      if (!res.ok) {
        setSaveError(`Clone failed (${res.status}). Please try again.`);
        return;
      }
      const cloned = (await res.json()) as Entry;
      setEntries((s) => [cloned, ...s]);
      setSelected(cloned);
      setEditorMode("edit");
      setIsDirty(false);
      setEditorOpen(true);
    } catch (e) {
      console.error("handleClone network error:", e);
      setSaveError("Network error — could not clone protocol. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleRunProtocol() {
    if (!selected) return;
    setShowConfirmModal(true);
  }

  async function confirmStartRun() {
    if (!selected) return;
    setShowConfirmModal(false);
    setLoading(true);
    try {
      // operatorName is derived server-side from x-user-name header (currentUser.name)
      const res = await fetch("/api/protocol-runs", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ sourceEntryId: selected.id }),
      });
      if (!res.ok) { console.error("Failed to create run:", res.status); return; }
      const run = (await res.json()) as { id: string };
      router.push(`/runs/${run.id}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Open parent from Version tab ───────────────────────────────────────────
  async function handleOpenParent(parentId: string) {
    await handleSelect(parentId);
  }

  // ── Called when NewProtocolModal successfully creates a protocol ────────────
  function handleProtocolCreated(entry: Entry) {
    setEntries((s) => [entry, ...s]);
    setSelected(entry);
    setEditorMode("edit");
    setIsDirty(false);
    setSaveError(null);
    setPendingPayload(null);
    setEditorOpen(true);
    setShowCreateModal(false);
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

  // ── Group into families ────────────────────────────────────────────────────
  const groupedFamilies = useMemo(() => buildFamilies(filteredEntries), [filteredEntries]);

  // ── Version family for the currently open entry (passed to Editor) ──────────
  const selectedVersionFamily = useMemo(() => {
    if (!selected) return undefined;
    const fam = groupedFamilies.find((f) => f.allVersions.some((e) => e.id === selected.id));
    const versions = fam?.allVersions ?? [selected];
    if (versions.length <= 1) return undefined; // no dropdown needed for single-entry families
    return versions.map((e) => ({ id: e.id, title: e.title || "", semVer: getSemVer(e) }));
  }, [selected, groupedFamilies]);

  const canRunProtocol = editorOpen && editorMode === "edit" && Boolean(selected) && !isDirty;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col gap-3 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      {/* Action bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowCreateModal(true)}
          className="ml-auto rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500"
        >
          + New Protocol
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

        {/* Grouped protocol list */}
        <ul className="space-y-2">
          {groupedFamilies.map(({ representative: e, allVersions }) => {
            const semVer    = getSemVer(e);
            const vCount    = allVersions.length;
            const fallback  = stripHtml(e.body ?? "");
            const summary   = (e.description || fallback).slice(0, 100);
            const author    = e.author?.name || "Unknown";
            const technique = e.technique || "General";
            const editable  = canEdit(e);
            const deletable = canDelete(e);

            return (
              <li key={e.id} className="rounded border border-zinc-800 bg-zinc-900 p-2">
                <button onClick={() => handleSelect(e.id)} className="w-full text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-semibold text-zinc-100">{e.title || "Untitled"}</p>
                    <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      v{semVer}
                    </span>
                    {vCount > 1 && (
                      <span className="shrink-0 rounded border border-zinc-600/50 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {vCount} versions
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-300">{summary || "No description"}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">Author: {author}</p>
                  <p className="text-[11px] text-zinc-400">Technique: {technique}</p>
                  {(e.tagAssignments?.length ?? 0) > 0 && (
                    <div className="mt-1.5">
                      <TagDisplay
                        tags={(e.tagAssignments ?? []).map((a) => a.tag)}
                        maxVisible={3}
                      />
                    </div>
                  )}
                </button>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  <button
                    onClick={() => handleEdit(e.id)}
                    disabled={!editable}
                    className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleClone(e.id)}
                    className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200"
                  >
                    Clone
                  </button>
                  <button
                    onClick={() => {
                      printProtocol(
                        parseProtocolBody(
                          e.body ?? "",
                          e.title || "Protocol",
                          getSemVer(e),
                          e.author?.name ?? "Unknown",
                          currentUser.name,
                        ),
                      );
                    }}
                    className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200"
                  >
                    Print
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    disabled={!deletable}
                    className="rounded border border-red-500/50 px-2 py-1 text-xs text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
          {groupedFamilies.length === 0 && !loading && (
            <li className="py-8 text-center text-sm text-zinc-600">No protocols match your filters.</li>
          )}
        </ul>
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
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="min-w-0 truncate text-sm font-semibold text-zinc-300">
                  {selected?.title || (editorMode === "create" ? "New Protocol" : "Protocol")}
                </span>
                {canRunProtocol && (
                  <button
                    onClick={handleRunProtocol}
                    disabled={loading}
                    className="shrink-0 rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    ▶ Run Protocol
                  </button>
                )}
                {canRunProtocol && (
                  <button
                    onClick={() => {
                      if (!selected) return;
                      printProtocol(
                        parseProtocolBody(
                          selected.body ?? "",
                          selected.title || "Protocol",
                          getSemVer(selected),
                          selected.author?.name ?? "Unknown",
                          currentUser.name,
                        ),
                      );
                    }}
                    className="shrink-0 rounded border border-zinc-600 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    🖨 Print
                  </button>
                )}
                {isDirty && (
                  <span className="shrink-0 text-[10px] text-zinc-500">(unsaved — save before running)</span>
                )}
              </div>
              <button
                onClick={closeEditor}
                className="ml-3 shrink-0 rounded px-2 py-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
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
                onOpenParent={handleOpenParent}
                versionFamily={selectedVersionFamily}
                beforeButtons={
                  <div className="mt-4 space-y-2">
                    {/* Tags section */}
                    <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Tags</p>
                      {editorMode === "edit" && selected?.id ? (
                        <TagInput
                          entityType="ENTRY"
                          entityId={selected.id}
                          currentUser={currentUser.name}
                          entityOwner={selected.author?.name ?? "Admin"}
                          existingAssignments={selected.tagAssignments ?? []}
                          onAssignmentsChange={(updated) => {
                            setSelected((prev) => prev ? { ...prev, tagAssignments: updated } : prev);
                            setShowTagNudge(false);
                          }}
                        />
                      ) : (
                        <p className="text-xs italic text-zinc-500">Save the protocol before adding tags</p>
                      )}
                    </div>

                    {/* Amber nudge banner */}
                    {showTagNudge && (
                      <div className="flex items-start gap-2 rounded border border-amber-500 bg-amber-500/20 p-3">
                        <span className="shrink-0">⚠️</span>
                        <span className="flex-1 text-sm text-amber-400">
                          <strong className="font-semibold">No Project tag added</strong> — consider tagging this protocol with a Project tag to keep your work organized.
                        </span>
                        <button
                          onClick={() => setShowTagNudge(false)}
                          className="shrink-0 text-amber-400/60 hover:text-amber-400 transition-colors"
                          aria-label="Dismiss"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Version Bump Modal ── */}
      {pendingPayload && selected && (
        <VersionBumpModal
          payload={pendingPayload}
          currentSemVer={getSemVer(selected)}
          onDecide={(type) => void doSave(pendingPayload, type)}
          onCancel={() => setPendingPayload(null)}
        />
      )}

      {/* ── New Protocol Creation Modal ── */}
      {showCreateModal && (
        <NewProtocolModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleProtocolCreated}
          jsonHeaders={jsonHeaders}
        />
      )}

      {/* ── Run Confirmation Dialog ── */}
      {showConfirmModal && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <p className="mb-6 text-sm text-zinc-200">
              Are you sure you want to start{" "}
              <span className="font-semibold text-zinc-100">{selected.title}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => void confirmStartRun()}
                disabled={loading}
                className="flex-1 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                ▶ Start Run
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
