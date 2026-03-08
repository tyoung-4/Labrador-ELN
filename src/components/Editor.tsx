"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RichTextEditor from "./RichTextEditor";
import ProtocolStepsEditor, {
  parseStepsData as parseStepsDataV2,
  type ProtocolStepsEditorHandle,
} from "./ProtocolStepsEditor";
import { TECHNIQUE_OPTIONS, type Entry, type AttachmentRecord } from "@/models/entry";
import {
  ENTRY_TYPE_CONFIGS,
  ENTRY_TYPE_KEYS,
  parseTypedData,
  emptyTypedData,
  type CustomField,
  type TypedData,
} from "@/lib/entryTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  initial?: Partial<Entry>;
  currentAuthorName?: string;
  onSave: (data: Partial<Entry>) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onCancel?: () => void;
  saving?: boolean;
  protocolShell?: boolean;
  /** Controlled title for protocolShell mode — managed by the parent modal header */
  titleValue?: string;
  /** Called when the user clicks the parent-protocol link in the Version panel */
  onOpenParent?: (parentId: string) => void;
};

// Component items shown in the right-sidebar dropdown.
const COMPONENT_ITEMS = [
  { label: "Amount",          entryType: "Mass"          },
  { label: "Sample",          entryType: "Volume"        },
  { label: "Concentration",   entryType: "Concentration" },
  { label: "Temperature",     entryType: "Temperature"   },
  { label: "Duration",        entryType: "Time"          },
  { label: "Document",        entryType: "Undefined"     },
  { label: "Equipment",       entryType: "Undefined"     },
  { label: "Reagent",         entryType: "Volume"        },
  { label: "Note",            entryType: "Undefined"     },
  { label: "Expected Result", entryType: "Undefined"     },
  { label: "Timer",           entryType: "Timer"         },
] as const;

type EditorTab = "steps" | "description" | "guidelines" | "references" | "materials";

type LinkedRef = {
  id: string;
  text: string;
  linkLabel?: string;
  linkHref?: string;
  linkType?: string;
};

type ProtocolBodyJSON = {
  steps: string;
  description: string;
  guidelines: string;
  references: LinkedRef[];
  materials: LinkedRef[];
};

// ─── Body JSON helpers ────────────────────────────────────────────────────────

const EMPTY_BODY: ProtocolBodyJSON = {
  steps: "",
  description: "",
  guidelines: "",
  references: [],
  materials: [],
};

function parseBody(raw: string | undefined): ProtocolBodyJSON {
  if (!raw) return { ...EMPTY_BODY };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "steps" in parsed) {
      return {
        steps: String(parsed.steps ?? ""),
        description: String(parsed.description ?? ""),
        guidelines: String(parsed.guidelines ?? ""),
        references: Array.isArray(parsed.references) ? (parsed.references as LinkedRef[]) : [],
        materials: Array.isArray(parsed.materials) ? (parsed.materials as LinkedRef[]) : [],
      };
    }
  } catch {}
  return { ...EMPTY_BODY, steps: raw };
}

function serializeBody(pb: ProtocolBodyJSON): string {
  return JSON.stringify(pb);
}

// ─── Link styles ─────────────────────────────────────────────────────────────

const LINK_STYLE: Record<string, string> = {
  protocol: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  stock:    "border-sky-500/30    bg-sky-500/10    text-sky-300",
  reagent:  "border-amber-500/30  bg-amber-500/10  text-amber-300",
  knowledge:"border-violet-500/30 bg-violet-500/10 text-violet-300",
  run:      "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
};

const INVENTORY_SUGGESTIONS = [
  { linkLabel: "Stocks",     linkHref: "/inventory/stocks",     linkType: "stock"   },
  { linkLabel: "Reagents",   linkHref: "/inventory/reagents",   linkType: "reagent" },
  { linkLabel: "Plasmids",   linkHref: "/inventory/plasmids",   linkType: "reagent" },
  { linkLabel: "Cell Lines", linkHref: "/inventory/cell-lines", linkType: "stock"   },
];

// ─── Linked Items Panel (References & Materials tabs) ─────────────────────────

function LinkedItemsPanel({
  items,
  onChange,
  placeholder = "Add item…",
}: {
  items: LinkedRef[];
  onChange: (items: LinkedRef[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [selectedLink, setSelectedLink] = useState<(typeof INVENTORY_SUGGESTIONS)[number] | null>(null);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return INVENTORY_SUGGESTIONS;
    return INVENTORY_SUGGESTIONS.filter((l) => l.linkLabel.toLowerCase().includes(q));
  }, [search]);

  function addItem() {
    if (!text.trim()) return;
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        text: text.trim(),
        ...(selectedLink
          ? { linkLabel: selectedLink.linkLabel, linkHref: selectedLink.linkHref, linkType: selectedLink.linkType }
          : {}),
      },
    ]);
    setText("");
    setSearch("");
    setSelectedLink(null);
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />

        <div className="relative">
          {selectedLink ? (
            <span className={`inline-flex items-center gap-1 rounded border px-2 py-1.5 text-xs ${LINK_STYLE[selectedLink.linkType]}`}>
              {selectedLink.linkLabel}
              <button
                type="button"
                onClick={() => { setSelectedLink(null); setSearch(""); }}
                className="opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </span>
          ) : (
            <>
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowDrop(true); }}
                onFocus={() => setShowDrop(true)}
                onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                placeholder="Link to inventory…"
                className="w-44 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
              {showDrop && results.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-0.5 overflow-hidden rounded border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/60">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onMouseDown={() => { setSelectedLink(r); setSearch(r.linkLabel); setShowDrop(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-zinc-800"
                    >
                      <span className={`shrink-0 rounded border px-1 py-0.5 text-[9px] font-medium ${LINK_STYLE[r.linkType]}`}>
                        {r.linkType}
                      </span>
                      <span className="truncate text-zinc-300">{r.linkLabel}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <button
          onClick={addItem}
          disabled={!text.trim()}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-30"
        >
          + Add
        </button>
      </div>

      {items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-2 rounded border border-zinc-700/70 bg-zinc-800/50 px-3 py-2"
            >
              <span className="flex-1 text-sm text-zinc-200">{item.text}</span>
              {item.linkHref && (
                <a
                  href={item.linkHref}
                  className={`rounded border px-1.5 py-0.5 text-[10px] transition hover:opacity-80 ${LINK_STYLE[item.linkType ?? "stock"]}`}
                >
                  {item.linkLabel}
                </a>
              )}
              <button
                onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                className="text-xs text-zinc-700 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-600">No items yet — add one above.</p>
      )}
    </div>
  );
}

// ─── Typed Fields Panel ───────────────────────────────────────────────────────

function TypedFieldsPanel({
  entryType,
  typedFields,
  onChange,
}: {
  entryType: string;
  typedFields: Record<string, string>;
  onChange: (fields: Record<string, string>) => void;
}) {
  const config = ENTRY_TYPE_CONFIGS[entryType];
  if (!config || config.fields.length === 0) return null;

  return (
    <div className="rounded border border-zinc-700/50 bg-zinc-800/30 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {config.icon} {config.label} Fields
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {config.fields.map((field) => {
          const value = typedFields[field.key] ?? "";
          const shared = "w-full rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none";
          if (field.type === "select" && field.options) {
            return (
              <div key={field.key} className={field.type === "select" ? "" : ""}>
                <label className="mb-0.5 block text-xs text-zinc-400">{field.label}</label>
                <select
                  value={value}
                  onChange={(e) => onChange({ ...typedFields, [field.key]: e.target.value })}
                  className={shared}
                >
                  <option value="">— select —</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            );
          }
          if (field.type === "textarea") {
            return (
              <div key={field.key} className="sm:col-span-2">
                <label className="mb-0.5 block text-xs text-zinc-400">{field.label}</label>
                <textarea
                  value={value}
                  onChange={(e) => onChange({ ...typedFields, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  rows={3}
                  className={`${shared} resize-none`}
                />
              </div>
            );
          }
          return (
            <div key={field.key}>
              <label className="mb-0.5 block text-xs text-zinc-400">{field.label}</label>
              <input
                value={value}
                onChange={(e) => onChange({ ...typedFields, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className={shared}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Custom Fields Panel ──────────────────────────────────────────────────────

function CustomFieldsPanel({
  fields,
  onChange,
}: {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}) {
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  function addField() {
    if (!newKey.trim()) return;
    onChange([...fields, { id: crypto.randomUUID(), key: newKey.trim(), value: newVal.trim() }]);
    setNewKey("");
    setNewVal("");
  }

  function updateField(id: string, key: string, value: string) {
    onChange(fields.map((f) => (f.id === id ? { ...f, key, value } : f)));
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  return (
    <div className="rounded border border-zinc-700/50 bg-zinc-800/30 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Custom Fields
      </p>

      {fields.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {fields.map((f) => (
            <div key={f.id} className="group flex items-center gap-2">
              <input
                value={f.key}
                onChange={(e) => updateField(f.id, e.target.value, f.value)}
                placeholder="Key"
                className="w-32 shrink-0 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-600">:</span>
              <input
                value={f.value}
                onChange={(e) => updateField(f.id, f.key, e.target.value)}
                placeholder="Value"
                className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
              <button
                onClick={() => removeField(f.id)}
                className="shrink-0 text-xs text-zinc-700 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField(); } }}
          placeholder="Key"
          className="w-32 shrink-0 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
        <span className="text-xs text-zinc-600">:</span>
        <input
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField(); } }}
          placeholder="Value"
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
        <button
          onClick={addField}
          disabled={!newKey.trim()}
          className="shrink-0 rounded bg-zinc-700 px-2.5 py-1 text-xs text-zinc-200 transition hover:bg-zinc-600 disabled:opacity-30"
        >
          + Add
        </button>
      </div>
      {fields.length === 0 && (
        <p className="mt-2 text-[11px] text-zinc-600">
          Add your own key-value pairs — extra metadata that doesn&apos;t fit the standard fields above.
        </p>
      )}
    </div>
  );
}

// ─── Attachments Panel ────────────────────────────────────────────────────────

function AttachmentsPanel({
  entryId,
  initialAttachments,
}: {
  entryId: string;
  initialAttachments: AttachmentRecord[];
}) {
  const [attachments, setAttachments] = useState<AttachmentRecord[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/entries/${entryId}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `Upload failed (${res.status})`);
      }
      const created = (await res.json()) as AttachmentRecord;
      setAttachments((prev) => [...prev, created]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("Remove this attachment?");
    if (!ok) return;
    try {
      const res = await fetch(`/api/entries/${entryId}/attachments/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // ignore
    }
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="rounded border border-zinc-700/50 bg-zinc-800/30 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Attachments
      </p>

      {attachments.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {attachments.map((att) => (
            <div key={att.id} className="group flex items-center gap-2 rounded border border-zinc-700/60 bg-zinc-800/40 px-3 py-1.5">
              <a
                href={att.path}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-indigo-300 hover:text-indigo-200"
              >
                {att.filename}
              </a>
              <span className="shrink-0 text-[10px] text-zinc-500">{formatBytes(att.size)}</span>
              <button
                onClick={() => handleDelete(att.id)}
                className="shrink-0 text-xs text-zinc-700 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                aria-label="Remove attachment"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <p className="mb-2 text-xs text-red-400">{uploadError}</p>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
          id={`attach-${entryId}`}
        />
        <label
          htmlFor={`attach-${entryId}`}
          className={`cursor-pointer rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-zinc-700 ${uploading ? "cursor-not-allowed opacity-50" : ""}`}
        >
          {uploading ? "Uploading…" : "📎 Attach file"}
        </label>
        {attachments.length === 0 && !uploading && (
          <span className="text-[11px] text-zinc-600">No attachments yet.</span>
        )}
      </div>
    </div>
  );
}

// ─── Entry Type Select ────────────────────────────────────────────────────────

function EntryTypeSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 ${className}`}
    >
      {ENTRY_TYPE_KEYS.map((key) => {
        const cfg = ENTRY_TYPE_CONFIGS[key];
        return (
          <option key={key} value={key}>
            {cfg.icon} {cfg.label}
          </option>
        );
      })}
    </select>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export default function Editor({
  initial = {},
  currentAuthorName = "Finn",
  onSave,
  onDirtyChange,
  onCancel,
  saving = false,
  protocolShell = false,
  titleValue,
  onOpenParent,
}: Props) {
  const [title, setTitle]           = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [technique, setTechnique]   = useState(initial.technique ?? "General");

  // Entry type + typed data
  const [entryType, setEntryType]   = useState(initial.entryType ?? "GENERAL");
  const initialTypedData            = useMemo(() => parseTypedData(initial.typedData ?? {}), [initial.typedData]);
  const [typedFields, setTypedFields] = useState<Record<string, string>>(initialTypedData.typed);
  const [customFields, setCustomFields] = useState<CustomField[]>(initialTypedData.custom);

  // Per-tab content
  const initialBody = useMemo(() => parseBody(initial.body), [initial.body]);
  const [steps, setSteps]                   = useState(initialBody.steps);
  const [tabDescription, setTabDescription] = useState(initialBody.description);
  const [tabGuidelines, setTabGuidelines]   = useState(initialBody.guidelines);
  const [tabReferences, setTabReferences]   = useState<LinkedRef[]>(initialBody.references);
  const [tabMaterials, setTabMaterials]     = useState<LinkedRef[]>(initialBody.materials);

  const [activeTab, setActiveTab] = useState<EditorTab>("steps");

  const stepsEditorRef = useRef<ProtocolStepsEditorHandle>(null);
  const [showSectionErrors, setShowSectionErrors] = useState(false);
  const [showComponentsMenu, setShowComponentsMenu] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);

  // ── Version info (read-only, derived from initial.typedData) ──────────────
  const semVer = useMemo(() => {
    const td = initial.typedData;
    if (!td || typeof td !== "object") return "1.0";
    return (td as { typed?: Record<string, string> }).typed?._semVer || "1.0";
  }, [initial.typedData]);

  const versionParentId = useMemo(() => {
    const td = initial.typedData;
    if (!td || typeof td !== "object") return undefined;
    return (td as { typed?: Record<string, string> }).typed?._parentId || undefined;
  }, [initial.typedData]);

  const versionParentTitle = useMemo(() => {
    const td = initial.typedData;
    if (!td || typeof td !== "object") return undefined;
    return (td as { typed?: Record<string, string> }).typed?._parentTitle || undefined;
  }, [initial.typedData]);

  // Reset all when entry changes
  useEffect(() => {
    setTitle(initial.title ?? "");
    setDescription(initial.description ?? "");
    setTechnique(initial.technique ?? "General");
    setEntryType(initial.entryType ?? "GENERAL");
    const td = parseTypedData(initial.typedData ?? {});
    setTypedFields(td.typed);
    setCustomFields(td.custom);
    const parsed = parseBody(initial.body);
    setSteps(parsed.steps);
    setTabDescription(parsed.description);
    setTabGuidelines(parsed.guidelines);
    setTabReferences(parsed.references);
    setTabMaterials(parsed.materials);
    setActiveTab("steps");
    setShowSectionErrors(false);
  }, [initial.id, initial.title, initial.description, initial.technique, initial.body, initial.entryType, initial.typedData]);

  // In protocolShell mode the title is managed by the parent via titleValue;
  const effectiveTitle = (protocolShell && titleValue !== undefined) ? titleValue : title;

  const isDirty = useMemo(() => {
    const typedDataChanged =
      JSON.stringify(typedFields) !== JSON.stringify(initialTypedData.typed) ||
      JSON.stringify(customFields) !== JSON.stringify(initialTypedData.custom);
    return (
      effectiveTitle !== (initial.title ?? "") ||
      description !== (initial.description ?? "") ||
      technique !== (initial.technique ?? "General") ||
      entryType !== (initial.entryType ?? "GENERAL") ||
      typedDataChanged ||
      steps !== initialBody.steps ||
      tabDescription !== initialBody.description ||
      tabGuidelines !== initialBody.guidelines ||
      JSON.stringify(tabReferences) !== JSON.stringify(initialBody.references) ||
      JSON.stringify(tabMaterials) !== JSON.stringify(initialBody.materials)
    );
  }, [
    effectiveTitle, description, technique, entryType, typedFields, customFields,
    steps, tabDescription, tabGuidelines, tabReferences, tabMaterials,
    initial.title, initial.description, initial.technique, initial.entryType,
    initialTypedData, initialBody,
  ]);

  // Auto-clear section errors once all sections have steps again
  useEffect(() => {
    if (!showSectionErrors) return;
    const stepsData = parseStepsDataV2(steps);
    const stillEmpty = stepsData.sections.some((s) => s.steps.length === 0);
    if (!stillEmpty) setShowSectionErrors(false);
  }, [steps, showSectionErrors]);

  // When initial.id changes (new entry loaded), the internal state hasn't been
  // reset yet, so isDirty is transiently true for one render cycle.  Suppress
  // that first onDirtyChange call so the parent never sees the spurious true.
  const lastPropagatedIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastPropagatedIdRef.current !== initial.id) {
      lastPropagatedIdRef.current = initial.id;
      return; // skip the transient dirty=true before reset runs
    }
    onDirtyChange?.(isDirty);
  }, [isDirty, initial.id, onDirtyChange]);

  function buildTypedData(): TypedData {
    return { typed: typedFields, custom: customFields };
  }

  function handleSave() {
    if (protocolShell) {
      const stepsData = parseStepsDataV2(steps);
      const hasEmptySection = stepsData.sections.some((s) => s.steps.length === 0);
      if (hasEmptySection) {
        setShowSectionErrors(true);
        return; // block save
      }
    }
    setShowSectionErrors(false);
    onSave({
      id: initial.id,
      title: effectiveTitle || initial.title || "",
      description: description.slice(0, 100),
      technique,
      entryType,
      typedData: buildTypedData(),
      body: serializeBody({ steps, description: tabDescription, guidelines: tabGuidelines, references: tabReferences, materials: tabMaterials }),
    });
  }

  // ─── Bottom panels (typed fields + custom fields + attachments) ──────────────

  function BottomPanels() {
    const hasTypedFields = (ENTRY_TYPE_CONFIGS[entryType]?.fields.length ?? 0) > 0;
    return (
      <div className="mt-3 space-y-2">
        {hasTypedFields && (
          <TypedFieldsPanel
            entryType={entryType}
            typedFields={typedFields}
            onChange={setTypedFields}
          />
        )}
        <CustomFieldsPanel fields={customFields} onChange={setCustomFields} />
        {initial.id && (
          <AttachmentsPanel
            entryId={initial.id}
            initialAttachments={initial.attachments ?? []}
          />
        )}
        {!initial.id && (
          <p className="text-[11px] text-zinc-600 px-1">
            💡 Save this entry first to enable file attachments.
          </p>
        )}
      </div>
    );
  }

  const TABS: { id: EditorTab; label: string }[] = [
    { id: "steps",       label: "Steps" },
    { id: "description", label: "Description" },
    { id: "guidelines",  label: "Guidelines & Warnings" },
    { id: "references",  label: "References" },
    { id: "materials",   label: "Materials" },
  ];

  return (
    <div className="w-full">
      {protocolShell ? (
        <>
          {/* ── Metadata row ── */}
          <div className="mb-2 rounded border border-zinc-800 bg-zinc-900 p-2">
            <div className="grid gap-2 lg:grid-cols-[2fr_1fr_1.2fr_1fr]">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 100))}
                placeholder="Short description (max 100 chars)"
                maxLength={100}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500"
              />
              <EntryTypeSelect value={entryType} onChange={setEntryType} className="w-full" />
              <select
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
              >
                {TECHNIQUE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <div className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200">
                {initial.author?.name || currentAuthorName || "Unknown"}
              </div>
            </div>
          </div>

          {/* ── 3-col layout: left sidebar | tabs+editor | right sidebar ── */}
          <div className="mb-2 grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)_240px]">

            {/* Left sidebar — Insert buttons (only for Steps tab) */}
            <aside className="lg:sticky lg:top-2 lg:h-fit rounded border border-zinc-800 bg-zinc-900 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Insert</p>
              <div className="space-y-1 text-sm">
                {(["insert-section", "insert-step"] as const).map((type) => {
                  const labels: Record<string, string> = {
                    "insert-section": "Insert section",
                    "insert-step":    "Insert step",
                  };
                  const disabled = activeTab !== "steps";
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        if (type === "insert-section") stepsEditorRef.current?.insertSection();
                        else stepsEditorRef.current?.insertStep();
                      }}
                      disabled={disabled}
                      className={`w-full rounded border px-3 py-2 text-left text-zinc-100 transition ${
                        disabled
                          ? "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-700"
                          : "border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                      }`}
                    >
                      {labels[type]}
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Center — Tabs + editor content */}
            <div>
              <div className="mb-1 flex flex-wrap gap-1 border-b border-zinc-700 pb-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-t px-3 py-1.5 text-sm transition ${
                      activeTab === tab.id
                        ? "border border-b-0 border-zinc-600 bg-zinc-800 font-semibold text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "steps" && (
                <ProtocolStepsEditor
                  key={(initial.id ?? "new-entry") + "-steps"}
                  ref={stepsEditorRef}
                  initialContent={steps}
                  onChange={setSteps}
                  showSectionErrors={showSectionErrors}
                />
              )}
              {activeTab === "description" && (
                <RichTextEditor
                  key={(initial.id ?? "new-entry") + "-desc"}
                  initialContent={tabDescription}
                  onChange={setTabDescription}
                  editable={true}
                  mode="simple"
                />
              )}
              {activeTab === "guidelines" && (
                <RichTextEditor
                  key={(initial.id ?? "new-entry") + "-guidelines"}
                  initialContent={tabGuidelines}
                  onChange={setTabGuidelines}
                  editable={true}
                  mode="simple"
                />
              )}
              {activeTab === "references" && (
                <LinkedItemsPanel
                  items={tabReferences}
                  onChange={setTabReferences}
                  placeholder="Add reference (paper, database, protocol)…"
                />
              )}
              {activeTab === "materials" && (
                <LinkedItemsPanel
                  items={tabMaterials}
                  onChange={setTabMaterials}
                  placeholder="Add material (buffer, enzyme, cell line)…"
                />
              )}
            </div>

            {/* Right sidebar — Version + Components */}
            <aside className="lg:sticky lg:top-2 lg:h-fit rounded border border-zinc-800 bg-zinc-900 p-3">

              {/* ── Version panel (collapsible) ── */}
              <div className="mb-3 border-b border-zinc-800 pb-3">
                <button
                  onClick={() => setShowVersionPanel((v) => !v)}
                  className="flex w-full items-center justify-between text-sm font-semibold text-zinc-100"
                >
                  <span>Version</span>
                  <span className="text-xs text-zinc-500">{showVersionPanel ? "▾" : "▸"}</span>
                </button>
                {showVersionPanel && (
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">Current:</span>
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-300">
                        v{semVer}
                      </span>
                    </div>
                    {versionParentId && (
                      <div className="flex flex-wrap items-start gap-1">
                        <span className="shrink-0 text-zinc-500">Cloned from:</span>
                        {onOpenParent ? (
                          <button
                            onClick={() => onOpenParent(versionParentId)}
                            className="text-left text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
                          >
                            {versionParentTitle || versionParentId}
                          </button>
                        ) : (
                          <span className="text-zinc-300">{versionParentTitle || versionParentId}</span>
                        )}
                      </div>
                    )}
                    {!versionParentId && (
                      <p className="text-zinc-600">Original protocol</p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Components ── */}
              <p className="mb-2 text-sm font-semibold text-zinc-100">Components</p>
              {activeTab !== "steps" && (
                <p className="mb-2 text-[10px] text-zinc-600">Switch to Steps tab to insert components.</p>
              )}
              <div className="relative">
                <button
                  disabled={activeTab !== "steps"}
                  onClick={() => setShowComponentsMenu(s => !s)}
                  className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                    activeTab !== "steps"
                      ? "cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-700"
                      : "border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                  }`}
                >
                  ＋ Components ▾
                </button>
                {showComponentsMenu && activeTab === "steps" && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowComponentsMenu(false)} />
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded border border-zinc-700 bg-zinc-950 shadow-xl">
                      {COMPONENT_ITEMS.map(item => (
                        <button
                          key={item.label}
                          onClick={() => {
                            if (item.entryType === "Timer") {
                              stepsEditorRef.current?.openRecipes();
                            } else {
                              stepsEditorRef.current?.openRequiredField(item.entryType);
                            }
                            setShowComponentsMenu(false);
                          }}
                          className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </aside>
          </div>

          {/* ── Bottom panels: typed fields, custom fields, attachments ── */}
          <BottomPanels />
        </>
      ) : (
        <>
          <div className="mb-4 rounded border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Entry Metadata</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Entry name"
              className="mb-3 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-xl font-semibold text-zinc-100 placeholder:text-zinc-500"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 100))}
              placeholder="Short description (max 100 characters)"
              maxLength={100}
              rows={2}
              className="w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500"
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Entry Type</label>
                <EntryTypeSelect value={entryType} onChange={setEntryType} className="w-full" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Technique</label>
                <select
                  value={technique}
                  onChange={(e) => setTechnique(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                >
                  {TECHNIQUE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 rounded border bg-zinc-800 px-3 py-2">
              <p className="text-xs font-medium text-zinc-400">Author</p>
              <p className="text-sm text-zinc-100">{initial.author?.name || currentAuthorName || "Unknown"}</p>
            </div>
            <p className="mt-1 text-right text-xs text-zinc-400">{description.length}/100</p>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium">Protocol / Entry Body</label>
            <RichTextEditor
              key={initial.id ?? "new-entry"}
              initialContent={steps}
              onChange={setSteps}
              editable={true}
            />
          </div>

          {/* Bottom panels: typed fields, custom fields, attachments */}
          <BottomPanels />
        </>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-60"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-200 hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
