"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppTopNav from "@/components/AppTopNav";
import { ANTIBODY_FORMATS } from "@/config/antibodyRegions";

interface AntibodyListItem {
  id: string;
  name: string;
  parentName?: string | null;
  format: string;
  isSymmetric: boolean;
  description?: string | null;
  owner: string;
  _count?: { annotations: number; binders: number };
}

function AntibodyCard({ antibody, onClick }: { antibody: AntibodyListItem; onClick: () => void }) {
  const annCount = antibody._count?.annotations ?? 0;
  const binderCount = antibody._count?.binders ?? 0;
  return (
    <div onClick={onClick}
      className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-purple-500/40 p-4 cursor-pointer transition-all">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-white font-semibold">{antibody.name}</h3>
          {antibody.parentName && <p className="text-xs text-gray-500">from {antibody.parentName}</p>}
        </div>
        <span className="text-xs rounded bg-purple-500/20 text-purple-300 px-2 py-0.5">{antibody.format}</span>
      </div>
      {antibody.description && <p className="text-gray-400 text-xs mb-3 line-clamp-2">{antibody.description}</p>}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>🔬 {annCount} mutation{annCount !== 1 ? "s" : ""}</span>
        {binderCount > 0 && <span>🔗 {binderCount} binder{binderCount !== 1 ? "s" : ""}</span>}
        {!antibody.isSymmetric && <span className="text-amber-400">◑ Asymmetric</span>}
      </div>
      <div className="mt-2 text-xs text-gray-600">{antibody.owner}</div>
    </div>
  );
}

const MODAL_INPUT = "w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2";
const MODAL_LABEL = "text-xs text-gray-400 uppercase tracking-wide mb-1 block";

export default function AntibodyDesignerListPage() {
  const router = useRouter();
  const [antibodies, setAntibodies] = useState<AntibodyListItem[]>([]);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [parentName, setParentName] = useState("");
  const [format, setFormat] = useState<string>(ANTIBODY_FORMATS[0]);
  const [isSymmetric, setIsSymmetric] = useState(true);
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/antibodies").then((r) => (r.ok ? r.json() : [])).then((d) => setAntibodies(Array.isArray(d) ? d : [])).catch(() => setAntibodies([]));
  }, []);

  const filteredAntibodies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return antibodies.filter((ab) => {
      if (formatFilter && ab.format !== formatFilter) return false;
      if (!q) return true;
      return [ab.name, ab.parentName, ab.description].filter(Boolean).some((s) => (s as string).toLowerCase().includes(q));
    });
  }, [antibodies, search, formatFilter]);

  async function handleCreate() {
    if (!name.trim() || isCreating) return;
    setIsCreating(true);
    setError(null);
    // Identity comes from the session actor — no createdBy sent.
    const res = await fetch("/api/antibodies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), parentName: parentName.trim() || undefined, format, isSymmetric, description: description.trim() || undefined }),
    }).catch(() => null);
    if (res && res.ok) {
      const { antibody } = await res.json();
      router.push(`/antibody-designer/${antibody.id}`);
    } else {
      setError((res && (await res.json().catch(() => ({})))?.error) || "Failed to create antibody");
      setIsCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-6 text-white">
      <AppTopNav />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Antibody Designer</h1>
          <p className="text-gray-400 text-sm mt-1">Design, annotate, and track antibody variants</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-sm font-medium transition-colors">
          + New Antibody
        </button>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input type="text" placeholder="Fetch antibodies…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 pl-9 pr-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30" />
        </div>
        <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}
          className="rounded-lg bg-white/5 border border-white/10 text-white text-sm px-3 py-2">
          <option value="">All formats</option>
          {ANTIBODY_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {filteredAntibodies.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl">🧬</span>
          <p className="text-gray-500 text-sm mt-3">
            {search ? `No antibodies matching "${search}"` : "No antibodies yet — create your first design"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAntibodies.map((ab) => (
            <AntibodyCard key={ab.id} antibody={ab} onClick={() => router.push(`/antibody-designer/${ab.id}`)} />
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-white font-bold">New Antibody</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className={MODAL_LABEL}>Name *</label>
                <input type="text" placeholder="e.g. Trastuzumab-S239D-K322A" value={name} onChange={(e) => setName(e.target.value)} className={MODAL_INPUT} />
              </div>
              <div>
                <label className={MODAL_LABEL}>Parent Antibody <span className="text-gray-600 normal-case">(optional)</span></label>
                <input type="text" placeholder="e.g. Trastuzumab" value={parentName} onChange={(e) => setParentName(e.target.value)} className={MODAL_INPUT} />
              </div>
              <div>
                <label className={MODAL_LABEL}>Format</label>
                <select value={format} onChange={(e) => setFormat(e.target.value)} className={MODAL_INPUT}>
                  {ANTIBODY_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsSymmetric((s) => !s)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isSymmetric ? "bg-gray-600" : "bg-amber-500"}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isSymmetric ? "translate-x-1" : "translate-x-4"}`} />
                </button>
                <span className="text-sm text-gray-300">{isSymmetric ? "Symmetric (identical arms)" : "Asymmetric (independent arms)"}</span>
              </div>
              <div>
                <label className={MODAL_LABEL}>Description <span className="text-gray-600 normal-case">(optional)</span></label>
                <textarea placeholder="Purpose of this design…" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${MODAL_INPUT} resize-none`} />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button onClick={() => setShowCreateModal(false)} className="text-sm text-gray-400 hover:text-white px-4 py-2">Cancel</button>
              <button onClick={handleCreate} disabled={!name.trim() || isCreating}
                className="text-sm rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white px-4 py-2 font-medium">
                {isCreating ? "Creating…" : "Create & Design"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
