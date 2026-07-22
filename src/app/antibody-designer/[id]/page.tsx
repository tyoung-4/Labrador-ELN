"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppTopNav, { getCurrentUser, ELN_USERS } from "@/components/AppTopNav";
import AntibodySchematic, { type RegionSelection, type SchematicBinder } from "@/components/antibody/AntibodySchematic";
import AnnotationPanel from "@/components/antibody/AnnotationPanel";
import RegionBoxes from "@/components/antibody/RegionBoxes";
import BinderSection, { type Binder } from "@/components/antibody/BinderSection";
import ProteinStockLink from "@/components/antibody/ProteinStockLink";
import TagInput from "@/components/tags/TagInput";
import { ANTIBODY_FORMATS } from "@/config/antibodyRegions";
import type { AntibodyAnnotation } from "@/components/antibody/types";

type TagAssignment = { tagId: string; tag: { id: string; name: string; type: "PROJECT" | "GENERAL"; color: string } };

interface AntibodyDetail {
  id: string;
  name: string;
  parentName?: string | null;
  format: string;
  isSymmetric: boolean;
  description?: string | null;
  owner: string;
  proteinStockId?: string | null;
  proteinStockName?: string | null;
  annotations: AntibodyAnnotation[];
  binders: Binder[];
  tagAssignments: TagAssignment[];
}

const MODAL_INPUT = "w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2";
const MODAL_LABEL = "text-xs text-gray-400 uppercase tracking-wide mb-1 block";

export default function AntibodyDesignerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [antibody, setAntibody] = useState<AntibodyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<RegionSelection | null>(null);
  const [tagAssignments, setTagAssignments] = useState<TagAssignment[]>([]);
  const [currentUser, setCurrentUser] = useState(ELN_USERS[0]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [eName, setEName] = useState("");
  const [eParent, setEParent] = useState("");
  const [eFormat, setEFormat] = useState<string>(ANTIBODY_FORMATS[0]);
  const [eSymmetric, setESymmetric] = useState(true);
  const [eDescription, setEDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setCurrentUser(getCurrentUser()); }, []);

  const refetch = useCallback(async () => {
    const data = await fetch(`/api/antibodies/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (data) {
      setAntibody(data);
      setTagAssignments(Array.isArray(data.tagAssignments) ? data.tagAssignments : []);
    }
    setLoading(false);
  }, [id]);
  useEffect(() => { refetch(); }, [refetch]);

  const isOwner = !!antibody && (currentUser.role === "ADMIN" || currentUser.name === antibody.owner);

  function openEdit() {
    if (!antibody) return;
    setEName(antibody.name);
    setEParent(antibody.parentName ?? "");
    setEFormat(antibody.format);
    setESymmetric(antibody.isSymmetric);
    setEDescription(antibody.description ?? "");
    setShowEditModal(true);
  }

  async function saveEdit() {
    if (!eName.trim() || saving) return;
    setSaving(true);
    const res = await fetch(`/api/antibodies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: eName.trim(), parentName: eParent.trim() || null, format: eFormat, isSymmetric: eSymmetric, description: eDescription.trim() || null }),
    }).catch(() => null);
    setSaving(false);
    if (res && res.ok) { setShowEditModal(false); refetch(); }
  }

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] px-6 py-6 text-gray-400"><AppTopNav /><p>Loading…</p></div>;
  if (!antibody) return <div className="min-h-screen bg-[#0a0a0a] px-6 py-6 text-gray-400"><AppTopNav /><p>Antibody not found. <a href="/antibody-designer" className="text-purple-400 underline">Back</a></p></div>;

  const selectionAnnotations = selectedRegion
    ? antibody.annotations.filter((a) => a.chain === selectedRegion.chain && a.region === selectedRegion.region)
    : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="px-6 pt-6"><AppTopNav /></div>

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => router.push("/antibody-designer")} className="text-sm text-gray-400 hover:text-white mb-1">← Antibody Designer</button>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">{antibody.name}</h1>
              <span className="text-xs rounded bg-purple-500/20 text-purple-300 px-2 py-0.5">{antibody.format}</span>
              {!antibody.isSymmetric && <span className="text-xs text-amber-400">◑ Asymmetric</span>}
            </div>
            {antibody.parentName && <p className="text-xs text-gray-500 mt-0.5">from {antibody.parentName}</p>}
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <button onClick={openEdit} className="text-sm text-gray-400 hover:text-white border border-white/10 rounded px-3 py-1.5">Edit Details</button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <TagInput
            entityType="ANTIBODY"
            entityId={antibody.id}
            currentUser={currentUser.name}
            entityOwner={antibody.owner}
            existingAssignments={tagAssignments}
            onAssignmentsChange={setTagAssignments}
            readOnly={!isOwner}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="px-6 py-6">
        <div className="max-w-3xl mx-auto mb-8">
          <AntibodySchematic
            isSymmetric={antibody.isSymmetric}
            annotations={antibody.annotations}
            binders={antibody.binders as SchematicBinder[]}
            selectedRegion={selectedRegion}
            onRegionClick={setSelectedRegion}
          />
        </div>

        <div className="max-w-3xl mx-auto mb-8">
          <BinderSection antibodyId={antibody.id} binders={antibody.binders} canEdit={isOwner} onBindersChange={refetch} />
        </div>

        <div className="max-w-5xl mx-auto">
          <h2 className="text-white font-semibold mb-3">Annotations by Region</h2>
          <RegionBoxes annotations={antibody.annotations} onRegionClick={(chain, region) => setSelectedRegion({ chain: chain as RegionSelection["chain"], region })} />
        </div>

        <div className="max-w-5xl mx-auto mt-8">
          <ProteinStockLink
            antibodyId={antibody.id}
            currentProteinStockId={antibody.proteinStockId ?? null}
            proteinStockName={antibody.proteinStockName}
            canEdit={isOwner}
            onLinkChange={refetch}
          />
        </div>
      </div>

      {selectedRegion && (
        <AnnotationPanel
          antibodyId={antibody.id}
          selection={selectedRegion}
          existingAnnotations={selectionAnnotations}
          currentUser={currentUser.name}
          canEdit={isOwner}
          onAnnotationAdded={refetch}
          onAnnotationDeleted={refetch}
          onClose={() => setSelectedRegion(null)}
        />
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-white font-bold">Edit Details</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className={MODAL_LABEL}>Name *</label>
                <input type="text" value={eName} onChange={(e) => setEName(e.target.value)} className={MODAL_INPUT} />
              </div>
              <div>
                <label className={MODAL_LABEL}>Parent Antibody <span className="text-gray-600 normal-case">(optional)</span></label>
                <input type="text" value={eParent} onChange={(e) => setEParent(e.target.value)} className={MODAL_INPUT} />
              </div>
              <div>
                <label className={MODAL_LABEL}>Format</label>
                <select value={eFormat} onChange={(e) => setEFormat(e.target.value)} className={MODAL_INPUT}>
                  {ANTIBODY_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setESymmetric((s) => !s)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${eSymmetric ? "bg-gray-600" : "bg-amber-500"}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${eSymmetric ? "translate-x-1" : "translate-x-4"}`} />
                </button>
                <span className="text-sm text-gray-300">{eSymmetric ? "Symmetric (identical arms)" : "Asymmetric (independent arms)"}</span>
              </div>
              <div>
                <label className={MODAL_LABEL}>Description <span className="text-gray-600 normal-case">(optional)</span></label>
                <textarea value={eDescription} onChange={(e) => setEDescription(e.target.value)} rows={2} className={`${MODAL_INPUT} resize-none`} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
              <button onClick={() => setShowEditModal(false)} className="text-sm text-gray-400 hover:text-white px-4 py-2">Cancel</button>
              <button onClick={saveEdit} disabled={!eName.trim() || saving}
                className="text-sm rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white px-4 py-2 font-medium">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
