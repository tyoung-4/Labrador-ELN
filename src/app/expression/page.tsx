"use client";

import React, { useEffect, useMemo, useState } from "react";
import AppTopNav from "@/components/AppTopNav";
import { calculateTransfection, type PlasmidRow } from "@/lib/transfection";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlasmidOption { id: string; name: string }
interface Row { key: string; plasmidId: string; name: string; stockConc: string; ratio: string }

const FLASK_PRESETS = [30, 50, 100, 200, 500, 1000];
const PROTOCOL_TYPES = ["Standard", "High Titer", "Max Titer"] as const;

let rowSeq = 0;
const newRow = (): Row => ({ key: `r${rowSeq++}`, plasmidId: "", name: "", stockConc: "", ratio: "1" });

function fmt(n: number, dp = 1): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: dp });
}

export default function ExpressionCalculatorPage() {
  const [plasmidOptions, setPlasmidOptions] = useState<PlasmidOption[]>([]);
  const [runName, setRunName] = useState("");
  const [protocolType, setProtocolType] = useState<(typeof PROTOCOL_TYPES)[number]>("Standard");
  const [flask, setFlask] = useState<string>("50");
  const [customVolume, setCustomVolume] = useState("50");
  const [finalConc, setFinalConc] = useState("0.6");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/inventory/plasmids")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: PlasmidOption[]) => setPlasmidOptions(Array.isArray(d) ? d.map((p) => ({ id: p.id, name: p.name })) : []))
      .catch(() => setPlasmidOptions([]));
  }, []);

  const cultureVolumeMl = flask === "custom" ? Number(customVolume) || 0 : Number(flask);

  // Pre-fill stock concentration from the plasmid's latest prep (user can override).
  async function selectPlasmid(key: string, plasmidId: string) {
    const opt = plasmidOptions.find((p) => p.id === plasmidId);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, plasmidId, name: opt?.name ?? r.name } : r)));
    if (!plasmidId) return;
    try {
      const preps = (await fetch(`/api/inventory/plasmids/${plasmidId}/preps`).then((r) => r.json())) as Array<{ concentration: number | null }>;
      const latest = preps.find((p) => p.concentration != null);
      if (latest?.concentration != null) {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, stockConc: String(latest.concentration) } : r)));
      }
    } catch { /* no preps — leave blank for manual entry */ }
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const result = useMemo(() => {
    const plasmids: PlasmidRow[] = rows.map((r) => ({
      name: r.name || "(unnamed plasmid)",
      stockConcNgUl: Number(r.stockConc) || 0,
      ratio: Number(r.ratio) || 0,
    }));
    return calculateTransfection({ cultureVolumeMl, finalConcUgMl: Number(finalConc) || 0, plasmids });
  }, [rows, cultureVolumeMl, finalConc]);

  const showRatio = rows.length > 1;
  const suggestedName = useMemo(() => {
    const first = rows.find((r) => r.name)?.name;
    const d = new Date().toISOString().slice(0, 10);
    return first ? `${first} Expression ${d}` : `Expression ${d}`;
  }, [rows]);

  const checklist = useMemo(() => {
    if (result.errors.length > 0) return "";
    const lines: string[] = [];
    lines.push("DAY 0 — DNA COMPLEXATION (use cold reagents, work quickly)", "");
    lines.push("DNA preparation:");
    for (const p of result.plasmids) lines.push(`  ${p.name}: ${fmt(p.amountUg)} µg → ${fmt(p.volumeUl)} µL  (stock ${fmt(p.stockConcNgUl, 0)} ng/µL)`);
    lines.push(`  TOTAL: ${fmt(result.totalDnaUg)} µg / ${fmt(result.totalDnaVolumeUl)} µL`, "");
    lines.push(`□ Add ${fmt(result.optiproForDnaUl)} µL cold OptiPRO to a sterile tube`);
    for (const p of result.plasmids) lines.push(`□ Add ${p.name}: ${fmt(p.volumeUl)} µL`);
    lines.push("□ Mix gently by swirling", "");
    lines.push("ExpiFectamine preparation (separate tube, cold):");
    lines.push(`□ Add ${fmt(result.optiproForExpifectamineUl)} µL cold OptiPRO`);
    lines.push(`□ Add ${fmt(result.expifectamineUl)} µL ExpiFectamine CHO — mix gently, 2–3 inversions`);
    lines.push("□ Add ExpiFectamine mixture to DNA tube immediately");
    lines.push("□ Mix by inversion 3–4×, incubate 1–5 min at RT");
    lines.push("□ Add dropwise to flask while swirling");
    return lines.join("\n");
  }, [result]);

  function copyChecklist() {
    navigator.clipboard?.writeText(checklist).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  const inp = "rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-white">ExpiCHO Transfection</h1>
        <p className="mb-6 text-sm text-zinc-400">Calculate DNA, OptiPRO and ExpiFectamine volumes for a transfection or antibody co-transfection.</p>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Inputs ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">1 · Setup</h2>
              <label className="mb-1 block text-xs text-zinc-400">Run name</label>
              <input value={runName} onChange={(e) => setRunName(e.target.value)} placeholder={suggestedName} className={`${inp} mb-3 w-full`} />
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Protocol type</label>
                  <select value={protocolType} onChange={(e) => setProtocolType(e.target.value as typeof protocolType)} className={inp}>
                    {PROTOCOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Culture volume</label>
                  <div className="flex items-center gap-2">
                    <select value={flask} onChange={(e) => setFlask(e.target.value)} className={inp}>
                      {FLASK_PRESETS.map((v) => <option key={v} value={String(v)}>{v} mL</option>)}
                      <option value="custom">Custom…</option>
                    </select>
                    {flask === "custom" && (
                      <input type="number" value={customVolume} onChange={(e) => setCustomVolume(e.target.value)} className={`${inp} w-24`} /> )}
                    {flask === "custom" && <span className="text-xs text-zinc-500">mL</span>}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Final DNA conc. (µg/mL)</label>
                  <input type="number" step="0.1" value={finalConc} onChange={(e) => setFinalConc(e.target.value)} className={`${inp} w-28`} />
                  <p className="mt-1 text-[11px] text-zinc-600">range 0.5–1.0 · default 0.8</p>
                </div>
              </div>
            </div>

            {/* Plasmid table */}
            <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">2 · DNA (plasmids)</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                    <th className="pb-1 pr-2">Plasmid</th>
                    <th className="pb-1 pr-2">Stock (ng/µL)</th>
                    {showRatio && <th className="pb-1 pr-2">Ratio</th>}
                    <th className="pb-1" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td className="py-1 pr-2">
                        <select value={r.plasmidId} onChange={(e) => selectPlasmid(r.key, e.target.value)} className={`${inp} w-full`}>
                          <option value="">— select plasmid —</option>
                          {plasmidOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <input type="number" value={r.stockConc} onChange={(e) => updateRow(r.key, { stockConc: e.target.value })} placeholder="NanoDrop" className={`${inp} w-28`} />
                      </td>
                      {showRatio && (
                        <td className="py-1 pr-2">
                          <input type="number" step="0.1" value={r.ratio} onChange={(e) => updateRow(r.key, { ratio: e.target.value })} className={`${inp} w-16`} />
                        </td>
                      )}
                      <td className="py-1 text-right">
                        {rows.length > 1 && (
                          <button onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} className="text-xs text-red-400/70 hover:text-red-300">Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setRows((prev) => [...prev, newRow()])} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300">+ Add plasmid</button>
              {rows.length > 1 && <p className="mt-1 text-[11px] text-zinc-600">Ratios are relative (e.g. 1:1, 2:1) — the calculator normalizes them. A ratio of 0 removes a plasmid.</p>}
            </div>
          </div>

          {/* ── Output ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">DNA preparation</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                    <th className="px-2 py-1">Plasmid</th>
                    <th className="px-2 py-1 text-right">Amount (µg)</th>
                    <th className="px-2 py-1 text-right">Volume (µL)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.plasmids.map((p, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="px-2 py-1 text-white">{p.name}</td>
                      <td className="px-2 py-1 text-right text-zinc-300">{fmt(p.amountUg)}</td>
                      <td className="px-2 py-1 text-right text-zinc-300">{fmt(p.volumeUl)}</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className="px-2 py-1 text-zinc-400">Total</td>
                    <td className="px-2 py-1 text-right text-white">{fmt(result.totalDnaUg)} µg</td>
                    <td className="px-2 py-1 text-right text-white">{fmt(result.totalDnaVolumeUl)} µL</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {result.errors.map((e, i) => (
              <div key={i} className="rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-300">⚠ {e}</div>
            ))}
            {result.warnings.map((w, i) => (
              <div key={i} className="rounded-lg border border-amber-600/50 bg-amber-900/25 px-3 py-2 text-sm text-amber-300">⚠ {w}</div>
            ))}

            {result.errors.length === 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-emerald-200">Day 0 — complexation checklist</h2>
                  <button onClick={copyChecklist} className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10">{copied ? "Copied ✓" : "Copy"}</button>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-200">{checklist}</pre>
              </div>
            )}

            <p className="text-center text-[11px] text-zinc-600">
              Saving this as a tracked multi-day expression run (timeline, harvest date, ProteinStock) is coming next.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
