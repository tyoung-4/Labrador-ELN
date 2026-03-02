"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ProtocolRun } from "@/models/protocolRun";
import RunLockedView from "@/components/RunLockedView";
import AppTopNav from "@/components/AppTopNav";

type CurrentUser = {
  id: string;
  name: string;
  role: "ADMIN" | "MEMBER";
};

type InteractionState = {
  stepCompletion: Record<string, boolean>;
  components: Record<string, boolean>;
  componentAmounts: Record<string, string>;
  entryFields: Record<string, string>;
  timers: Record<string, { total: number; remaining: number; running: boolean; locked: boolean }>;
};

type UtilityTimerState = {
  total: number;
  remaining: number;
  running: boolean;
  locked: boolean;
};

type PersistedRunState = InteractionState & {
  __ui?: {
    utilityTimer?: UtilityTimerState;
    utilityMinutes?: number;
    utilitySeconds?: number;
  };
};

type ViewMode = "active" | "history";
type RunSortBy = "newest" | "oldest" | "technique" | "author";

type CompletionCheck = {
  missingSteps: string[];
  missingComponents: string[];
  missingFields: string[];
};

const FINN_USER: CurrentUser = {
  id: "finn-user",
  name: "Finn",
  role: "MEMBER",
};

const JAKE_USER: CurrentUser = {
  id: "jake-user",
  name: "Jake",
  role: "MEMBER",
};

const ADMIN_USER: CurrentUser = {
  id: "admin-user",
  name: "Admin",
  role: "ADMIN",
};

const EMPTY_INTERACTION: InteractionState = {
  stepCompletion: {},
  components: {},
  componentAmounts: {},
  entryFields: {},
  timers: {},
};

const DEFAULT_UTILITY: UtilityTimerState = {
  total: 300,
  remaining: 300,
  running: false,
  locked: false,
};

function parsePersistedState(raw: string): { interaction: InteractionState; utilityTimer: UtilityTimerState; utilityMinutes: number; utilitySeconds: number } {
  try {
    const parsed = JSON.parse(raw || "{}") as PersistedRunState;
    // Timers are not persisted — always start fresh from defaults
    return {
      interaction: {
        stepCompletion: parsed.stepCompletion ?? {},
        components: parsed.components ?? {},
        componentAmounts: parsed.componentAmounts ?? {},
        entryFields: parsed.entryFields ?? {},
        timers: parsed.timers ?? {},
      },
      utilityTimer: DEFAULT_UTILITY,
      utilityMinutes: 5,
      utilitySeconds: 0,
    };
  } catch {
    return {
      interaction: EMPTY_INTERACTION,
      utilityTimer: DEFAULT_UTILITY,
      utilityMinutes: 5,
      utilitySeconds: 0,
    };
  }
}

function serializePersistedState(interaction: InteractionState): string {
  // Timers are session-only and not persisted; only interaction state is saved
  return JSON.stringify(interaction);
}

function toAutoSaveSignature(interaction: InteractionState): string {
  const timers = Object.fromEntries(
    Object.entries(interaction.timers).map(([key, value]) => [
      key,
      {
        total: value.total,
        running: value.running,
        locked: value.locked,
      },
    ])
  );

  return JSON.stringify({
    stepCompletion: interaction.stepCompletion,
    components: interaction.components,
    componentAmounts: interaction.componentAmounts,
    entryFields: interaction.entryFields,
    timers,
  });
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function parseRunCompletion(runBody: string, interaction: InteractionState): CompletionCheck {
  if (typeof window === "undefined") {
    return { missingSteps: [], missingComponents: [], missingFields: [] };
  }

  const doc = new DOMParser().parseFromString(runBody || "", "text/html");

  const stepNodes = Array.from(doc.querySelectorAll("li[data-type='taskItem']"));
  const componentNodes = Array.from(doc.querySelectorAll("span[data-entry-node='component']"));
  const fieldNodes = Array.from(doc.querySelectorAll("span[data-entry-node='measurement']"));

  const missingSteps: string[] = [];
  const missingComponents: string[] = [];
  const missingFields: string[] = [];

  for (let i = 0; i < stepNodes.length; i += 1) {
    if (interaction.stepCompletion[`step-${i}`]) continue;
    const rawText = (stepNodes[i].textContent || "").replace(/\s+/g, " ").trim();
    const preview = (rawText.slice(0, 10) || "(blank)").trim();
    missingSteps.push(`Step ${i + 1}: ${preview}...`);
  }

  for (let i = 0; i < componentNodes.length; i += 1) {
    const componentKey = `component-${i}`;
    const checked = Boolean(interaction.components[componentKey]);
    const amount = (interaction.componentAmounts[componentKey] ?? "").trim();
    if (checked && amount.length > 0) continue;
    const label = (componentNodes[i].getAttribute("label") || `Component ${i + 1}`).trim();
    missingComponents.push(label);
  }

  for (let i = 0; i < fieldNodes.length; i += 1) {
    const fieldValue = (interaction.entryFields[`field-${i}`] ?? "").trim();
    if (fieldValue) continue;
    const label = (fieldNodes[i].getAttribute("label") || `Entry Field ${i + 1}`).trim();
    missingFields.push(label);
  }

  return {
    missingSteps,
    missingComponents,
    missingFields,
  };
}

function RunsPageContent() {
  const searchParams = useSearchParams();
  const initialRunId = searchParams.get("runId");

  const [currentUser, setCurrentUser] = useState<CurrentUser>(FINN_USER);
  const [runs, setRuns] = useState<ProtocolRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRunId);
  const [viewMode, setViewMode] = useState<ViewMode>(initialRunId ? "active" : "history");
  const [loading, setLoading] = useState(false);
  const [manualSaveLoading, setManualSaveLoading] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showNotesPopup, setShowNotesPopup] = useState(false);
  const [showUtilityPopup, setShowUtilityPopup] = useState(false);

  const [interactionState, setInteractionState] = useState<InteractionState>(EMPTY_INTERACTION);
  const [notes, setNotes] = useState("");
  const [utilityMinutes, setUtilityMinutes] = useState(5);
  const [utilitySeconds, setUtilitySeconds] = useState(0);
  const [utilityTimer, setUtilityTimer] = useState<UtilityTimerState>(DEFAULT_UTILITY);
  const [savedUtilitySnapshot, setSavedUtilitySnapshot] = useState<{
    utilityTimer: UtilityTimerState;
    utilityMinutes: number;
    utilitySeconds: number;
  }>({
    utilityTimer: DEFAULT_UTILITY,
    utilityMinutes: 5,
    utilitySeconds: 0,
  });

  const [runQuery, setRunQuery] = useState("");
  const [runTechniqueFilter, setRunTechniqueFilter] = useState("ALL");
  const [runAuthorFilter, setRunAuthorFilter] = useState("ALL");
  const [runSortBy, setRunSortBy] = useState<RunSortBy>("newest");

  const lastAutoSavedSignatureRef = useRef<string>("");
  const lastLoadedRunIdRef = useRef<string | null>(null);

  const authHeaders = useMemo(
    () => ({
      "x-user-id": currentUser.id,
      "x-user-name": currentUser.name,
      "x-user-role": currentUser.role,
    }),
    [currentUser]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      setLoading(true);
      try {
        const res = await fetch("/api/protocol-runs", { headers: authHeaders });
        if (!res.ok) {
          const text = await res.text().catch(() => "<no body>");
          console.error("Failed to load protocol runs:", res.status, text);
          if (!cancelled) setRuns([]);
          return;
        }

        const data = (await res.json()) as ProtocolRun[];
        if (cancelled) return;

        setRuns(data);

        if (data.length === 0) {
          setSelectedRunId(null);
          setInteractionState(EMPTY_INTERACTION);
          setNotes("");
          return;
        }

        setSelectedRunId((prev) => {
          if (prev && data.some((run) => run.id === prev)) return prev;
          if (initialRunId && data.some((run) => run.id === initialRunId)) return initialRunId;
          return data[0].id;
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRuns();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, initialRunId]);

  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId) || null, [runs, selectedRunId]);

  useEffect(() => {
    if (!selectedRun) return;
    if (lastLoadedRunIdRef.current === selectedRun.id) return;

    const parsed = parsePersistedState(selectedRun.interactionState || "{}");
    setInteractionState(parsed.interaction);
    setNotes(selectedRun.notes || "");
    setUtilityMinutes(parsed.utilityMinutes);
    setUtilitySeconds(parsed.utilitySeconds);
    setUtilityTimer(parsed.utilityTimer);
    setSavedUtilitySnapshot({
      utilityTimer: parsed.utilityTimer,
      utilityMinutes: parsed.utilityMinutes,
      utilitySeconds: parsed.utilitySeconds,
    });
    lastAutoSavedSignatureRef.current = toAutoSaveSignature(parsed.interaction);
    lastLoadedRunIdRef.current = selectedRun.id;
  }, [selectedRun]);

  useEffect(() => {
    if (!utilityTimer.running || utilityTimer.locked) return;
    const id = window.setInterval(() => {
      setUtilityTimer((prev) => {
        const next = Math.max(0, prev.remaining - 1);
        return {
          ...prev,
          remaining: next,
          running: next > 0,
        };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [utilityTimer.running, utilityTimer.locked]);

  const filteredAndSortedRuns = useMemo(() => {
    const query = runQuery.trim().toLowerCase();

    const filtered = runs.filter((run) => {
      const technique = run.sourceEntry?.technique || "General";
      const protocolAuthor = run.sourceEntry?.author?.name || "Unknown";
      const haystack = `${run.title} ${run.sourceEntry?.title || ""} ${run.status} ${run.runner?.name || ""} ${technique} ${protocolAuthor}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesTechnique = runTechniqueFilter === "ALL" || technique === runTechniqueFilter;
      const matchesAuthor = runAuthorFilter === "ALL" || protocolAuthor === runAuthorFilter;
      return matchesQuery && matchesTechnique && matchesAuthor;
    });

    filtered.sort((a, b) => {
      if (runSortBy === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (runSortBy === "technique") return (a.sourceEntry?.technique || "General").localeCompare(b.sourceEntry?.technique || "General");
      if (runSortBy === "author") {
        return (a.sourceEntry?.author?.name || "Unknown").localeCompare(b.sourceEntry?.author?.name || "Unknown");
      }
      return b.createdAt.localeCompare(a.createdAt);
    });

    return filtered;
  }, [runs, runQuery, runTechniqueFilter, runAuthorFilter, runSortBy]);

  const activeRuns = useMemo(
    () => filteredAndSortedRuns.filter((run) => run.status === "IN_PROGRESS"),
    [filteredAndSortedRuns]
  );

  const historyRuns = useMemo(() => filteredAndSortedRuns, [filteredAndSortedRuns]);

  const techniqueOptions = useMemo(() => {
    return Array.from(new Set(runs.map((run) => run.sourceEntry?.technique || "General"))).sort((a, b) => a.localeCompare(b));
  }, [runs]);

  const authorOptions = useMemo(() => {
    return Array.from(new Set(runs.map((run) => run.sourceEntry?.author?.name || "Unknown"))).sort((a, b) => a.localeCompare(b));
  }, [runs]);

  useEffect(() => {
    if (viewMode !== "active") return;
    if (activeRuns.length === 0) return;
    if (selectedRun && selectedRun.status === "IN_PROGRESS") return;
    setSelectedRunId(activeRuns[0].id);
  }, [viewMode, activeRuns, selectedRun]);

  async function handleSelectRun(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/protocol-runs/${id}`, { headers: authHeaders });
      if (!res.ok) {
        const text = await res.text().catch(() => "<no body>");
        console.error("Failed to load protocol run:", res.status, text);
        return;
      }

      const run = (await res.json()) as ProtocolRun;
      setRuns((prev) => prev.map((item) => (item.id === run.id ? run : item)));
      setSelectedRunId(run.id);
      setSaveError(null);
    } finally {
      setLoading(false);
    }
  }

  async function updateRun(id: string, payload: Partial<Pick<ProtocolRun, "status" | "notes" | "interactionState">>) {
    const res = await fetch(`/api/protocol-runs/${id}`, {
      method: "PUT",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let detail = "";
    if (!res.ok) {
      try {
        const parsed = await res.json();
        detail = parsed?.error || parsed?.detail || "";
      } catch {
        detail = await res.text().catch(() => "<no body>");
      }
      const err = new Error(detail || `Save failed (${res.status})`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }

    return (await res.json()) as ProtocolRun;
  }

  useEffect(() => {
    if (!selectedRun || selectedRun.status !== "IN_PROGRESS" || viewMode !== "active") return;

    const signature = toAutoSaveSignature(interactionState);
    if (signature === lastAutoSavedSignatureRef.current) return;

    const timeout = window.setTimeout(async () => {
      try {
        setAutoSaveState("saving");
        const updated = await updateRun(selectedRun.id, {
          interactionState: serializePersistedState(interactionState),
        });
        setRuns((prev) => prev.map((run) => (run.id === updated.id ? updated : run)));
        lastAutoSavedSignatureRef.current = signature;
        setAutoSaveState("saved");
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : undefined;
        const runLocked = status === 409 || /already ended and is locked/i.test(message);

        if (runLocked) {
          setRuns((prev) =>
            prev.map((run) =>
              run.id === selectedRun.id
                ? {
                    ...run,
                    status: "COMPLETED",
                  }
                : run
            )
          );
          setAutoSaveState("idle");
          return;
        }

        console.error("Auto-save failed:", error);
        setAutoSaveState("error");
      }
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [selectedRun, interactionState, viewMode, savedUtilitySnapshot]);

  async function handleManualSave() {
    if (!selectedRun) return;

    setManualSaveLoading(true);
    try {
      const updated = await updateRun(selectedRun.id, {
        notes,
        interactionState: serializePersistedState(interactionState),
      });
      setRuns((prev) => prev.map((run) => (run.id === updated.id ? updated : run)));
      setSavedUtilitySnapshot({
        utilityTimer,
        utilityMinutes,
        utilitySeconds,
      });
      setSaveError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save notes and utility timer.";
      setSaveError(message);
    } finally {
      setManualSaveLoading(false);
    }
  }

  async function handleEndRun() {
    if (!selectedRun || selectedRun.status !== "IN_PROGRESS") return;

    const completion = parseRunCompletion(selectedRun.runBody, interactionState);
    if (completion.missingSteps.length > 0 || completion.missingComponents.length > 0 || completion.missingFields.length > 0) {
      const lines: string[] = [];
      if (completion.missingSteps.length > 0) {
        lines.push("Incomplete steps:");
        lines.push(...completion.missingSteps.map((item) => `- ${item}`));
      }
      if (completion.missingComponents.length > 0) {
        lines.push("Incomplete components:");
        lines.push(...completion.missingComponents.map((item) => `- ${item}`));
      }
      if (completion.missingFields.length > 0) {
        lines.push("Incomplete entry fields:");
        lines.push(...completion.missingFields.map((item) => `- ${item}`));
      }

      const proceedWithIncomplete = window.confirm(
        `Not all steps are completed - would you like to proceed anyways?\n\n${lines.join("\n")}\n\nTimers are ignored for completion checks.`
      );
      if (!proceedWithIncomplete) return;
    }

    const confirmed = window.confirm(
      `End Run: ${selectedRun.title}?\n\nWarning: once data is submitted, it cannot be changed and will be timestamped to prevent tampering with raw data.`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const updated = await updateRun(selectedRun.id, {
        status: "COMPLETED",
        notes,
        interactionState: serializePersistedState(interactionState),
      });
      setRuns((prev) => prev.map((run) => (run.id === updated.id ? updated : run)));
      setSelectedRunId(updated.id);
      setViewMode("history");
      setSaveError(null);
      window.alert(`Run ended and locked at ${new Date(updated.updatedAt).toLocaleString()}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to end run.";
      setSaveError(message);
    } finally {
      setLoading(false);
    }
  }

  function applyUtilityDuration(minutes: number, seconds: number) {
    const safeMinutes = Math.max(0, minutes);
    const safeSeconds = Math.min(59, Math.max(0, seconds));
    const total = safeMinutes * 60 + safeSeconds;
    setUtilityMinutes(safeMinutes);
    setUtilitySeconds(safeSeconds);
    setUtilityTimer({
      total: Math.max(1, total),
      remaining: Math.max(1, total),
      running: false,
      locked: false,
    });
  }

  return (
    <div className="flex min-h-screen flex-col gap-5 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("active")}
            className={`rounded px-3 py-1.5 text-sm ${viewMode === "active" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}
          >
            Active Run
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`rounded px-3 py-1.5 text-sm ${viewMode === "history" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}
          >
            Run History
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>
            User: <span className="font-semibold text-zinc-100">{currentUser.name}</span>
          </span>
          <select
            value={currentUser.id}
            onChange={(e) => {
              const next = e.target.value === "admin-user" ? ADMIN_USER : e.target.value === "jake-user" ? JAKE_USER : FINN_USER;
              setCurrentUser(next);
              setSelectedRunId(null);
              setSaveError(null);
            }}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="finn-user">Login as Finn</option>
            <option value="jake-user">Login as Jake</option>
            <option value="admin-user">Login as Admin</option>
          </select>
        </div>
      </div>

      {viewMode === "history" && (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={runQuery}
              onChange={(e) => setRunQuery(e.target.value)}
              placeholder="Search runs"
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500"
            />
            <select
              value={runTechniqueFilter}
              onChange={(e) => setRunTechniqueFilter(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
            >
              <option value="ALL">All techniques</option>
              {techniqueOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={runAuthorFilter}
              onChange={(e) => setRunAuthorFilter(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
            >
              <option value="ALL">All authors</option>
              {authorOptions.map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
            </select>
            <select
              value={runSortBy}
              onChange={(e) => setRunSortBy(e.target.value as RunSortBy)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="technique">Sort: Technique</option>
              <option value="author">Sort: Author</option>
            </select>
          </div>
        </div>
      )}

      {viewMode === "active" ? (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_240px]">
          <aside className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Active Runs</h2>
            <ul className="space-y-2">
              {activeRuns.map((run) => (
                <li key={run.id}>
                  <button
                    onClick={() => handleSelectRun(run.id)}
                    className={`w-full rounded border px-3 py-2 text-left ${selectedRun?.id === run.id ? "border-indigo-500 bg-indigo-500/20" : "border-zinc-700 bg-zinc-800"}`}
                  >
                    <p className="text-sm font-semibold text-zinc-100">{run.title}</p>
                    <p className="text-xs text-zinc-400">{run.sourceEntry?.title || run.sourceEntryId}</p>
                    <p className="text-[11px] text-zinc-500">{run.sourceEntry?.technique || "General"} • {run.sourceEntry?.author?.name || "Unknown"}</p>
                  </button>
                </li>
              ))}
              {activeRuns.length === 0 && <li className="text-sm text-zinc-400">No active runs found.</li>}
            </ul>
          </aside>

          <main className="space-y-4">
            {selectedRun ? (
              <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">{selectedRun.title}</h2>
                    <p className="text-xs text-zinc-400">Running from: {selectedRun.sourceEntry?.title || selectedRun.sourceEntryId}</p>
                    <p className="text-[11px] text-zinc-500">{selectedRun.sourceEntry?.technique || "General"} • {selectedRun.sourceEntry?.author?.name || "Unknown"}</p>
                  </div>
                  <div className="text-right text-xs text-zinc-400">
                    <p>
                      Auto-save: {autoSaveState === "saving" ? "Saving..." : autoSaveState === "saved" ? "Saved" : autoSaveState === "error" ? "Failed" : "Idle"}
                    </p>
                    <p>Protocol interactions auto-save after 5s.</p>
                  </div>
                </div>

                <RunLockedView
                  runBody={selectedRun.runBody}
                  initialInteractionState={selectedRun.interactionState || "{}"}
                  onChange={setInteractionState}
                />

                <div className="mt-5 border-t border-zinc-800 pt-4">
                  <button
                    onClick={handleEndRun}
                    disabled={loading || selectedRun.status !== "IN_PROGRESS"}
                    className="w-full rounded bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    End Run
                  </button>
                  <p className="mt-2 text-xs text-zinc-500">Ending a run permanently locks it and timestamps submission.</p>
                </div>
              </div>
            ) : (
              <div className="rounded border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Select an active run.</div>
            )}
          </main>

          <aside className="space-y-3">
            {selectedRun && (
              <>
                <button
                  onClick={() => setShowNotesPopup((prev) => !prev)}
                  className={`w-full rounded border px-3 py-2 text-left text-sm font-semibold ${
                    showNotesPopup ? "border-indigo-500 bg-indigo-500/20 text-indigo-100" : "border-zinc-700 bg-zinc-900 text-zinc-200"
                  }`}
                >
                  {showNotesPopup ? "Hide Notes" : "Open Notes"}
                </button>
                {showNotesPopup && (
                  <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-zinc-100">
                      Notes — {selectedRun.title}
                    </h3>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={10}
                      placeholder="Run-specific notes…"
                      className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
                    />
                  </div>
                )}
              </>
            )}

            <button
              onClick={() => setShowUtilityPopup((prev) => !prev)}
              className={`w-full rounded border px-3 py-2 text-left text-sm font-semibold ${
                showUtilityPopup ? "border-emerald-500 bg-emerald-500/20 text-emerald-100" : "border-zinc-700 bg-zinc-900 text-zinc-200"
              }`}
            >
              {showUtilityPopup ? "Hide Utility Timer" : "Open Utility Timer"}
            </button>
            {showUtilityPopup && (
              <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
                <h3 className="mb-2 text-sm font-semibold text-zinc-100">Utility Timer</h3>
                <p className="mb-3 text-xs text-zinc-400">Standalone timer for this run (outside protocol steps).</p>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">Minutes</label>
                    <input
                      type="number"
                      min="0"
                      value={utilityMinutes}
                      onChange={(e) => applyUtilityDuration(parseInt(e.target.value || "0", 10), utilitySeconds)}
                      className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">Seconds</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={utilitySeconds}
                      onChange={(e) => applyUtilityDuration(utilityMinutes, parseInt(e.target.value || "0", 10))}
                      className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="min-w-[70px] rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-center font-mono text-sm text-zinc-100">
                    {formatDuration(utilityTimer.remaining)}
                  </span>
                  <button
                    onClick={() => setUtilityTimer((prev) => (prev.locked ? prev : { ...prev, running: !prev.running }))}
                    disabled={utilityTimer.locked}
                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 disabled:opacity-40"
                  >
                    {utilityTimer.running ? "Pause" : "Start"}
                  </button>
                  <button
                    onClick={() =>
                      setUtilityTimer((prev) => (prev.locked ? prev : { ...prev, running: false, remaining: prev.total }))
                    }
                    disabled={utilityTimer.locked}
                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 disabled:opacity-40"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setUtilityTimer((prev) => ({ ...prev, running: false, locked: !prev.locked }))}
                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                  >
                    {utilityTimer.locked ? "Unlock" : "Lock"}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleManualSave}
              disabled={manualSaveLoading || !selectedRun}
              className="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Save Run Progress
            </button>
            <p className="text-[11px] text-zinc-500">Manual save persists run notes. Timers are session-only.</p>
          </aside>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <h2 className="mb-2 text-lg font-semibold text-zinc-100">Run History</h2>
            <ul className="space-y-2">
              {historyRuns.map((run) => (
                <li key={run.id}>
                  <button
                    onClick={() => handleSelectRun(run.id)}
                    className={`w-full rounded border px-3 py-2 text-left ${selectedRun?.id === run.id ? "border-emerald-500 bg-emerald-500/20" : "border-zinc-700 bg-zinc-800"}`}
                  >
                    <p className="text-sm font-semibold text-zinc-100">{run.title}</p>
                    <p className="text-xs text-zinc-400">{run.sourceEntry?.title || run.sourceEntryId}</p>
                    <p className="text-[11px] text-zinc-500">{run.sourceEntry?.technique || "General"} • {run.sourceEntry?.author?.name || "Unknown"}</p>
                    <p className="text-[11px] text-zinc-500">{run.status} • {new Date(run.createdAt).toLocaleString()}</p>
                  </button>
                </li>
              ))}
              {historyRuns.length === 0 && <li className="text-sm text-zinc-400">No run history matches this filter.</li>}
            </ul>
          </aside>

          <main>
            {selectedRun ? (
              <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
                <div className="mb-3">
                  <h2 className="text-lg font-semibold text-zinc-100">{selectedRun.title}</h2>
                  <p className="text-xs text-zinc-400">Locked history • Protocol: {selectedRun.sourceEntry?.title || selectedRun.sourceEntryId}</p>
                  <p className="text-[11px] text-zinc-500">{selectedRun.sourceEntry?.technique || "General"} • {selectedRun.sourceEntry?.author?.name || "Unknown"}</p>
                </div>

                <RunLockedView
                  runBody={selectedRun.runBody}
                  initialInteractionState={selectedRun.interactionState || "{}"}
                  readOnly={true}
                />

                <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Run Notes</p>
                  <p className="whitespace-pre-wrap text-sm text-zinc-300">{selectedRun.notes || "No notes captured for this run."}</p>
                  <p className="mt-2 text-xs text-zinc-500">Ended/Last updated: {new Date(selectedRun.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <div className="rounded border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">Select a historical run to view locked details.</div>
            )}
          </main>
        </div>
      )}

      {saveError && <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{saveError}</div>}
    </div>
  );
}

export default function RunsPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-zinc-600">Loading runs...</div>}>
      <RunsPageContent />
    </React.Suspense>
  );
}
