"use client";

import { useMemo } from "react";
import { REGION_LABELS, CHAINS, ANNOTATION_TYPES } from "@/config/antibodyRegions";
import { formatMutation } from "@/utils/aminoAcids";
import type { AntibodyAnnotation } from "./types";

const typeColor = (type: string) =>
  (ANNOTATION_TYPES as Record<string, { color: string }>)[type]?.color ?? "#888";

// Below-schematic list view: annotations grouped into a titled box per
// populated chain+region. Clicking a box opens the same panel as the schematic.
export default function RegionBoxes({
  annotations, onRegionClick,
}: {
  annotations: AntibodyAnnotation[];
  onRegionClick: (chain: string, region: string) => void;
}) {
  const groupedByRegion = useMemo(() => {
    const map = new Map<string, { chain: string; region: string; annotations: AntibodyAnnotation[] }>();
    for (const a of annotations) {
      const key = `${a.chain}-${a.region}`;
      if (!map.has(key)) map.set(key, { chain: a.chain, region: a.region, annotations: [] });
      map.get(key)!.annotations.push(a);
    }
    return [...map.values()].sort((x, y) => `${x.chain}${x.region}`.localeCompare(`${y.chain}${y.region}`));
  }, [annotations]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {groupedByRegion.map(({ chain, region, annotations: anns }) => (
        <div
          key={`${chain}-${region}`}
          onClick={() => onRegionClick(chain, region)}
          className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/[0.08] p-3 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-medium">{REGION_LABELS[region] ?? region}</span>
            <span className="text-xs text-gray-500">{(CHAINS as Record<string, string>)[chain] ?? chain}</span>
          </div>
          <div className="space-y-1">
            {anns.map((ann) => (
              <div key={ann.id} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: typeColor(ann.type) }} />
                <span className="text-xs text-gray-300 font-mono truncate">
                  {ann.type === "POINT_MUTATION" && formatMutation(ann)}
                  {ann.type === "DISULFIDE" && `${ann.position}–${ann.position2}`}
                  {ann.type === "GLYCOSYLATION" && `${ann.glycoAction === "REMOVE" ? "−" : "+"}glyco ${ann.position}`}
                  {ann.type === "DOMAIN_SWAP" && `swap: ${ann.swapSource}`}
                  {ann.type === "TAG" && ann.tagIdentity}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {groupedByRegion.length === 0 && (
        <div className="col-span-full text-center py-8">
          <p className="text-gray-600 text-sm">No annotations yet. Click a region on the schematic to add mutations.</p>
        </div>
      )}
    </div>
  );
}
