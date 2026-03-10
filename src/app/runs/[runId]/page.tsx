"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppTopNav from "@/components/AppTopNav";
import { getCurrentUser } from "@/components/AppTopNav";
import type { ProtocolRun, StepResult } from "@/models/protocolRun";

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
};

type ResultKind = "PASSED" | "FAILED" | "SKIPPED";

// ─────────────────────────────────────────────────────────────────────────────
// Step parsing — handles both the new JSON (ProtocolStepsEditor) and legacy HTML
// ─────────────────────────────────────────────────────────────────────────────

function parseStepsFromBody(runBody: string): ParsedStep[] {
  const steps: ParsedStep[] = [];

  // Try new JSON format first (from ProtocolStepsEditor)
  try {
    const parsed = JSON.parse(runBody) as {
      version?: number;
      sections?: Array<{
        id: string;
        title: string;
        steps?: Array<{
          id: string;
          html: string;
          substeps?: Array<{ id: string; html: string; requiredFields?: Array<{ id: string; label: string }> }>;
          requiredFields?: Array<{ id: string; label: string }>;
        }>;
      }>;
    };

    if (parsed.sections && Array.isArray(parsed.sections)) {
      let globalIdx = 0;
      for (const section of parsed.sections) {
        for (const step of section.steps ?? []) {
          const stepId = `step-${globalIdx++}`;
          const label = stripHtml(step.html || "");
          steps.push({
            id: stepId,
            label: label || `Step ${steps.length + 1}`,
            html: step.html || "",
            sectionTitle: section.title,
            isSubstep: false,
            requiredFields: (step.requiredFields ?? []).map((f, fi) => ({
              key: `field-${globalIdx - 1}-${fi}`,
              label: f.label,
            })),
          });
          for (const sub of step.substeps ?? []) {
            const subId = `step-${globalIdx++}`;
            const subLabel = stripHtml(sub.html || "");
            steps.push({
              id: subId,
              label: subLabel || `Sub-step ${steps.length + 1}`,
              html: sub.html || "",
              sectionTitle: section.title,
              isSubstep: true,
              requiredFields: (sub.requiredFields ?? []).map((f, fi) => ({
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

        // Restore active step from interactionState
        try {
          const state = JSON.parse(runData.interactionState || "{}") as { currentStepIdx?: number };
          if (typeof state.currentStepIdx === "number") {
            setActiveStepIdx(state.currentStepIdx);
          }
        } catch {
          // ignore
        }

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

  // ── Persist active step index to interactionState ──────────────────────────
  const persistActiveStep = useCallback(
    async (idx: number) => {
      if (!run || run.status === "COMPLETED") return;
      try {
        const existing = JSON.parse(run.interactionState || "{}") as Record<string, unknown>;
        await fetch(`/api/protocol-runs/${runId}`, {
          method: "PUT",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ interactionState: JSON.stringify({ ...existing, currentStepIdx: idx }) }),
        });
      } catch {
        // non-critical — step position is best-effort
      }
    },
    [run, runId, authHeaders]
  );

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
        await completeRun();
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
      }
    } finally {
      setCompletingRun(false);
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  // Kept in scope for Prompts 3 & 4 — do not remove
  const activeStep = steps[activeStepIdx] ?? null;
  void activeStep; // referenced by handleResult indirectly via activeStepIdx

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

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-zinc-800 px-6 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Link href="/runs" className="text-xs text-zinc-500 hover:text-zinc-400">
                ← Active Runs
              </Link>
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

      {/* ── Completion banner ────────────────────────────────────────────── */}
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
        <div className="flex-1 overflow-y-auto border-r border-zinc-800 p-8">
          <p className="text-sm text-zinc-600">[Protocol scroll view — Prompt 3]</p>
        </div>

        {/* Right sidebar — fixed height, does not scroll with left panel */}
        <div className="w-80 shrink-0 overflow-hidden p-6">
          <p className="text-sm text-zinc-600">[Progress bar + actions — Prompt 4]</p>
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
// RunNotes — persisted run-level notes
// ─────────────────────────────────────────────────────────────────────────────

function RunNotes({
  runId,
  initialNotes,
  authHeaders,
}: {
  runId: string;
  initialNotes: string;
  authHeaders: Record<string, string>;
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
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
      <textarea
        rows={4}
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
        placeholder="General notes for this run…"
        className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
      />
    </div>
  );
}
