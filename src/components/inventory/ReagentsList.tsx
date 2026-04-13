"use client";

import React, { useState, useEffect, useCallback } from "react";

interface Reagent {
  id: string;
  name: string;
  category: string;
  quantity: number | null;
  initialQuantity: number | null;
  unit: string | null;
  concentration: number | null;
  concUnit: string | null;
  location: string | null;
  lotNumber: string | null;
  catalogNumber: string | null;
  vendor: string | null;
  expiryDate: string | null;
  owner: string | null;
  notes: string | null;
  tags: string[];
  lowStockThreshold: number | null;
  _count: { researchNotes: number; usageEvents: number };
}

function formatQty(n: number | null, unit: string | null) {
  if (n === null) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}${unit ? " " + unit : ""}`;
}

function isLowStock(r: Reagent) {
  if (r.quantity === null) return false;
  const threshold = r.lowStockThreshold ?? (r.initialQuantity ? r.initialQuantity * 0.2 : null);
  return threshold !== null && r.quantity <= threshold;
}

export default function ReagentsList({ search, currentUser }: { search: string; currentUser: string }) {
  const [reagents, setReagents] = useState<Reagent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/reagents?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (Array.isArray(data)) setReagents(data);
    } catch {
      // leave reagents as-is on network/parse error
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reagent?")) return;
    await fetch(`/api/inventory/reagents/${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="text-white/40 text-sm py-8 text-center">Loading…</div>;
  if (!reagents.length) return (
    <div className="text-white/40 text-sm py-12 text-center">
      No reagents yet.{" "}
      <span className="text-white/20">Import from Excel or add manually.</span>
    </div>
  );

  // Group by name
  const groups = new Map<string, Reagent[]>();
  for (const r of reagents) {
    const key = r.name.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([key, stocks]) => {
        const hasLow = stocks.some(isLowStock);
        const groupExpanded = stocks.some((s) => expandedIds.has(s.id));
        return (
          <div key={key} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {/* Group header */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => stocks.forEach((s) => toggleExpand(s.id))}
            >
              <span className="text-white font-semibold flex-1">{stocks[0].name}</span>
              <div className="flex items-center gap-2">
                {hasLow && <span className="text-amber-400 text-xs">Low stock</span>}
                <span className="text-white/30 text-xs">{stocks.length} stock{stocks.length !== 1 ? "s" : ""}</span>
                <span className="text-white/30 text-sm">{groupExpanded ? "▲" : "▼"}</span>
              </div>
            </div>

            {/* Stocks */}
            {groupExpanded && (
              <div className="border-t border-white/10 divide-y divide-white/5">
                {stocks.map((r) => {
                  const expanded = expandedIds.has(r.id);
                  const low = isLowStock(r);
                  const pct = r.initialQuantity && r.quantity !== null
                    ? Math.max(0, Math.min(100, (r.quantity / r.initialQuantity) * 100))
                    : null;
                  return (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${low ? "text-amber-300" : "text-white/80"}`}>
                              {formatQty(r.quantity, r.unit)}
                            </span>
                            {r.concentration && (
                              <span className="text-white/40 text-xs">
                                {r.concentration.toLocaleString()} {r.concUnit ?? ""}
                              </span>
                            )}
                            {r.location && <span className="text-white/40 text-xs">&#x1F4CD; {r.location}</span>}
                            <span className="text-white/30 text-xs bg-white/10 px-2 py-0.5 rounded-full">{r.category}</span>
                          </div>
                          {pct !== null && (
                            <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden w-32">
                              <div
                                className={`h-full rounded-full transition-all ${pct < 20 ? "bg-red-400" : pct < 40 ? "bg-amber-400" : "bg-teal-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => toggleExpand(r.id)}
                          className="text-white/30 hover:text-white/70 text-xs transition-colors"
                        >
                          {expanded ? "▲ Less" : "▼ More"}
                        </button>
                      </div>

                      {expanded && (
                        <div className="mt-3 space-y-2 text-xs text-white/50">
                          {r.lotNumber && <p>Lot: {r.lotNumber}</p>}
                          {r.catalogNumber && <p>Catalog: {r.catalogNumber}</p>}
                          {r.vendor && <p>Vendor: {r.vendor}</p>}
                          {r.expiryDate && <p>Expires: {new Date(r.expiryDate).toLocaleDateString()}</p>}
                          {r.owner && <p>Owner: {r.owner}</p>}
                          {r.notes && <p className="text-white/40 whitespace-pre-wrap">{r.notes}</p>}
                          {r.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.tags.map((t) => (
                                <span key={t} className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full text-xs">{t}</span>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="text-red-400/60 hover:text-red-400 transition-colors mt-1"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
