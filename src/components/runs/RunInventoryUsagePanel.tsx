"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Inventory deep-link helper (shared) ─────────────────────────────────────
// Maps the lowercase itemType (from /api/inventory/search + ProtocolInventoryLink)
// to the /inventory tab + highlight param. Keep in sync with /inventory page.
const INVENTORY_LINK: Record<string, { tab: string; param: string }> = {
  plasmid:  { tab: "plasmids",  param: "plasmidId" },
  stock:    { tab: "proteins",  param: "stockId" },
  reagent:  { tab: "reagents",  param: "reagentId" },
  cellline: { tab: "cellLines", param: "cellLineId" },
};

export function inventoryHref(itemType: string, itemId: string): string | null {
  const m = INVENTORY_LINK[itemType?.toLowerCase()];
  return m ? `/inventory?tab=${m.tab}&${m.param}=${encodeURIComponent(itemId)}` : null;
}

const TYPE_LABEL: Record<string, string> = {
  plasmid: "Plasmid", stock: "Protein stock", reagent: "Reagent", cellline: "Cell line",
};
const TYPE_BADGE: Record<string, string> = {
  plasmid: "bg-teal-500/15 text-teal-300",
  stock: "bg-violet-500/15 text-violet-300",
  reagent: "bg-amber-500/15 text-amber-300",
  cellline: "bg-sky-500/15 text-sky-300",
};

interface Usage {
  id: string; itemType: string; itemId: string; itemName: string; itemDetail: string;
  amountUsed: number | null; unit: string | null; notes: string; addedBy: string;
}
interface SearchResult { id: string; type: string; name: string; detail: string }
export interface UsageSuggestion { itemType: string; itemId: string; itemName: string; itemDetail: string }

export default function RunInventoryUsagePanel({
  runId, runStatus, suggestions = [],
}: {
  runId: string;
  runStatus: string;
  suggestions?: UsageSuggestion[];
}) {
  const editable = runStatus === "IN_PROGRESS";
  const [usage, setUsage] = useState<Usage[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const d = await fetch(`/api/protocol-runs/${runId}/inventory-usage`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    setUsage(Array.isArray(d) ? d : []);
  }, [runId]);
  useEffect(() => { load(); }, [load]);

  // Debounced inventory search.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      const d = await fetch(`/api/inventory/search?q=${encodeURIComponent(query)}`).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      setResults(Array.isArray(d) ? d : []);
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const usedKey = new Set(usage.map((u) => `${u.itemType}:${u.itemId}`));

  async function add(item: UsageSuggestion) {
    if (busy || usedKey.has(`${item.itemType}:${item.itemId}`)) return;
    setBusy(true);
    await fetch(`/api/protocol-runs/${runId}/inventory-usage`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item),
    }).catch(() => {});
    setQ(""); setResults([]);
    await load(); setBusy(false);
  }
  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/protocol-runs/${runId}/inventory-usage/${id}`, { method: "DELETE" }).catch(() => {});
    await load(); setBusy(false);
  }

  const pendingSuggestions = suggestions.filter((s) => !usedKey.has(`${s.itemType}:${s.itemId}`));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">Inventory used</h3>
        <span className="text-xs text-zinc-500">{usage.length}</span>
        {!editable && <span className="ml-auto rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-500">locked</span>}
      </div>

      {/* Used items */}
      {usage.length === 0 ? (
        <p className="mb-3 text-xs text-zinc-600">
          {editable ? "No inventory recorded yet. Add the items you actually used below." : "No inventory was recorded for this run."}
        </p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {usage.map((u) => {
            const href = inventoryHref(u.itemType, u.itemId);
            return (
              <li key={u.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-zinc-950/40 px-3 py-2">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BADGE[u.itemType] ?? "bg-zinc-700 text-zinc-300"}`}>
                  {TYPE_LABEL[u.itemType] ?? u.itemType}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {href ? (
                      <Link href={href} className="truncate text-sm font-medium text-zinc-100 underline decoration-zinc-600 underline-offset-2 hover:decoration-zinc-300">
                        {u.itemName}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-medium text-zinc-100">{u.itemName}</span>
                    )}
                    {u.amountUsed != null && (
                      <span className="shrink-0 text-xs text-zinc-400">{u.amountUsed}{u.unit ? ` ${u.unit}` : ""}</span>
                    )}
                  </div>
                  {u.itemDetail && <p className="truncate text-xs text-zinc-500">{u.itemDetail}</p>}
                </div>
                {href && (
                  <Link href={href} className="shrink-0 text-[11px] text-indigo-400 hover:text-indigo-300" title="Open in inventory">
                    view →
                  </Link>
                )}
                {editable && (
                  <button onClick={() => remove(u.id)} disabled={busy} className="shrink-0 text-[11px] text-red-400/70 hover:text-red-300 disabled:opacity-40">
                    remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <>
          {/* Suggestions from the protocol's linked inventory */}
          {pendingSuggestions.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-600">Suggested (from protocol)</p>
              <div className="flex flex-wrap gap-1.5">
                {pendingSuggestions.map((s) => (
                  <button
                    key={`${s.itemType}:${s.itemId}`}
                    onClick={() => add(s)}
                    disabled={busy}
                    className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-indigo-500 hover:text-indigo-200 disabled:opacity-40"
                  >
                    + {s.itemName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search-to-add */}
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search inventory to add an item you used…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
                {results.map((r) => {
                  const already = usedKey.has(`${r.type}:${r.id}`);
                  return (
                    <button
                      key={`${r.type}:${r.id}`}
                      onClick={() => add({ itemType: r.type, itemId: r.id, itemName: r.name, itemDetail: r.detail })}
                      disabled={busy || already}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-zinc-800 disabled:opacity-40"
                    >
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_BADGE[r.type] ?? "bg-zinc-700 text-zinc-300"}`}>
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{r.name}</span>
                      {r.detail && <span className="shrink-0 truncate text-xs text-zinc-500">{r.detail}</span>}
                      {already && <span className="shrink-0 text-[10px] text-zinc-500">added</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
