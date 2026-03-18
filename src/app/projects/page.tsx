"use client";

import React, { useEffect, useState } from "react";
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

type UntaggedCounts = {
  untaggedRunCount: number;
  untaggedProtocolCount: number;
};

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

function ProjectCard({ project }: { project: ProjectSummary }) {
  function navigate() {
    window.location.href = `/projects/${project.id}`;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={navigate}
      onKeyDown={(e) => e.key === "Enter" && navigate()}
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
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* Untagged warning section */}
      {!loading && untagged && <UntaggedSection counts={untagged} />}

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
