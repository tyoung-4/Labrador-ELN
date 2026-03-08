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

  const activeStep = steps[activeStepIdx] ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
        <AppTopNav />
        <p className="mt-10 text-center text-sm text-zinc-400">Loading run…</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
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
    <div className="flex min-h-screen flex-col bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/runs" className="text-xs text-zinc-500 hover:text-zinc-400">
              ← Active Runs
            </Link>
            {run.status === "COMPLETED" && (
              <span className="rounded bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-emerald-100">COMPLETED</span>
            )}
            {run.status === "IN_PROGRESS" && (
              <span className="rounded bg-indigo-700 px-2 py-0.5 text-xs font-semibold text-indigo-100">IN PROGRESS</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-zinc-100">{run.title}</h1>
          <p className="text-sm text-zinc-400">
            {run.sourceEntry?.title ?? run.sourceEntryId}
            {run.operatorName ? ` · Operator: ${run.operatorName}` : run.runner?.name ? ` · ${run.runner.name}` : ""}
          </p>
          <p className="text-xs text-zinc-500">
            Started {new Date(run.createdAt).toLocaleString()}
            {run.completedAt ? ` · Completed ${new Date(run.completedAt).toLocaleString()}` : ""}
          </p>
        </div>

        {isRunComplete && (
          <Link
            href={`/runs/${runId}/summary`}
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            View Summary →
          </Link>
        )}
      </div>

      {/* Completion banner */}
      {showCompleteBanner && (
        <div className="mb-4 flex items-center justify-between rounded border border-emerald-500 bg-emerald-500/20 px-4 py-3">
          <span className="font-semibold text-emerald-200">🎉 All steps resolved — run completed and locked!</span>
          <Link
            href={`/runs/${runId}/summary`}
            className="ml-4 rounded bg-emerald-700 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            View Summary
          </Link>
        </div>
      )}

      {/* Progress dog */}
      <ProgressDog progress={progress} />

      {steps.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-400">
          No steps found in this protocol run. The protocol body may be empty.
        </div>
      ) : (
        <div className="grid flex-1 gap-5 lg:grid-cols-[1fr_320px]">
          {/* ── Main panel ─────────────────────────────────────────────────── */}
          <main className="space-y-4">
            {isRunComplete ? (
              <div className="rounded border border-emerald-700/50 bg-emerald-900/20 p-6 text-center">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-lg font-semibold text-emerald-300">Run Complete</p>
                <p className="mt-1 text-sm text-zinc-400">All {steps.length} steps have been resolved.</p>
                <Link
                  href={`/runs/${runId}/summary`}
                  className="mt-4 inline-block rounded bg-emerald-700 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  View Run Summary →
                </Link>
              </div>
            ) : activeStep ? (
              <div className="rounded border border-zinc-800 bg-zinc-900 p-5">
                {/* Step counter + section label */}
                <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                  <span>Step {activeStepIdx + 1} of {steps.length}</span>
                  {activeStep.sectionTitle && (
                    <>
                      <span>·</span>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5">{activeStep.sectionTitle}</span>
                    </>
                  )}
                  {activeStep.isSubstep && (
                    <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-zinc-400">sub-step</span>
                  )}
                </div>

                {/* Step content */}
                <div
                  className="prose prose-invert max-w-none text-lg leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: activeStep.html || `<p>${activeStep.label}</p>` }}
                />

                {/* Required fields */}
                {activeStep.requiredFields.length > 0 && (
                  <div className="mt-5 space-y-3 rounded border border-blue-700/40 bg-blue-900/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">Required Fields</p>
                    {activeStep.requiredFields.map((field) => (
                      <div key={field.key} className="flex items-center gap-3">
                        <label className="min-w-[120px] text-sm text-zinc-300">{field.label}</label>
                        <input
                          type="text"
                          value={(pendingFields[activeStep.id] ?? {})[field.key] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPendingFields((prev) => ({
                              ...prev,
                              [activeStep.id]: { ...(prev[activeStep.id] ?? {}), [field.key]: val },
                            }));
                          }}
                          placeholder="Enter value…"
                          className="flex-1 rounded border border-blue-700 bg-blue-900/40 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes for this step */}
                <div className="mt-4">
                  <label className="mb-1 block text-xs text-zinc-500">Step notes (optional)</label>
                  <textarea
                    rows={2}
                    value={pendingNotes[activeStep.id] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPendingNotes((prev) => ({ ...prev, [activeStep.id]: val }));
                    }}
                    placeholder="Add notes for this step…"
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                {/* Already resolved? show badge */}
                {resultMap[activeStep.id] && (
                  <div className="mt-3 flex items-center gap-2">
                    <ResultBadge result={resultMap[activeStep.id].result} />
                    <span className="text-xs text-zinc-500">
                      Recorded {new Date(resultMap[activeStep.id].completedAt).toLocaleTimeString()}
                    </span>
                    <span className="text-xs text-zinc-500">(click Pass/Fail/Skip to override)</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleResult(activeStep, "PASSED")}
                    disabled={submitting}
                    className="flex-1 rounded border border-emerald-600 bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    ✓ Pass
                  </button>
                  <button
                    onClick={() => handleResult(activeStep, "FAILED")}
                    disabled={submitting}
                    className="flex-1 rounded border border-red-600 bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    ✗ Fail
                  </button>
                  <button
                    onClick={() => handleResult(activeStep, "SKIPPED")}
                    disabled={submitting}
                    className="flex-1 rounded border border-zinc-600 bg-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-600 disabled:opacity-50"
                  >
                    → Skip
                  </button>
                </div>
              </div>
            ) : null}

            {/* Run notes (global) */}
            {!isRunComplete && (
              <RunNotes runId={runId} initialNotes={run.notes} authHeaders={authHeaders} />
            )}
          </main>

          {/* ── Sidebar: step list ──────────────────────────────────────────── */}
          <aside className="space-y-3">
            <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
              <h2 className="mb-3 text-sm font-semibold text-zinc-200">
                Steps ({resolvedCount}/{steps.length})
              </h2>
              <ul className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
                {steps.map((step, idx) => {
                  const resolved = resultMap[step.id];
                  const isActive = idx === activeStepIdx && !isRunComplete;
                  const isFuture = !resolved && idx > activeStepIdx && !isRunComplete;

                  return (
                    <li key={step.id}>
                      <button
                        onClick={() => {
                          if (!isFuture || isRunComplete) {
                            setActiveStepIdx(idx);
                            persistActiveStep(idx);
                          }
                        }}
                        disabled={false}
                        className={[
                          "w-full rounded border px-2.5 py-2 text-left text-xs transition",
                          isActive
                            ? "border-indigo-500 bg-indigo-500/20 text-indigo-100"
                            : resolved
                            ? "border-zinc-700 bg-zinc-800/50 text-zinc-400"
                            : isFuture
                            ? "border-zinc-800 bg-zinc-900 text-zinc-600"
                            : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`flex-1 leading-snug ${step.isSubstep ? "pl-2" : ""}`}>
                            {step.isSubstep && <span className="mr-1 text-zinc-600">↳</span>}
                            <span className="mr-1 text-zinc-600">{idx + 1}.</span>
                            {step.label.length > 60 ? step.label.slice(0, 57) + "…" : step.label}
                          </span>
                          {resolved ? (
                            <ResultBadge result={resolved.result} small />
                          ) : isFuture ? (
                            <span className="text-zinc-700">🔒</span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Run notes (sidebar compact view when complete) */}
            {isRunComplete && run.notes && (
              <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Run Notes</p>
                <p className="whitespace-pre-wrap text-xs text-zinc-400">{run.notes}</p>
              </div>
            )}
          </aside>
        </div>
      )}
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
