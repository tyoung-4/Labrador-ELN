"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Reverse link: "Used in N runs" for an inventory item, with a collapsible list
// linking back to each run. Mounts inside a card's expanded section, so the
// fetch is lazy (only when the user expands the item). See
// docs/CROSS_LINKING_DESIGN.md.

interface UsageRun {
  runId: string; runCode: string | null; title: string; status: string;
  amountUsed: number | null; unit: string | null;
}

export default function InventoryUsageBadge({ itemType, itemId }: { itemType: string; itemId: string }) {
  const [data, setData] = useState<{ count: number; runs: UsageRun[] } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/inventory/usage?itemType=${encodeURIComponent(itemType)}&itemId=${encodeURIComponent(itemId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [itemType, itemId]);

  if (!data) return null;
  if (data.count === 0) {
    return <p className="text-[11px] text-white/30">Not used in any run yet.</p>;
  }

  return (
    <div className="text-xs">
      <button onClick={() => setOpen((o) => !o)} className="font-medium text-indigo-400 hover:text-indigo-300">
        Used in {data.count} run{data.count > 1 ? "s" : ""} {open ? "▲" : "▼"}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 pl-1">
          {data.runs.map((r) => (
            <li key={r.runId} className="flex items-center gap-1.5">
              <span className="text-white/25">
                {r.status === "COMPLETED" ? "✓" : r.status === "IN_PROGRESS" ? "…" : "•"}
              </span>
              <Link href={`/runs/${r.runId}`} className="truncate text-white/70 underline decoration-white/20 underline-offset-2 hover:text-white">
                {r.title}
              </Link>
              {r.amountUsed != null && (
                <span className="shrink-0 text-white/30">· {r.amountUsed}{r.unit ? ` ${r.unit}` : ""}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
