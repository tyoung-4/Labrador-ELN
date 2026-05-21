"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppTopNav from "@/components/AppTopNav";
import { getCurrentUser } from "@/components/AppTopNav";
import type { ProtocolRun, StepResult } from "@/models/protocolRun";
import TagInput from "@/components/tags/TagInput";
import ProtocolsRunsSubNav from "@/components/ProtocolsRunsSubNav";
import SidebarWidgets from "@/components/runs/SidebarWidgets";
import RecipeChip, { type RecipeSummary } from "@/components/recipes/RecipeChip";
import StepFileAttachment from "@/components/runs/StepFileAttachment";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ParsedStep = {
  id: string;      // "step-0", "step-1", ...
  label: string;   // plain-text title of the step
  html: string;    // raw html content for display
  sectionTitle?: string;
  isSubstep: boolean;
  requiredFields: { key: string; label: string }[]; // measurement/field nodes
  recipeRefs?: string[]; // recipe IDs attached to this step
};

type ResultKind = "PASSED" | "FAILED" | "SKIPPED";

type LinkedInventoryItem = {
  id: string;
  itemType: string;
  itemId: string;
  itemName: string;
  itemDetail: string;
  notes: string;
};

function safeParseLinkedInventory(raw: string): LinkedInventoryItem[] {
  try { return JSON.parse(raw) as LinkedInventoryItem[]; } catch { return []; }
}

// Typed shape of the interactionState JSON blob persisted on ProtocolRun.
// stepFailures and stepSkips are stored here for type-safety even though
// PASS/FAIL/SKIP truth-of-record lives in StepResult rows.
type RunInteractionState = {
  currentStepIdx:   number;
  stepFailures:     Record<string, boolean>;  // key: "step-N"
  stepSkips:        Record<string, boolean>;  // key: "step-N"
};

function parseInteractionState(raw: string): RunInteractionState {
  try {
    const parsed = JSON.parse(raw || "{}") as Partial<RunInteractionState>;
    return {
      currentStepIdx: typeof parsed.currentStepIdx === "number" ? parsed.currentStepIdx : 0,
      stepFailures:   typeof parsed.stepFailures   === "object" && parsed.stepFailures   !== null ? parsed.stepFailures   : {},
      stepSkips:      typeof parsed.stepSkips      === "object" && parsed.stepSkips      !== null ? parsed.stepSkips      : {},
    };
  } catch {
    return { currentStepIdx: 0, stepFailures: {}, stepSkips: {} };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step parsing — handles both the new JSON (ProtocolStepsEditor) and legacy HTML
// ─────────────────────────────────────────────────────────────────────────────

function parseStepsFromBody(runBody: string): ParsedStep[] {
  const steps: ParsedStep[] = [];

  // Try JSON format (from ProtocolStepsEditor)
  // Handles two variants:
  //   A) ProtocolBodyJSON wrapper: { steps: "JSON-stringified StepsData" }
  //   B) Raw StepsData:            { version, sections: [...] }
  try {
    type RawField  = { id: string; label: string; [k: string]: unknown };
    type RawSub    = { id: string; html?: string; text?: string; requiredFields?: RawField[]; fields?: RawField[] };
    type RawStep   = { id: string; html?: string; text?: string; requiredFields?: RawField[]; fields?: RawField[]; substeps?: RawSub[]; subSteps?: RawSub[]; recipeRefs?: string[] };
    type RawSection = { id: string; title: string; steps?: RawStep[] };
    type RawData    = { version?: number; sections?: RawSection[]; steps?: unknown };

    let parsed = JSON.parse(runBody) as RawData;

    // Unwrap ProtocolBodyJSON: { steps: "JSON string" }
    if (typeof parsed.steps === "string" && !Array.isArray((parsed as RawData).sections)) {
      parsed = JSON.parse(parsed.steps) as RawData;
    }

    if (parsed.sections && Array.isArray(parsed.sections)) {
      let globalIdx = 0;
      for (const section of parsed.sections) {
        for (const step of section.steps ?? []) {
          const stepId  = `step-${globalIdx++}`;
          const content = step.html ?? step.text ?? "";
          const label   = step.html ? stripHtml(content) : content;
          const rawFields = step.requiredFields ?? step.fields ?? [];
          steps.push({
            id: stepId,
            label: label || `Step ${steps.length + 1}`,
            html: content,
            sectionTitle: section.title,
            isSubstep: false,
            requiredFields: rawFields.map((f, fi) => ({
              key: `field-${globalIdx - 1}-${fi}`,
              label: f.label,
            })),
            recipeRefs: step.recipeRefs ?? [],
          });
          for (const sub of step.substeps ?? step.subSteps ?? []) {
            const subId      = `step-${globalIdx++}`;
            const subContent = sub.html ?? sub.text ?? "";
            const subLabel   = sub.html ? stripHtml(subContent) : subContent;
            const subFields  = sub.requiredFields ?? sub.fields ?? [];
            steps.push({
              id: subId,
              label: subLabel || `Sub-step ${steps.length + 1}`,
              html: subContent,
              sectionTitle: section.title,
              isSubstep: true,
              requiredFields: subFields.map((f, fi) => ({
                key: `field-${globalIdx - 1}-${fi}`,
                label: f.label,
              })),
            });
          }
        }
      }
      return steps;
    }
  } catch {
    // fall through to HTML parsing
  }

  // Legacy HTML format — extract task list items
  if (typeof window !== "undefined") {
    const doc = new DOMParser().parseFromString(runBody || "", "text/html");
    const stepNodes = Array.from(doc.querySelectorAll("li[data-type='taskItem']"));
    stepNodes.forEach((node, idx) => {
      // Use only the content div (sibling of the label/checkbox), not the full li innerHTML
      const contentDiv = node.querySelector("div") ?? node;
      const html = contentDiv.innerHTML || "";
      const label = (contentDiv.textContent || "").replace(/\s+/g, " ").trim();
      const fieldNodes = Array.from(node.querySelectorAll("span[data-entry-node='measurement']"));
      steps.push({
        id: `step-${idx}`,
        label: label || `Step ${idx + 1}`,
        html,
        isSubstep: false,
        requiredFields: fieldNodes.map((f, fi) => ({
          key: `field-${idx}-${fi}`,
          label: f.getAttribute("label") || `Field ${fi + 1}`,
        })),
      });
    });
  }

  return steps;
}

function stripHtml(html: string): string {
  if (typeof window !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }
  return html.replace(/<[^>]+>/g, "").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress Dog 🐕
// ─────────────────────────────────────────────────────────────────────────────

function ProgressDog({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const isComplete = pct >= 100;

  return (
    <div className="mb-5 rounded border border-zinc-800 bg-zinc-900 p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-400">
        <span>Run Progress</span>
        <span className="font-mono font-semibold text-zinc-100">{pct}%</span>
      </div>
      {/* Track */}
      <div className="relative h-10 overflow-hidden rounded-lg bg-gradient-to-r from-emerald-900/40 to-emerald-600/30">
        {/* Filled portion */}
        <div
          className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-emerald-700/60 to-emerald-500/40 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        {/* Dog emoji — slides along the track, clamped to stay visible */}
        <div
          className="absolute top-1/2 -translate-y-1/2 text-xl transition-all duration-500"
          style={{ left: `clamp(0px, calc(${pct}% - 1rem), calc(100% - 2rem))` }}
          title={isComplete ? "Run complete! 🎉" : "Running…"}
        >
          {isComplete ? "🎉" : "🐕"}
        </div>
        {/* Ball at the end */}
        {!isComplete && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-base" title="Goal">
            🎾
          </div>
        )}
      </div>
      {isComplete && (
        <p className="mt-1.5 text-center text-xs font-semibold text-emerald-400">All steps resolved — run complete! 🎉</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RunProtocolScrollView — Left panel: sections + step rows
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT_BORDERS = [
  "border-indigo-500",
  "border-violet-500",
  "border-cyan-500",
  "border-emerald-500",
  "border-amber-500",
];
const ACCENT_TEXTS = [
  "text-indigo-300",
  "text-violet-300",
  "text-cyan-300",
  "text-emerald-300",
  "text-amber-300",
];

// ── InlineStepEditor — compact form to change a completed step's result/note ──

function InlineStepEditor({
  step,
  currentResult,
  currentNote,
  onSave,
  onCancel,
}: {
  step: ParsedStep;
  currentResult: string;
  currentNote: string;
  onSave: (kind: ResultKind, note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<ResultKind>(currentResult as ResultKind);
  const [note, setNote] = useState(currentNote);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(kind, note);
    setSaving(false);
  }

  const btnBase = "rounded px-2.5 py-1 text-xs font-semibold transition";
  return (
    <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-3 space-y-2">
      {/* Result selector */}
      <div className="flex gap-1.5">
        {(["PASSED", "FAILED", "SKIPPED"] as ResultKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`${btnBase} ${
              kind === k
                ? k === "PASSED" ? "bg-emerald-600 text-white"
                : k === "FAILED" ? "bg-red-600 text-white"
                : "bg-zinc-600 text-white"
                : "bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {k === "PASSED" ? "✓ Pass" : k === "FAILED" ? "✗ Fail" : "→ Skip"}
          </button>
        ))}
      </div>
      {/* Note */}
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notes for this step…"
        className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none"
      />
      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={save}
          disabled={saving}
          className={`${btnBase} bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50`}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className={`${btnBase} bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-100`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── UnlockConfirmInline — confirmation prompt for unlocking a step ─────────────

function UnlockConfirmInline({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs">
      <span className="text-amber-800">Re-open this step? Current result will be cleared.</span>
      <button
        onClick={onConfirm}
        className="rounded bg-amber-600 px-2 py-0.5 text-white hover:bg-amber-700 font-medium"
      >
        Confirm
      </button>
      <button
        onClick={onCancel}
        className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-zinc-600 hover:bg-zinc-50"
      >
        Cancel
      </button>
    </div>
  );
}

// ── StepRow — a single step with inline edit / unlock support ─────────────────

function StepRow({
  step,
  globalIdx,
  numLabel,
  result,
  isActive,
  isRunComplete,
  allowNonSequential,
  isEditing,
  pendingNotes,
  pendingFields,
  onNoteChange,
  onFieldChange,
  onEditOpen,
  onEditClose,
  onEditSave,
  onUnlock,
  onStepClick,
  expandedNotes,
  setExpandedNotes,
  recipesById,
}: {
  step: ParsedStep;
  globalIdx: number;
  numLabel: string;
  result: StepResult | undefined;
  isActive: boolean;
  isRunComplete: boolean;
  allowNonSequential: boolean;
  isEditing: boolean;
  pendingNotes: Record<string, string>;
  pendingFields: Record<string, Record<string, string>>;
  onNoteChange: (stepId: string, note: string) => void;
  onFieldChange: (stepId: string, fieldKey: string, value: string) => void;
  onEditOpen: (stepId: string) => void;
  onEditClose: () => void;
  onEditSave: (step: ParsedStep, kind: ResultKind, note: string) => Promise<void>;
  onUnlock: (step: ParsedStep) => Promise<void>;
  onStepClick: (globalIdx: number, step: ParsedStep) => void;
  expandedNotes: Set<string>;
  setExpandedNotes: React.Dispatch<React.SetStateAction<Set<string>>>;
  recipesById: Record<string, RecipeSummary>;
}) {
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [hovered, setHovered] = useState(false);

  let stripeBorder: string;
  let rowBg: string;
  if (result?.result === "PASSED")       { stripeBorder = "border-emerald-500"; rowBg = "bg-emerald-50"; }
  else if (result?.result === "FAILED")  { stripeBorder = "border-red-500";     rowBg = "bg-red-50"; }
  else if (result?.result === "SKIPPED") { stripeBorder = "border-amber-500";   rowBg = "bg-amber-50"; }
  else if (isActive)                     { stripeBorder = "border-indigo-400";  rowBg = ""; }
  else                                   { stripeBorder = "border-zinc-300";    rowBg = ""; }

  const notesOpen   = expandedNotes.has(step.id);
  const savedNote   = result?.notes ?? "";
  const pendingNote = pendingNotes[step.id] ?? "";

  // Click target for non-sequential mode
  const isClickable = allowNonSequential && !isRunComplete;

  return (
    <div
      className={`border-l-4 ${stripeBorder} ${rowBg} rounded-r transition-colors duration-150${step.isSubstep ? " ml-8" : ""}${isActive && !result ? " outline-2 outline-dashed outline-indigo-400" : ""}${isClickable && !result ? " cursor-pointer" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (isClickable && !result) onStepClick(globalIdx, step);
      }}
    >
      <div className="px-4 py-3">
        <div className="flex gap-3">
          {/* Step number */}
          <span
            className={`mt-0.5 shrink-0 font-mono text-xs font-bold ${
              isActive && !result ? "text-indigo-600" : result ? "text-zinc-400" : "text-zinc-500"
            }`}
          >
            {numLabel}.
          </span>

          {/* Step body */}
          <div className="min-w-0 flex-1">
            {/* Header row: HTML + hover actions */}
            <div className="flex items-start gap-2">
              <div
                className="flex-1 text-sm leading-relaxed text-zinc-800 [&_p]:my-0"
                dangerouslySetInnerHTML={{ __html: step.html || step.label }}
              />
              {/* Hover action buttons — edit + unlock (completed steps, not complete run) */}
              {result && !isRunComplete && hovered && !isEditing && !showUnlockConfirm && (
                <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onEditOpen(step.id)}
                    title="Edit result"
                    className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition text-sm"
                  >
                    ✏️
                  </button>
                  {allowNonSequential && (
                    <button
                      onClick={() => setShowUnlockConfirm(true)}
                      title="Unlock step"
                      className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition"
                    >
                      Unlock
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Recipe chips */}
            {(step.recipeRefs ?? []).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(step.recipeRefs ?? []).map((rid) => {
                  const recipe = recipesById[rid];
                  if (!recipe) return null;
                  return <RecipeChip key={rid} recipe={recipe} />;
                })}
              </div>
            )}

            {/* Result badge (only shown when not in inline edit mode) */}
            {result && !isEditing && (
              <div className="mt-1.5">
                <ResultBadge result={result.result} small />
              </div>
            )}

            {/* Unlock confirmation */}
            {showUnlockConfirm && (
              <UnlockConfirmInline
                onConfirm={() => { setShowUnlockConfirm(false); onUnlock(step); }}
                onCancel={() => setShowUnlockConfirm(false)}
              />
            )}

            {/* Inline edit mode (only on IN_PROGRESS runs) */}
            {isEditing && result && !isRunComplete && (
              <InlineStepEditor
                step={step}
                currentResult={result.result}
                currentNote={result.notes ?? ""}
                onSave={(kind, note) => onEditSave(step, kind, note)}
                onCancel={onEditClose}
              />
            )}

            {/* Required field chips — hidden in edit mode */}
            {!isEditing && step.requiredFields.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {step.requiredFields.map((field) => {
                  if (result) {
                    let savedVal = "";
                    try {
                      savedVal = (JSON.parse(result.fieldValues) as Record<string, string>)[field.key] ?? "";
                    } catch { /* */ }
                    return (
                      <span key={field.key} className="flex items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs">
                        <span className="text-zinc-500">{field.label}:</span>
                        <span className="text-zinc-700">{savedVal || "—"}</span>
                      </span>
                    );
                  }
                  const val = (pendingFields[step.id] ?? {})[field.key] ?? "";
                  return (
                    <label key={field.key} className="flex cursor-text items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs">
                      <span className="text-zinc-500">{field.label}:</span>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => onFieldChange(step.id, field.key, e.target.value)}
                        disabled={isRunComplete}
                        placeholder="…"
                        className="w-20 border-none bg-white text-zinc-800 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
                      />
                    </label>
                  );
                })}
              </div>
            )}

            {/* Inline notes toggle — hidden in edit mode */}
            {!isEditing && (
              <div className="mt-2">
                <button
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedNotes((prev) => {
                      const next = new Set(prev);
                      if (next.has(step.id)) next.delete(step.id);
                      else next.add(step.id);
                      return next;
                    });
                  }}
                >
                  {notesOpen ? "▾ Hide notes" : `▸ ${savedNote ? "View notes" : "Add notes"}`}
                </button>
                {notesOpen && (
                  <div className="mt-1.5">
                    {result || isRunComplete ? (
                      <p className="text-xs italic text-zinc-600">{savedNote || "No notes."}</p>
                    ) : (
                      <textarea
                        rows={2}
                        value={pendingNote}
                        onChange={(e) => { e.stopPropagation(); onNoteChange(step.id, e.target.value); }}
                        placeholder="Notes for this step…"
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RunProtocolScrollView({
  steps,
  resultMap,
  activeStepIdx,
  pendingNotes,
  pendingFields,
  onNoteChange,
  onFieldChange,
  isRunComplete,
  recipesById,
  allowNonSequential,
  editingStepId,
  onStepClick,
  onEditOpen,
  onEditClose,
  onEditSave,
  onUnlock,
  runId,
  userId,
  authHeaders,
}: {
  steps: ParsedStep[];
  resultMap: Record<string, StepResult>;
  activeStepIdx: number;
  pendingNotes: Record<string, string>;
  pendingFields: Record<string, Record<string, string>>;
  onNoteChange: (stepId: string, note: string) => void;
  onFieldChange: (stepId: string, fieldKey: string, value: string) => void;
  isRunComplete: boolean;
  recipesById: Record<string, RecipeSummary>;
  allowNonSequential: boolean;
  editingStepId: string | null;
  onStepClick: (globalIdx: number, step: ParsedStep) => void;
  onEditOpen: (stepId: string) => void;
  onEditClose: () => void;
  onEditSave: (step: ParsedStep, kind: ResultKind, note: string) => Promise<void>;
  onUnlock: (step: ParsedStep) => Promise<void>;
  runId: string;
  userId: string;
  authHeaders: Record<string, string>;
}) {
  const stepRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Start with notes expanded for any step that already has saved notes
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const [stepId, result] of Object.entries(resultMap)) {
      if (result.notes) set.add(stepId);
    }
    return set;
  });

  // Auto-expand when a completed step with notes arrives after initial load
  useEffect(() => {
    setExpandedNotes((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const [stepId, result] of Object.entries(resultMap)) {
        if (result.notes && !next.has(stepId)) {
          next.add(stepId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [resultMap]);

  // Auto-scroll active step into view (smooth)
  useEffect(() => {
    const active = steps[activeStepIdx];
    if (!active) return;
    stepRefs.current[active.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeStepIdx, steps]);

  if (steps.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500">
        No steps found in this protocol.
      </div>
    );
  }

  // Build per-step display labels in a single pass
  let mainNum = 0;
  let subNum = 0;
  const displaySteps = steps.map((step, globalIdx) => {
    let numLabel: string;
    if (!step.isSubstep) {
      mainNum++;
      subNum = 0;
      numLabel = String(mainNum);
    } else {
      const subLetter = "abcdefghijklmnopqrstuvwxyz"[subNum] ?? String(subNum + 1);
      subNum++;
      numLabel = `${mainNum}${subLetter}`;
    }
    return { step, globalIdx, numLabel };
  });

  // Group by contiguous sectionTitle
  type SectionGroup = { title: string; items: typeof displaySteps };
  const sections: SectionGroup[] = [];
  for (const item of displaySteps) {
    const title = item.step.sectionTitle ?? "";
    const last = sections[sections.length - 1];
    if (!last || last.title !== title) sections.push({ title, items: [item] });
    else last.items.push(item);
  }

  return (
    <div className="space-y-8">
      {sections.map((section, si) => (
        <div key={`${section.title}-${si}`}>
          {/* Section header bar */}
          {section.title && (
            <div
              className={`mb-3 flex items-center border-l-4 ${ACCENT_BORDERS[si % ACCENT_BORDERS.length]} rounded-r bg-zinc-900/80 px-3 py-2.5`}
            >
              <span className={`text-xs font-bold uppercase tracking-widest ${ACCENT_TEXTS[si % ACCENT_TEXTS.length]}`}>
                {section.title}
              </span>
            </div>
          )}

          {/* Step rows */}
          <div className="space-y-2">
            {section.items.map(({ step, globalIdx, numLabel }) => (
              <div key={step.id} ref={(el) => { stepRefs.current[step.id] = el; }}>
                <StepRow
                  step={step}
                  globalIdx={globalIdx}
                  numLabel={numLabel}
                  result={resultMap[step.id]}
                  isActive={globalIdx === activeStepIdx}
                  isRunComplete={isRunComplete}
                  allowNonSequential={allowNonSequential}
                  isEditing={editingStepId === step.id}
                  pendingNotes={pendingNotes}
                  pendingFields={pendingFields}
                  onNoteChange={onNoteChange}
                  onFieldChange={onFieldChange}
                  onEditOpen={onEditOpen}
                  onEditClose={onEditClose}
                  onEditSave={onEditSave}
                  onUnlock={onUnlock}
                  onStepClick={onStepClick}
                  expandedNotes={expandedNotes}
                  setExpandedNotes={setExpandedNotes}
                  recipesById={recipesById}
                />
                <StepFileAttachment
                  runId={runId}
                  stepId={step.id}
                  userId={userId}
                  authHeaders={authHeaders}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ActiveRunPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const router = useRouter();

  const currentUser = useMemo(() => {
    if (typeof window === "undefined") return { id: "finn-user", name: "Finn", role: "MEMBER" as const };
    return getCurrentUser();
  }, []);

  const authHeaders = useMemo(
    () => ({
      "x-user-id": currentUser.id,
      "x-user-name": currentUser.name,
      "x-user-role": currentUser.role,
    }),
    [currentUser]
  );

  const [run, setRun] = useState<ProtocolRun | null>(null);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});
  const [pendingFields, setPendingFields] = useState<Record<string, Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completingRun, setCompletingRun] = useState(false);
  const [showCompleteBanner, setShowCompleteBanner] = useState(false);
  const [runTagAssignments, setRunTagAssignments] = useState<NonNullable<ProtocolRun["tagAssignments"]>>([]);
  const [showTagNudge, setShowTagNudge] = useState(false);
  const [tagNudgeDismissed, setTagNudgeDismissed] = useState(false);
  const [recipesById, setRecipesById] = useState<Record<string, RecipeSummary>>({});
  const [allowNonSequential, setAllowNonSequential] = useState(false);
  // stepId of the step currently open in inline-edit mode (null = none)
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  // Inventory usage confirmation
  const [showInventoryConfirm, setShowInventoryConfirm] = useState(false);
  const [inventoryConfirmed, setInventoryConfirmed] = useState<Set<string>>(new Set());

  // Parse steps — only after run is loaded and we're client-side
  const steps = useMemo<ParsedStep[]>(() => {
    if (!run) return [];
    return parseStepsFromBody(run.runBody);
  }, [run]);

  const resultMap = useMemo<Record<string, StepResult>>(() => {
    const map: Record<string, StepResult> = {};
    for (const r of stepResults) map[r.stepId] = r;
    return map;
  }, [stepResults]);

  const resolvedCount = useMemo(
    () => steps.filter((s) => resultMap[s.id]).length,
    [steps, resultMap]
  );

  const progress = steps.length > 0 ? resolvedCount / steps.length : 0;
  const allResolved = steps.length > 0 && resolvedCount === steps.length;
  const isRunComplete = run?.status === "COMPLETED";

  // ── Load run + step results ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [runRes, srRes] = await Promise.all([
          fetch(`/api/protocol-runs/${runId}`, { headers: authHeaders }),
          fetch(`/api/protocol-runs/${runId}/step-results`, { headers: authHeaders }),
        ]);

        if (!runRes.ok) {
          if (runRes.status === 404) setError("Run not found.");
          else setError(`Failed to load run (${runRes.status}).`);
          return;
        }

        const runData = (await runRes.json()) as ProtocolRun;
        const srData: StepResult[] = srRes.ok ? ((await srRes.json()) as StepResult[]) : [];

        if (cancelled) return;
        setRun(runData);
        setStepResults(srData);

        // Fetch allowNonSequential from the source protocol entry
        if (runData.sourceEntryId) {
          fetch(`/api/entries/${runData.sourceEntryId}`, { headers: authHeaders })
            .then((r) => r.ok ? r.json() : null)
            .then((entry) => { if (entry?.allowNonSequential) setAllowNonSequential(true); })
            .catch(() => {/* non-critical */});
        }

        // Initialise tag state
        const tags = runData.tagAssignments ?? [];
        setRunTagAssignments(tags);
        if (runData.status === "COMPLETED") {
          const hasProjectTag = tags.some((a) => a.tag.type === "PROJECT");
          if (!hasProjectTag) setShowTagNudge(true);
        }

        // Restore active step from interactionState
        const iState = parseInteractionState(runData.interactionState);
        setActiveStepIdx(iState.currentStepIdx);

        if (runData.status === "COMPLETED") setShowCompleteBanner(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load run.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [runId, authHeaders]);

  // ── Load all recipes for chip rendering ───────────────────────────────────
  useEffect(() => {
    fetch("/api/recipes", { headers: authHeaders })
      .then((r) => r.ok ? r.json() : [])
      .then((list: RecipeSummary[]) => {
        const map: Record<string, RecipeSummary> = {};
        for (const r of list) map[r.id] = r;
        setRecipesById(map);
      })
      .catch(() => {/* non-critical */});
  }, [authHeaders]);

  // ── Persist active step index to interactionState ──────────────────────────
  const persistActiveStep = useCallback(
    async (idx: number) => {
      if (!run || run.status === "COMPLETED") return;
      try {
        const existing = parseInteractionState(run.interactionState);
        const next: RunInteractionState = { ...existing, currentStepIdx: idx };
        await fetch(`/api/protocol-runs/${runId}`, {
          method: "PUT",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ interactionState: JSON.stringify(next) }),
        });
      } catch {
        // non-critical — step position is best-effort
      }
    },
    [run, runId, authHeaders]
  );

  const handleNoteChange = useCallback((stepId: string, note: string) => {
    setPendingNotes((prev) => ({ ...prev, [stepId]: note }));
  }, []);

  const handleFieldChange = useCallback((stepId: string, fieldKey: string, value: string) => {
    setPendingFields((prev) => ({
      ...prev,
      [stepId]: { ...(prev[stepId] ?? {}), [fieldKey]: value },
    }));
  }, []);

  // ── Non-sequential step selection ─────────────────────────────────────────
  function handleStepClick(globalIdx: number, step: ParsedStep) {
    if (!allowNonSequential || isRunComplete) return;
    if (resultMap[step.id]) {
      // Completed step → open inline edit instead of setting active
      setEditingStepId(step.id);
    } else {
      // Incomplete step → make it active
      setEditingStepId(null);
      setActiveStepIdx(globalIdx);
      persistActiveStep(globalIdx);
    }
  }

  // ── Unlock a completed step (non-sequential only) ──────────────────────────
  async function handleUnlock(step: ParsedStep) {
    if (!allowNonSequential || isRunComplete) return;
    try {
      const res = await fetch(`/api/protocol-runs/${runId}/step-results`, {
        method: "DELETE",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: step.id }),
      });
      if (!res.ok) return;
      // Remove from local state
      setStepResults((prev) => prev.filter((r) => r.stepId !== step.id));
      // Set this step as active
      const idx = steps.indexOf(step);
      if (idx >= 0) {
        setActiveStepIdx(idx);
        persistActiveStep(idx);
      }
      setEditingStepId(null);
    } catch {
      // non-critical
    }
  }

  // ── Inline edit save ───────────────────────────────────────────────────────
  async function handleEditSave(step: ParsedStep, kind: ResultKind, note: string) {
    if (isRunComplete) return;
    try {
      const res = await fetch(`/api/protocol-runs/${runId}/step-results`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: step.id, result: kind, notes: note, fieldValues: {} }),
      });
      if (!res.ok) return;
      const updated = (await res.json()) as StepResult;
      setStepResults((prev) => {
        const next = prev.filter((r) => r.stepId !== step.id);
        next.push(updated);
        return next;
      });
      setEditingStepId(null);
    } catch {
      // non-critical
    }
  }

  // ── Submit a step result ───────────────────────────────────────────────────
  async function handleResult(step: ParsedStep, kind: ResultKind) {
    if (isRunComplete || submitting) return;

    // Validate required fields
    if (kind === "PASSED" && step.requiredFields.length > 0) {
      const stepFields = pendingFields[step.id] ?? {};
      const missing = step.requiredFields.filter((f) => !(stepFields[f.key] ?? "").trim());
      if (missing.length > 0) {
        alert(`Please fill required fields before passing:\n${missing.map((f) => `• ${f.label}`).join("\n")}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const stepFields = pendingFields[step.id] ?? {};
      const res = await fetch(`/api/protocol-runs/${runId}/step-results`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId: step.id,
          result: kind,
          notes: pendingNotes[step.id] ?? "",
          fieldValues: stepFields,
        }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        console.error("Failed to record step result:", msg);
        return;
      }

      const newResult = (await res.json()) as StepResult;
      setStepResults((prev) => {
        const next = prev.filter((r) => r.stepId !== step.id);
        next.push(newResult);
        return next;
      });

      // Advance to next unresolved step
      const nextIdx = findNextUnresolved(steps, { ...resultMap, [step.id]: newResult }, activeStepIdx);
      setActiveStepIdx(nextIdx);
      persistActiveStep(nextIdx);

      // Check if all resolved → complete run
      const updatedResolved = steps.filter((s) =>
        s.id === step.id ? true : Boolean(resultMap[s.id])
      ).length;

      if (updatedResolved === steps.length && run?.status === "IN_PROGRESS") {
        requestCompleteRun();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function findNextUnresolved(
    allSteps: ParsedStep[],
    resolvedMap: Record<string, StepResult>,
    currentIdx: number
  ): number {
    // Search forward from current+1
    for (let i = currentIdx + 1; i < allSteps.length; i++) {
      if (!resolvedMap[allSteps[i].id]) return i;
    }
    // Wrap from beginning
    for (let i = 0; i < currentIdx; i++) {
      if (!resolvedMap[allSteps[i].id]) return i;
    }
    return currentIdx; // all resolved
  }

  function requestCompleteRun() {
    if (!run || run.status === "COMPLETED" || completingRun) return;
    const linkedItems: LinkedInventoryItem[] = safeParseLinkedInventory(run.linkedInventory);
    if (linkedItems.length > 0) {
      setInventoryConfirmed(new Set());
      setShowInventoryConfirm(true);
    } else {
      void completeRun();
    }
  }

  async function completeRun() {
    if (!run || run.status === "COMPLETED" || completingRun) return;
    setCompletingRun(true);
    try {
      const res = await fetch(`/api/protocol-runs/${runId}`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (res.ok) {
        const updated = (await res.json()) as ProtocolRun;
        setRun(updated);
        setShowCompleteBanner(true);
        const hasProjectTag = runTagAssignments.some((a) => a.tag.type === "PROJECT");
        if (!hasProjectTag && !tagNudgeDismissed) setShowTagNudge(true);
      }
    } finally {
      setCompletingRun(false);
    }
  }

  async function handleAbortRun(abortNotes: string) {
    if (!run) return;
    try {
      const res = await fetch(`/api/protocol-runs/${runId}`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ABORTED", abortNotes }),
      });
      if (res.ok) router.push(`/runs/${runId}/summary`);
    } catch { /* non-critical */ }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  const activeStep = steps[activeStepIdx] ?? null;

  if (loading) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
        <AppTopNav />
        <p className="mt-10 text-center text-sm text-zinc-400">Loading run…</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
        <AppTopNav />
        <div className="mx-auto mt-10 max-w-md rounded border border-red-500/40 bg-red-500/10 p-4 text-center text-sm text-red-200">
          {error ?? "Run not found."}
        </div>
        <div className="mt-4 text-center">
          <Link href="/runs" className="text-sm text-indigo-400 hover:text-indigo-300 underline">← Back to Active Runs</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <AppTopNav />
      <ProtocolsRunsSubNav />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-zinc-800 px-6 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Link href="/runs" className="text-xs text-zinc-500 hover:text-zinc-400">
                ← Active Runs
              </Link>
              {run.isMockRun && (
                <span className="rounded border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  🧪 MOCK RUN
                </span>
              )}
              {run.status === "IN_PROGRESS" && (
                <span className="rounded bg-indigo-700 px-2 py-0.5 text-xs font-semibold text-indigo-100">
                  IN PROGRESS
                </span>
              )}
              {run.status === "COMPLETED" && (
                <span className="rounded bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-emerald-100">
                  COMPLETED
                </span>
              )}
              {allowNonSequential && (
                <span className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-400">
                  Out-of-order run
                </span>
              )}
            </div>
            <h1 className="text-lg font-bold leading-tight text-zinc-100">{run.title}</h1>
            {run.runId && (
              <p className="mt-0.5 text-xs text-zinc-500">ID: {run.runId}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm text-zinc-400">
              Started: {new Date(run.createdAt).toLocaleString()}
            </p>
            {run.completedAt && (
              <p className="mt-0.5 text-xs text-zinc-500">
                Completed: {new Date(run.completedAt).toLocaleString()}
              </p>
            )}
            {isRunComplete && (
              <Link
                href={`/runs/${runId}/summary`}
                className="mt-2 inline-block rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                View Summary →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Mock run banner ──────────────────────────────────────────────── */}
      {run.isMockRun && (
        <div className="mx-6 mt-3 flex items-center gap-3 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2">
          <span className="text-sm text-amber-400">🧪 This is a <strong>mock run</strong> — results will not be saved to the official record.</span>
          <button
            onClick={async () => {
              if (!window.confirm("Delete this mock run? It cannot be recovered.")) return;
              const res = await fetch(`/api/protocol-runs/${run.id}`, { method: "DELETE", headers: authHeaders });
              if (res.ok) router.push("/protocols");
            }}
            className="ml-auto shrink-0 rounded border border-red-500/40 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
          >
            Delete Mock Run
          </button>
        </div>
      )}

      {/* ── Completion banner ────────────────────────────────────────────── */}
      {/* ── Inventory usage confirmation modal ── */}
      {showInventoryConfirm && run && (() => {
        const items = safeParseLinkedInventory(run.linkedInventory);
        const allConfirmed = items.every((item) => inventoryConfirmed.has(item.id));
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="mx-4 w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
              <h3 className="mb-1 text-base font-semibold text-zinc-100">Confirm Inventory Usage</h3>
              <p className="mb-4 text-xs text-zinc-400">Check off each item used before finishing the run.</p>
              <div className="mb-5 space-y-2">
                {items.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded border border-zinc-700 bg-zinc-800/60 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={inventoryConfirmed.has(item.id)}
                      onChange={(e) => {
                        setInventoryConfirmed((prev) => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(item.id) : next.delete(item.id);
                          return next;
                        });
                      }}
                      className="mt-0.5 accent-indigo-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100">{item.itemName}</p>
                      {item.itemDetail && <p className="text-xs text-zinc-400">{item.itemDetail}</p>}
                      {item.notes && <p className="text-xs text-zinc-500">{item.notes}</p>}
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowInventoryConfirm(false)}
                  className="rounded border border-zinc-700 px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  disabled={!allConfirmed}
                  onClick={() => { setShowInventoryConfirm(false); void completeRun(); }}
                  className="rounded bg-indigo-600 px-4 py-2 text-xs text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  Finish Run
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showCompleteBanner && (
        <div className="shrink-0 flex items-center justify-between border-b border-emerald-500/50 bg-emerald-500/10 px-6 py-2">
          <span className="text-sm font-semibold text-emerald-200">
            🎉 All steps resolved — run completed and locked!
          </span>
          <Link
            href={`/runs/${runId}/summary`}
            className="ml-4 rounded bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
          >
            View Summary
          </Link>
        </div>
      )}

      {/* ── Two-column body ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — scrollable */}
        <div className="flex-1 overflow-y-auto border-r border-zinc-800 bg-white p-6">
          <RunProtocolScrollView
            steps={steps}
            resultMap={resultMap}
            activeStepIdx={activeStepIdx}
            pendingNotes={pendingNotes}
            pendingFields={pendingFields}
            onNoteChange={handleNoteChange}
            onFieldChange={handleFieldChange}
            isRunComplete={isRunComplete}
            recipesById={recipesById}
            allowNonSequential={allowNonSequential}
            editingStepId={editingStepId}
            onStepClick={handleStepClick}
            onEditOpen={(stepId) => setEditingStepId(stepId)}
            onEditClose={() => setEditingStepId(null)}
            onEditSave={handleEditSave}
            onUnlock={handleUnlock}
            runId={runId}
            userId={currentUser.id}
            authHeaders={authHeaders}
          />
        </div>

        {/* Right sidebar */}
        <div className="w-80 shrink-0 overflow-y-auto p-6">
          <RunSidebar
            steps={steps}
            resolvedCount={resolvedCount}
            progress={progress}
            activeStep={activeStep}
            submitting={submitting}
            completingRun={completingRun}
            isRunComplete={isRunComplete}
            allResolved={allResolved}
            onResult={handleResult}
            onCompleteRun={requestCompleteRun}
            runId={runId}
            runNotes={run.notes}
            authHeaders={authHeaders}
            runTagAssignments={runTagAssignments}
            onTagAssignmentsChange={(updated) => {
              setRunTagAssignments(updated);
              const hasProject = updated.some((a) => a.tag.type === "PROJECT");
              if (hasProject) setShowTagNudge(false);
            }}
            showTagNudge={showTagNudge}
            onDismissTagNudge={() => { setShowTagNudge(false); setTagNudgeDismissed(true); }}
            currentUserName={currentUser.name}
            runnerName={run.runner?.name ?? "Admin"}
            onAbortRun={handleAbortRun}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ResultBadge
// ─────────────────────────────────────────────────────────────────────────────

function ResultBadge({ result, small = false }: { result: string; small?: boolean }) {
  const base = small ? "rounded px-1 py-0.5 text-[10px] font-semibold" : "rounded px-2 py-0.5 text-xs font-semibold";
  if (result === "PASSED") return <span className={`${base} bg-emerald-800 text-emerald-200`}>PASS</span>;
  if (result === "FAILED") return <span className={`${base} bg-red-800 text-red-200`}>FAIL</span>;
  return <span className={`${base} bg-zinc-700 text-zinc-300`}>SKIP</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// RunSidebar — Right panel: progress bar, Pass/Fail/Skip, run notes
// ─────────────────────────────────────────────────────────────────────────────

function RunSidebar({
  steps,
  resolvedCount,
  progress,
  activeStep,
  submitting,
  completingRun,
  isRunComplete,
  allResolved,
  onResult,
  onCompleteRun,
  onAbortRun,
  runId,
  runNotes,
  authHeaders,
  runTagAssignments,
  onTagAssignmentsChange,
  showTagNudge,
  onDismissTagNudge,
  currentUserName,
  runnerName,
}: {
  steps: ParsedStep[];
  resolvedCount: number;
  progress: number;
  activeStep: ParsedStep | null;
  submitting: boolean;
  completingRun: boolean;
  isRunComplete: boolean;
  allResolved: boolean;
  onResult: (step: ParsedStep, kind: ResultKind) => Promise<void>;
  onCompleteRun: () => void;
  onAbortRun: (abortNotes: string) => Promise<void>;
  runId: string;
  runNotes: string;
  authHeaders: Record<string, string>;
  runTagAssignments: NonNullable<ProtocolRun["tagAssignments"]>;
  onTagAssignmentsChange: (updated: NonNullable<ProtocolRun["tagAssignments"]>) => void;
  showTagNudge: boolean;
  onDismissTagNudge: () => void;
  currentUserName: string;
  runnerName: string;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [showFailMenu, setShowFailMenu] = useState(false);
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [abortNotesInput, setAbortNotesInput] = useState("");
  const [aborting, setAborting] = useState(false);

  // Auto-expand run notes when run completes
  useEffect(() => {
    if (isRunComplete) setNotesOpen(true);
  }, [isRunComplete]);

  const done = allResolved || isRunComplete;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto pb-4">
      {/* Progress */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Run Progress: {resolvedCount} / {steps.length} steps
        </p>
        <ProgressDog progress={progress} />
      </div>

      {/* Actions */}
      {done ? (
        <div className="space-y-3">
          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-sm font-semibold text-emerald-300">All steps resolved!</p>
            <p className="mt-0.5 text-xs text-zinc-400">Add final run notes before finishing.</p>
          </div>
          {!isRunComplete ? (
            <button
              onClick={onCompleteRun}
              disabled={completingRun}
              className="w-full rounded bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {completingRun ? "Finishing…" : "Finish Run"}
            </button>
          ) : (
            <Link
              href={`/runs/${runId}/summary`}
              className="block w-full rounded bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700"
            >
              View Summary →
            </Link>
          )}
        </div>
      ) : activeStep ? (
        <div className="space-y-2">
          <button
            onClick={() => onResult(activeStep, "PASSED")}
            disabled={submitting}
            className="w-full rounded bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving…" : "✓  Pass"}
          </button>
          <div className="flex gap-2">
            {/* Split fail button */}
            <div className="relative flex flex-1">
              <button
                onClick={() => { setShowFailMenu(false); void onResult(activeStep, "FAILED"); }}
                disabled={submitting}
                className="flex-1 rounded-l bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✗  Fail
              </button>
              <button
                onClick={() => setShowFailMenu((v) => !v)}
                disabled={submitting}
                className="rounded-r border-l border-red-800 bg-red-600 px-2 py-2 text-sm text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="More fail options"
              >
                ▾
              </button>
              {showFailMenu && (
                <div className="absolute bottom-full left-0 mb-1 z-10 min-w-[140px] rounded border border-zinc-700 bg-zinc-800 shadow-xl">
                  <button
                    onClick={() => { setShowFailMenu(false); void onResult(activeStep, "FAILED"); }}
                    className="block w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
                  >
                    ✗  Step Fail
                  </button>
                  <button
                    onClick={() => { setShowFailMenu(false); setAbortNotesInput(""); setShowAbortModal(true); }}
                    className="block w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-700"
                  >
                    ⊗  Abort Run
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => onResult(activeStep, "SKIPPED")}
              disabled={submitting}
              className="flex-1 rounded bg-zinc-600 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              →  Skip
            </button>
          </div>

          {/* Abort confirmation modal */}
          {showAbortModal && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
              <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
                <h3 className="mb-1 text-sm font-semibold text-zinc-100">Abort Run?</h3>
                <p className="mb-3 text-xs text-zinc-400">This will permanently abort the run. This action cannot be undone.</p>
                <textarea
                  value={abortNotesInput}
                  onChange={(e) => setAbortNotesInput(e.target.value)}
                  placeholder="Reason for aborting (optional)..."
                  rows={3}
                  className="mb-3 w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setAborting(true);
                      await onAbortRun(abortNotesInput.trim());
                      setAborting(false);
                      setShowAbortModal(false);
                    }}
                    disabled={aborting}
                    className="flex-1 rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {aborting ? "Aborting…" : "Abort Run"}
                  </button>
                  <button
                    onClick={() => setShowAbortModal(false)}
                    disabled={aborting}
                    className="flex-1 rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Keep Running
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Widgets */}
      <SidebarWidgets />

      {/* Tags */}
      <div className="border-t border-zinc-800 pt-4">
        {showTagNudge && (
          <div className="mb-2 flex items-start gap-2 rounded border border-amber-500 bg-amber-500/20 p-2">
            <span className="shrink-0 text-sm">⚠️</span>
            <span className="flex-1 text-xs text-amber-400">
              <strong className="font-semibold">No Project tag added</strong> — tag this run with a Project to keep your work organised.
            </span>
            <button
              onClick={onDismissTagNudge}
              className="shrink-0 text-amber-400/60 hover:text-amber-400 transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Tags</p>
        <TagInput
          entityType="RUN"
          entityId={runId}
          currentUser={currentUserName}
          entityOwner={runnerName}
          existingAssignments={runTagAssignments}
          onAssignmentsChange={onTagAssignmentsChange}
        />
      </div>

      {/* Run Notes — collapsed during run, auto-expands on completion */}
      <div className="mt-auto border-t border-zinc-800 pt-4">
        {notesOpen ? (
          <RunNotes runId={runId} initialNotes={runNotes} authHeaders={authHeaders} readonly={isRunComplete} />
        ) : (
          <button
            className="text-xs text-zinc-500 hover:text-zinc-300"
            onClick={() => setNotesOpen(true)}
          >
            ▸ Run notes
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RunNotes — persisted run-level notes
// ─────────────────────────────────────────────────────────────────────────────

function RunNotes({
  runId,
  initialNotes,
  authHeaders,
  readonly = false,
}: {
  runId: string;
  initialNotes: string;
  authHeaders: Record<string, string>;
  readonly?: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/protocol-runs/${runId}`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Run Notes</h3>
        {!readonly && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
        )}
      </div>
      {readonly ? (
        <p className="whitespace-pre-wrap text-sm text-zinc-400">{notes || <span className="italic text-zinc-600">No notes recorded.</span>}</p>
      ) : (
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
          placeholder="General notes for this run…"
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      )}
    </div>
  );
}
