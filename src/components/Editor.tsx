"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import RichTextEditor from "./RichTextEditor";
import { TECHNIQUE_OPTIONS, type Entry } from "@/models/entry";

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
};

// Component items shown in the right-sidebar dropdown.
// entryType maps to ENTRY_TYPE_OPTIONS labels in RichTextEditor;
// "Timer" is a special sentinel that opens the timer modal instead.
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
  // Legacy: raw HTML → treat as Steps content
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

// ─── Linked Items Panel (for References & Materials tabs) ─────────────────────

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
      {/* Add row */}
      <div className="flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />

        {/* Inventory link picker */}
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

      {/* Items list */}
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
}: Props) {
  const [title, setTitle]       = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [technique, setTechnique] = useState(initial.technique ?? "General");

  // Per-tab content
  const initialBody = useMemo(() => parseBody(initial.body), [initial.body]);
  const [steps, setSteps]                   = useState(initialBody.steps);
  const [tabDescription, setTabDescription] = useState(initialBody.description);
  const [tabGuidelines, setTabGuidelines]   = useState(initialBody.guidelines);
  const [tabReferences, setTabReferences]   = useState<LinkedRef[]>(initialBody.references);
  const [tabMaterials, setTabMaterials]     = useState<LinkedRef[]>(initialBody.materials);

  const [activeTab, setActiveTab] = useState<EditorTab>("steps");

  const [externalAction, setExternalAction] = useState<{
    id: number;
    type: "insert-section" | "insert-step" | "insert-sub-step" | "convert-to-step" | "add-step-case"
        | "open-entry-field" | "open-timer";
    preset?: { entryType?: string };
  } | null>(null);

  const [showComponentsMenu, setShowComponentsMenu] = useState(false);

  // Reset all when protocol changes
  useEffect(() => {
    setTitle(initial.title ?? "");
    setDescription(initial.description ?? "");
    setTechnique(initial.technique ?? "General");
    const parsed = parseBody(initial.body);
    setSteps(parsed.steps);
    setTabDescription(parsed.description);
    setTabGuidelines(parsed.guidelines);
    setTabReferences(parsed.references);
    setTabMaterials(parsed.materials);
    setActiveTab("steps");
  }, [initial.id, initial.title, initial.description, initial.technique, initial.body]);

  // In protocolShell mode the title is managed by the parent via titleValue;
  // in non-shell mode we track our own internal `title` state.
  const effectiveTitle = (protocolShell && titleValue !== undefined) ? titleValue : title;

  const isDirty = useMemo(() => {
    return (
      effectiveTitle !== (initial.title ?? "") ||
      description !== (initial.description ?? "") ||
      technique !== (initial.technique ?? "General") ||
      steps !== initialBody.steps ||
      tabDescription !== initialBody.description ||
      tabGuidelines !== initialBody.guidelines ||
      JSON.stringify(tabReferences) !== JSON.stringify(initialBody.references) ||
      JSON.stringify(tabMaterials) !== JSON.stringify(initialBody.materials)
    );
  }, [
    effectiveTitle, description, technique,
    steps, tabDescription, tabGuidelines, tabReferences, tabMaterials,
    initial.title, initial.description, initial.technique,
    initialBody,
  ]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  function handleSave() {
    onSave({
      id: initial.id,
      title: effectiveTitle || initial.title || "",
      description: description.slice(0, 100),
      technique,
      body: serializeBody({ steps, description: tabDescription, guidelines: tabGuidelines, references: tabReferences, materials: tabMaterials }),
    });
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
          {/* ── Metadata row (title lives in the modal header — see protocols/page.tsx) ── */}
          <div className="mb-2 rounded border border-zinc-800 bg-zinc-900 p-2">
            <div className="grid gap-2 lg:grid-cols-[3fr_1.2fr_1fr]">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 100))}
                placeholder="Short description (max 100 chars)"
                maxLength={100}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500"
              />
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
                {(["insert-section","insert-step","insert-sub-step","convert-to-step","add-step-case"] as const).map((type) => {
                  const labels: Record<string, string> = {
                    "insert-section":  "Insert section",
                    "insert-step":     "Insert step",
                    "insert-sub-step": "Insert sub-step",
                    "convert-to-step": "Convert to step",
                    "add-step-case":   "Add step-case",
                  };
                  const disabled = activeTab !== "steps";
                  return (
                    <button
                      key={type}
                      onClick={() => setExternalAction({ id: Date.now(), type })}
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
              {/* Tab bar */}
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

              {/* Steps tab */}
              {activeTab === "steps" && (
                <RichTextEditor
                  key={(initial.id ?? "new-entry") + "-steps"}
                  initialContent={steps}
                  onChange={setSteps}
                  editable={true}
                  mode="full"
                  externalAction={externalAction}
                />
              )}

              {/* Description tab */}
              {activeTab === "description" && (
                <RichTextEditor
                  key={(initial.id ?? "new-entry") + "-desc"}
                  initialContent={tabDescription}
                  onChange={setTabDescription}
                  editable={true}
                  mode="simple"
                />
              )}

              {/* Guidelines & Warnings tab */}
              {activeTab === "guidelines" && (
                <RichTextEditor
                  key={(initial.id ?? "new-entry") + "-guidelines"}
                  initialContent={tabGuidelines}
                  onChange={setTabGuidelines}
                  editable={true}
                  mode="simple"
                />
              )}

              {/* References tab */}
              {activeTab === "references" && (
                <LinkedItemsPanel
                  items={tabReferences}
                  onChange={setTabReferences}
                  placeholder="Add reference (paper, database, protocol)…"
                />
              )}

              {/* Materials tab */}
              {activeTab === "materials" && (
                <LinkedItemsPanel
                  items={tabMaterials}
                  onChange={setTabMaterials}
                  placeholder="Add material (buffer, enzyme, cell line)…"
                />
              )}
            </div>

            {/* Right sidebar — Components (only enabled for Steps tab) */}
            <aside className="lg:sticky lg:top-2 lg:h-fit rounded border border-zinc-800 bg-zinc-900 p-3">
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
                              setExternalAction({ id: Date.now(), type: "open-timer" });
                            } else {
                              setExternalAction({ id: Date.now(), type: "open-entry-field", preset: { entryType: item.entryType } });
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
            <div className="mt-3">
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
        </>
      )}

      <div className="flex gap-2">
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
