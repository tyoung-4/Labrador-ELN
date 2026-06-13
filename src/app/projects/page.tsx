"use client";

import React, { useEffect, useMemo, useState } from "react";
import AppTopNav, { getCurrentUser } from "@/components/AppTopNav";
import NewProjectForm from "@/components/projects/NewProjectForm";
import NewTagForm from "@/components/projects/NewTagForm";

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
  owner: string | null;
  isGeneral: boolean;
  isPrivate: boolean;
  privateMembers: string[];
  pinnedBy: string[];
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

function ProjectCard({
  tag,
  isPinned,
  onTogglePin,
}: {
  tag: ProjectSummary;
  isPinned: boolean;
  onTogglePin: (tag: ProjectSummary) => void;
}) {
  return (
    <a
      href={`/projects/${tag.id}`}
      className="group block overflow-hidden rounded-lg border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10"
    >
      {/* Color bar — 6px tall */}
      <div style={{ backgroundColor: tag.color, height: "6px" }} />

      {/* Card body */}
      <div className="p-4">
        {/* Row 1: project name + badges */}
        <div className="mb-1 flex items-start justify-between gap-2">
          <span className="text-base font-semibold leading-tight text-white">
            {tag.name}
          </span>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {tag.isPrivate && (
              <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                🔒 Private
              </span>
            )}
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{
                backgroundColor: tag.color + "40",
                border: `1px solid ${tag.color}`,
              }}
            >
              {tag.isGeneral ? "GENERAL" : "PROJECT"}
            </span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(tag); }}
              title={isPinned ? "Unpin" : "Pin"}
              aria-label={isPinned ? "Unpin project" : "Pin project"}
              className={`rounded px-1.5 py-0.5 text-xs transition ${
                isPinned ? "text-amber-300 hover:text-amber-200" : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              📌
            </button>
          </div>
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
          <span className="text-xs text-gray-300">
            {tag.isGeneral ? "General" : tag.owner ?? tag.createdBy}
          </span>
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
  const [showNewTagForm,     setShowNewTagForm]     = useState(false);
  const [listTab,            setListTab]            = useState<"MY" | "ALL">("MY");

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

  // "My Projects" = projects I own (owner/createdBy), am a private member of, or
  // a regular member of. The General project (no owner) shows under All only.
  const visibleProjects = useMemo(() => {
    if (listTab === "ALL") return sortedProjects;
    const me = currentUser.trim().toLowerCase();
    if (!me) return [];
    return sortedProjects.filter((p) => {
      if (p.isGeneral) return false;
      return (
        (p.owner ?? "").toLowerCase() === me ||
        p.createdBy.toLowerCase() === me ||
        p.privateMembers.some((m) => m.toLowerCase() === me) ||
        p.members.some((m) => (m.user.name ?? "").toLowerCase() === me)
      );
    });
  }, [sortedProjects, listTab, currentUser]);

  // Per-operator pin state, split into pinned / unpinned for the two sections.
  const meKey = currentUser.trim().toLowerCase();
  const isPinned = (p: ProjectSummary) => p.pinnedBy.some((o) => o.toLowerCase() === meKey);
  const pinnedProjects = useMemo(() => visibleProjects.filter(isPinned), [visibleProjects, meKey]);
  const unpinnedProjects = useMemo(() => visibleProjects.filter((p) => !isPinned(p)), [visibleProjects, meKey]);

  async function handleTogglePin(tag: ProjectSummary) {
    const pinned = isPinned(tag);
    // Optimistic update of local pinnedBy
    setProjects((prev) =>
      prev.map((p) =>
        p.id === tag.id
          ? {
              ...p,
              pinnedBy: pinned
                ? p.pinnedBy.filter((o) => o.toLowerCase() !== meKey)
                : [...p.pinnedBy, currentUser],
            }
          : p
      )
    );
    try {
      await fetch(`/api/projects/${tag.id}/pin`, {
        method: pinned ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator: currentUser }),
      });
    } catch {
      // Reload on failure to resync
      const res = await fetch(`/api/projects?currentUser=${encodeURIComponent(currentUser)}`);
      if (res.ok) setProjects((await res.json()).projects);
    }
  }

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewTagForm(true)}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            + Tag
          </button>
          <button
            onClick={() => setShowNewProjectForm(true)}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            + New Project
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex items-center gap-1 border-b border-zinc-800">
        <button
          onClick={() => setListTab("MY")}
          className={`px-4 py-2 text-sm font-medium transition ${listTab === "MY" ? "border-b-2 border-indigo-500 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          My Projects
        </button>
        <button
          onClick={() => setListTab("ALL")}
          className={`px-4 py-2 text-sm font-medium transition ${listTab === "ALL" ? "border-b-2 border-indigo-500 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          All Projects
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonCards />
      ) : projects.length === 0 ? (
        /* ── Empty state (no projects exist anywhere) ─────────────────────── */
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
      ) : visibleProjects.length === 0 ? (
        /* ── Empty state (tab-specific — e.g. "My Projects" with none) ────── */
        <div className="py-20 text-center">
          <div className="mb-4 text-5xl">📁</div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            No projects in this view
          </h2>
          <p className="mx-auto mb-6 max-w-sm text-sm text-gray-400">
            You aren&apos;t a member of any projects yet. Switch to &quot;All
            Projects&quot; to browse the lab&apos;s projects, or create your own.
          </p>
          <button
            onClick={() => setShowNewProjectForm(true)}
            className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            + New Project
          </button>
        </div>
      ) : (
        <>
          {/* ── Sort controls ──────────────────────────────────────────────── */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {visibleProjects.length} project{visibleProjects.length !== 1 ? "s" : ""}
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

          {/* ── Pinned section ─────────────────────────────────────────────── */}
          {pinnedProjects.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-400">
                📌 Pinned
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pinnedProjects.map((tag) => (
                  <ProjectCard key={tag.id} tag={tag} isPinned onTogglePin={handleTogglePin} />
                ))}
              </div>
            </div>
          )}

          {/* ── Card grid (unpinned) ───────────────────────────────────────── */}
          {pinnedProjects.length > 0 && unpinnedProjects.length > 0 && (
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              All {listTab === "MY" ? "My " : ""}Projects
            </h2>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {unpinnedProjects.map((tag) => (
              <ProjectCard key={tag.id} tag={tag} isPinned={false} onTogglePin={handleTogglePin} />
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
                owner: (newTag as { owner?: string | null }).owner ?? currentUser,
                isGeneral: false,
                isPrivate: (newTag as { isPrivate?: boolean }).isPrivate ?? false,
                privateMembers: (newTag as { privateMembers?: string[] }).privateMembers ?? [],
                pinnedBy: [],
              },
              ...prev,
            ]);
          }}
          onCancel={() => setShowNewProjectForm(false)}
        />
      )}

      {/* New Tag modal */}
      {showNewTagForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="mx-4 w-full max-w-md rounded-xl border border-white/10 bg-gray-900">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="font-bold text-white">New Tag</h2>
              <button
                onClick={() => setShowNewTagForm(false)}
                className="text-xl leading-none text-gray-400 hover:text-white"
              >✕</button>
            </div>
            <div className="px-6 py-4">
              <NewTagForm
                currentUser={currentUser}
                onSuccess={() => setShowNewTagForm(false)}
                onCancel={() => setShowNewTagForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
