"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/components/AppTopNav";

type OutstandingRun = {
  id: string;
  runId: string;
  title: string;
  stepCount: number;
  createdAt: string;
};

export default function OutstandingRunsWidget() {
  const [runs, setRuns] = useState<OutstandingRun[]>([]);
  const [loaded, setLoaded] = useState(false);

  const authHeaders = useMemo((): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const u = getCurrentUser();
    return { "x-user-id": u.id, "x-user-role": u.role, "x-user-name": u.name };
  }, []);

  useEffect(() => {
    fetch("/api/dashboard/outstanding", { headers: authHeaders })
      .then((r) => r.ok ? r.json() : { runs: [] })
      .then((data: { runs: OutstandingRun[] }) => {
        setRuns(data.runs ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [authHeaders]);

  if (!loaded || runs.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3">
      <p className="mb-2 text-xs font-semibold text-amber-300">
        Outstanding Runs ({runs.length})
      </p>
      <ul className="flex flex-col gap-1">
        {runs.map((run) => (
          <li key={run.id}>
            <Link
              href={`/runs/${run.id}`}
              className="flex items-center justify-between rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/20"
            >
              <span className="min-w-0 flex-1 truncate">{run.title}</span>
              {run.stepCount > 0 && (
                <span className="ml-2 shrink-0 text-amber-400/70">{run.stepCount} steps</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
