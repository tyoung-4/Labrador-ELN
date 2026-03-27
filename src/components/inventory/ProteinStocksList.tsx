"use client";

import React, { useState, useEffect, useCallback } from "react";

interface ProteinStock {
  id: string;
  name: string;
  concentration: number | null;
  concUnit: string | null;
  volume: number | null;
  volUnit: string | null;
  purity: string | null;
  location: string | null;
  owner: string | null;
  notes: string | null;
  tags: string[];
  _count: { researchNotes: number; usageEvents: number };
}

export default function ProteinStocksList({ search, currentUser }: { search: string; currentUser: string }) {
  const [items, setItems] = useState<ProteinStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inventory/proteinstocks?search=${encodeURIComponent(search)}`);
    setItems(await res.json());
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this protein stock?")) return;
    await fetch(`/api/inventory/proteinstocks/${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="text-white/40 text-sm py-8 text-center">Loading…</div>;
  if (!items.length) return <div className="text-white/40 text-sm py-12 text-center">No protein stocks yet.</div>;

  // Group by name
  const groups = new Map<string, ProteinStock[]>();
  for (const r of items) {
    const key = r.name.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([key, stocks]) => {
        const groupExpanded = stocks.some((s) => expandedIds.has(s.id));
        return (
          <div key={key} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5"
              onClick={() => {
                const allExpanded = stocks.every((s) => expandedIds.has(s.id));
                setExpandedIds((prev) => {
                  const n = new Set(prev);
                  if (allExpanded) {
                    stocks.forEach((s) => n.delete(s.id));
                  } else {
                    stocks.forEach((s) => n.add(s.id));
                  }
                  return n;
                });
              }}
            >
              <span className="text-white font-semibold flex-1">{stocks[0].name}</span>
              <span className="text-white/30 text-xs">{stocks.length} stock{stocks.length !== 1 ? "s" : ""}</span>
              <span className="text-white/30 text-sm">{groupExpanded ? "▲" : "▼"}</span>
            </div>
            {groupExpanded && (
              <div className="border-t border-white/10 divide-y divide-white/5">
                {stocks.map((item) => {
                  const expanded = expandedIds.has(item.id);
                  return (
                    <div key={item.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-xs text-white/60 flex flex-wrap gap-2">
                          {item.concentration !== null && (
                            <span>{item.concentration.toLocaleString()} {item.concUnit ?? ""}</span>
                          )}
                          {item.volume !== null && (
                            <span>{item.volume.toLocaleString()} {item.volUnit ?? ""}</span>
                          )}
                          {item.purity && <span>Purity: {item.purity}</span>}
                          {item.location && <span>&#x1F4CD; {item.location}</span>}
                        </div>
                        <button
                          onClick={() => setExpandedIds((prev) => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })}
                          className="text-white/30 hover:text-white/70 text-xs"
                        >
                          {expanded ? "▲ Less" : "▼ More"}
                        </button>
                      </div>
                      {expanded && (
                        <div className="mt-2 space-y-1 text-xs text-white/50">
                          {item.owner && <p>Owner: {item.owner}</p>}
                          {item.notes && <p className="whitespace-pre-wrap">{item.notes}</p>}
                          {item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.tags.map((t) => <span key={t} className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">{t}</span>)}
                            </div>
                          )}
                          <button onClick={() => handleDelete(item.id)} className="text-red-400/60 hover:text-red-400 transition-colors">Delete</button>
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
