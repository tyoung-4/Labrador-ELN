"use client";

import React, { useEffect, useMemo, useState } from "react";
import AppTopNav, { getCurrentUser } from "@/components/AppTopNav";
import NewProjectForm from "@/components/projects/NewProjectForm";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ProjectMember = {
  user: { id: string; name: string | null };
};

type ProjectSummary = {
  id: string;
  name: string;
  color: string;
  createdBy: string;
  createdAt: string;
  description: string | null;
  startDate: string | null;
  members: ProjectMember[];
  runCount: number;
  protocolCount: number;
  lastActivity: string | null;
};

type UntaggedCounts = {
  runCount: number;
  protocolCount: number;
};

type SortOption = "lastActivity" | "name" | "created" | "runs";

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(date: Date | string | null | undefined): string {
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
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-lg border border-white/10 bg-white/5"
        >
          <div className="h-1.5 bg-zinc-700" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-3/4 rounded bg-zinc-700" />
            <div className="h-3 w-full rounded bg-zinc-700" />
            <div className="h-3 w-2/3 rounded bg-zinc-700" />
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-16 rounded bg-zinc-700" />
              <div className="h-5 w-20 rounded bg-zinc-700" />
              <div className="h-5 w-28 rounded bg-zinc-700" />
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

function ProjectCard({ tag }: { tag: ProjectSummary }) {
  return (
    <a
      href={`/projects/${tag.id}`}
      className="group block overflow-hidden rounded-lg border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10"
    >
      {/* Color bar — 6px tall */}
      <div style={{ backgroundColor: tag.color, height: "6px" }} />

      {/* Card body */}
      <div className="p-4">
        {/* Row 1: project name + PROJECT pill */}
        <div className="mb-1 flex items-start justify-between gap-2">
          <span className="text-base font-semibold leading-tight text-white">
            {tag.name}
          </span>
          <span
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{
              backgroundColor: tag.color + "40",
              border: `1px solid ${tag.color}`,
            }}
          >
            PROJECT
          </span>
        </div>

        {/* Row 2: description — max 2 lines */}
        {tag.description && (
          <p className="mb-3 line-clamp-2 text-xs text-gray-400">
            {tag.description}
          </p>
        )}

        {/* Row 3: owner + members */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Owner:</span>
          <span className="text-xs text-gray-300">{tag.createdBy}</span>
          {tag.members.length > 1 && (
            <>
              <span className="text-xs text-gray-600">·</span>
              <span className="text-xs text-gray-500">
                {tag.members.length} member{tag.members.length !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>

        {/* Row 4: stat chips */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-gray-300">
            {tag.runCount} run{tag.runCount !== 1 ? "s" : ""}
          </span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-gray-300">
            {tag.protocolCount} protocol{tag.protocolCount !== 1 ? "s" : ""}
          </span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-gray-400">
            {tag.lastActivity
              ? `Active ${formatRelativeDate(tag.lastActivity)}`
              : "No activity yet"}
          </span>
        </div>

        {/* Row 5: started date + open link */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">
            Started {formatDate(tag.startDate ?? tag.createdAt)}
          </span>
          <span className="text-xs text-gray-400 transition-colors group-hover:text-white">
            Open Project →
          </span>
        </div>
      </div>
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Untagged section — scoped to current user
// ─────────────────────────────────────────────────────────────────────────────

function UntaggedSection({
  untagged,
  setShowNewProjectForm,
}: {
  untagged: UntaggedCounts;
  setShowNewProjectForm: (v: boolean) => void;
}) {
  const hasUntagged = untagged.runCount > 0 || untagged.protocolCount > 0;

  if (hasUntagged) {
    return (
      <div className="mt-8 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-amber-400">
          ⚠️ Your Untagged Items
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          These items belong to you but have no Project tag. Adding a Project
          tag helps keep your work organized.
        </p>
        <div className="flex flex-wrap gap-6">
          {untagged.runCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-amber-400">
                {untagged.runCount}
              </span>
              <span className="text-sm text-gray-400">
                run{untagged.runCount !== 1 ? "s" : ""} without a Project tag
              </span>
              <a
                href="/runs?filter=untagged"
                className="ml-1 text-sm text-amber-400 hover:underline"
              >
                View →
              </a>
            </div>
          )}
          {untagged.protocolCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-amber-400">
                {untagged.protocolCount}
              </span>
              <span className="text-sm text-gray-400">
                protocol{untagged.protocolCount !== 1 ? "s" : ""} without a Project tag
              </span>
              <a
                href="/protocols?filter=untagged"
                className="ml-1 text-sm text-amber-400 hover:underline"
              >
                View →
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
      <p className="text-xs text-green-400">
        ✓ All your runs and protocols have a Project tag.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [untagged, setUntagged] = useState<UntaggedCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("lastActivity");
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);

  // Current user (from localStorage via AppTopNav helper)
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser().name);
  useEffect(() => {
    setCurrentUser(getCurrentUser().name);
    function onStorage() {
      setCurrentUser(getCurrentUser().name);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Load project list + user-scoped untagged counts
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects?currentUser=${encodeURIComponent(currentUser)}`
        );
        if (!cancelled && res.ok) {
          const data = (await res.json()) as {
            projects: ProjectSummary[];
            untagged: UntaggedCounts;
          };
          setProjects(data.projects);
          setUntagged(data.untagged);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // Sorted project list
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "created":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "runs":
          return b.runCount - a.runCount;
        case "lastActivity":
        default:
          if (!a.lastActivity && !b.lastActivity) return 0;
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return (
            new Date(b.lastActivity).getTime() -
            new Date(a.lastActivity).getTime()
          );
      }
    });
  }, [projects, sortBy]);

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-zinc-400">
            Organize your runs and protocols by project
          </p>
        </div>
        <button
          onClick={() => setShowNewProjectForm(true)}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          + New Project
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonCards />
      ) : projects.length === 0 ? (
        /* ── Empty state ─────────────────────────────────────────────────── */
        <div className="py-20 text-center">
          <div className="mb-4 text-5xl">📁</div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            No projects yet
          </h2>
          <p className="mx-auto mb-6 max-w-sm text-sm text-gray-400">
            Create your first project to start organizing your protocols, runs,
            and data in one place.
          </p>
          <button
            onClick={() => setShowNewProjectForm(true)}
            className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            + Create First Project
          </button>
        </div>
      ) : (
        <>
          {/* ── Sort controls ──────────────────────────────────────────────── */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded border border-white/10 bg-white/5 px-3 py-1 text-sm text-gray-300 focus:outline-none"
            >
              <option value="lastActivity">Sort: Last Activity</option>
              <option value="name">Sort: Name A–Z</option>
              <option value="created">Sort: Date Created</option>
              <option value="runs">Sort: Most Runs</option>
            </select>
          </div>

          {/* ── Card grid ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedProjects.map((tag) => (
              <ProjectCard key={tag.id} tag={tag} />
            ))}
          </div>

          {/* ── Untagged section ───────────────────────────────────────────── */}
          {untagged && (
            <UntaggedSection
              untagged={untagged}
              setShowNewProjectForm={setShowNewProjectForm}
            />
          )}
        </>
      )}

      {/* New Project modal */}
      {showNewProjectForm && (
        <NewProjectForm
          currentUser={currentUser}
          onSuccess={(newTag) => {
            setShowNewProjectForm(false);
            // Optimistically prepend the new project card
            setProjects((prev) => [
              {
                id: newTag.id,
                name: newTag.name,
                color: newTag.color,
                createdBy: newTag.createdBy,
                createdAt: newTag.createdAt,
                description: newTag.description ?? null,
                startDate: newTag.startDate ?? null,
                members: [],
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
