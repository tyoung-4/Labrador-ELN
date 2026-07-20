"use client";

// ⚠️ TEMPORARY test harness for the AntibodySchematic component (Prompt 2 of 4).
// Uses mock data only — no API wiring. This route is DELETED in Prompt 4 once the
// schematic is wired into the real antibody detail page. Do not link to it.

import { useState } from "react";
import AntibodySchematic, {
  type RegionSelection,
  type SchematicAnnotation,
} from "@/components/antibody/AntibodySchematic";

const mockAnnotations: SchematicAnnotation[] = [
  { id: "1", type: "POINT_MUTATION", chain: "HEAVY_A", region: "CH2", position: 239, wtResidue: "S", mutResidue: "D" },
  { id: "2", type: "GLYCOSYLATION", chain: "HEAVY_A", region: "CH2", position: 297, glycoAction: "REMOVE" },
  { id: "3", type: "TAG", chain: "HEAVY_A", region: "C_TERM", tagIdentity: "His6" },
  { id: "4", type: "POINT_MUTATION", chain: "HEAVY_A", region: "CDR_H3", position: 100, wtResidue: "Y", mutResidue: "F" },
];

export default function AntibodyTest() {
  const [selected, setSelected] = useState<RegionSelection | null>(null);
  const [symmetric, setSymmetric] = useState(true);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <p className="mb-2 text-center text-[11px] uppercase tracking-widest text-amber-500/70">
        Temporary schematic test harness — removed in Prompt 4
      </p>
      <button
        onClick={() => setSymmetric((s) => !s)}
        className="mb-4 rounded bg-white/10 px-3 py-1 text-white hover:bg-white/20"
      >
        Toggle {symmetric ? "Asymmetric" : "Symmetric"}
      </button>
      <div className="mx-auto max-w-2xl">
        <AntibodySchematic
          isSymmetric={symmetric}
          annotations={mockAnnotations}
          binders={[{ id: "b1", type: "MEDITOPE", name: "Meditope-1" }]}
          selectedRegion={selected}
          onRegionClick={setSelected}
        />
      </div>
      {selected && (
        <p className="mt-4 text-center text-white">
          Selected: {selected.chain} → {selected.region}
        </p>
      )}
    </div>
  );
}
