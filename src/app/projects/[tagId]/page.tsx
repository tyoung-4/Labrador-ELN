"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import AppTopNav, { getCurrentUser } from "@/components/AppTopNav";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  addedAt: string;
  user: { id: string; name: string | null };
}

interface TagDetail {
  id: string;
  name: string;
  color: string;
  createdBy: string;
  createdAt: string;
  description: string | null;
  startDate: string | null;
  members: Member[];
}

interface Run {
  id: string;
  title: string;
  runId: string;
  runner: { name: string };
  createdAt: string;
  completedAt: string | null;
  status: string;
  passCount: number;
  failCount: number;
  skipCount: number;
}

interface Protocol {
  id: string;
  title: string;
  version: string;
  author: string;
  updatedAt: string;
}

interface ProjectDetail {
  tag: TagDetail;
  runs: Run[];
  protocols: Protocol[];
  lastActivity: string | null;
}

interface SearchResults {
  runs: Array<{ id: string; title: string; runId: string; status: string; createdAt: string }>;
  protocols: Array<{ id: string; title: string; version: string; author: string }>;
  inventory: never[];
  knowledgeHub: never[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function formatRelativeDate(date: Date | string | null): string {
  if (!date) return "Never";
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 px-6 py-6">
      <div className="h-6 w-32 rounded bg-zinc-800" />
      <div className="h-8 w-64 rounded bg-zinc-800" />
      <div className="h-4 w-96 rounded bg-zinc-800" />
      <div className="mt-6 grid grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 rounded bg-zinc-800" />
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams();
  const tagId = params?.tagId as string;

  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentUser, setCurrentUser] = useState("Admin");

  const [activeTab, setActiveTab] = useState<"protocols" | "runs">("protocols");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);

  const tabsRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Current user from localStorage
  useEffect(() => {
    setCurrentUser(getCurrentUser().name);
    function onStorage() { setCurrentUser(getCurrentUser().name); }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Fetch project detail
  useEffect(() => {
    if (!tagId) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/projects/${tagId}`)
      .then(async (res) => {
        if (!cancelled) {
          if (res.status === 404) { setNotFound(true); return; }
          if (res.ok) setData(await res.json());
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tagId]);

  // Debounced search
  const doSearch = useMemo(() => (q: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (q.length < 2) { setSearchResults(null); return; }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/${tagId}/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch { /* silent */ }
    }, 300);
  }, [tagId]);

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    doSearch(q);
  }

  function handleTabSwitch(tab: "protocols" | "runs") {
    setActiveTab(tab);
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="p-6"><AppTopNav /></div>
        <div className="rounded-xl border border-white/10 bg-zinc-900 mx-6">
          <Skeleton />
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
        <AppTopNav />
        <div className="mt-12 text-center">
          <p className="mb-4 text-lg text-zinc-400">Project not found.</p>
          <a href="/projects" className="text-sm text-purple-400 hover:text-purple-300">
            ← Back to Projects
          </a>
        </div>
      </div>
    );
  }

  const { tag, runs, protocols, lastActivity } = data;
  const canEdit = currentUser === tag.createdBy || currentUser === "Admin";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="p-6 pb-0"><AppTopNav /></div>

      <div className="mx-6 mb-6 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">

        {/* ── Color bar ─────────────────────────────────────────────────────── */}
        <div className="h-2 w-full rounded-t-xl" style={{ backgroundColor: tag.color }} />

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="border-b border-white/10 px-6 py-5">
          {/* Row 1: back link + edit */}
          <div className="mb-3 flex items-center justify-between">
            <a
              href="/projects"
              className="text-sm text-gray-400 transition hover:text-white"
            >
              ← Projects
            </a>
            {canEdit && (
              <button
                disabled
                title="Edit Project — coming in next prompt"
                className="rounded border border-white/10 px-3 py-1 text-sm text-gray-400 hover:text-white transition cursor-not-allowed opacity-60"
              >
                Edit Project
              </button>
            )}
          </div>

          {/* Row 2: project name */}
          <h1 className="mb-1 text-2xl font-bold text-white">{tag.name}</h1>

          {/* Row 3: description */}
          {tag.description && (
            <p className="mb-4 text-sm text-gray-400">{tag.description}</p>
          )}

          {/* Row 4: metadata grid */}
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-gray-500">Owner</span>
              <span className="text-white">{tag.createdBy}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-gray-500">Last Activity</span>
              <span className="text-white">{formatRelativeDate(lastActivity)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-gray-500">Started</span>
              <span className="text-white">
                {formatDate(tag.startDate ?? tag.createdAt)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-gray-500">Members</span>
              <div className="flex flex-wrap items-center gap-1">
                {tag.members.length > 0 ? (
                  tag.members.map((m) => (
                    <span
                      key={m.id}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white"
                    >
                      {m.user.name ?? "Unknown"}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500 text-xs">—</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-gray-500">Runs</span>
              <span className="text-white">{runs.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-gray-500">Protocols</span>
              <span className="text-white">{protocols.length}</span>
            </div>
          </div>
        </div>

        {/* ── Fetch bar ─────────────────────────────────────────────────────── */}
        <div className="border-b border-white/10 px-6 py-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">🔍</span>
            <input
              type="text"
              placeholder={`Fetch within ${tag.name}…`}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-9 text-sm text-white placeholder-gray-500 focus:border-white/30 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setSearchResults(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {searchResults && searchQuery.length >= 2 && (
            <div className="mt-3 divide-y divide-white/5 rounded-lg border border-white/10 bg-white/5">
              {searchResults.protocols.length > 0 && (
                <div className="p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Protocols</p>
                  {searchResults.protocols.map((p) => (
                    <div
                      key={p.id}
                      className="flex cursor-pointer items-center justify-between rounded px-2 py-1 hover:bg-white/5"
                      onClick={() => { window.location.href = "/protocols"; }}
                    >
                      <span className="text-sm text-white">{p.title}</span>
                      <span className="text-xs text-gray-500">{p.version}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.runs.length > 0 && (
                <div className="p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Runs</p>
                  {searchResults.runs.map((r) => (
                    <div
                      key={r.id}
                      className="flex cursor-pointer items-center justify-between rounded px-2 py-1 hover:bg-white/5"
                      onClick={() => { window.location.href = `/runs/${r.id}`; }}
                    >
                      <span className="text-sm text-white">{r.title}</span>
                      <span className="font-mono text-xs text-gray-500">{r.runId}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.protocols.length === 0 && searchResults.runs.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  No results found for &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Mini home boxes ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 border-b border-white/10 px-6 py-4">
          {/* Protocols & Runs */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h3 className="mb-3 text-sm font-semibold" style={{ color: tag.color }}>
              Protocols &amp; Runs
            </h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleTabSwitch("protocols")}
                className="rounded px-2 py-1 text-left text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
              >
                List ({protocols.length})
              </button>
              <button
                onClick={() => handleTabSwitch("runs")}
                className="rounded px-2 py-1 text-left text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
              >
                Run History ({runs.length})
              </button>
            </div>
          </div>

          {/* Inventory — coming soon */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 opacity-50">
            <h3 className="mb-3 text-sm font-semibold text-gray-400">Inventory</h3>
            <p className="text-xs text-gray-600">Coming soon</p>
          </div>

          {/* Knowledge Hub — coming soon */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 opacity-50">
            <h3 className="mb-3 text-sm font-semibold text-gray-400">Knowledge Hub</h3>
            <p className="text-xs text-gray-600">Coming soon</p>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div ref={tabsRef} className="flex border-b border-white/10 px-6">
          <button
            onClick={() => setActiveTab("protocols")}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "protocols"
                ? "border-purple-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Protocols ({protocols.length})
          </button>
          <button
            onClick={() => setActiveTab("runs")}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "runs"
                ? "border-purple-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Runs ({runs.length})
          </button>
        </div>

        {/* ── Protocols tab ─────────────────────────────────────────────────── */}
        {activeTab === "protocols" && (
          <div className="px-6 py-4">
            {protocols.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No protocols tagged with this project yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-2 py-2">Protocol</th>
                    <th className="px-2 py-2">Version</th>
                    <th className="px-2 py-2">Author</th>
                    <th className="px-2 py-2">Last Modified</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {protocols.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-b border-white/5 hover:bg-white/5 ${
                        i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-2 py-2 font-medium text-white">{p.title}</td>
                      <td className="px-2 py-2">
                        <span className="rounded bg-green-900/50 px-2 py-0.5 text-xs text-green-400">
                          {p.version}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-gray-400">{p.author}</td>
                      <td className="px-2 py-2 text-gray-400">{formatRelativeDate(p.updatedAt)}</td>
                      <td className="px-2 py-2">
                        <a
                          href="/protocols"
                          className="text-xs text-gray-400 transition hover:text-white"
                        >
                          Open →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Runs tab ──────────────────────────────────────────────────────── */}
        {activeTab === "runs" && (
          <div className="px-6 py-4">
            {runs.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No runs tagged with this project yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-2 py-2">Run ID</th>
                    <th className="px-2 py-2">Protocol</th>
                    <th className="px-2 py-2">Operator</th>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Results</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-b border-white/5 hover:bg-white/5 ${
                        i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-2 py-2 font-mono text-xs text-gray-300">{r.runId}</td>
                      <td className="px-2 py-2 text-white">{r.title}</td>
                      <td className="px-2 py-2 text-gray-400">{r.runner?.name ?? "—"}</td>
                      <td className="px-2 py-2 text-gray-400">{formatDate(r.createdAt)}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            r.status === "COMPLETED"
                              ? "bg-green-900/50 text-green-400"
                              : "bg-amber-900/50 text-amber-400"
                          }`}
                        >
                          {r.status === "COMPLETED" ? "Completed" : "In Progress"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span className="text-xs text-green-400">✓{r.passCount}</span>{" "}
                        <span className="text-xs text-red-400">✗{r.failCount}</span>{" "}
                        <span className="text-xs text-gray-400">→{r.skipCount}</span>
                      </td>
                      <td className="px-2 py-2">
                        <a
                          href={`/runs/${r.id}`}
                          className="text-xs text-gray-400 transition hover:text-white"
                        >
                          Open →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
