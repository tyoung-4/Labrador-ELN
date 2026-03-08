"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppTopNav from "@/components/AppTopNav";
import { getCurrentUser } from "@/components/AppTopNav";
import type { ProtocolRun } from "@/models/protocolRun";

type ViewMode = "active" | "history";

function StatusBadge({ status }: { status: string }) {
  if (status === "IN_PROGRESS")
    return <span className="rounded bg-indigo-700 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-100">IN PROGRESS</span>;
  if (status === "COMPLETED")
    return <span className="rounded bg-emerald-800 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">COMPLETED</span>;
  return <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">{status}</span>;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end: string | null | undefined): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function RunsPage() {
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

  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [runs, setRuns] = useState<ProtocolRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/protocol-runs", { headers: authHeaders });
        if (!res.ok) return;
        const data = (await res.json()) as ProtocolRun[];
        if (!cancelled) setRuns(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authHeaders]);

  // Re-fetch when user changes (storage event)
  useEffect(() => {
    function onStorage() { window.location.reload(); }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs
      .filter((r) => {
        const match = viewMode === "active" ? r.status === "IN_PROGRESS" : r.status !== "IN_PROGRESS";
        const search =
          !q ||
          r.title.toLowerCase().includes(q) ||
          (r.sourceEntry?.title ?? "").toLowerCase().includes(q) ||
          (r.operatorName ?? "").toLowerCase().includes(q) ||
          (r.runner?.name ?? "").toLowerCase().includes(q);
        return match && search;
      })
      .sort((a, b) =>
        viewMode === "active"
          ? a.createdAt.localeCompare(b.createdAt) // oldest first for active (urgency)
          : b.createdAt.localeCompare(a.createdAt) // newest first for history
      );
  }, [runs, viewMode, query]);

  const activeCount = useMemo(() => runs.filter((r) => r.status === "IN_PROGRESS").length, [runs]);

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Protocol Runs</h1>
          {activeCount > 0 && (
            <p className="text-sm text-zinc-400">
              {activeCount} active run{activeCount !== 1 ? "s" : ""} in progress
            </p>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("active")}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
              viewMode === "active"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            ▶ Active Runs
            {activeCount > 0 && (
              <span className="ml-1.5 rounded-full bg-indigo-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
              viewMode === "history"
                ? "bg-zinc-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            Run History
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={viewMode === "active" ? "Search active runs…" : "Search run history…"}
          className="w-full max-w-sm rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading runs…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-sm text-zinc-400">
            {viewMode === "active"
              ? "No active runs. Start a run from a Protocol entry."
              : "No completed runs found."}
          </p>
          <Link
            href="/protocols"
            className="mt-3 inline-block text-sm text-indigo-400 underline hover:text-indigo-300"
          >
            Go to Protocols →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((run) => (
            <li key={run.id}>
              <Link
                href={`/runs/${run.id}`}
                className="block rounded border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-600 hover:bg-zinc-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-zinc-100">{run.title}</h2>
                      <StatusBadge status={run.status} />
                    </div>
                    <p className="text-xs text-zinc-400">
                      Protocol: {run.sourceEntry?.title ?? run.sourceEntryId}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {run.operatorName || run.runner?.name
                        ? `Operator: ${run.operatorName || run.runner?.name}`
                        : null}
                      {(run.operatorName || run.runner?.name) ? " · " : ""}
                      Started: {formatDate(run.createdAt)}
                      {run.status === "COMPLETED" && run.completedAt
                        ? ` · Duration: ${formatDuration(run.createdAt, run.completedAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {run.status === "COMPLETED" && (
                      <Link
                        href={`/runs/${run.id}/summary`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                      >
                        Summary
                      </Link>
                    )}
                    <span className="text-xs text-indigo-400">
                      {run.status === "IN_PROGRESS" ? "Continue →" : "View →"}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
