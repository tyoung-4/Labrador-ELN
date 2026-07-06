"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Editor from "@/components/Editor";
import AppTopNav from "@/components/AppTopNav";
import { ELN_USERS, USER_STORAGE_KEY } from "@/components/AppTopNav";
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

function userFromId(id: string): CurrentUser {
  return ELN_USERS.find((u) => u.id === id) ?? ELN_USERS[0];
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

// ─── Publish Flow Modal ───────────────────────────────────────────────────────

function PublishFlowModal({
  selected,
  parentSemVer,
  onConfirm,
  onCancel,
}: {
  selected: Entry;
  parentSemVer: string | null; // null = brand new protocol (no prior published version)
  onConfirm: (bumpType: "major" | "minor" | null, changeSummary: string) => void;
  onCancel: () => void;
}) {
  const isNewProtocol = parentSemVer === null;
  const [step, setStep] = useState<1 | 2>(isNewProtocol ? 2 : 1);
  const [bumpType, setBumpType] = useState<"major" | "minor" | null>(null);
  const [summary, setSummary] = useState("");

  const minorVer = parentSemVer ? bumpSemVer(parentSemVer, "minor") : "1.0";
  const majorVer = parentSemVer ? bumpSemVer(parentSemVer, "major") : "1.0";
  const targetVer = isNewProtocol ? "1.0" : bumpType ? bumpSemVer(parentSemVer!, bumpType) : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl shadow-black/80">
        {step === 1 ? (
          <>
            <h3 className="mb-3 text-sm font-semibold text-zinc-100">Publish Protocol</h3>
            <div className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              ⚠ Once published, this protocol will be available to all lab members and can be run immediately. Please review your protocol before proceeding.
            </div>
            <div className="mb-3 h-px bg-zinc-800" />
            <p className="mb-3 text-xs font-medium text-zinc-300">Select version bump type:</p>
            <div className="mb-4 space-y-2">
              <button
                onClick={() => setBumpType("minor")}
                className={`w-full rounded border px-4 py-3 text-left transition ${
                  bumpType === "minor"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-100">Minor Update</span>
                  <span className="text-xs text-zinc-400">
                    v{parentSemVer} →{" "}
                    <span className={bumpType === "minor" ? "font-semibold text-emerald-300" : "text-zinc-300"}>
                      v{minorVer}
                    </span>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">Small corrections, clarifications, or reagent adjustments</p>
              </button>
              <button
                onClick={() => setBumpType("major")}
                className={`w-full rounded border px-4 py-3 text-left transition ${
                  bumpType === "major"
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-100">Major Update</span>
                  <span className="text-xs text-zinc-400">
                    v{parentSemVer} →{" "}
                    <span className={bumpType === "major" ? "font-semibold text-orange-300" : "text-zinc-300"}>
                      v{majorVer}
                    </span>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">Significant workflow changes, new sections, or protocol restructuring</p>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button onClick={onCancel} className="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
              <button
                onClick={() => setStep(2)}
                disabled={!bumpType}
                className="rounded bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">Add Change Summary</h3>
              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                Publishing as v{targetVer ?? "1.0"}
              </span>
            </div>
            <p className="mb-1 text-xs text-zinc-400">Change summary (optional)</p>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value.slice(0, 500))}
              placeholder="Briefly describe what changed in this version (e.g. Updated lysis buffer to 50 mM Tris-HCl, added Western blot section...)"
              rows={4}
              className="mb-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none resize-none"
            />
            <div className="mb-1 flex justify-end">
              <span className="text-[10px] text-zinc-600">{summary.length}/500</span>
            </div>
            <p className="mb-4 text-[10px] text-zinc-600">Version history note will be visible to all lab members.</p>
            <div className="mb-4 h-px bg-zinc-800" />
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                {!isNewProtocol && (
                  <button onClick={() => setStep(1)} className="text-xs text-zinc-500 hover:text-zinc-300">← Back</button>
                )}
                <button onClick={onCancel} className="text-xs text-zinc-600 hover:text-zinc-400">Cancel</button>
              </div>
              <button
                onClick={() => onConfirm(isNewProtocol ? null : bumpType, summary.trim())}
                className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                Confirm &amp; Publish
              </button>
            </div>
          </>
        )}
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

function ProtocolsPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── User (synced with global AppTopNav selection) ──────────────────────────
  const [currentUser, setCurrentUser] = useState<CurrentUser>(() => userFromId(
    typeof window !== "undefined" ? (localStorage.getItem(USER_STORAGE_KEY) ?? "") : ""
  ));

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
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isDirty, setIsDirty]       = useState(false);
  const [tagsModified, setTagsModified] = useState(false);

  // Pending payload waiting for version bump decision
  const [pendingPayload, setPendingPayload] = useState<Partial<Entry> | null>(null);

  // Run/mock-run confirmation dialogs
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showMockRunModal, setShowMockRunModal] = useState(false);
  const [preRunNotesInput, setPreRunNotesInput] = useState("");
  const [runRequireStepOrder, setRunRequireStepOrder] = useState(false);
  const [preRunTags, setPreRunTags] = useState<Array<{ id: string; name: string; type: "PROJECT" | "GENERAL"; color: string }>>([]);
  const [preRunTagSearch, setPreRunTagSearch] = useState("");
  const [preRunTagSuggestions, setPreRunTagSuggestions] = useState<Array<{ id: string; name: string; type: "PROJECT" | "GENERAL"; color: string }>>([]);

  // New Protocol creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Amber nudge banner — shown after save if protocol has no PROJECT tag
  const [showTagNudge, setShowTagNudge] = useState(false);

  // Protocol list tab
  const [listTab, setListTab] = useState<"MY" | "PUBLISHED" | "DRAFTS">("MY");

  // Draft auto-save: ref to trigger Editor save, plus last-saved timestamp
  const autoSaveRef = useRef<(() => void) | null>(null);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);

  // Publish flow modal
  const [showPublishFlow, setShowPublishFlow] = useState(false);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [keyword,         setKeyword]         = useState("");
  const [techniqueFilter, setTechniqueFilter] = useState<(typeof TECHNIQUE_TABS)[number]["id"]>("ALL");
  const [authorFilter,    setAuthorFilter]    = useState("ALL");
  const [sortBy,          setSortBy]          = useState<"newest" | "oldest" | "technique" | "author">("newest");
  const [showUntaggedOnly, setShowUntaggedOnly] = useState(() => searchParams.get("filter") === "untagged");

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
  const canEdit   = (e: Entry) => currentUser.role === "ADMIN" || Boolean(e.authorId && e.authorId === currentUser.id);
  const canDelete = (e: Entry) => currentUser.role === "ADMIN" || Boolean(e.authorId && e.authorId === currentUser.id);

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
  async function doSave(payload: Partial<Entry> & { status?: string; publishedAt?: string | null }, bumpType: "major" | "minor" | null, isTagOnly = false) {
    setPendingPayload(null);
    setLoading(true);
    setSaveError(null);
    setSaveSuccess(null);

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
      const apiBody: Record<string, unknown> = {
        title:       finalPayload.title,
        description: finalPayload.description,
        body:        finalPayload.body,
        technique:   finalPayload.technique,
        entryType:   finalPayload.entryType,
        typedData:   finalPayload.typedData,
      };
      if ("status"        in finalPayload) apiBody.status        = finalPayload.status;
      if ("publishedAt"   in finalPayload) apiBody.publishedAt   = finalPayload.publishedAt;
      if ("changeSummary" in finalPayload) apiBody.changeSummary = finalPayload.changeSummary;

      const res = await fetch(isUpdate ? `/api/entries/${finalPayload.id}` : "/api/entries", {
        method: isUpdate ? "PUT" : "POST",
        headers: jsonHeaders,
        body: JSON.stringify(apiBody),
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
      setTagsModified(false);
      if (isTagOnly) {
        setSaveSuccess("Tags updated successfully");
      }
      // Track auto-save timestamp for drafts
      if (saved.status === "DRAFT") {
        setAutoSavedAt(new Date());
      }
      // When a draft is published, switch to My Protocols tab
      if (finalPayload.status === "PUBLISHED" && saved.status === "PUBLISHED") {
        setListTab("MY");
      }
      // Show nudge banner if protocol has no PROJECT tag (published only)
      if (saved.status !== "DRAFT") {
        const hasProjectTag = existingTagAssignments.some((a) => a.tag.type === "PROJECT");
        setShowTagNudge(!hasProjectTag);
      }
    } finally {
      setLoading(false);
    }
  }

  /** Entry point for saving — intercepts to show version bump modal for edits */
  async function handleSave(payload: Partial<Entry>) {
    const isUpdate = editorMode === "edit" && Boolean(payload.id);

    // Block save if nothing changed
    if (isUpdate && !isDirty && !tagsModified) {
      setSaveError("No changes detected — modify the protocol before saving.");
      return;
    }

    // New protocols: save immediately (no version bump prompt)
    if (!isUpdate) {
      await doSave(payload, null);
      return;
    }

    // DRAFT entries: save without version bump (drafts don't version-bump)
    if (selected?.status === "DRAFT") {
      await doSave(payload, null);
      return;
    }

    // Tag-only change on existing protocol: save without bumping version
    if (!isDirty && tagsModified) {
      await doSave(payload, null, true);
      return;
    }

    // Existing protocols with content changes: show version bump modal
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
    setTagsModified(false);
    setEditorOpen(false);
    setSaveError(null);
    setSaveSuccess(null);
    setPendingPayload(null);
    setShowTagNudge(false);
    setAutoSavedAt(null);
  }

  async function handleSelect(id: string) {
    setLoading(true);
    setSaveError(null);
    setSaveSuccess(null);
    setTagsModified(false);

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

    // DRAFT entries: open directly
    if (entry.status === "DRAFT") {
      await handleSelect(id);
      return;
    }

    // PUBLISHED entries: create a draft fork (with confirmation)
    if (!window.confirm(`Create a draft copy of "${entry.title}" to edit?\n\nYour changes will be saved as a draft until you publish.`)) return;
    setLoading(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/protocols/${id}/draft`, { method: "POST", headers: authHeaders });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({})) as { draftId?: string };
        if (body.draftId) {
          // Already has a draft — open it
          setListTab("DRAFTS");
          await handleSelect(body.draftId);
        }
        return;
      }
      if (!res.ok) {
        setSaveError("Failed to create draft. Please try again.");
        return;
      }
      const draft = (await res.json()) as Entry;
      setEntries((s) => [draft, ...s]);
      setListTab("DRAFTS");
      setSelected(draft);
      setEditorMode("edit");
      setIsDirty(false);
      setEditorOpen(true);
    } finally {
      setLoading(false);
    }
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
    // Inherit protocol's stored requireStepOrder value (operator can override in dialog)
    setRunRequireStepOrder(selected.requireStepOrder ?? false);
    setPreRunTags([]);
    setPreRunTagSearch("");
    setPreRunTagSuggestions([]);
    setShowConfirmModal(true);
  }

  function handleMockRun() {
    if (!selected) return;
    setShowMockRunModal(true);
  }

  async function confirmStartRun(isMockRun = false) {
    if (!selected) return;
    const notes = preRunNotesInput.trim();
    const tagsToApply = [...preRunTags];
    setShowConfirmModal(false);
    setShowMockRunModal(false);
    setPreRunNotesInput("");
    setPreRunTags([]);
    setLoading(true);
    try {
      // 1. Create the run (with requireStepOrder set at run-start time)
      const res = await fetch("/api/protocol-runs", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          sourceEntryId: selected.id,
          isMockRun,
          preRunNotes: notes,
          requireStepOrder: runRequireStepOrder,
        }),
      });
      if (!res.ok) { console.error("Failed to create run:", res.status); return; }
      const run = (await res.json()) as { id: string };

      // 2. Apply any pre-selected tags to the new run record
      if (tagsToApply.length > 0) {
        await Promise.all(
          tagsToApply.map((tag) =>
            fetch("/api/tags/assign", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tagId: tag.id,
                entityType: "RUN",
                entityId: run.id,
                assignedBy: currentUser.name,
              }),
            })
          )
        );
      }

      // 3. Navigate to the run
      router.push(`/runs/${run.id}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Pre-run tag search ────────────────────────────────────────────────────
  const preRunTagDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handlePreRunTagSearch(q: string) {
    setPreRunTagSearch(q);
    if (preRunTagDebounceRef.current) clearTimeout(preRunTagDebounceRef.current);
    if (!q.trim()) { setPreRunTagSuggestions([]); return; }
    preRunTagDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tags?q=${encodeURIComponent(q.trim())}`);
        if (!res.ok) return;
        const data = (await res.json()) as Array<{ id: string; name: string; type: "PROJECT" | "GENERAL"; color: string }>;
        const selectedIds = new Set(preRunTags.map((t) => t.id));
        setPreRunTagSuggestions(data.filter((t) => !selectedIds.has(t.id)));
      } catch { /* ignore */ }
    }, 250);
  }

  // ── Publish draft ──────────────────────────────────────────────────────────
  function publishDraft() {
    if (!selected || selected.status !== "DRAFT") return;
    setShowPublishFlow(true);
  }

  async function doPublishDraft(bumpType: "major" | "minor" | null, changeSummary: string) {
    if (!selected || selected.status !== "DRAFT") return;
    setShowPublishFlow(false);

    const isDraftFork = Boolean(selected.draftOfId);
    let publishSemVer: string;

    if (!isDraftFork) {
      publishSemVer = "1.0";
    } else {
      const parent = entries.find((e) => e.id === selected.draftOfId);
      const parentSemVer = parent ? getSemVer(parent) : getSemVer(selected);
      publishSemVer = bumpSemVer(parentSemVer, bumpType ?? "minor");
    }

    const td = parseTypedData(selected.typedData);
    td.typed._semVer = publishSemVer;

    await doSave(
      {
        id: selected.id,
        title: selected.title,
        description: selected.description,
        body: selected.body,
        technique: selected.technique,
        entryType: selected.entryType,
        typedData: td,
        changeSummary,
        status: "PUBLISHED",
        publishedAt: new Date().toISOString(),
      },
      null,
    );
  }

  // ── Discard draft ──────────────────────────────────────────────────────────
  async function discardDraft() {
    if (!selected || selected.status !== "DRAFT") return;
    if (!window.confirm(`Discard this draft of "${selected.title}"? It cannot be recovered.`)) return;
    setLoading(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/entries/${selected.id}`, { method: "DELETE", headers: authHeaders });
      if (!res.ok) {
        setSaveError("Failed to discard draft. Please try again.");
        return;
      }
      setEntries((s) => s.filter((e) => e.id !== selected.id));
      closeEditor();
    } finally {
      setLoading(false);
    }
  }

  // ── Auto-save for open drafts (every 60 s) ─────────────────────────────────
  useEffect(() => {
    if (!editorOpen || selected?.status !== "DRAFT") return;
    const interval = setInterval(() => {
      if (isDirty) autoSaveRef.current?.();
    }, 60_000);
    return () => clearInterval(interval);
  }, [editorOpen, selected?.status, isDirty]);

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
    // New protocols start as drafts — switch to Drafts tab
    setListTab("DRAFTS");
  }

  // ── Filter / sort ──────────────────────────────────────────────────────────
  const authorOptions = useMemo(() => {
    const names = Array.from(new Set(entries.map((e) => e.author?.name || "Unknown")));
    return names.sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (listTab === "DRAFTS") {
        if (entry.status !== "DRAFT" || entry.authorId !== currentUser.id) return false;
      } else if (listTab === "MY") {
        if (entry.status === "DRAFT" || entry.authorId !== currentUser.id) return false;
      } else {
        // ALL: show everything published (or legacy entries with no status)
        if (entry.status === "DRAFT") return false;
      }
      const author = entry.author?.name || "Unknown";
      const bucket = normalizeTechniqueBucket(entry.technique || "General");
      const untaggedOk = !showUntaggedOnly || !entry.tagAssignments?.some((a) => a.tag.type === "PROJECT");
      return (
        (techniqueFilter === "ALL" || bucket === techniqueFilter) &&
        (authorFilter === "ALL" || author === authorFilter) &&
        (!q || `${entry.title} ${entry.description} ${entry.technique} ${author} ${entry.body}`.toLowerCase().includes(q)) &&
        untaggedOk
      );
    });
    filtered.sort((a, b) => {
      if (sortBy === "oldest")    return a.createdAt.localeCompare(b.createdAt);
      if (sortBy === "technique") return (a.technique || "General").localeCompare(b.technique || "General");
      if (sortBy === "author")    return (a.author?.name || "Unknown").localeCompare(b.author?.name || "Unknown");
      return b.createdAt.localeCompare(a.createdAt);
    });
    return filtered;
  }, [entries, keyword, techniqueFilter, authorFilter, sortBy, showUntaggedOnly, listTab, currentUser.id]);

  // ── Group into families ────────────────────────────────────────────────────
  const groupedFamilies = useMemo(() => buildFamilies(filteredEntries), [filteredEntries]);

  // ── Version family for the currently open entry (passed to Editor) ──────────
  const selectedVersionFamily = useMemo(() => {
    if (!selected) return undefined;
    const fam = groupedFamilies.find((f) => f.allVersions.some((e) => e.id === selected.id));
    const versions = fam?.allVersions ?? [selected];
    if (versions.length <= 1) return undefined; // no dropdown needed for single-entry families
    return versions.map((e) => ({ id: e.id, title: e.title || "", semVer: getSemVer(e), changeSummary: e.changeSummary ?? "" }));
  }, [selected, groupedFamilies]);

  const isDraft = selected?.status === "DRAFT";
  const canRunProtocol = editorOpen && editorMode === "edit" && Boolean(selected) && !isDirty && !isDraft;
  const canMockRun = editorOpen && editorMode === "edit" && Boolean(selected) && !isDirty && isDraft;

  // Draft count for the tab badge
  const myDraftCount = useMemo(
    () => entries.filter((e) => e.status === "DRAFT" && e.authorId === currentUser.id).length,
    [entries, currentUser.id],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col gap-3 bg-zinc-950 p-6 text-zinc-100">
      {/* Tab bar + New Protocol — sticky so it remains visible while scrolling */}
      <div className="sticky top-0 z-20 -mx-6 flex items-center gap-1 border-b border-zinc-800 bg-zinc-950 px-6">
        <button
          onClick={() => setListTab("MY")}
          className={`px-4 py-2 text-sm font-medium transition ${listTab === "MY" ? "border-b-2 border-indigo-500 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          My Protocols
        </button>
        <button
          onClick={() => setListTab("PUBLISHED")}
          className={`px-4 py-2 text-sm font-medium transition ${listTab === "PUBLISHED" ? "border-b-2 border-indigo-500 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          All Protocols
        </button>
        <button
          onClick={() => setListTab("DRAFTS")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition ${listTab === "DRAFTS" ? "border-b-2 border-amber-500 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Drafts
          {myDraftCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">{myDraftCount}</span>
          )}
        </button>
        <a
          href="/protocols/transfection"
          className="ml-auto rounded border border-rose-500/50 bg-rose-600/20 px-3 py-1.5 text-sm text-rose-200 transition hover:bg-rose-600/30"
        >
          + New Transfection
        </a>
        <button
          onClick={() => setShowCreateModal(true)}
          className="ml-2 rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500"
        >
          + New Protocol
        </button>
      </div>

      {/* Protocol Library */}
      <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
        {/* Technique filter pills — hidden on Drafts tab */}
        <div className={`mb-3 flex flex-wrap gap-2${listTab === "DRAFTS" ? " hidden" : ""}`}>
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
        <div className="mb-2 grid gap-2 md:grid-cols-3">
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

        {/* Untagged filter toggle */}
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => setShowUntaggedOnly((v) => !v)}
            className={`rounded border px-3 py-1 text-xs transition-colors ${
              showUntaggedOnly
                ? "border-amber-500 bg-amber-500/20 text-amber-400"
                : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
            }`}
          >
            ⚠️ Untagged only
          </button>
        </div>

        {/* Untagged filter banner */}
        {showUntaggedOnly && (
          <div className="mb-3 flex items-center justify-between rounded border border-amber-500 bg-amber-500/20 p-3">
            <span className="text-sm text-amber-400">Showing only protocols without a Project tag</span>
            <button
              onClick={() => setShowUntaggedOnly(false)}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* List-level error banner — surfaces delete failures (e.g. 409 when
            runs exist) when the editor modal is closed and wouldn't show them. */}
        {saveError && !editorOpen && (
          <div className="mb-3 flex items-center justify-between rounded border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            <span>{saveError}</span>
            <button
              onClick={() => setSaveError(null)}
              aria-label="Dismiss"
              className="ml-3 shrink-0 text-red-300 transition hover:text-red-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Grouped protocol list */}
        <ul className="space-y-2">
          {groupedFamilies.map(({ representative: e, allVersions }) => {
            const semVer    = getSemVer(e);
            const vCount    = allVersions.length;
            const rawDesc   = (e.description ?? "").trim();
            const summary   = rawDesc && !rawDesc.startsWith("{") && !rawDesc.startsWith("[")
              ? rawDesc.slice(0, 100)
              : "";
            const author    = e.author?.name || "Unknown";
            const technique = e.technique || "General";
            const editable  = canEdit(e);
            const deletable = canDelete(e);

            return (
              <li key={e.id} className="rounded border border-zinc-800 bg-zinc-900 p-2">
                <button onClick={() => handleSelect(e.id)} className="w-full text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-semibold text-zinc-100">{e.title || "Untitled"}</p>
                    {e.status === "DRAFT" ? (
                      <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                        DRAFT {semVer === "0" ? "v0" : `v${semVer}-draft`}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                        v{semVer}
                      </span>
                    )}
                    {vCount > 1 && (
                      <span className="shrink-0 rounded border border-zinc-600/50 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        {vCount} versions
                      </span>
                    )}
                  </div>
                  {summary && <p className="mt-1 text-xs text-zinc-300">{summary}</p>}
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

        {/* Bottom + New Protocol — visible on My and All Protocols tabs */}
        {(listTab === "MY" || listTab === "PUBLISHED") && (
          <div className="mt-4 flex justify-center border-t border-zinc-800 pt-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
            >
              + New Protocol
            </button>
          </div>
        )}
      </div>

      {/* ── Editor Modal Overlay ── */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeEditor(); }}
        >
          <div className="flex h-[90vh] w-[90vw] max-w-6xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/80">
            {/* Modal header */}
            <div className={`flex items-center justify-between border-b px-5 py-3 ${isDraft ? "border-amber-900/60 bg-amber-950/20" : "border-zinc-800"}`}>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-zinc-300">
                  {selected?.title || (editorMode === "create" ? "New Protocol" : "Protocol")}
                </span>
                {/* DRAFT badge */}
                {isDraft && (
                  <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                    DRAFT
                  </span>
                )}
                {/* Auto-save timestamp */}
                {isDraft && autoSavedAt && !isDirty && (
                  <span className="shrink-0 text-[10px] text-zinc-500">
                    Saved {autoSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {/* Run Protocol button (published only) */}
                {canRunProtocol && (
                  <button
                    onClick={handleRunProtocol}
                    disabled={loading}
                    className="shrink-0 rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    ▶ Run Protocol
                  </button>
                )}
                {/* Mock Run button (draft only) */}
                {canMockRun && (
                  <button
                    onClick={handleMockRun}
                    disabled={loading}
                    className="shrink-0 rounded border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    🧪 Mock Run
                  </button>
                )}
                {/* Publish button (draft only) */}
                {isDraft && editorMode === "edit" && !isDirty && (
                  <button
                    onClick={() => void publishDraft()}
                    disabled={loading}
                    className="shrink-0 rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Publish
                  </button>
                )}
                {/* Print (published only) */}
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
                {/* Discard draft */}
                {isDraft && editorMode === "edit" && (
                  <button
                    onClick={() => void discardDraft()}
                    disabled={loading}
                    className="shrink-0 rounded border border-red-500/40 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Discard Draft
                  </button>
                )}
                {isDirty && (
                  <span className="shrink-0 text-[10px] text-zinc-500">
                    {isDraft ? "(unsaved)" : "(unsaved — save before running)"}
                  </span>
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

            {/* Success banner */}
            {saveSuccess && (
              <div className="mx-5 mt-3 rounded border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
                {saveSuccess}
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 overflow-y-auto p-4">
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
                saveRef={autoSaveRef}
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
                            setEntries((prev) => prev.map((e) => e.id === selected.id ? { ...e, tagAssignments: updated } : e));
                            setShowTagNudge(false);
                            setTagsModified(true);
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
          <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <p className="mb-4 text-sm text-zinc-200">
              Start{" "}
              <span className="font-semibold text-zinc-100">{selected.title}</span>?
            </p>

            {/* Run Notes */}
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-400">
              Run Notes <span className="normal-case text-zinc-600">(optional)</span>
            </label>
            <textarea
              value={preRunNotesInput}
              onChange={(e) => setPreRunNotesInput(e.target.value)}
              placeholder="Sample info, conditions, deviations from standard protocol…"
              rows={3}
              className="mb-4 w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />

            {/* Step order toggle — inherits protocol value, operator can override */}
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRunRequireStepOrder((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${runRequireStepOrder ? "bg-green-500" : "bg-zinc-600"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${runRequireStepOrder ? "translate-x-4" : "translate-x-1"}`} />
                </button>
                <span className={`text-sm ${runRequireStepOrder ? "text-green-400" : "text-zinc-500"}`}>
                  {runRequireStepOrder ? "Steps MUST be completed in order" : "Steps can be completed in any order"}
                </span>
              </div>
              <p className="mt-1 ml-12 text-xs text-zinc-600">
                Inherited from protocol — you can override for this run
              </p>
            </div>

            {/* Pre-run tags */}
            <div className="mb-5">
              <label className="mb-2 block text-xs uppercase tracking-wide text-zinc-400">
                Tags <span className="normal-case text-zinc-600">(optional)</span>
              </label>
              {/* Selected tag chips */}
              {preRunTags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {preRunTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: tag.color + "33", border: `1px solid ${tag.color}`, color: tag.color }}
                    >
                      {tag.name}
                      <button
                        onClick={() => setPreRunTags((prev) => prev.filter((t) => t.id !== tag.id))}
                        className="ml-0.5 opacity-60 hover:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* Tag search input */}
              <div className="relative">
                <input
                  type="text"
                  value={preRunTagSearch}
                  onChange={(e) => handlePreRunTagSearch(e.target.value)}
                  placeholder="Search tags…"
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
                {preRunTagSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 z-10 mt-1 w-full rounded border border-zinc-700 bg-zinc-800 shadow-xl">
                    {preRunTagSuggestions.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => {
                          setPreRunTags((prev) => [...prev, tag]);
                          setPreRunTagSearch("");
                          setPreRunTagSuggestions([]);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-700"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                        <span className="ml-auto text-zinc-600">{tag.type === "PROJECT" ? "Project" : "General"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-600">Tags will be applied to this run when started</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => void confirmStartRun()}
                disabled={loading}
                className="flex-1 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                ▶ Start Run
              </button>
              <button
                onClick={() => { setShowConfirmModal(false); setPreRunNotesInput(""); setPreRunTags([]); setPreRunTagSearch(""); setPreRunTagSuggestions([]); }}
                className="rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mock Run Confirmation Dialog ── */}
      {showPublishFlow && selected && (() => {
        const parent = selected.draftOfId ? entries.find((e) => e.id === selected.draftOfId) : null;
        const parentSemVer = parent ? getSemVer(parent) : null;
        return (
          <PublishFlowModal
            selected={selected}
            parentSemVer={parentSemVer}
            onConfirm={(bumpType, changeSummary) => void doPublishDraft(bumpType, changeSummary)}
            onCancel={() => setShowPublishFlow(false)}
          />
        );
      })()}

      {showMockRunModal && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg border border-amber-600/40 bg-zinc-900 p-6 shadow-2xl">
            <p className="mb-2 text-sm font-semibold text-amber-400">🧪 Mock Run</p>
            <p className="mb-6 text-sm text-zinc-300">
              Start a mock run of{" "}
              <span className="font-semibold text-zinc-100">{selected.title}</span> (draft)?
              Mock runs are temporary and can be deleted when finished.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => void confirmStartRun(true)}
                disabled={loading}
                className="flex-1 rounded border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
              >
                🧪 Start Mock Run
              </button>
              <button
                onClick={() => setShowMockRunModal(false)}
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

import { Suspense } from "react";
export default function ProtocolsPage() {
  return (
    <Suspense>
      <ProtocolsPageContent />
    </Suspense>
  );
}
