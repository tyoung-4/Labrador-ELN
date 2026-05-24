"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Italic, Redo2, Underline, Undo2 } from "lucide-react";
import RecipeChip, { type RecipeSummary } from "@/components/recipes/RecipeChip";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FieldKind = "measurement" | "component" | "timer";

export type RequiredField = {
  id: string;
  kind: FieldKind;
  label: string;
  unit: string;
  required?: boolean; // undefined/missing → treat as true for backward compat
  timerSeconds?: number;    // target duration in seconds
  timerMaxSeconds?: number; // optional max for range display (e.g. 20–40 min)
  timerMode?: "countdown" | "countup";
  timerTemp?: string;       // temperature label (e.g. "37°C", "Ice / 4°C")
};

export type SubStep = {
  id: string;
  text: string;
  fields: RequiredField[];
};

export type Step = {
  id: string;
  text: string;
  fields: RequiredField[];
  subSteps: SubStep[];
  recipeRefs?: string[]; // recipe IDs attached to this step
};

export type Section = {
  id: string;
  title: string;
  steps: Step[];
};

export type StepsData = {
  version: 2;
  sections: Section[];
};

/** Which type of element currently has focus in the editor. Consumed by Editor sidebar. */
export type FocusType = "section" | "step" | "substep" | null;

// ─── Section color palette ─────────────────────────────────────────────────────

const SECTION_COLORS = [
  "#3B82F6", // blue
  "#22C55E", // green
  "#F59E0B", // amber
  "#A855F7", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
  "#EF4444", // red
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

function emptyStep(): Step {
  return { id: uid(), text: "", fields: [], subSteps: [] };
}

function emptySection(index = 0): Section {
  return { id: uid(), title: `Section ${index + 1}`, steps: [emptyStep()] };
}

function emptyStepsData(): StepsData {
  return { version: 2, sections: [emptySection(0)] };
}

function normalizeSubStep(raw: Partial<SubStep>): SubStep {
  return {
    id: raw.id || uid(),
    text: raw.text || "",
    fields: Array.isArray(raw.fields) ? raw.fields : [],
  };
}

function normalizeStep(raw: Partial<Step>): Step {
  return {
    id: raw.id || uid(),
    text: raw.text || "",
    fields: Array.isArray(raw.fields) ? raw.fields : [],
    subSteps: Array.isArray(raw.subSteps)
      ? (raw.subSteps as Partial<SubStep>[]).map(normalizeSubStep)
      : [],
  };
}

function normalizeSection(raw: Partial<Section>): Section {
  return {
    id: raw.id || uid(),
    title: raw.title || "",
    steps: Array.isArray(raw.steps)
      ? (raw.steps as Partial<Step>[]).map(normalizeStep)
      : [],
  };
}

export function parseStepsData(raw: string): StepsData {
  if (!raw || !raw.trim()) return emptyStepsData();
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === 2 && Array.isArray(parsed.sections)) {
      return {
        version: 2,
        sections: (parsed.sections as Partial<Section>[]).map(normalizeSection),
      };
    }
  } catch {
    // not JSON
  }
  return emptyStepsData();
}

export function serializeStepsData(data: StepsData): string {
  return JSON.stringify(data);
}

function computeNumbers(data: StepsData): Map<string, string> {
  const map = new Map<string, string>();
  let stepNum = 1;
  for (const section of data.sections) {
    for (const step of section.steps) {
      map.set(step.id, String(stepNum));
      step.subSteps.forEach((ss, i) => {
        map.set(ss.id, `${stepNum}${String.fromCharCode(97 + i)}`);
      });
      stepNum++;
    }
  }
  return map;
}

// ─── History reducer ──────────────────────────────────────────────────────────

type HistoryState = {
  past: StepsData[];
  present: StepsData;
  future: StepsData[];
};

type HistoryAction =
  | { type: "SET"; data: StepsData }
  | { type: "UNDO" }
  | { type: "REDO" };

const MAX_HISTORY = 60;

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "SET":
      return {
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
        present: action.data,
        future: [],
      };
    case "UNDO":
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future.slice(0, MAX_HISTORY - 1)],
      };
    case "REDO":
      if (state.future.length === 0) return state;
      return {
        past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
        present: state.future[0],
        future: state.future.slice(1),
      };
  }
}

// ─── Entry type options ───────────────────────────────────────────────────────

const FIELD_TYPE_OPTIONS = [
  { label: "Mass",          defaultUnit: "g",      units: ["kg", "g", "mg"] },
  { label: "Volume",        defaultUnit: "mL",     units: ["L", "mL", "µL"] },
  { label: "Temperature",   defaultUnit: "°C",     units: ["°C", "°F", "K"] },
  { label: "Concentration", defaultUnit: "mg/mL",  units: ["mg/mL", "µg/mL", "mM", "µM", "nM"] },
  { label: "Time",          defaultUnit: "min",    units: ["hr", "min", "s"] },
  { label: "Timer",         defaultUnit: "",       units: [] as string[] }, // live incubation timer
  { label: "Other",         defaultUnit: "",       units: [] as string[] },
] as const;

const TIMER_TEMP_OPTIONS = ["Ice / 4°C", "RT", "37°C", "42°C", "Other"] as const;

// ─── StepTextInput ─────────────────────────────────────────────────────────────
// ContentEditable div that supports inline formatting (Italic, Underline).
// Uses lastSyncedRef (init null) to detect external value changes vs. user edits.

type StepTextInputProps = {
  value: string;
  onHtmlChange: (html: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onFocus: () => void;
  placeholder: string;
  className?: string;
  focusId: string;
  pendingFocusRef: React.MutableRefObject<string | null>;
};

function StepTextInput({
  value,
  onHtmlChange,
  onKeyDown,
  onFocus,
  placeholder,
  className = "",
  focusId,
  pendingFocusRef,
}: StepTextInputProps) {
  const divRef = useRef<HTMLDivElement>(null);
  // null = not yet synced (mount case); otherwise tracks last innerHTML we set
  const lastSyncedRef = useRef<string | null>(null);

  // Sync innerHTML whenever value differs from what we last set.
  // On mount: lastSyncedRef is null → always syncs initial value.
  // On user type: onInput sets lastSyncedRef before state update, so re-render
  //   sees value === lastSyncedRef → no sync → cursor preserved.
  // On undo/redo: value changes → lastSyncedRef differs → syncs innerHTML.
  useLayoutEffect(() => {
    if (divRef.current && value !== lastSyncedRef.current) {
      divRef.current.innerHTML = value;
      lastSyncedRef.current = value;
    }
  });

  // Pending focus: set by insertStep / insertSubStep before mutate().
  // Fires on every render; condition is cheap.
  useLayoutEffect(() => {
    if (pendingFocusRef.current === focusId && divRef.current) {
      divRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      if (sel) {
        range.selectNodeContents(divRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      pendingFocusRef.current = null;
    }
  });

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      className={`${className} [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-gray-400 [&:empty:before]:pointer-events-none`}
      onInput={() => {
        if (divRef.current) {
          let html = divRef.current.innerHTML;
          // Normalize browser-inserted bare <br> → empty string
          if (html === "<br>" || html === "<br/>") html = "";
          lastSyncedRef.current = html;
          onHtmlChange(html);
        }
      }}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    />
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldPill({
  field,
  onRemove,
}: {
  field: RequiredField;
  onRemove: () => void;
}) {
  const cls =
    field.kind === "timer"
      ? "inline-flex items-center gap-1.5 rounded border border-sky-300 bg-sky-50 px-2 py-0.5 text-xs text-sky-800"
      : field.kind === "component"
      ? "inline-flex items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
      : "inline-flex items-center gap-1.5 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs text-blue-900";
  return (
    <span className={cls}>
      {field.kind === "timer" && <span>⏱</span>}
      <span className="font-medium">{field.label}</span>
      {field.kind === "timer" && field.timerTemp && (
        <span className="opacity-70">{field.timerTemp}</span>
      )}
      {field.kind === "timer" && field.timerSeconds != null && (
        <span className="opacity-60">
          {field.timerMode === "countup" ? "↑" : "↓"}
          {Math.floor(field.timerSeconds / 60)}m
          {field.timerMaxSeconds != null ? `–${Math.floor(field.timerMaxSeconds / 60)}m` : ""}
        </span>
      )}
      {field.kind !== "timer" && field.unit ? <span className="opacity-70">{field.unit}</span> : null}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 opacity-40 hover:opacity-100"
        aria-label="Remove field"
      >
        ×
      </button>
    </span>
  );
}

function InputFieldModal({
  initialType,
  onClose,
  onInsert,
}: {
  initialType?: string;
  onClose: () => void;
  onInsert: (field: RequiredField) => void;
}) {
  const init = FIELD_TYPE_OPTIONS.find((o) => o.label === initialType) ?? FIELD_TYPE_OPTIONS[0];
  const [fieldType, setFieldType] = useState<string>(init.label);
  const [fieldUnit, setFieldUnit] = useState<string>(init.defaultUnit);
  const [customUnit, setCustomUnit] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [isRequired, setIsRequired] = useState(true);

  // Timer-specific state
  const [timerTemp, setTimerTemp] = useState<string>(TIMER_TEMP_OPTIONS[0]);
  const [timerCustomTemp, setTimerCustomTemp] = useState("");
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerHasRange, setTimerHasRange] = useState(false);
  const [timerMaxMinutes, setTimerMaxMinutes] = useState(40);
  const [timerMaxSeconds, setTimerMaxSeconds] = useState(0);
  const [timerMode, setTimerMode] = useState<"countdown" | "countup">("countdown");

  const currentOpt = FIELD_TYPE_OPTIONS.find((o) => o.label === fieldType) ?? FIELD_TYPE_OPTIONS[0];
  const isOther = fieldType === "Other";
  const isTimer = fieldType === "Timer";

  function doInsert() {
    if (isTimer) {
      const totalSeconds = timerMinutes * 60 + timerSeconds;
      const totalMaxSeconds = timerHasRange ? timerMaxMinutes * 60 + timerMaxSeconds : undefined;
      const resolvedTemp = timerTemp === "Other" ? timerCustomTemp.trim() : timerTemp;
      onInsert({
        id: uid(),
        kind: "timer",
        label: fieldLabel.trim() || "Incubation",
        unit: "",
        required: false,
        timerSeconds: totalSeconds,
        timerMaxSeconds: totalMaxSeconds,
        timerMode,
        timerTemp: resolvedTemp || undefined,
      });
    } else {
      const unit = isOther ? customUnit.trim() : fieldUnit;
      onInsert({
        id: uid(),
        kind: "measurement",
        label: fieldLabel.trim() || fieldType,
        unit,
        required: isRequired,
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Insert Input Field</h3>
        <div className="space-y-4">
          {/* Required toggle — hidden for timers (always optional) */}
          {!isTimer && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">Required</span>
              {!isRequired && (
                <span className="text-xs text-gray-400">(user may leave blank)</span>
              )}
            </label>
          )}

          {/* Type selector */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Field Type</label>
            <select
              value={fieldType}
              onChange={(e) => {
                const v = e.target.value;
                setFieldType(v);
                const opt = FIELD_TYPE_OPTIONS.find((o) => o.label === v);
                setFieldUnit(opt?.defaultUnit ?? "");
                setCustomUnit("");
              }}
              className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
            >
              {FIELD_TYPE_OPTIONS.map((o) => (
                <option key={o.label} value={o.label}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Custom label */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Label <span className="text-gray-400 font-normal">(optional — defaults to type name)</span>
            </label>
            <input
              autoFocus
              value={fieldLabel}
              onChange={(e) => setFieldLabel(e.target.value)}
              placeholder={isTimer ? "e.g. Ice incubation" : "e.g. Bead slurry volume"}
              className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doInsert(); } }}
            />
          </div>

          {/* Unit: dropdown for typed, text input for Other — hidden for Timer */}
          {!isTimer && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
              {isOther ? (
                <input
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="Enter unit…"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                />
              ) : (
                <select
                  value={fieldUnit}
                  onChange={(e) => setFieldUnit(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                >
                  {(currentOpt.units as readonly string[]).map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Timer-specific fields */}
          {isTimer && (
            <>
              {/* Temperature */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Temperature</label>
                <select
                  value={timerTemp}
                  onChange={(e) => setTimerTemp(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                >
                  {TIMER_TEMP_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {timerTemp === "Other" && (
                  <input
                    value={timerCustomTemp}
                    onChange={(e) => setTimerCustomTemp(e.target.value)}
                    placeholder="e.g. 55°C"
                    className="mt-1.5 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                  />
                )}
              </div>

              {/* Target duration */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Target Duration</label>
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={timerMinutes}
                      onChange={(e) => setTimerMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                    />
                    <span className="shrink-0 text-sm text-gray-500">min</span>
                  </div>
                  <div className="flex flex-1 items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={timerSeconds}
                      onChange={(e) => setTimerSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                    />
                    <span className="shrink-0 text-sm text-gray-500">sec</span>
                  </div>
                </div>
              </div>

              {/* Range toggle + max duration */}
              <div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={timerHasRange}
                    onChange={(e) => setTimerHasRange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700">Variable duration (range)</span>
                </label>
                {timerHasRange && (
                  <div className="mt-2">
                    <label className="mb-1 block text-sm text-gray-600">Maximum Duration</label>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          value={timerMaxMinutes}
                          onChange={(e) => setTimerMaxMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                        />
                        <span className="shrink-0 text-sm text-gray-500">min</span>
                      </div>
                      <div className="flex flex-1 items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={timerMaxSeconds}
                          onChange={(e) => setTimerMaxSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                        />
                        <span className="shrink-0 text-sm text-gray-500">sec</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Timer mode */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Timer Mode</label>
                <div className="flex gap-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="timerMode"
                      value="countdown"
                      checked={timerMode === "countdown"}
                      onChange={() => setTimerMode("countdown")}
                      className="h-4 w-4 border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">↓ Countdown</span>
                    <span className="text-xs text-gray-400">(default)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="timerMode"
                      value="countup"
                      checked={timerMode === "countup"}
                      onChange={() => setTimerMode("countup")}
                      className="h-4 w-4 border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">↑ Count Up</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={doInsert} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Public handle type ───────────────────────────────────────────────────────

export type ProtocolStepsEditorHandle = {
  insertSection: () => void;
  insertStep: () => void;
  insertSubStep: () => void;
  convertFocused: () => void;
  deleteFocused: () => void;
  openInputField: (entryType?: string) => void;
  openRecipePicker: () => void;
};

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  initialContent?: string;
  onChange?: (content: string) => void;
  showSectionErrors?: boolean;
  onFocusTypeChange?: (type: FocusType) => void;
};

export type FocusTarget = {
  sectionId: string;
  stepId: string;
  subStepId?: string;
};

// ── StepRecipeRow ─────────────────────────────────────────────────────────────

function StepRecipeRow({
  recipeRefs,
  allRecipes,
  onRemove,
}: {
  recipeRefs: string[];
  allRecipes: RecipeSummary[];
  onRemove: (id: string) => void;
}) {
  const attachedRecipes = recipeRefs
    .map((id) => allRecipes.find((r) => r.id === id))
    .filter(Boolean) as RecipeSummary[];

  if (attachedRecipes.length === 0) return null;
  return (
    <div className="ml-10 flex flex-wrap items-center gap-1 pb-0.5">
      {attachedRecipes.map((recipe) => (
        <RecipeChip
          key={recipe.id}
          recipe={recipe}
          onRemove={() => onRemove(recipe.id)}
        />
      ))}
    </div>
  );
}

// ── RecipePickerDropdown ───────────────────────────────────────────────────────

function RecipePickerDropdown({
  recipes,
  attachedIds,
  noStepFocused,
  onPick,
  onClose,
}: {
  recipes: RecipeSummary[];
  attachedIds: string[];
  noStepFocused?: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Search by name only
  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  const hoveredRecipe = hovered ? recipes.find((r) => r.id === hovered) : null;

  return (
    <div className="flex gap-2" style={{ minWidth: 220 }}>
      {/* Picker panel */}
      <div className="w-52 rounded border border-zinc-200 bg-white shadow-lg">
        {noStepFocused && (
          <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            Select a step first
          </p>
        )}
        <div className="border-b border-zinc-100 px-2 py-1.5">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes…"
            className="w-full text-xs text-zinc-800 placeholder:text-zinc-400 outline-none"
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-zinc-400">No recipes found</p>
          )}
          {filtered.map((r) => {
            const attached = attachedIds.includes(r.id);
            const disabled = attached || noStepFocused;
            return (
              <button
                key={r.id}
                onClick={() => { if (!disabled) { onPick(r.id); onClose(); } }}
                disabled={disabled}
                title={noStepFocused ? "Select a step first" : undefined}
                onMouseEnter={() => setHovered(r.id)}
                onMouseLeave={() => setHovered(null)}
                className={`w-full px-3 py-1.5 text-left text-xs transition ${
                  disabled
                    ? "cursor-not-allowed text-zinc-400"
                    : "text-zinc-700 hover:bg-indigo-50 hover:text-indigo-800"
                }`}
              >
                {r.name}
                {attached && <span className="ml-1 text-zinc-400">(added)</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hover preview panel */}
      {hoveredRecipe && hoveredRecipe.components.length > 0 && (
        <div className="w-56 rounded border border-zinc-200 bg-white p-3 shadow-lg">
          <p className="mb-1 text-xs font-semibold text-zinc-800">{hoveredRecipe.name}</p>
          {hoveredRecipe.description && (
            <p className="mb-1.5 text-xs text-zinc-500">{hoveredRecipe.description}</p>
          )}
          <table className="w-full text-xs">
            <tbody>
              {hoveredRecipe.components.map((c) => (
                <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                  <td className="py-0.5 pr-2 text-zinc-700">{c.reagentName}</td>
                  <td className="py-0.5 text-right text-zinc-500 tabular-nums">
                    {c.concentration != null ? `${c.concentration} ${c.unit}`.trim() : c.unit || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const ProtocolStepsEditor = forwardRef<ProtocolStepsEditorHandle, Props>(
  function ProtocolStepsEditor(
    { initialContent = "", onChange, showSectionErrors = false, onFocusTypeChange },
    ref
  ) {
    const [history, dispatch] = useReducer(historyReducer, {
      past: [],
      present: parseStepsData(initialContent),
      future: [],
    });

    const data = history.present;

    const dataRef = useRef(data);
    const onChangeRef = useRef(onChange);
    useEffect(() => { dataRef.current = data; }, [data]);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    const pendingFocusRef = useRef<string | null>(null);
    const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
    const [focusType, setFocusType] = useState<FocusType>(null);

    // Stable refs so imperative handle always sees latest values
    const focusTargetRef = useRef<FocusTarget | null>(null);
    const focusTypeRef   = useRef<FocusType>(null);
    const onFocusTypeChangeRef = useRef(onFocusTypeChange);
    useEffect(() => { focusTargetRef.current = focusTarget; }, [focusTarget]);
    useEffect(() => { focusTypeRef.current = focusType; }, [focusType]);
    useEffect(() => { onFocusTypeChangeRef.current = onFocusTypeChange; }, [onFocusTypeChange]);

    const [fieldModalOpen, setFieldModalOpen] = useState(false);
    const [fieldModalInitialType, setFieldModalInitialType] = useState<string | undefined>(undefined);
    const [recipePickerOpen, setRecipePickerOpen] = useState(false);

    // ── Recipe data — lazy fetch on first open ────────────────────────────────
    const [allRecipes, setAllRecipes] = useState<RecipeSummary[]>([]);
    const recipeFetchedRef = useRef(false);
    useEffect(() => {
      if (!recipePickerOpen || recipeFetchedRef.current) return;
      recipeFetchedRef.current = true;
      fetch("/api/recipes")
        .then((r) => r.ok ? r.json() : [])
        .then((list: RecipeSummary[]) => setAllRecipes(list))
        .catch(() => {/* non-critical */});
    }, [recipePickerOpen]);

    const numbers = useMemo(() => computeNumbers(data), [data]);

    // ── Core mutation ─────────────────────────────────────────────────────────

    const mutate = useCallback((newData: StepsData) => {
      dispatch({ type: "SET", data: newData });
      onChangeRef.current?.(serializeStepsData(newData));
    }, []);

    const undo = useCallback(() => {
      if (history.past.length === 0) return;
      const prev = history.past[history.past.length - 1];
      dispatch({ type: "UNDO" });
      onChangeRef.current?.(serializeStepsData(prev));
    }, [history.past]);

    const redo = useCallback(() => {
      if (history.future.length === 0) return;
      const next = history.future[0];
      dispatch({ type: "REDO" });
      onChangeRef.current?.(serializeStepsData(next));
    }, [history.future]);

    // ── Global keyboard: undo/redo ────────────────────────────────────────────

    useEffect(() => {
      function handleKeyDown(e: KeyboardEvent) {
        const isMac = navigator.platform.toUpperCase().includes("MAC");
        const mod = isMac ? e.metaKey : e.ctrlKey;
        if (!mod) return;
        if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
        if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redo(); }
      }
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [undo, redo]);

    // ── Focus helpers ─────────────────────────────────────────────────────────

    function setFocusCtx(target: FocusTarget | null, type: FocusType) {
      setFocusTarget(target);
      setFocusType(type);
      onFocusTypeChangeRef.current?.(type);
    }

    // ── Section operations ────────────────────────────────────────────────────

    function updateSectionTitle(sectionId: string, title: string) {
      mutate({ ...data, sections: data.sections.map((s) => s.id === sectionId ? { ...s, title } : s) });
    }

    // ── Step operations ───────────────────────────────────────────────────────

    function updateStep(sectionId: string, stepId: string, text: string) {
      mutate({
        ...data,
        sections: data.sections.map((s) => s.id !== sectionId ? s : {
          ...s, steps: s.steps.map((st) => st.id === stepId ? { ...st, text } : st),
        }),
      });
    }

    function addStepAfter(sectionId: string, stepId: string) {
      const newStep = emptyStep();
      pendingFocusRef.current = newStep.id;
      mutate({
        ...data,
        sections: data.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const idx = s.steps.findIndex((st) => st.id === stepId);
          const steps = [...s.steps];
          steps.splice(idx + 1, 0, newStep);
          return { ...s, steps };
        }),
      });
    }

    function deleteStep(sectionId: string, stepId: string) {
      mutate({
        ...data,
        sections: data.sections.map((s) => s.id !== sectionId ? s : {
          ...s, steps: s.steps.filter((st) => st.id !== stepId),
        }),
      });
    }

    function convertStepToSubStep(sectionId: string, stepId: string) {
      const section = data.sections.find((s) => s.id === sectionId);
      if (!section) return;
      const idx = section.steps.findIndex((st) => st.id === stepId);
      if (idx <= 0) return;
      const prevStep = section.steps[idx - 1];
      const curStep  = section.steps[idx];
      const newSub: SubStep = { id: curStep.id, text: curStep.text, fields: curStep.fields };
      pendingFocusRef.current = newSub.id;
      mutate({
        ...data,
        sections: data.sections.map((s) => {
          if (s.id !== sectionId) return s;
          return {
            ...s,
            steps: s.steps
              .filter((st) => st.id !== stepId)
              .map((st) => st.id !== prevStep.id ? st : { ...st, subSteps: [...st.subSteps, newSub] }),
          };
        }),
      });
    }

    // ── Sub-step operations ───────────────────────────────────────────────────

    function updateSubStep(sectionId: string, stepId: string, subStepId: string, text: string) {
      mutate({
        ...data,
        sections: data.sections.map((s) => s.id !== sectionId ? s : {
          ...s, steps: s.steps.map((st) => st.id !== stepId ? st : {
            ...st, subSteps: st.subSteps.map((ss) => ss.id === subStepId ? { ...ss, text } : ss),
          }),
        }),
      });
    }

    function addSubStepAfter(sectionId: string, stepId: string, subStepId: string) {
      const newSub: SubStep = { id: uid(), text: "", fields: [] };
      pendingFocusRef.current = newSub.id;
      mutate({
        ...data,
        sections: data.sections.map((s) => s.id !== sectionId ? s : {
          ...s, steps: s.steps.map((st) => {
            if (st.id !== stepId) return st;
            const idx = st.subSteps.findIndex((ss) => ss.id === subStepId);
            const subs = [...st.subSteps];
            subs.splice(idx + 1, 0, newSub);
            return { ...st, subSteps: subs };
          }),
        }),
      });
    }

    function addSubStepToStep(sectionId: string, stepId: string) {
      const newSub: SubStep = { id: uid(), text: "", fields: [] };
      pendingFocusRef.current = newSub.id;
      mutate({
        ...data,
        sections: data.sections.map((s) => s.id !== sectionId ? s : {
          ...s, steps: s.steps.map((st) => st.id !== stepId ? st : {
            ...st, subSteps: [...st.subSteps, newSub],
          }),
        }),
      });
    }

    function deleteSubStep(sectionId: string, stepId: string, subStepId: string) {
      mutate({
        ...data,
        sections: data.sections.map((s) => s.id !== sectionId ? s : {
          ...s, steps: s.steps.map((st) => st.id !== stepId ? st : {
            ...st, subSteps: st.subSteps.filter((ss) => ss.id !== subStepId),
          }),
        }),
      });
    }

    function promoteSubStepToStep(sectionId: string, stepId: string, subStepId: string) {
      const section   = data.sections.find((s) => s.id === sectionId);
      if (!section) return;
      const parentSt  = section.steps.find((st) => st.id === stepId);
      if (!parentSt) return;
      const subStep   = parentSt.subSteps.find((ss) => ss.id === subStepId);
      if (!subStep) return;
      const promoted: Step = { id: subStep.id, text: subStep.text, fields: subStep.fields, subSteps: [] };
      pendingFocusRef.current = promoted.id;
      mutate({
        ...data,
        sections: data.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const newSteps: Step[] = [];
          for (const st of s.steps) {
            newSteps.push(
              st.id === stepId
                ? { ...st, subSteps: st.subSteps.filter((ss) => ss.id !== subStepId) }
                : st
            );
            if (st.id === stepId) newSteps.push(promoted);
          }
          return { ...s, steps: newSteps };
        }),
      });
    }

    // ── Field operations ──────────────────────────────────────────────────────

    function addFieldToFocused(field: RequiredField) {
      const target = focusTarget;
      if (!target) return;
      mutate({
        ...data,
        sections: data.sections.map((s) => s.id !== target.sectionId ? s : {
          ...s, steps: s.steps.map((st) => {
            if (st.id !== target.stepId) return st;
            if (target.subStepId) {
              return { ...st, subSteps: st.subSteps.map((ss) =>
                ss.id === target.subStepId ? { ...ss, fields: [...ss.fields, field] } : ss
              )};
            }
            return { ...st, fields: [...st.fields, field] };
          }),
        }),
      });
    }

    function addRecipeToFocused(recipeId: string) {
      const target = focusTargetRef.current;
      if (!target) return;
      mutate({
        ...dataRef.current,
        sections: dataRef.current.sections.map((s) => s.id !== target.sectionId ? s : {
          ...s, steps: s.steps.map((st) => {
            if (st.id !== target.stepId) return st;
            const refs = st.recipeRefs ?? [];
            if (refs.includes(recipeId)) return st;
            return { ...st, recipeRefs: [...refs, recipeId] };
          }),
        }),
      });
    }

    function removeField(sectionId: string, stepId: string, fieldId: string, subStepId?: string) {
      mutate({
        ...data,
        sections: data.sections.map((s) => s.id !== sectionId ? s : {
          ...s, steps: s.steps.map((st) => {
            if (st.id !== stepId) return st;
            if (subStepId) {
              return { ...st, subSteps: st.subSteps.map((ss) =>
                ss.id === subStepId ? { ...ss, fields: ss.fields.filter((f) => f.id !== fieldId) } : ss
              )};
            }
            return { ...st, fields: st.fields.filter((f) => f.id !== fieldId) };
          }),
        }),
      });
    }

    // ── Recipe ref operations ─────────────────────────────────────────────────

    function addRecipeToStep(sectionId: string, stepId: string, recipeId: string) {
      mutate({
        ...data,
        sections: data.sections.map((s) => s.id !== sectionId ? s : {
          ...s, steps: s.steps.map((st) => {
            if (st.id !== stepId) return st;
            const refs = st.recipeRefs ?? [];
            if (refs.includes(recipeId)) return st; // already attached
            return { ...st, recipeRefs: [...refs, recipeId] };
          }),
        }),
      });
    }

    function removeRecipeFromStep(sectionId: string, stepId: string, recipeId: string) {
      mutate({
        ...data,
        sections: data.sections.map((s) => s.id !== sectionId ? s : {
          ...s, steps: s.steps.map((st) => st.id !== stepId ? st : {
            ...st, recipeRefs: (st.recipeRefs ?? []).filter((id) => id !== recipeId),
          }),
        }),
      });
    }

    // ── Keyboard handlers ─────────────────────────────────────────────────────

    function handleStepKeyDown(
      e: React.KeyboardEvent<HTMLDivElement>,
      sectionId: string,
      step: Step,
    ) {
      const currentText = (e.currentTarget as HTMLDivElement).textContent?.trim() || "";
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        addStepAfter(sectionId, step.id);
        return;
      }
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        convertStepToSubStep(sectionId, step.id);
        return;
      }
      if (e.key === "Backspace" && currentText === "" && step.fields.length === 0) {
        e.preventDefault();
        if (step.subSteps.length > 0) {
          if (window.confirm("Deleting this step will also remove its sub-steps. Continue?")) {
            deleteStep(sectionId, step.id);
          }
        } else {
          deleteStep(sectionId, step.id);
        }
      }
    }

    function handleSubStepKeyDown(
      e: React.KeyboardEvent<HTMLDivElement>,
      sectionId: string,
      stepId: string,
      subStep: SubStep,
    ) {
      const currentText = (e.currentTarget as HTMLDivElement).textContent?.trim() || "";
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        addSubStepAfter(sectionId, stepId, subStep.id);
        return;
      }
      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        promoteSubStepToStep(sectionId, stepId, subStep.id);
        return;
      }
      if (e.key === "Backspace" && currentText === "" && subStep.fields.length === 0) {
        e.preventDefault();
        deleteSubStep(sectionId, stepId, subStep.id);
      }
    }

    // ── Imperative handle ─────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      insertSection() {
        const cur = dataRef.current;
        const newSection = emptySection(cur.sections.length);
        pendingFocusRef.current = newSection.id;
        mutate({ ...cur, sections: [...cur.sections, newSection] });
      },
      insertStep() {
        const cur = dataRef.current;
        if (cur.sections.length === 0) return;
        const targetId = focusTargetRef.current?.sectionId ?? cur.sections[cur.sections.length - 1].id;
        const newStep = emptyStep();
        pendingFocusRef.current = newStep.id;
        mutate({
          ...cur,
          sections: cur.sections.map((s) =>
            s.id === targetId ? { ...s, steps: [...s.steps, newStep] } : s
          ),
        });
      },
      insertSubStep() {
        const type   = focusTypeRef.current;
        const target = focusTargetRef.current;
        if (type === "section") return; // disabled
        if (type === "step" && target) {
          addSubStepToStep(target.sectionId, target.stepId);
        } else if (type === "substep" && target?.subStepId) {
          addSubStepAfter(target.sectionId, target.stepId, target.subStepId);
        } else {
          // No focus → append to last step of last section
          const cur = dataRef.current;
          const lastSec = cur.sections[cur.sections.length - 1];
          if (!lastSec || lastSec.steps.length === 0) return;
          const lastStep = lastSec.steps[lastSec.steps.length - 1];
          addSubStepToStep(lastSec.id, lastStep.id);
        }
      },
      convertFocused() {
        const type   = focusTypeRef.current;
        const target = focusTargetRef.current;
        if (!target || type === "section" || type === null) return;
        if (type === "step") {
          convertStepToSubStep(target.sectionId, target.stepId);
        } else if (type === "substep" && target.subStepId) {
          promoteSubStepToStep(target.sectionId, target.stepId, target.subStepId);
        }
      },
      deleteFocused() {
        const type   = focusTypeRef.current;
        const target = focusTargetRef.current;
        if (type !== "step" || !target) return;
        const cur = dataRef.current;
        const section = cur.sections.find((s) => s.id === target.sectionId);
        const step = section?.steps.find((st) => st.id === target.stepId);
        if (!step) return;
        const hasContent = step.subSteps.length > 0 || step.fields.length > 0;
        if (hasContent && !window.confirm("Delete this step and all its sub-steps and fields?")) return;
        mutate({
          ...cur,
          sections: cur.sections.map((s) => s.id !== target.sectionId ? s : {
            ...s, steps: s.steps.filter((st) => st.id !== target.stepId),
          }),
        });
        setFocusCtx(null, null);
      },
      openInputField(entryType?: string) {
        setFieldModalInitialType(entryType);
        setFieldModalOpen(true);
      },
      openRecipePicker() {
        setRecipePickerOpen(true);
      },
    }));

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <div className="w-full overflow-hidden rounded border border-gray-300 bg-white">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
          <button
            title="Add an input field that must be filled in each time this step is run."
            onClick={() => setFieldModalOpen(true)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            + Input Field
          </button>
          <button
            onClick={() => setRecipePickerOpen(true)}
            title={focusType !== "step" ? "Select a step first" : "Attach a recipe to the selected step"}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            + Recipe
          </button>

          <div className="mx-1 h-5 w-px bg-gray-300" />

          {/* Italic — onMouseDown prevents stealing focus from contentEditable */}
          <button
            title="Italic (Ctrl+I / Cmd+I)"
            onMouseDown={(e) => { e.preventDefault(); document.execCommand("italic"); }}
            className="inline-flex items-center justify-center rounded border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-50"
          >
            <Italic size={14} />
          </button>

          {/* Underline */}
          <button
            title="Underline (Ctrl+U / Cmd+U)"
            onMouseDown={(e) => { e.preventDefault(); document.execCommand("underline"); }}
            className="inline-flex items-center justify-center rounded border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-50"
          >
            <Underline size={14} />
          </button>

          <div className="mx-1 h-5 w-px bg-gray-300" />

          <button
            onClick={undo}
            disabled={history.past.length === 0}
            title="Undo (Ctrl+Z / Cmd+Z)"
            className="inline-flex items-center justify-center rounded border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={redo}
            disabled={history.future.length === 0}
            title="Redo (Ctrl+Shift+Z / Cmd+Shift+Z)"
            className="inline-flex items-center justify-center rounded border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-64 space-y-6 bg-white p-4">
          {data.sections.length === 0 && (
            <p className="text-sm text-gray-400">
              No sections yet — click &quot;Add Section&quot; in the sidebar to add one.
            </p>
          )}

          {data.sections.map((section, sectionIdx) => {
            const sectionColor = SECTION_COLORS[sectionIdx % SECTION_COLORS.length];
            const hasNoSteps   = section.steps.length === 0;

            return (
              <div key={section.id}>
                {/* Section title row — color bar + bold input */}
                <div className="flex items-stretch gap-2 mb-1">
                  <div
                    className="w-1.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: sectionColor }}
                  />
                  <input
                    ref={(el) => {
                      if (pendingFocusRef.current === section.id && el) {
                        el.focus(); el.select();
                        pendingFocusRef.current = null;
                      }
                    }}
                    value={section.title}
                    onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                    onFocus={() =>
                      setFocusCtx(
                        { sectionId: section.id, stepId: section.steps[0]?.id ?? "" },
                        "section"
                      )
                    }
                    onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                    placeholder="Section title"
                    className="flex-1 border-none bg-transparent text-sm font-bold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none"
                  />
                </div>

                {/* Section validation error */}
                {showSectionErrors && hasNoSteps && (
                  <p className="mb-1 ml-3.5 mt-0.5 text-xs text-red-500">
                    Each section must contain at least one step before saving.
                  </p>
                )}

                {/* Steps */}
                <div className="mt-1 space-y-0.5 pl-3">
                  {section.steps.length === 0 && !showSectionErrors && (
                    <p className="py-1 text-xs text-gray-400">
                      No steps — use &quot;Add Step&quot; in the sidebar.
                    </p>
                  )}

                  {section.steps.map((step) => {
                    const stepNum = numbers.get(step.id) ?? "";
                    return (
                      <div key={step.id} className="space-y-0.5">

                        {/* Step row */}
                        <div className="flex items-center gap-1.5 py-0.5">
                          <div
                            className="w-1.5 self-stretch shrink-0 rounded-sm"
                            style={{ backgroundColor: sectionColor }}
                          />
                          <span className="w-7 shrink-0 select-none text-right text-xs text-gray-400">
                            {stepNum}.
                          </span>
                          <StepTextInput
                            value={step.text}
                            focusId={step.id}
                            pendingFocusRef={pendingFocusRef}
                            onHtmlChange={(html) => updateStep(section.id, step.id, html)}
                            onKeyDown={(e) => handleStepKeyDown(e, section.id, step)}
                            onFocus={() =>
                              setFocusCtx({ sectionId: section.id, stepId: step.id }, "step")
                            }
                            placeholder="Step description"
                            className="flex-1 min-w-0 py-1 text-sm text-gray-900 focus:outline-none"
                          />
                        </div>

                        {/* Step fields */}
                        {step.fields.length > 0 && (
                          <div className="ml-10 flex flex-wrap gap-1 pb-0.5">
                            {step.fields.map((field) => (
                              <FieldPill key={field.id} field={field}
                                onRemove={() => removeField(section.id, step.id, field.id)} />
                            ))}
                          </div>
                        )}

                        {/* Recipe chips */}
                        <StepRecipeRow
                          recipeRefs={step.recipeRefs ?? []}
                          allRecipes={allRecipes}
                          onRemove={(id) => removeRecipeFromStep(section.id, step.id, id)}
                        />

                        {/* Sub-steps */}
                        {step.subSteps.map((ss) => {
                          const ssNum = numbers.get(ss.id) ?? "";
                          return (
                            <div key={ss.id} className="space-y-0.5">
                              {/* Sub-step row — extra left indent */}
                              <div className="flex items-center gap-1.5 py-0.5 pl-5">
                                <div
                                  className="w-1.5 self-stretch shrink-0 rounded-sm"
                                  style={{ backgroundColor: sectionColor }}
                                />
                                <span className="w-8 shrink-0 select-none text-right text-xs text-gray-400">
                                  {ssNum}.
                                </span>
                                <StepTextInput
                                  value={ss.text}
                                  focusId={ss.id}
                                  pendingFocusRef={pendingFocusRef}
                                  onHtmlChange={(html) =>
                                    updateSubStep(section.id, step.id, ss.id, html)
                                  }
                                  onKeyDown={(e) =>
                                    handleSubStepKeyDown(e, section.id, step.id, ss)
                                  }
                                  onFocus={() =>
                                    setFocusCtx(
                                      { sectionId: section.id, stepId: step.id, subStepId: ss.id },
                                      "substep"
                                    )
                                  }
                                  placeholder="Sub-step description"
                                  className="flex-1 min-w-0 py-1 text-sm text-gray-600 focus:outline-none"
                                />
                              </div>
                              {/* Sub-step fields */}
                              {ss.fields.length > 0 && (
                                <div className="ml-[68px] flex flex-wrap gap-1 pb-0.5">
                                  {ss.fields.map((field) => (
                                    <FieldPill key={field.id} field={field}
                                      onRemove={() => removeField(section.id, step.id, field.id, ss.id)} />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 border-b border-gray-100" />
              </div>
            );
          })}
        </div>

        {/* Modals */}
        {fieldModalOpen && (
          <InputFieldModal
            initialType={fieldModalInitialType}
            onClose={() => setFieldModalOpen(false)}
            onInsert={(field) => { addFieldToFocused(field); setFieldModalOpen(false); }}
          />
        )}
        {recipePickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onMouseDown={(e) => { if (e.target === e.currentTarget) setRecipePickerOpen(false); }}
          >
            <RecipePickerDropdown
              recipes={allRecipes}
              attachedIds={
                (() => {
                  const target = focusTargetRef.current;
                  if (!target) return [];
                  const section = data.sections.find((s) => s.id === target.sectionId);
                  const step = section?.steps.find((st) => st.id === target.stepId);
                  return step?.recipeRefs ?? [];
                })()
              }
              noStepFocused={focusTypeRef.current !== "step"}
              onPick={(id) => { addRecipeToFocused(id); setRecipePickerOpen(false); }}
              onClose={() => setRecipePickerOpen(false)}
            />
          </div>
        )}
      </div>
    );
  }
);

export default ProtocolStepsEditor;
