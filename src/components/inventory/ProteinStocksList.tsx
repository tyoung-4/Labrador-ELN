"use client";

import React, { useState, useEffect, useCallback } from "react";
import ArchiveButton from "./ArchiveButton";
import MarkForArchiveButton from "./MarkForArchiveButton";

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
  markedForArchive: boolean;
  _count: { researchNotes: number; usageEvents: number };
}

export default function ProteinStocksList({ search, currentUser, refetchTrigger }: { search: string; currentUser: string; refetchTrigger?: number }) {
  const [items, setItems] = useState<ProteinStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/proteinstocks?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch {
      // leave items as-is on error
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load, refetchTrigger]);

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
        const anyMarked = stocks.some((s) => s.markedForArchive);
        return (
          <div
            key={key}
            className={`bg-white/5 border rounded-xl overflow-hidden ${anyMarked ? "border-orange-500/40" : "border-white/10"}`}
          >
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
              <span className="text-white font-semibold flex-1">
                {stocks[0].name}
                {anyMarked && <span className="ml-2 text-orange-400/70 text-xs font-normal">⚑ flagged</span>}
              </span>
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
                          {item.markedForArchive && <span className="text-orange-400/60">⚑ flagged</span>}
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
                          <div className="flex items-center gap-4 mt-1 flex-wrap">
                            <MarkForArchiveButton
                              entityType="protein_stock"
                              entityId={item.id}
                              entityName={item.name}
                              currentUser={currentUser}
                              alreadyMarked={item.markedForArchive}
                              onMarked={load}
                            />
                            <ArchiveButton
                              entityType="protein_stock"
                              entityId={item.id}
                              entityName={item.name}
                              currentUser={currentUser}
                              onArchived={load}
                            />
                            <button onClick={() => handleDelete(item.id)} className="text-red-400/60 hover:text-red-400 transition-colors">Delete</button>
                          </div>
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
