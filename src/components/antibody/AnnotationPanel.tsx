"use client";

import { useMemo, useState } from "react";
import { REGION_LABELS, CHAINS, ANNOTATION_TYPES } from "@/config/antibodyRegions";
import { validatePointMutation, formatMutation } from "@/utils/aminoAcids";
import type { AntibodyAnnotation } from "./types";

const typeConfig = (type: string) =>
  (ANNOTATION_TYPES as Record<string, { label: string; color: string }>)[type] ?? { label: type, color: "#888" };

// Which annotation types are allowed on a given region.
export function getAvailableTypes(region: string): string[] {
  if (region === "N_TERM" || region === "C_TERM") return ["TAG"];
  if (region.startsWith("CDR_")) return ["POINT_MUTATION", "DISULFIDE"];
  return ["POINT_MUTATION", "DISULFIDE", "GLYCOSYLATION", "DOMAIN_SWAP"];
}

const INPUT = "w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2";

// ─── AnnotationCard ──────────────────────────────────────────────────────────
function AnnotationCard({
  annotation, canEdit, onDelete,
}: {
  annotation: AntibodyAnnotation;
  canEdit: boolean;
  onDelete: () => void;
}) {
  const config = typeConfig(annotation.type);
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: config.color + "50", backgroundColor: config.color + "10" }}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <span className="text-xs rounded px-1.5 py-0.5 font-medium" style={{ backgroundColor: config.color + "30", color: config.color }}>
            {config.label}
          </span>
          <p className="text-white text-sm font-mono mt-1">
            {annotation.type === "POINT_MUTATION" && formatMutation(annotation)}
            {annotation.type === "DISULFIDE" && `${annotation.position}–${annotation.position2}${annotation.chain2 ? " (inter-chain)" : ""}`}
            {annotation.type === "GLYCOSYLATION" && `${annotation.glycoAction === "REMOVE" ? "Remove" : "Add"} @ ${annotation.position}`}
            {annotation.type === "DOMAIN_SWAP" && `← ${annotation.swapSource}`}
            {annotation.type === "TAG" && annotation.tagIdentity}
          </p>
          {annotation.rationale && <p className="text-gray-500 text-xs mt-1 italic">{annotation.rationale}</p>}
        </div>
        {canEdit && (
          <button onClick={onDelete} className="text-red-400 hover:text-red-300 text-xs ml-2">✕</button>
        )}
      </div>
    </div>
  );
}

// ─── AnnotationForm ──────────────────────────────────────────────────────────
function AnnotationForm({
  region, onSubmit,
}: {
  region: string;
  onSubmit: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const availableTypes = useMemo(() => getAvailableTypes(region), [region]);
  const [selectedType, setSelectedType] = useState<string>(availableTypes[0]);

  const [wtResidue, setWtResidue] = useState("");
  const [position, setPosition] = useState("");
  const [mutResidue, setMutResidue] = useState("");
  const [isNonCanonical, setIsNonCanonical] = useState(false);
  const [ncaaIdentity, setNcaaIdentity] = useState("");
  const [position2, setPosition2] = useState("");
  const [chain2, setChain2] = useState("");
  const [glycoAction, setGlycoAction] = useState("");
  const [swapSource, setSwapSource] = useState("");
  const [tagIdentity, setTagIdentity] = useState("");
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setWtResidue(""); setPosition(""); setMutResidue(""); setIsNonCanonical(false);
    setNcaaIdentity(""); setPosition2(""); setChain2(""); setGlycoAction("");
    setSwapSource(""); setTagIdentity(""); setRationale(""); setError(null);
  }

  const canSubmit = (() => {
    switch (selectedType) {
      case "POINT_MUTATION": return !!(wtResidue && position && mutResidue && (!isNonCanonical || ncaaIdentity.trim()));
      case "DISULFIDE": return !!(position && position2);
      case "GLYCOSYLATION": return !!(position && glycoAction);
      case "DOMAIN_SWAP": return !!swapSource.trim();
      case "TAG": return !!tagIdentity.trim();
      default: return false;
    }
  })();

  async function handleSubmit() {
    setError(null);
    if (selectedType === "POINT_MUTATION") {
      const result = validatePointMutation({ wtResidue, mutResidue, position: parseInt(position, 10), isNonCanonical, ncaaIdentity });
      if (!result.valid) { setError(result.error ?? "Invalid mutation"); return; }
    }
    // Identity comes from the session actor — never send createdBy.
    const body: Record<string, unknown> = { type: selectedType, rationale: rationale.trim() || undefined };
    if (selectedType === "POINT_MUTATION") Object.assign(body, { wtResidue, position: parseInt(position, 10), mutResidue, isNonCanonical, ncaaIdentity: isNonCanonical ? ncaaIdentity.trim() : undefined });
    if (selectedType === "DISULFIDE") Object.assign(body, { position: parseInt(position, 10), position2: parseInt(position2, 10), chain2: chain2 || undefined });
    if (selectedType === "GLYCOSYLATION") Object.assign(body, { position: parseInt(position, 10), glycoAction });
    if (selectedType === "DOMAIN_SWAP") Object.assign(body, { swapSource: swapSource.trim() });
    if (selectedType === "TAG") Object.assign(body, { tagIdentity: tagIdentity.trim() });

    setSubmitting(true);
    const ok = await onSubmit(body);
    setSubmitting(false);
    if (ok) reset();
    else setError((e) => e ?? "Failed to add annotation");
  }

  return (
    <div>
      {/* Type selector */}
      <div className="mb-4">
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Type</label>
        <div className="flex flex-wrap gap-2">
          {availableTypes.map((type) => {
            const c = typeConfig(type);
            const active = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => { setSelectedType(type); setError(null); }}
                className={`text-xs rounded px-2.5 py-1.5 border transition-colors ${active ? "text-white" : "text-gray-400 hover:bg-white/10 border-white/10"}`}
                style={active ? { backgroundColor: c.color + "30", borderColor: c.color } : {}}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedType === "POINT_MUTATION" && (
        <div className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="w-16">
              <label className="text-xs text-gray-400 mb-1 block">WT</label>
              <input type="text" maxLength={1} placeholder="S" value={wtResidue}
                onChange={(e) => setWtResidue(e.target.value.toUpperCase())}
                className={`${INPUT} text-center font-mono`} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Position (EU)</label>
              <input type="number" min={1} placeholder="239" value={position}
                onChange={(e) => setPosition(e.target.value)} className={INPUT} />
            </div>
            <div className="w-16">
              <label className="text-xs text-gray-400 mb-1 block">Mut</label>
              <input type="text" maxLength={1} placeholder="D" value={mutResidue}
                onChange={(e) => { const v = e.target.value.toUpperCase(); setMutResidue(v); setIsNonCanonical(v === "X"); }}
                className={`${INPUT} text-center font-mono`} />
            </div>
          </div>

          {wtResidue && position && mutResidue && (
            <div className="rounded bg-black/30 px-3 py-2">
              <span className="text-xs text-gray-500">Preview: </span>
              <span className="text-white font-mono text-sm">
                {wtResidue}{position}{mutResidue}{isNonCanonical && ncaaIdentity && ` (${ncaaIdentity})`}
              </span>
            </div>
          )}

          {isNonCanonical && (
            <div>
              <label className="text-xs text-amber-400 mb-1 block">Non-canonical AA identity *</label>
              <input type="text" placeholder="e.g. diphenylalanine, AzF, pAcF" value={ncaaIdentity}
                onChange={(e) => setNcaaIdentity(e.target.value)}
                className="w-full rounded bg-amber-500/10 border border-amber-500/40 text-white text-sm px-3 py-2" />
              <p className="text-xs text-gray-500 mt-1">Required — specify which non-canonical amino acid X represents</p>
            </div>
          )}
        </div>
      )}

      {selectedType === "DISULFIDE" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Engineered disulfide bond between two positions.</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Position 1 (EU)</label>
              <input type="number" value={position} onChange={(e) => setPosition(e.target.value)} className={INPUT} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Position 2 (EU)</label>
              <input type="number" value={position2} onChange={(e) => setPosition2(e.target.value)} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Second chain (for inter-chain disulfide)</label>
            <select value={chain2} onChange={(e) => setChain2(e.target.value)} className={INPUT}>
              <option value="">Same chain (intra-chain)</option>
              <option value="HEAVY_A">Heavy Chain A</option>
              <option value="HEAVY_B">Heavy Chain B</option>
              <option value="LIGHT_A">Light Chain A</option>
              <option value="LIGHT_B">Light Chain B</option>
            </select>
          </div>
        </div>
      )}

      {selectedType === "GLYCOSYLATION" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Position (EU)</label>
              <input type="number" placeholder="297" value={position} onChange={(e) => setPosition(e.target.value)} className={INPUT} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">Action</label>
              <div className="flex gap-1">
                {["ADD", "REMOVE"].map((action) => (
                  <button key={action} onClick={() => setGlycoAction(action)}
                    className={`flex-1 text-xs rounded px-2 py-2 border ${glycoAction === action ? "bg-green-500/20 border-green-500 text-green-300" : "bg-white/5 border-white/10 text-gray-400"}`}>
                    {action === "ADD" ? "Add site" : "Remove"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">e.g. N297A removes the conserved Fc glycosylation site.</p>
        </div>
      )}

      {selectedType === "DOMAIN_SWAP" && (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Source of swapped domain</label>
          <input type="text" placeholder="e.g. Matuzumab VH, Pertuzumab VL" value={swapSource}
            onChange={(e) => setSwapSource(e.target.value)} className={INPUT} />
          <p className="text-xs text-gray-500 mt-1">
            This {REGION_LABELS[region]} is replaced with the domain from the named source.
          </p>
        </div>
      )}

      {selectedType === "TAG" && (
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Tag identity</label>
          <input type="text" placeholder="e.g. His6, Avi, Flag, Strep-II" value={tagIdentity}
            onChange={(e) => setTagIdentity(e.target.value)} className={INPUT} />
          <p className="text-xs text-gray-500 mt-1">Attached at the {REGION_LABELS[region]}.</p>
        </div>
      )}

      {/* Rationale — all types */}
      <div className="mt-3">
        <label className="text-xs text-gray-400 mb-1 block">Rationale <span className="text-gray-600">(optional)</span></label>
        <textarea placeholder="Why is this modification made?" value={rationale}
          onChange={(e) => setRationale(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
      </div>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      <button onClick={handleSubmit} disabled={!canSubmit || submitting}
        className="w-full mt-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm font-medium py-2">
        {submitting ? "Adding…" : "Add Annotation"}
      </button>
    </div>
  );
}

// ─── AnnotationPanel ─────────────────────────────────────────────────────────
export default function AnnotationPanel({
  antibodyId, selection, existingAnnotations, canEdit, onAnnotationAdded, onAnnotationDeleted, onClose,
}: {
  antibodyId: string;
  selection: { chain: string; region: string };
  existingAnnotations: AntibodyAnnotation[];
  currentUser?: string;
  canEdit: boolean;
  onAnnotationAdded: () => void;
  onAnnotationDeleted: () => void;
  onClose: () => void;
}) {
  async function handleAddAnnotation(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/antibodies/${antibodyId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, chain: selection.chain, region: selection.region }),
    }).catch(() => null);
    if (res && res.ok) { onAnnotationAdded(); return true; }
    return false;
  }

  async function handleDelete(annotationId: string) {
    const res = await fetch(`/api/antibodies/${antibodyId}/annotations/${annotationId}`, { method: "DELETE" }).catch(() => null);
    if (res && res.ok) onAnnotationDeleted();
  }

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-white/10 shadow-2xl z-50 overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-gray-900 z-10">
        <div>
          <h3 className="text-white font-bold">{REGION_LABELS[selection.region] ?? selection.region}</h3>
          <p className="text-xs text-gray-500">{(CHAINS as Record<string, string>)[selection.chain] ?? selection.chain}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
      </div>

      <div className="px-5 py-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Annotations ({existingAnnotations.length})</p>
        {existingAnnotations.length === 0 ? (
          <p className="text-gray-600 text-sm">No annotations on this region yet.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {existingAnnotations.map((ann) => (
              <AnnotationCard key={ann.id} annotation={ann} canEdit={canEdit} onDelete={() => handleDelete(ann.id)} />
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Add Annotation</p>
          <AnnotationForm region={selection.region} onSubmit={handleAddAnnotation} />
        </div>
      )}
    </div>
  );
}
