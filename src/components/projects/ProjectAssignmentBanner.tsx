"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getCurrentUser, USER_STORAGE_KEY } from "@/components/AppTopNav";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  operator: string;
  createdAt: string;
  isDismissed: boolean;
}
interface ProjectOption {
  id: string;
  name: string;
  color: string;
}

const TYPE_LABEL: Record<string, string> = {
  ENTRY: "Protocol",
  RUN: "Run",
  PROTEIN_STOCK: "Protein Stock",
  PLASMID: "Plasmid",
  CELL_LINE: "Cell Line",
  REAGENT: "Reagent",
  KNOWLEDGE_HUB: "Knowledge Hub",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProjectAssignmentBanner() {
  const [operator, setOperator] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Notification | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback((op: string) => {
    if (!op) return;
    fetch(`/api/notifications/project-assignment?operator=${encodeURIComponent(op)}`)
      .then((r) => r.json())
      .then((d: { notifications: Notification[] }) => setNotifications(d.notifications ?? []))
      .catch(() => setNotifications([]));
  }, []);

  useEffect(() => {
    const op = getCurrentUser().name;
    setOperator(op);
    load(op);
    function onStorage(e: StorageEvent) {
      if (e.key === USER_STORAGE_KEY) {
        const next = getCurrentUser().name;
        setOperator(next);
        setExpanded(false);
        load(next);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  async function dismiss(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id)); // optimistic
    await fetch(`/api/notifications/project-assignment/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDismissed: true }),
    }).catch(() => load(operator));
  }

  async function openAssign(n: Notification) {
    setAssignTarget(n);
    if (projects.length === 0) {
      try {
        const res = await fetch(`/api/projects?currentUser=${encodeURIComponent(operator)}&includePrivate=true`);
        const d = (await res.json()) as { projects: ProjectOption[] };
        setProjects(d.projects ?? []);
      } catch {
        setProjects([]);
      }
    }
  }

  async function assignTo(projectId: string) {
    if (!assignTarget || assigning) return;
    setAssigning(true);
    try {
      await fetch(`/api/projects/${projectId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: assignTarget.entityType,
          entityId: assignTarget.entityId,
          assignedBy: operator,
        }),
      });
      await dismiss(assignTarget.id);
      setAssignTarget(null);
    } finally {
      setAssigning(false);
    }
  }

  if (notifications.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-300">
          ⚠️ {notifications.length} item{notifications.length !== 1 ? "s" : ""} missing a project assignment
        </span>
        <span className="text-xs text-amber-400/70">{expanded ? "Hide ▲" : "Show ▼"}</span>
      </button>

      {expanded && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {notifications.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-amber-100">
                <span className="mr-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                  {TYPE_LABEL[n.entityType] ?? n.entityType}
                </span>
                {n.entityName}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => openAssign(n)}
                  className="rounded border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/25"
                >
                  Assign Project
                </button>
                <button
                  onClick={() => dismiss(n.id)}
                  className="text-xs text-amber-400/70 transition hover:text-amber-200"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Project selector modal */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setAssignTarget(null)}>
          <div
            className="mx-4 w-full max-w-sm rounded-xl border border-white/10 bg-gray-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-semibold text-white">Assign to a project</h3>
            <p className="mb-4 truncate text-xs text-zinc-400">{assignTarget.entityName}</p>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {projects.length === 0 ? (
                <p className="text-sm text-zinc-500">No projects available.</p>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => assignTo(p.id)}
                    disabled={assigning}
                    className="flex w-full items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-left text-sm text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setAssignTarget(null)}
              className="mt-4 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
