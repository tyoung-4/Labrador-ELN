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

// ─── Types ────────────────────────────────────────────────────────────────────

export type FieldKind = "measurement" | "component" | "timer";

export type RequiredField = {
  id: string;
  kind: FieldKind;
  label: string;
  unit: string;
  timerSeconds?: number;
  timerMode?: "countdown" | "countup" | "longrange";
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

const ENTRY_TYPE_OPTIONS = [
  { label: "Undefined", defaultUnit: "" },
  { label: "Mass",        defaultUnit: "g" },
  { label: "Volume",      defaultUnit: "mL" },
  { label: "Concentration", defaultUnit: "mM" },
  { label: "Cell Count",  defaultUnit: "cells" },
  { label: "Temperature", defaultUnit: "deg C" },
  { label: "pH",          defaultUnit: "pH" },
  { label: "Time",        defaultUnit: "min" },
];

const UNIT_OPTIONS = [
  "g","mg","ug","mL","uL","L","mM","uM","nM","cells","%","min","hr","deg C","pH",
];

const RECIPE_ITEMS = [
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
      <span className="font-medium">{field.label}</span>
      {field.unit ? <span className="opacity-70">{field.unit}</span> : null}
      {field.timerMode === "countdown" && field.timerSeconds != null && (
        <span className="opacity-60">
          {Math.floor(field.timerSeconds / 60)}m{field.timerSeconds % 60}s
        </span>
      )}
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

function RequiredFieldModal({
  initialType,
  onClose,
  onInsert,
}: {
  initialType?: string;
  onClose: () => void;
  onInsert: (field: RequiredField) => void;
}) {
  const init = ENTRY_TYPE_OPTIONS.find((o) => o.label === initialType) ?? ENTRY_TYPE_OPTIONS[0];
  const [fieldType, setFieldType] = useState(init.label);
  const [fieldUnit, setFieldUnit] = useState(init.defaultUnit);
  const [fieldLabel, setFieldLabel] = useState("");

  function doInsert() {
    onInsert({ id: uid(), kind: "measurement", label: fieldLabel.trim() || fieldType, unit: fieldUnit });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Insert Required Field</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Field Type</label>
            <select
              value={fieldType}
              onChange={(e) => {
                const v = e.target.value;
                setFieldType(v);
                const opt = ENTRY_TYPE_OPTIONS.find((o) => o.label === v);
                if (opt) setFieldUnit(opt.defaultUnit);
              }}
              className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
            >
              {ENTRY_TYPE_OPTIONS.map((o) => (
                <option key={o.label} value={o.label}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Custom Label <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              autoFocus
              value={fieldLabel}
              onChange={(e) => setFieldLabel(e.target.value)}
              placeholder="e.g. Bead slurry volume"
              className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doInsert(); } }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
            <select
              value={fieldUnit}
              onChange={(e) => setFieldUnit(e.target.value)}
              disabled={fieldType === "Undefined"}
              className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
            >
              <option value="">No unit</option>
              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
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

type TimerMode = "countdown" | "countup" | "longrange";

function RecipesModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (field: RequiredField) => void;
}) {
  const [step, setStep] = useState<"pick" | "configure">("pick");
  const [chosen, setChosen] = useState<(typeof RECIPE_ITEMS)[number] | null>(null);
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [timerLabel, setTimerLabel] = useState("Step Timer");
  const [timerMode, setTimerMode] = useState<TimerMode>("countdown");
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(0);

  function pickItem(item: (typeof RECIPE_ITEMS)[number]) {
    setChosen(item);
    if (item.entryType !== "Timer") {
      const opt = ENTRY_TYPE_OPTIONS.find((o) => o.label === item.entryType);
      setUnit(opt?.defaultUnit ?? "");
      setLabel("");
    } else {
      setTimerLabel("Step Timer");
      setTimerMode("countdown");
      setTimerMinutes(5);
      setTimerSeconds(0);
    }
    setStep("configure");
  }

  function doInsert() {
    if (!chosen) return;
    if (chosen.entryType === "Timer") {
      const totalSec = timerMinutes * 60 + timerSeconds;
      onInsert({ id: uid(), kind: "timer", label: timerLabel.trim() || "Step Timer", unit: "",
        timerSeconds: timerMode === "countdown" ? Math.max(1, totalSec) : 0, timerMode });
    } else {
      onInsert({ id: uid(), kind: "component", label: label.trim() || chosen.label, unit });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded bg-white p-6 shadow-xl">
        {step === "pick" ? (
          <>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Insert Recipe</h3>
            <div className="grid grid-cols-2 gap-2">
              {RECIPE_ITEMS.map((item) => (
                <button key={item.label} onClick={() => pickItem(item)}
                  className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 transition-colors">
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">Cancel</button>
            </div>
          </>
        ) : (
          <>
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Configure: {chosen?.label}</h3>
            {chosen?.entryType === "Timer" ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Timer Label</label>
                  <input autoFocus value={timerLabel} onChange={(e) => setTimerLabel(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Timer Type</label>
                  <select value={timerMode} onChange={(e) => setTimerMode(e.target.value as TimerMode)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900">
                    <option value="countdown">Countdown</option>
                    <option value="countup">Count Up</option>
                    <option value="longrange">Long-range</option>
                  </select>
                </div>
                <div className={`grid grid-cols-2 gap-3 ${timerMode !== "countdown" ? "opacity-50" : ""}`}>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Minutes</label>
                    <input type="number" min="0" value={timerMinutes}
                      onChange={(e) => setTimerMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      disabled={timerMode !== "countdown"}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Seconds</label>
                    <input type="number" min="0" max="59" value={timerSeconds}
                      onChange={(e) => setTimerSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                      disabled={timerMode !== "countdown"}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Custom Label <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)}
                    placeholder={`e.g. ${chosen?.label}`}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doInsert(); onClose(); } }} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)}
                    disabled={chosen?.entryType === "Undefined"}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900">
                    <option value="">No unit</option>
                    {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <button onClick={() => setStep("pick")} className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 text-sm">← Back</button>
              <div className="flex gap-2">
                <button onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={() => { doInsert(); onClose(); }} className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">Insert</button>
              </div>
            </div>
          </>
        )}
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
  openRequiredField: (entryType?: string) => void;
  openRecipes: () => void;
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
    const [recipesModalOpen, setRecipesModalOpen] = useState(false);

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
      openRequiredField(entryType?: string) {
        setFieldModalInitialType(entryType);
        setFieldModalOpen(true);
      },
      openRecipes() {
        setRecipesModalOpen(true);
      },
    }));

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <div className="w-full overflow-hidden rounded border border-gray-300 bg-white">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
          <button
            title="Required fields must be filled in each time this protocol is run."
            onClick={() => setFieldModalOpen(true)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            + Required Field
          </button>
          <button
            onClick={() => setRecipesModalOpen(true)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            + Recipes
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
          <RequiredFieldModal
            initialType={fieldModalInitialType}
            onClose={() => setFieldModalOpen(false)}
            onInsert={(field) => { addFieldToFocused(field); setFieldModalOpen(false); }}
          />
        )}
        {recipesModalOpen && (
          <RecipesModal
            onClose={() => setRecipesModalOpen(false)}
            onInsert={(field) => { addFieldToFocused(field); setRecipesModalOpen(false); }}
          />
        )}
      </div>
    );
  }
);

export default ProtocolStepsEditor;
