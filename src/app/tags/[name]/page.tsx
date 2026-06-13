"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppTopNav from "@/components/AppTopNav";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectBadge {
  id: string;
  name: string;
  color: string;
}
interface ResultRow {
  entityType: string;
  entityId: string;
  name: string;
  owner: string | null;
  date: string | null;
  projects: ProjectBadge[];
}
interface TagItemsResponse {
  tag: { id?: string; name: string; type?: string; color?: string; found: boolean };
  total: number;
  protocols: ResultRow[];
  runs: ResultRow[];
  inventoryItems: ResultRow[];
  knowledgeHub: ResultRow[];
  owners: string[];
  projects: ProjectBadge[];
}

// ─── Entity-type display + link mapping ──────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  ENTRY: "Protocols",
  RUN: "Runs",
  PROTEIN_STOCK: "Protein Stocks",
  PLASMID: "Plasmids",
  CELL_LINE: "Cell Lines",
  REAGENT: "Reagents",
  KNOWLEDGE_HUB: "Knowledge Hub",
};
const TYPE_ORDER = ["ENTRY", "RUN", "PROTEIN_STOCK", "PLASMID", "CELL_LINE", "REAGENT", "KNOWLEDGE_HUB"];
// Type filter dropdown — value is the canonical entityType (or "ALL").
const TYPE_FILTERS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All Types" },
  { value: "ENTRY", label: "Protocols" },
  { value: "RUN", label: "Runs" },
  { value: "PROTEIN_STOCK", label: "Protein Stocks" },
  { value: "PLASMID", label: "Plasmids" },
  { value: "CELL_LINE", label: "Cell Lines" },
  { value: "REAGENT", label: "Reagents" },
  { value: "KNOWLEDGE_HUB", label: "Knowledge Hub" },
];

function itemHref(row: ResultRow): string {
  switch (row.entityType) {
    case "RUN": return `/runs/${row.entityId}`;
    case "ENTRY": return "/protocols";
    case "PLASMID": return "/inventory/plasmids";
    case "CELL_LINE": return "/inventory/cell-lines";
    case "PROTEIN_STOCK": return "/inventory/stocks";
    case "REAGENT": return "/inventory/reagents";
    case "KNOWLEDGE_HUB": return "/knowledge-hub";
    default: return "#";
  }
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function hexToRgba(hex: string, alpha: number): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return `rgba(99,102,241,${alpha})`;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TagSearchPage() {
  const params = useParams();
  const rawName = params?.name as string;
  const tagName = rawName ? decodeURIComponent(rawName) : "";

  const [data, setData] = useState<TagItemsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [keyword, setKeyword] = useState("");

  // Fetch once — all subsequent filtering is client-side.
  useEffect(() => {
    if (!tagName) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/tags/${encodeURIComponent(tagName)}/items`)
      .then((r) => r.json())
      .then((d: TagItemsResponse) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tagName]);

  const allRows: ResultRow[] = useMemo(() => {
    if (!data) return [];
    return [...data.protocols, ...data.runs, ...data.inventoryItems, ...data.knowledgeHub];
  }, [data]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return allRows.filter((r) => {
      if (typeFilter !== "ALL" && r.entityType !== typeFilter) return false;
      if (ownerFilter !== "ALL" && (r.owner ?? "") !== ownerFilter) return false;
      if (projectFilter !== "ALL" && !r.projects.some((p) => p.id === projectFilter)) return false;
      if (kw && !r.name.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [allRows, typeFilter, ownerFilter, projectFilter, keyword]);

  const grouped = useMemo(() => {
    const m = new Map<string, ResultRow[]>();
    for (const r of filtered) {
      const list = m.get(r.entityType) ?? [];
      list.push(r);
      m.set(r.entityType, list);
    }
    return TYPE_ORDER.filter((t) => m.has(t)).map((t) => ({ type: t, rows: m.get(t)! }));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="p-6">
        <AppTopNav />

        {/* Heading */}
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">🔖 Tag</span>
            <h1 className="text-2xl font-bold text-white">{tagName}</h1>
          </div>
          {!loading && data && (
            <p className="mt-1 text-sm text-zinc-400">
              {data.tag.found
                ? `${filtered.length} of ${allRows.length} item${allRows.length !== 1 ? "s" : ""} shown`
                : "No tag by this name exists yet — nothing is tagged with it."}
            </p>
          )}
        </div>

        {/* Filter bar */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          >
            {TYPE_FILTERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          >
            <option value="ALL">All Owners</option>
            {(data?.owners ?? []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          >
            <option value="ALL">All Projects</option>
            {(data?.projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Filter by keyword…"
            className="min-w-[12rem] flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        {/* Results */}
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : grouped.length === 0 ? (
          <div className="rounded border border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-400">
            No items match these filters.
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ type, rows }) => (
              <section key={type}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {TYPE_LABEL[type] ?? type} ({rows.length})
                </h2>
                <ul className="space-y-1.5">
                  {rows.map((row) => (
                    <li key={`${row.entityType}:${row.entityId}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 transition hover:border-zinc-600">
                        <Link href={itemHref(row)} className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-zinc-100 hover:text-white">
                            {row.name}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {row.owner ? `${row.owner} · ` : ""}{formatDate(row.date)}
                          </span>
                        </Link>
                        {row.projects.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {row.projects.map((p) => (
                              <Link
                                key={p.id}
                                href={`/projects/${p.id}`}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white transition hover:brightness-125"
                                style={{ backgroundColor: hexToRgba(p.color, 0.2), border: `1px solid ${p.color}` }}
                              >
                                📁 {p.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
