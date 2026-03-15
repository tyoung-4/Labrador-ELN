"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppTopNav from "@/components/AppTopNav";
import { getCurrentUser } from "@/components/AppTopNav";
import type { ProtocolRun, StepResult } from "@/models/protocolRun";
import TagInput from "@/components/tags/TagInput";

type ParsedStep = {
  id: string;
  label: string;
  sectionTitle?: string;
  isSubstep: boolean;
};

function stripHtml(html: string): string {
  if (typeof window !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }
  return html.replace(/<[^>]+>/g, "").trim();
}

function parseStepsFromBody(runBody: string): ParsedStep[] {
  const steps: ParsedStep[] = [];
  try {
    const parsed = JSON.parse(runBody) as {
      sections?: Array<{
        id: string;
        title: string;
        steps?: Array<{
          id: string;
          html: string;
          substeps?: Array<{ id: string; html: string }>;
        }>;
      }>;
    };
    if (parsed.sections && Array.isArray(parsed.sections)) {
      let idx = 0;
      for (const section of parsed.sections) {
        for (const step of section.steps ?? []) {
          steps.push({
            id: `step-${idx++}`,
            label: stripHtml(step.html || "") || `Step ${steps.length + 1}`,
            sectionTitle: section.title,
            isSubstep: false,
          });
          for (const sub of step.substeps ?? []) {
            steps.push({
              id: `step-${idx++}`,
              label: stripHtml(sub.html || "") || `Sub-step ${steps.length + 1}`,
              sectionTitle: section.title,
              isSubstep: true,
            });
          }
        }
      }
      return steps;
    }
  } catch {
    // fall through
  }

  // Legacy HTML
  if (typeof window !== "undefined") {
    const doc = new DOMParser().parseFromString(runBody || "", "text/html");
    const nodes = Array.from(doc.querySelectorAll("li[data-type='taskItem']"));
    nodes.forEach((node, idx) => {
      const contentDiv = node.querySelector("div") ?? node;
      steps.push({
        id: `step-${idx}`,
        label: (contentDiv.textContent || "").replace(/\s+/g, " ").trim() || `Step ${idx + 1}`,
        isSubstep: false,
      });
    });
  }
  return steps;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function ResultBadge({ result }: { result: string }) {
  if (result === "PASSED") return <span className="rounded bg-emerald-800 px-2 py-0.5 text-xs font-semibold text-emerald-200">PASS</span>;
  if (result === "FAILED") return <span className="rounded bg-red-800 px-2 py-0.5 text-xs font-semibold text-red-200">FAIL</span>;
  return <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-300">SKIP</span>;
}

export default function RunSummaryPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;

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
  const [runTagAssignments, setRunTagAssignments] = useState<NonNullable<ProtocolRun["tagAssignments"]>>([]);
  const [showTagNudge, setShowTagNudge] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [runRes, srRes] = await Promise.all([
          fetch(`/api/protocol-runs/${runId}`, { headers: authHeaders }),
          fetch(`/api/protocol-runs/${runId}/step-results`, { headers: authHeaders }),
        ]);
        if (!runRes.ok) { setError(`Failed to load run (${runRes.status}).`); return; }
        const runData = (await runRes.json()) as ProtocolRun;
        const srData: StepResult[] = srRes.ok ? ((await srRes.json()) as StepResult[]) : [];
        if (!cancelled) {
          setRun(runData);
          setStepResults(srData);
          const tags = runData.tagAssignments ?? [];
          setRunTagAssignments(tags);
          const hasProjectTag = tags.some((a) => a.tag.type === "PROJECT");
          setShowTagNudge(!hasProjectTag);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [runId, authHeaders]);

  const steps = useMemo<ParsedStep[]>(() => {
    if (!run) return [];
    return parseStepsFromBody(run.runBody);
  }, [run]);

  const resultMap = useMemo<Record<string, StepResult>>(() => {
    const m: Record<string, StepResult> = {};
    for (const r of stepResults) m[r.stepId] = r;
    return m;
  }, [stepResults]);

  const passed = stepResults.filter((r) => r.result === "PASSED").length;
  const failed = stepResults.filter((r) => r.result === "FAILED").length;
  const skipped = stepResults.filter((r) => r.result === "SKIPPED").length;
  const total = steps.length;

  const durationMs = run
    ? run.completedAt
      ? new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime()
      : Date.now() - new Date(run.createdAt).getTime()
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
        <AppTopNav />
        <p className="mt-10 text-center text-sm text-zinc-400">Loading summary…</p>
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/runs" className="hover:text-zinc-400">Active Runs</Link>
        <span>›</span>
        <Link href={`/runs/${runId}`} className="hover:text-zinc-400">{run.title}</Link>
        <span>›</span>
        <span className="text-zinc-300">Summary</span>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header card */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-100">{run.title}</h1>
            {run.status === "COMPLETED" && (
              <span className="rounded bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-emerald-100">COMPLETED</span>
            )}
          </div>
          <p className="text-sm text-zinc-400">Protocol: {run.sourceEntry?.title ?? run.sourceEntryId}</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-zinc-500">Operator: </span>
              <span className="text-zinc-200">{run.operatorName || run.runner?.name || "Unknown"}</span>
            </div>
            <div>
              <span className="text-zinc-500">Started: </span>
              <span className="text-zinc-200">{new Date(run.createdAt).toLocaleString()}</span>
            </div>
            {run.completedAt && (
              <div>
                <span className="text-zinc-500">Completed: </span>
                <span className="text-zinc-200">{new Date(run.completedAt).toLocaleString()}</span>
              </div>
            )}
            <div>
              <span className="text-zinc-500">Duration: </span>
              <span className="text-zinc-200">{formatDuration(durationMs)}</span>
            </div>
          </div>
        </div>

        {/* Summary counts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded border border-emerald-700/50 bg-emerald-900/20 p-4 text-center">
            <p className="text-3xl font-bold text-emerald-300">{passed}</p>
            <p className="text-xs text-zinc-400">Passed</p>
          </div>
          <div className="rounded border border-red-700/50 bg-red-900/20 p-4 text-center">
            <p className="text-3xl font-bold text-red-300">{failed}</p>
            <p className="text-xs text-zinc-400">Failed</p>
          </div>
          <div className="rounded border border-zinc-700 bg-zinc-800 p-4 text-center">
            <p className="text-3xl font-bold text-zinc-300">{skipped}</p>
            <p className="text-xs text-zinc-400">Skipped</p>
          </div>
        </div>

        {/* Step-by-step results */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">
            Step Results ({stepResults.length}/{total} recorded)
          </h2>
          <ul className="divide-y divide-zinc-800">
            {steps.map((step, idx) => {
              const r = resultMap[step.id];
              return (
                <li key={step.id} className="py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 min-w-[1.5rem] text-xs text-zinc-600">{idx + 1}.</span>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${step.isSubstep ? "pl-3 text-zinc-400" : "text-zinc-200"}`}>
                          {step.isSubstep && <span className="mr-1 text-zinc-600">↳</span>}
                          {step.label}
                        </p>
                        {r ? <ResultBadge result={r.result} /> : (
                          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600">—</span>
                        )}
                      </div>
                      {r && (
                        <div className="mt-1 space-y-1">
                          <p className="text-xs text-zinc-500">
                            {new Date(r.completedAt).toLocaleString()}
                          </p>
                          {r.notes && (
                            <p className="text-xs text-zinc-400 italic">Notes: {r.notes}</p>
                          )}
                          {r.fieldValues && r.fieldValues !== "{}" && (() => {
                            try {
                              const fields = JSON.parse(r.fieldValues) as Record<string, string>;
                              const entries = Object.entries(fields).filter(([, v]) => v);
                              if (entries.length === 0) return null;
                              return (
                                <div className="text-xs text-zinc-400">
                                  Fields: {entries.map(([k, v]) => `${k}: ${v}`).join(", ")}
                                </div>
                              );
                            } catch { return null; }
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Run notes */}
        {run.notes && (
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-2 text-sm font-semibold text-zinc-200">Run Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-zinc-400">{run.notes}</p>
          </div>
        )}

        {/* Tags */}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-sm font-semibold text-zinc-200">Tags</p>
          {showTagNudge && (
            <div className="mb-3 flex items-start gap-2 rounded border border-amber-500 bg-amber-500/20 p-3">
              <span className="shrink-0">⚠️</span>
              <span className="flex-1 text-sm text-amber-400">
                <strong className="font-semibold">No Project tag added</strong> — consider tagging this run with a Project tag to keep your work organised.
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
          <TagInput
            entityType="RUN"
            entityId={runId}
            currentUser={currentUser.name}
            entityOwner={run.runner?.name ?? "Admin"}
            existingAssignments={runTagAssignments}
            onAssignmentsChange={(updated) => {
              setRunTagAssignments(updated);
              const hasProject = updated.some((a) => a.tag.type === "PROJECT");
              if (hasProject) setShowTagNudge(false);
            }}
          />
        </div>

        {/* PDF export placeholder */}
        <div className="rounded border border-zinc-700 bg-zinc-800/50 p-4 text-center text-sm text-zinc-500">
          📄 PDF export — coming soon
        </div>

        {/* Back links */}
        <div className="flex gap-4 text-sm">
          <Link href={`/runs/${runId}`} className="text-indigo-400 hover:text-indigo-300">← Back to Run</Link>
          <Link href="/runs" className="text-zinc-400 hover:text-zinc-300">Active Runs list</Link>
        </div>
      </div>
    </div>
  );
}
