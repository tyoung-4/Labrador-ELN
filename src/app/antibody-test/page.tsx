"use client";

// ⚠️ TEMPORARY test harness for the Antibody Designer (Prompts 2–3). Uses REAL
// API data now (creates a demo antibody if none exists). This route is DELETED
// in Prompt 4 once the schematic + panel are wired into the real detail page.

import { useCallback, useEffect, useState } from "react";
import AntibodySchematic, {
  type RegionSelection,
  type SchematicBinder,
} from "@/components/antibody/AntibodySchematic";
import AnnotationPanel from "@/components/antibody/AnnotationPanel";
import RegionBoxes from "@/components/antibody/RegionBoxes";
import type { AntibodyAnnotation } from "@/components/antibody/types";

export default function AntibodyTest() {
  const [antibodyId, setAntibodyId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<AntibodyAnnotation[]>([]);
  const [binders, setBinders] = useState<SchematicBinder[]>([]);
  const [selection, setSelection] = useState<RegionSelection | null>(null);
  const [symmetric, setSymmetric] = useState(true);
  const [loading, setLoading] = useState(true);

  // Ensure a demo antibody exists (identity comes from the session actor).
  useEffect(() => {
    (async () => {
      const list = await fetch("/api/antibodies").then((r) => (r.ok ? r.json() : [])).catch(() => []);
      let id = Array.isArray(list) && list[0]?.id;
      if (!id) {
        const created = await fetch("/api/antibodies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Demo Antibody (test harness)", format: "IgG1" }),
        }).then((r) => r.json()).catch(() => null);
        id = created?.antibody?.id ?? null;
      }
      setAntibodyId(id || null);
      setLoading(false);
    })();
  }, []);

  const refetch = useCallback(async () => {
    if (!antibodyId) return;
    const [anns, bnds] = await Promise.all([
      fetch(`/api/antibodies/${antibodyId}/annotations`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`/api/antibodies/${antibodyId}/binders`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    setAnnotations(Array.isArray(anns) ? anns : []);
    setBinders(Array.isArray(bnds) ? bnds : []);
  }, [antibodyId]);

  useEffect(() => { refetch(); }, [refetch]);

  const openRegion = (chain: string, region: string) =>
    setSelection({ chain: chain as RegionSelection["chain"], region });

  const selectionAnnotations = selection
    ? annotations.filter((a) => a.chain === selection.chain && a.region === selection.region)
    : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <p className="mb-2 text-center text-[11px] uppercase tracking-widest text-amber-500/70">
        Temporary Antibody Designer test harness — removed in Prompt 4
      </p>

      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => setSymmetric((s) => !s)} className="rounded bg-white/10 px-3 py-1 text-white hover:bg-white/20">
          Toggle {symmetric ? "Asymmetric" : "Symmetric"}
        </button>
        {loading && <span className="text-xs text-gray-500">Loading antibody…</span>}
        {!loading && !antibodyId && <span className="text-xs text-red-400">No antibody (auth?) — check session.</span>}
      </div>

      <div className="mx-auto max-w-2xl">
        <AntibodySchematic
          isSymmetric={symmetric}
          annotations={annotations}
          binders={binders}
          selectedRegion={selection}
          onRegionClick={setSelection}
        />
      </div>

      <div className="mx-auto mt-8 max-w-4xl">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Annotations by region</p>
        <RegionBoxes annotations={annotations} onRegionClick={openRegion} />
      </div>

      {selection && antibodyId && (
        <AnnotationPanel
          key={`${selection.chain}-${selection.region}`}
          antibodyId={antibodyId}
          selection={selection}
          existingAnnotations={selectionAnnotations}
          canEdit
          onAnnotationAdded={refetch}
          onAnnotationDeleted={refetch}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}
