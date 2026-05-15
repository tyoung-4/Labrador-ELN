"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type StepFile = {
  id: string;
  fileName: string;
  mimeType: string;
  runId: string;
};

type LadderDef = {
  id: string;
  name: string;
  manufacturer: string;
};

type InventoryItem = {
  id: string;
  type: string;
  name: string;
  detail: string;
};

type GelLane = {
  id: string;
  laneNumber: number;
  ladderId: string | null;
  ladderName: string;
  contents: string;
  inventoryId: string;
  inventoryType: string;
  inventoryName: string;
};

type Peak = {
  id: string;
  peakNumber: number;
  label: string;
  retentionVolume: number | null;
  inventoryId: string;
  inventoryType: string;
  inventoryName: string;
};

type Annotation = {
  id: string;
  fileType: string;
  notes: string;
  gelLanes: GelLane[];
  peaks: Peak[];
};

// ── Local state shape for lane rows ──────────────────────────────────────────

type LaneRow = {
  dbId: string | null;
  isLadder: boolean;
  ladderId: string | null;
  ladderName: string;
  contents: string;
  inventoryId: string;
  inventoryType: string;
  inventoryName: string;
};

type PeakRow = {
  dbId: string | null;
  label: string;
  retentionVolume: string;
  inventoryId: string;
  inventoryType: string;
  inventoryName: string;
};

const FILE_TYPES = [
  { value: "SDS_PAGE",    label: "SDS-PAGE" },
  { value: "WESTERN_BLOT", label: "Western Blot" },
  { value: "CHROMATOGRAM", label: "Chromatogram" },
  { value: "OTHER",        label: "Other" },
];

const ITEM_TYPE_STYLE: Record<string, string> = {
  stock:     "border-sky-500/50 text-sky-300",
  plasmid:   "border-violet-500/50 text-violet-300",
  cell_line: "border-rose-500/50 text-rose-300",
  reagent:   "border-amber-500/50 text-amber-300",
};

function emptyLane(): LaneRow {
  return { dbId: null, isLadder: false, ladderId: null, ladderName: "", contents: "", inventoryId: "", inventoryType: "", inventoryName: "" };
}

function emptyPeak(): PeakRow {
  return { dbId: null, label: "", retentionVolume: "", inventoryId: "", inventoryType: "", inventoryName: "" };
}

// ── Inventory search sub-component ───────────────────────────────────────────

function InventorySearch({
  value,
  onSelect,
  onClearInventory,
  authHeaders,
}: {
  value: { inventoryId: string; inventoryName: string; inventoryType: string };
  onSelect: (item: InventoryItem) => void;
  onClearInventory: () => void;
  authHeaders: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setShowDrop(false); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/inventory/search?q=${encodeURIComponent(query.trim())}`, { headers: authHeaders });
        const data: InventoryItem[] = res.ok ? await res.json() : [];
        setResults(data);
        setShowDrop(data.length > 0);
      } finally { setSearching(false); }
    }, 250);
  }, [query, authHeaders]);

  if (value.inventoryId) {
    return (
      <div className="flex items-center gap-1">
        <span className={`rounded border px-1 py-0.5 text-[9px] font-semibold uppercase ${ITEM_TYPE_STYLE[value.inventoryType] ?? "border-zinc-600 text-zinc-400"}`}>
          {value.inventoryType}
        </span>
        <span className="flex-1 truncate text-xs text-zinc-200">{value.inventoryName}</span>
        <button onClick={onClearInventory} className="text-[10px] text-zinc-500 hover:text-red-400">✕</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowDrop(true)}
        onBlur={() => setTimeout(() => setShowDrop(false), 150)}
        placeholder="Search inventory…"
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
      />
      {searching && <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-zinc-500">…</span>}
      {showDrop && (
        <div className="absolute left-0 right-0 top-full z-50 mt-0.5 max-h-40 overflow-y-auto rounded border border-zinc-700 bg-zinc-900 shadow-xl">
          {results.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              onMouseDown={() => { onSelect(item); setQuery(""); setResults([]); setShowDrop(false); }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-zinc-800"
            >
              <span className={`shrink-0 rounded border px-1 py-0.5 text-[9px] font-semibold uppercase ${ITEM_TYPE_STYLE[item.type] ?? ""}`}>
                {item.type}
              </span>
              <span className="flex-1 truncate text-zinc-200">{item.name}</span>
              {item.detail && <span className="shrink-0 text-zinc-500">{item.detail}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

type Props = {
  file: StepFile;
  authHeaders: Record<string, string>;
  currentUserId: string;
  onClose: () => void;
  onAnnotationChange: (hasAnnotation: boolean) => void;
};

export default function FileAnnotationModal({ file, authHeaders, currentUserId, onClose, onAnnotationChange }: Props) {
  const [annotation, setAnnotation] = useState<Annotation | null>(null);
  const [fileType, setFileType] = useState("SDS_PAGE");
  const [notes, setNotes] = useState("");
  const [lanes, setLanes] = useState<LaneRow[]>([]);
  const [peaks, setPeaks] = useState<PeakRow[]>([]);
  const [wellCount, setWellCount] = useState("10");
  const [peakCount, setPeakCount] = useState("5");
  const [ladders, setLadders] = useState<LadderDef[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isGel = fileType === "SDS_PAGE" || fileType === "WESTERN_BLOT";
  const isChrom = fileType === "CHROMATOGRAM";
  const isImage = file.mimeType.startsWith("image/");

  // Load annotation + ladders + preview URL on open
  useEffect(() => {
    Promise.all([
      fetch(`/api/files/${file.id}/annotation`, { headers: authHeaders }).then((r) => r.ok ? r.json() : null),
      fetch("/api/ladders", { headers: authHeaders }).then((r) => r.ok ? r.json() : []),
      isImage
        ? fetch(`/api/runs/${file.runId}/files/${file.id}/url`, { headers: authHeaders })
            .then((r) => r.ok ? r.json() : null)
            .then((d) => d?.url ?? null)
        : Promise.resolve(null),
    ]).then(([ann, ladderList, imgUrl]) => {
      setLadders(ladderList as LadderDef[]);
      if (imgUrl) setPreviewUrl(imgUrl as string);

      if (ann) {
        const a = ann as Annotation;
        setAnnotation(a);
        setFileType(a.fileType);
        setNotes(a.notes);
        setLanes(a.gelLanes.map((l) => ({
          dbId: l.id,
          isLadder: !!l.ladderId || !!l.ladderName,
          ladderId: l.ladderId,
          ladderName: l.ladderName,
          contents: l.contents,
          inventoryId: l.inventoryId,
          inventoryType: l.inventoryType,
          inventoryName: l.inventoryName,
        })));
        setWellCount(String(a.gelLanes.length || 10));
        setPeaks(a.peaks.map((p) => ({
          dbId: p.id,
          label: p.label,
          retentionVolume: p.retentionVolume !== null ? String(p.retentionVolume) : "",
          inventoryId: p.inventoryId,
          inventoryType: p.inventoryType,
          inventoryName: p.inventoryName,
        })));
        setPeakCount(String(a.peaks.length || 5));
      } else {
        // Default: 10 empty lanes
        setLanes(Array.from({ length: 10 }, emptyLane));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyWellCount() {
    const n = Math.min(20, Math.max(1, parseInt(wellCount) || 10));
    setWellCount(String(n));
    setLanes((prev) => {
      if (n > prev.length) return [...prev, ...Array.from({ length: n - prev.length }, emptyLane)];
      return prev.slice(0, n);
    });
  }

  function applyPeakCount() {
    const n = Math.max(1, parseInt(peakCount) || 5);
    setPeakCount(String(n));
    setPeaks((prev) => {
      if (n > prev.length) return [...prev, ...Array.from({ length: n - prev.length }, emptyPeak)];
      return prev.slice(0, n);
    });
  }

  function updateLane(idx: number, patch: Partial<LaneRow>) {
    setLanes((prev) => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }

  function clearLane(idx: number) {
    setLanes((prev) => prev.map((l, i) => i === idx ? { ...emptyLane(), dbId: l.dbId } : l));
  }

  function updatePeak(idx: number, patch: Partial<PeakRow>) {
    setPeaks((prev) => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }

  function clearPeak(idx: number) {
    setPeaks((prev) => prev.map((p, i) => i === idx ? { ...emptyPeak(), dbId: p.dbId } : p));
  }

  function flash(msg: string) {
    setSaveMsg(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSaveMsg(null), 2500);
  }

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      let ann = annotation;

      // Create or update annotation header
      if (!ann) {
        const res = await fetch(`/api/files/${file.id}/annotation`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ fileType, notes, createdById: currentUserId }),
        });
        if (!res.ok) { flash("Failed to save"); return; }
        ann = await res.json() as Annotation;
        setAnnotation(ann);
        onAnnotationChange(true);
      } else {
        const res = await fetch(`/api/files/${file.id}/annotation`, {
          method: "PUT",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ fileType, notes }),
        });
        if (!res.ok) { flash("Failed to save"); return; }
      }

      // Sync lanes
      if (isGel) {
        for (let i = 0; i < lanes.length; i++) {
          const lane = lanes[i];
          const payload = {
            ladderId: lane.isLadder ? (lane.ladderId || null) : null,
            ladderName: lane.isLadder ? lane.ladderName : "",
            contents: lane.isLadder ? "" : lane.contents,
            inventoryId: lane.isLadder ? "" : lane.inventoryId,
            inventoryType: lane.isLadder ? "" : lane.inventoryType,
            inventoryName: lane.isLadder ? "" : lane.inventoryName,
          };
          if (lane.dbId) {
            await fetch(`/api/files/${file.id}/annotation/lanes`, {
              method: "PUT",
              headers: { ...authHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({ laneId: lane.dbId, ...payload }),
            });
          } else {
            const res = await fetch(`/api/files/${file.id}/annotation/lanes`, {
              method: "POST",
              headers: { ...authHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({ annotationId: ann!.id, laneNumber: i + 1, ...payload }),
            });
            if (res.ok) {
              const created = await res.json() as { id: string };
              setLanes((prev) => prev.map((l, idx) => idx === i ? { ...l, dbId: created.id } : l));
            }
          }
        }
      }

      // Sync peaks
      if (isChrom) {
        for (let i = 0; i < peaks.length; i++) {
          const peak = peaks[i];
          const rv = peak.retentionVolume !== "" ? parseFloat(peak.retentionVolume) : null;
          const payload = {
            label: peak.label,
            retentionVolume: isNaN(rv as number) ? null : rv,
            inventoryId: peak.inventoryId,
            inventoryType: peak.inventoryType,
            inventoryName: peak.inventoryName,
          };
          if (peak.dbId) {
            await fetch(`/api/files/${file.id}/annotation/peaks`, {
              method: "PUT",
              headers: { ...authHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({ peakId: peak.dbId, ...payload }),
            });
          } else {
            const res = await fetch(`/api/files/${file.id}/annotation/peaks`, {
              method: "POST",
              headers: { ...authHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({ annotationId: ann!.id, peakNumber: i + 1, ...payload }),
            });
            if (res.ok) {
              const created = await res.json() as { id: string };
              setPeaks((prev) => prev.map((p, idx) => idx === i ? { ...p, dbId: created.id } : p));
            }
          }
        }
      }

      flash("Saved ✓");
    } finally {
      setSaving(false);
    }
  }, [annotation, file, authHeaders, currentUserId, fileType, notes, lanes, peaks, isGel, isChrom, onAnnotationChange]);

  async function handleDelete() {
    if (!annotation) return;
    if (!window.confirm("Delete this annotation and all lane/peak data? This cannot be undone.")) return;
    await fetch(`/api/files/${file.id}/annotation`, { method: "DELETE", headers: authHeaders });
    setAnnotation(null);
    setLanes(Array.from({ length: 10 }, emptyLane));
    setPeaks([]);
    setNotes("");
    onAnnotationChange(false);
    flash("Annotation deleted");
  }

  function fileIcon(mimeType: string) {
    if (mimeType === "application/pdf") return "📄";
    if (mimeType === "text/csv" || mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
    if (mimeType.startsWith("text/")) return "📝";
    if (mimeType.startsWith("video/")) return "🎬";
    return "📎";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-[80vh] w-[85vw] max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{file.fileName}</span>
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500"
          >
            {FILE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button onClick={onClose} className="text-zinc-500 transition hover:text-zinc-200">✕</button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          {/* Left — image/icon preview */}
          <div className="flex w-[45%] shrink-0 items-center justify-center border-r border-zinc-800 bg-zinc-900/50 p-4">
            {isImage && previewUrl ? (
              <img
                src={previewUrl}
                alt={file.fileName}
                className="max-h-full max-w-full rounded object-contain"
              />
            ) : (
              <span className="text-6xl opacity-60">{isImage ? "📎" : fileIcon(file.mimeType)}</span>
            )}
          </div>

          {/* Right — annotation form */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* GEL: lane rows */}
              {isGel && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-xs font-medium text-zinc-400">Wells</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={wellCount}
                      onChange={(e) => setWellCount(e.target.value)}
                      className="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 outline-none"
                    />
                    <button
                      onClick={applyWellCount}
                      className="rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition"
                    >
                      Set wells
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {lanes.map((lane, i) => (
                      <div key={i} className="flex items-start gap-1.5 rounded border border-zinc-800 bg-zinc-900 p-1.5">
                        <span className="w-5 shrink-0 pt-0.5 text-center text-[10px] font-mono text-zinc-500">{i + 1}</span>

                        {/* Ladder/Sample toggle */}
                        <button
                          onClick={() => updateLane(i, { isLadder: !lane.isLadder, ladderId: null, ladderName: "", contents: "", inventoryId: "", inventoryType: "", inventoryName: "" })}
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium transition ${lane.isLadder ? "border-sky-500/50 bg-sky-900/30 text-sky-300" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                        >
                          {lane.isLadder ? "Ladder" : "Sample"}
                        </button>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          {lane.isLadder ? (
                            <div className="flex gap-1">
                              <select
                                value={lane.ladderId ?? "__custom__"}
                                onChange={(e) => {
                                  if (e.target.value === "__custom__") {
                                    updateLane(i, { ladderId: null, ladderName: lane.ladderName });
                                  } else {
                                    const found = ladders.find((l) => l.id === e.target.value);
                                    updateLane(i, { ladderId: e.target.value, ladderName: found?.name ?? "" });
                                  }
                                }}
                                className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 outline-none"
                              >
                                <option value="">— select ladder —</option>
                                {ladders.map((l) => (
                                  <option key={l.id} value={l.id}>{l.name} ({l.manufacturer})</option>
                                ))}
                                <option value="__custom__">Custom…</option>
                              </select>
                              {!lane.ladderId && (
                                <input
                                  value={lane.ladderName}
                                  onChange={(e) => updateLane(i, { ladderName: e.target.value })}
                                  placeholder="Ladder name"
                                  className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none"
                                />
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <InventorySearch
                                value={{ inventoryId: lane.inventoryId, inventoryName: lane.inventoryName, inventoryType: lane.inventoryType }}
                                onSelect={(item) => updateLane(i, { inventoryId: item.id, inventoryType: item.type, inventoryName: item.name, contents: "" })}
                                onClearInventory={() => updateLane(i, { inventoryId: "", inventoryType: "", inventoryName: "" })}
                                authHeaders={authHeaders}
                              />
                              {!lane.inventoryId && (
                                <input
                                  value={lane.contents}
                                  onChange={(e) => updateLane(i, { contents: e.target.value })}
                                  placeholder="Contents (free text)"
                                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none"
                                />
                              )}
                            </div>
                          )}
                        </div>

                        <button onClick={() => clearLane(i)} className="shrink-0 pt-0.5 text-xs text-zinc-600 hover:text-red-400 transition">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CHROMATOGRAM: peak rows */}
              {isChrom && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <label className="text-xs font-medium text-zinc-400">Peaks</label>
                    <input
                      type="number"
                      min={1}
                      value={peakCount}
                      onChange={(e) => setPeakCount(e.target.value)}
                      className="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200 outline-none"
                    />
                    <button
                      onClick={applyPeakCount}
                      className="rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition"
                    >
                      Set peaks
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {peaks.map((peak, i) => (
                      <div key={i} className="flex items-start gap-1.5 rounded border border-zinc-800 bg-zinc-900 p-1.5">
                        <span className="w-5 shrink-0 pt-0.5 text-center text-[10px] font-mono text-zinc-500">{i + 1}</span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex gap-1">
                            <input
                              value={peak.label}
                              onChange={(e) => updatePeak(i, { label: e.target.value })}
                              placeholder="Label (e.g. target protein)"
                              className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none"
                            />
                            <div className="flex items-center gap-0.5">
                              <input
                                type="number"
                                step="0.1"
                                value={peak.retentionVolume}
                                onChange={(e) => updatePeak(i, { retentionVolume: e.target.value })}
                                placeholder="mL"
                                className="w-16 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none"
                              />
                              <span className="text-[10px] text-zinc-500">mL</span>
                            </div>
                          </div>
                          <InventorySearch
                            value={{ inventoryId: peak.inventoryId, inventoryName: peak.inventoryName, inventoryType: peak.inventoryType }}
                            onSelect={(item) => updatePeak(i, { inventoryId: item.id, inventoryType: item.type, inventoryName: item.name })}
                            onClearInventory={() => updatePeak(i, { inventoryId: "", inventoryType: "", inventoryName: "" })}
                            authHeaders={authHeaders}
                          />
                        </div>
                        <button onClick={() => clearPeak(i)} className="shrink-0 pt-0.5 text-xs text-zinc-600 hover:text-red-400 transition">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes (all types) */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Additional notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes…"
                  rows={3}
                  className="w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 flex items-center justify-between border-t border-zinc-800 px-4 py-2.5">
              <div>
                {annotation && (
                  <button onClick={handleDelete} className="text-xs text-red-600/70 hover:text-red-400 transition">
                    Delete annotation
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {saveMsg && <span className="text-xs text-emerald-400">{saveMsg}</span>}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded border border-indigo-500/60 bg-indigo-600/30 px-3 py-1 text-xs font-medium text-indigo-200 transition hover:bg-indigo-600/50 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
