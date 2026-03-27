"use client";

import React, { useState, useEffect, useCallback } from "react";

interface Plasmid {
  id: string;
  name: string;
  backbone: string | null;
  insert: string | null;
  resistance: string | null;
  promoter: string | null;
  location: string | null;
  owner: string | null;
  notes: string | null;
  tags: string[];
  _count: { researchNotes: number };
}

export default function PlasmidsList({ search, currentUser }: { search: string; currentUser: string }) {
  const [items, setItems] = useState<Plasmid[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inventory/plasmids?search=${encodeURIComponent(search)}`);
    setItems(await res.json());
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this plasmid?")) return;
    await fetch(`/api/inventory/plasmids/${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="text-white/40 text-sm py-8 text-center">Loading…</div>;
  if (!items.length) return <div className="text-white/40 text-sm py-12 text-center">No plasmids yet.</div>;

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const expanded = expandedIds.has(item.id);
        return (
          <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5"
              onClick={() => setExpandedIds((prev) => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n; })}
            >
              <span className="text-white font-semibold flex-1">{item.name}</span>
              <div className="flex items-center gap-2 text-white/40 text-xs">
                {item.backbone && <span>{item.backbone}</span>}
                {item.resistance && <span className="bg-white/10 px-2 py-0.5 rounded-full">{item.resistance}</span>}
                {item.location && <span>&#x1F4CD; {item.location}</span>}
                <span>{expanded ? "▲" : "▼"}</span>
              </div>
            </div>
            {expanded && (
              <div className="border-t border-white/10 px-4 py-3 space-y-1 text-xs text-white/50">
                {item.insert && <p>Insert: {item.insert}</p>}
                {item.promoter && <p>Promoter: {item.promoter}</p>}
                {item.owner && <p>Owner: {item.owner}</p>}
                {item.notes && <p className="whitespace-pre-wrap">{item.notes}</p>}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.tags.map((t) => <span key={t} className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full">{t}</span>)}
                  </div>
                )}
                <button onClick={() => handleDelete(item.id)} className="text-red-400/60 hover:text-red-400 transition-colors mt-1">Delete</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
