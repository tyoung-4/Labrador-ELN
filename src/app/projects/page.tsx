"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppTopNav, { getCurrentUser } from "@/components/AppTopNav";
import NewProjectForm from "@/components/projects/NewProjectForm";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ProjectSummary = {
  id: string;
  name: string;
  color: string;
  createdBy: string;
  createdAt: string;
  runCount: number;
  protocolCount: number;
  lastActivity: string | null;
};

type ProjectRun = {
  id: string;
  title: string;
  runId: string;
  operator: string;
  createdAt: string;
  completedAt: string | null;
  status: string;
  passCount: number;
  failCount: number;
  skipCount: number;
};

type ProjectProtocol = {
  id: string;
  title: string;
  version: string;
  author: string;
  updatedAt: string;
};

type ProjectDetail = {
  tag: { id: string; name: string; color: string; createdBy: string; createdAt: string };
  runs: ProjectRun[];
  protocols: ProjectProtocol[];
};

type UntaggedCounts = {
  untaggedRunCount: number;
  untaggedProtocolCount: number;
};

type SortDir = "asc" | "desc";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const w = Math.floor(d / 7);
  const mo = Math.floor(d / 30);
  const y = Math.floor(d / 365);
  if (s < 60) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  if (w < 4) return `${w}w ago`;
  if (mo < 12) return `${mo}mo ago`;
  return `${y}y ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-lg border border-white/10 bg-white/5"
        >
          <div className="h-1 bg-zinc-700" />
          <div className="space-y-3 p-5">
            <div className="h-5 w-3/4 rounded bg-zinc-700" />
            <div className="h-3 w-1/2 rounded bg-zinc-700" />
            <div className="h-3 w-2/3 rounded bg-zinc-700" />
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-16 rounded-full bg-zinc-700" />
              <div className="h-5 w-20 rounded-full bg-zinc-700" />
              <div className="h-5 w-28 rounded-full bg-zinc-700" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Project card
// ─────────────────────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onClick,
}: {
  project: ProjectSummary;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-white/5 transition hover:border-white/20 hover:bg-white/10"
    >
      {/* Color bar */}
      <div className="h-1 w-full" style={{ backgroundColor: project.color }} />

      {/* Body */}
      <div className="p-5">
        {/* Row 1 — name + tag pill */}
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-white">{project.name}</h2>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: hexToRgba(project.color, 0.2),
              border: `1px solid ${project.color}`,
              color: project.color,
            }}
          >
            {project.name}
          </span>
        </div>

        {/* Row 2 — created by + relative date */}
        <p className="mb-3 text-xs text-zinc-500">
          Created by {project.createdBy} · {relativeDate(project.createdAt)}
        </p>

        {/* Row 3 — stat chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {project.runCount} run{project.runCount !== 1 ? "s" : ""}
          </span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {project.protocolCount} protocol{project.protocolCount !== 1 ? "s" : ""}
          </span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {project.lastActivity ? `Active ${relativeDate(project.lastActivity)}` : "No activity yet"}
          </span>
        </div>

        {/* Row 4 — view link */}
        <div className="flex justify-end">
          <span
            className="text-xs font-medium transition group-hover:brightness-125"
            style={{ color: project.color }}
          >
            View Project →
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "IN_PROGRESS")
    return (
      <span className="rounded bg-amber-700 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100">
        IN PROGRESS
      </span>
    );
  if (status === "COMPLETED")
    return (
      <span className="rounded bg-emerald-800 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
        COMPLETED
      </span>
    );
  return (
    <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort header helper
// ─────────────────────────────────────────────────────────────────────────────

function SortTh({
  col,
  label,
  sortCol,
  sortDir,
  onSort,
  className = "",
}: {
  col: string;
  label: string;
  sortCol: string;
  sortDir: SortDir;
  onSort: (col: string) => void;
  className?: string;
}) {
  const active = sortCol === col;
  return (
    <th
      className={`cursor-pointer select-none px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200 ${className}`}
      onClick={() => onSort(col)}
    >
      {label}
      <span className="ml-1 inline-block w-3 text-center">
        {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
      </span>
    </th>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Project detail view
// ─────────────────────────────────────────────────────────────────────────────

function ProjectDetailView({
  detail,
  loading,
  onBack,
}: {
  detail: ProjectDetail | null;
  loading: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"runs" | "protocols">("runs");
  const [filterOperator, setFilterOperator] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortCol, setSortCol] = useState("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Reset filters & sort when detail changes
  useEffect(() => {
    setActiveTab("runs");
    setFilterOperator("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSortCol("createdAt");
    setSortDir("desc");
  }, [detail?.tag.id]);

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  // All unique operators/authors for the dropdown
  const operatorOptions = useMemo(() => {
    if (!detail) return [];
    const set = new Set<string>();
    detail.runs.forEach((r) => r.operator && set.add(r.operator));
    detail.protocols.forEach((p) => p.author && set.add(p.author));
    return Array.from(set).sort();
  }, [detail]);

  // Filtered & sorted runs
  const filteredRuns = useMemo(() => {
    if (!detail) return [];
    let rows = detail.runs;
    if (filterOperator) rows = rows.filter((r) => r.operator === filterOperator);
    if (filterDateFrom) rows = rows.filter((r) => r.createdAt >= filterDateFrom);
    if (filterDateTo) rows = rows.filter((r) => r.createdAt <= filterDateTo + "T23:59:59Z");
    return [...rows].sort((a, b) => {
      let av = 0,
        bv = 0;
      if (sortCol === "runId") {
        const cmp = a.runId.localeCompare(b.runId);
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortCol === "title") {
        const cmp = a.title.localeCompare(b.title);
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortCol === "operator") {
        const cmp = a.operator.localeCompare(b.operator);
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortCol === "status") {
        const cmp = a.status.localeCompare(b.status);
        return sortDir === "asc" ? cmp : -cmp;
      }
      // Default: date
      av = new Date(a.createdAt).getTime();
      bv = new Date(b.createdAt).getTime();
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [detail, filterOperator, filterDateFrom, filterDateTo, sortCol, sortDir]);

  // Filtered & sorted protocols
  const filteredProtocols = useMemo(() => {
    if (!detail) return [];
    let rows = detail.protocols;
    if (filterOperator) rows = rows.filter((p) => p.author === filterOperator);
    if (filterDateFrom) rows = rows.filter((p) => p.updatedAt >= filterDateFrom);
    if (filterDateTo) rows = rows.filter((p) => p.updatedAt <= filterDateTo + "T23:59:59Z");
    return [...rows].sort((a, b) => {
      if (sortCol === "title") {
        const cmp = a.title.localeCompare(b.title);
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortCol === "author") {
        const cmp = a.author.localeCompare(b.author);
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortCol === "version") {
        const cmp = a.version.localeCompare(b.version);
        return sortDir === "asc" ? cmp : -cmp;
      }
      // Default: updatedAt
      const av = new Date(a.updatedAt).getTime();
      const bv = new Date(b.updatedAt).getTime();
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [detail, filterOperator, filterDateFrom, filterDateTo, sortCol, sortDir]);

  const hasFilters = filterOperator || filterDateFrom || filterDateTo;

  function clearFilters() {
    setFilterOperator("");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 rounded-lg bg-zinc-800" />
        <div className="h-10 w-64 rounded bg-zinc-800" />
        <div className="h-48 rounded-lg bg-zinc-800" />
      </div>
    );
  }

  if (!detail) return null;

  const { tag, runs, protocols } = detail;
  const color = tag.color;

  return (
    <div className="space-y-4">
      {/* Color header bar */}
      <div className="overflow-hidden rounded-lg" style={{ backgroundColor: color }}>
        <div className="px-6 py-4">
          <button
            onClick={onBack}
            className="mb-2 text-xs font-medium text-white/70 hover:text-white transition"
          >
            ← Back to Projects
          </button>
          <h2 className="text-xl font-bold text-white">{tag.name}</h2>
          <p className="mt-0.5 text-sm text-white/70">
            Created by {tag.createdBy} · {relativeDate(tag.createdAt)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => { setActiveTab("runs"); setSortCol("createdAt"); setSortDir("desc"); }}
          className={`rounded px-4 py-2 text-sm font-medium transition ${
            activeTab === "runs"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
        >
          Runs ({runs.length})
        </button>
        <button
          onClick={() => { setActiveTab("protocols"); setSortCol("updatedAt"); setSortDir("desc"); }}
          className={`rounded px-4 py-2 text-sm font-medium transition ${
            activeTab === "protocols"
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
        >
          Protocols ({protocols.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterOperator}
          onChange={(e) => setFilterOperator(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:border-zinc-500 focus:outline-none"
        >
          <option value="">All operators / authors</option>
          {operatorOptions.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:border-zinc-500 focus:outline-none"
          placeholder="From"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:border-zinc-500 focus:outline-none"
          placeholder="To"
        />
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results table */}
      {activeTab === "runs" ? (
        filteredRuns.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">
            {runs.length === 0
              ? "No runs tagged with this project yet."
              : "No runs match the current filters."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900">
                <tr>
                  <SortTh col="runId" label="Run ID" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-28" />
                  <SortTh col="title" label="Protocol" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="operator" label="Operator" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortTh col="createdAt" label="Date" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-28" />
                  <SortTh col="status" label="Status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-32" />
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 w-28">
                    P / F / S
                  </th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredRuns.map((run, idx) => (
                  <tr
                    key={run.id}
                    className={`transition hover:bg-white/10 ${idx % 2 === 0 ? "bg-white/5" : "bg-transparent"}`}
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs text-zinc-400">
                        {String(run.runId).slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-zinc-200">{truncate(run.title, 40)}</td>
                    <td className="px-3 py-2.5 text-zinc-400">{run.operator}</td>
                    <td className="px-3 py-2.5 text-zinc-400">{formatDate(run.createdAt)}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-emerald-400">{run.passCount}</span>
                      <span className="mx-1 text-zinc-600">/</span>
                      <span className="font-medium text-red-400">{run.failCount}</span>
                      <span className="mx-1 text-zinc-600">/</span>
                      <span className="font-medium text-zinc-400">{run.skipCount}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => router.push(`/runs/${run.id}`)}
                        className="rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
                        aria-label="Open run"
                        title="Go to run"
                      >
                        ↗
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : filteredProtocols.length === 0 ? (
        <p className="py-8 text-center text-zinc-500">
          {protocols.length === 0
            ? "No protocols tagged with this project yet."
            : "No protocols match the current filters."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900">
              <tr>
                <SortTh col="title" label="Protocol" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortTh col="version" label="Version" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-24" />
                <SortTh col="author" label="Author" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-36" />
                <SortTh col="updatedAt" label="Last Modified" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="w-36" />
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredProtocols.map((proto, idx) => (
                <tr
                  key={proto.id}
                  className={`transition hover:bg-white/10 ${idx % 2 === 0 ? "bg-white/5" : "bg-transparent"}`}
                >
                  <td className="px-3 py-2.5 text-zinc-200">{truncate(proto.title, 40)}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">
                      {proto.version}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-400">{proto.author}</td>
                  <td className="px-3 py-2.5 text-zinc-400">{relativeDate(proto.updatedAt)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => router.push("/protocols")}
                      className="rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
                      aria-label="Open protocol"
                      title="Go to protocols"
                    >
                      ↗
                    </button>
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

// ─────────────────────────────────────────────────────────────────────────────
// Untagged warning section
// ─────────────────────────────────────────────────────────────────────────────

function UntaggedSection({ counts }: { counts: UntaggedCounts }) {
  return (
    <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
        Untagged Items
      </h3>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-amber-400">{counts.untaggedRunCount}</span>
          <span className="text-sm text-zinc-400">runs without a Project tag</span>
          {counts.untaggedRunCount > 0 && (
            <a
              href="/runs?filter=untagged"
              className="ml-2 text-sm text-amber-400 hover:underline"
            >
              View →
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-amber-400">{counts.untaggedProtocolCount}</span>
          <span className="text-sm text-zinc-400">protocols without a Project tag</span>
          {counts.untaggedProtocolCount > 0 && (
            <a
              href="/protocols?filter=untagged"
              className="ml-2 text-sm text-amber-400 hover:underline"
            >
              View →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [untagged, setUntagged] = useState<UntaggedCounts | null>(null);

  // Current user (from localStorage via AppTopNav helper)
  const [currentUser, setCurrentUser] = useState("Admin");
  useEffect(() => {
    setCurrentUser(getCurrentUser().name);
    function onStorage() { setCurrentUser(getCurrentUser().name); }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // New project form
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);

  // Detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load project list + untagged counts on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [projRes, untaggedRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/projects/untagged"),
        ]);
        if (!cancelled) {
          if (projRes.ok) setProjects((await projRes.json()) as ProjectSummary[]);
          if (untaggedRes.ok) setUntagged((await untaggedRes.json()) as UntaggedCounts);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Load detail when a project is selected
  const selectProject = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) setDetail((await res.json()) as ProjectDetail);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function handleBack() {
    setSelectedId(null);
    setDetail(null);
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-zinc-400">Organize your runs and protocols by project</p>
        </div>
        <button
          onClick={() => setShowNewProjectForm(true)}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          + New Project
        </button>
      </div>

      {/* Detail view replaces card grid */}
      {selectedId ? (
        <ProjectDetailView
          detail={detail}
          loading={detailLoading}
          onBack={handleBack}
        />
      ) : (
        <>
          {/* Card grid */}
          {loading ? (
            <SkeletonCards />
          ) : projects.length === 0 ? (
            <div className="py-16 text-center text-zinc-500">
              <p className="mb-2 text-lg">No projects yet</p>
              <p className="text-sm">
                Add a Project tag to any protocol or run to see it here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => selectProject(project.id)}
                />
              ))}
            </div>
          )}

          {/* Untagged warning section */}
          {!loading && untagged && <UntaggedSection counts={untagged} />}
        </>
      )}

      {/* New Project modal */}
      {showNewProjectForm && (
        <NewProjectForm
          currentUser={currentUser}
          onSuccess={(newTag) => {
            setShowNewProjectForm(false);
            // Refresh project list to include new project
            setProjects((prev) => [
              {
                id: newTag.id,
                name: newTag.name,
                color: newTag.color,
                createdBy: newTag.createdBy,
                createdAt: newTag.createdAt,
                runCount: 0,
                protocolCount: 0,
                lastActivity: null,
              },
              ...prev,
            ]);
          }}
          onCancel={() => setShowNewProjectForm(false)}
        />
      )}
    </div>
  );
}
