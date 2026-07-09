"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppTopNav from "@/components/AppTopNav";
import { calculateTransfection, calculateDilutionToDensity, calculateExpressionSchedule, type PlasmidRow, type ProtocolType } from "@/lib/transfection";

interface PlasmidOption { id: string; name: string }
interface Row { key: string; plasmidId: string; name: string; stockConc: string; ratio: string }

const FLASK_PRESETS = [30, 50, 100, 250, 500, 1000];
const PROTOCOL_TYPES = ["Standard", "High Titer", "Max Titer"] as const;
type VolumeMode = "FIXED" | "DILUTE" | "EXACT";

const PROTOCOL_KEY: Record<(typeof PROTOCOL_TYPES)[number], ProtocolType> = {
  "Standard": "STANDARD", "High Titer": "HIGH_TITER", "Max Titer": "MAX_TITER",
};

let rowSeq = 0;
const newRow = (): Row => ({ key: `r${rowSeq++}`, plasmidId: "", name: "", stockConc: "", ratio: "1" });
const fmt = (n: number, dp = 1) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: dp });
const mL = (ul: number) => (ul / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 }); // µL → mL display

export default function TransfectionCalculatorPage() {
  const router = useRouter();
  const [plasmidOptions, setPlasmidOptions] = useState<PlasmidOption[]>([]);
  const [runName, setRunName] = useState("");
  const [saving, setSaving] = useState(false);
  const [startError, setStartError] = useState("");
  const [protocolType, setProtocolType] = useState<(typeof PROTOCOL_TYPES)[number]>("Standard");
  const [finalConc, setFinalConc] = useState("0.6");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [copied, setCopied] = useState(false);

  // Volume: one authoritative "transfected volume", populated by the chosen mode.
  const [volumeMode, setVolumeMode] = useState<VolumeMode>("FIXED");
  const [flaskPreset, setFlaskPreset] = useState("50");
  const [measuredDensity, setMeasuredDensity] = useState("");
  const [startingVolume, setStartingVolume] = useState("");
  const [finalVolume, setFinalVolume] = useState("50");

  useEffect(() => {
    fetch("/api/inventory/plasmids").then((r) => (r.ok ? r.json() : []))
      .then((d: PlasmidOption[]) => setPlasmidOptions(Array.isArray(d) ? d.map((p) => ({ id: p.id, name: p.name })) : []))
      .catch(() => setPlasmidOptions([]));
  }, []);

  const cultureVolumeMl = Number(finalVolume) || 0;
  const dilution = useMemo(
    () => calculateDilutionToDensity(Number(measuredDensity) || 0, Number(startingVolume) || 0),
    [measuredDensity, startingVolume],
  );

  async function selectPlasmid(key: string, plasmidId: string) {
    const opt = plasmidOptions.find((p) => p.id === plasmidId);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, plasmidId, name: opt?.name ?? r.name } : r)));
    if (!plasmidId) return;
    try {
      const preps = (await fetch(`/api/inventory/plasmids/${plasmidId}/preps`).then((r) => r.json())) as Array<{ concentration: number | null }>;
      const latest = preps.find((p) => p.concentration != null);
      if (latest?.concentration != null) setRows((prev) => prev.map((r) => (r.key === key ? { ...r, stockConc: String(latest.concentration) } : r)));
    } catch { /* leave blank */ }
  }
  const updateRow = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const result = useMemo(() => {
    const plasmids: PlasmidRow[] = rows.map((r) => ({ name: r.name || "(unnamed plasmid)", stockConcNgUl: Number(r.stockConc) || 0, ratio: Number(r.ratio) || 0 }));
    return calculateTransfection({ cultureVolumeMl, finalConcUgMl: Number(finalConc) || 0, plasmids });
  }, [rows, cultureVolumeMl, finalConc]);

  const schedule = useMemo(() => calculateExpressionSchedule(cultureVolumeMl, PROTOCOL_KEY[protocolType]), [cultureVolumeMl, protocolType]);

  const showRatio = rows.length > 1;
  const suggestedName = useMemo(() => {
    const first = rows.find((r) => r.name)?.name;
    return `${first ? first + " " : ""}Expression ${new Date().toISOString().slice(0, 10)}`;
  }, [rows]);

  const checklist = useMemo(() => {
    if (result.errors.length > 0) return "";
    const L: string[] = [`Culture volume: ${fmt(cultureVolumeMl)} mL · ${protocolType}`, "",
      "DAY 0 — DNA COMPLEXATION (use cold reagents, work quickly)", "", "DNA preparation:"];
    for (const p of result.plasmids) L.push(`  ${p.name}: ${fmt(p.amountUg)} µg → ${fmt(p.volumeUl)} µL  (stock ${fmt(p.stockConcNgUl, 0)} ng/µL)`);
    L.push(`  TOTAL: ${fmt(result.totalDnaUg)} µg / ${fmt(result.totalDnaVolumeUl)} µL`, "");
    L.push(`□ Add ${mL(result.optiproForDnaUl)} mL cold OptiPRO SFM to a sterile tube`);
    for (const p of result.plasmids) L.push(`□ Add ${p.name}: ${fmt(p.volumeUl)} µL`);
    L.push("□ Mix gently by swirling", "", "ExpiFectamine preparation (separate tube, cold):");
    L.push(`□ Add ${mL(result.optiproForExpifectamineUl)} mL cold OptiPRO SFM`);
    L.push(`□ Add ${fmt(result.expifectamineUl)} µL ExpiFectamine CHO — mix gently, 2–3 inversions`);
    L.push("□ Add ExpiFectamine mixture to DNA tube immediately", "□ Mix by inversion 3–4×, incubate 1–5 min at RT", "□ Add dropwise to flask while swirling", "");
    L.push("DAY 1 (18–22 h post-transfection):");
    L.push(`□ Add ExpiCHO Enhancer: ${fmt(schedule.enhancerUl)} µL`);
    L.push(`□ Add ExpiCHO Feed: ${fmt(schedule.feedMl, 2)} mL`);
    L.push(schedule.tempShiftC ? `□ Shift culture to ${schedule.tempShiftC} °C` : "□ Keep culture at 37 °C");
    if (schedule.feed2Ml != null) {
      L.push("", "DAY 5:", `□ Add ExpiCHO Feed (2nd): ${fmt(schedule.feed2Ml, 2)} mL`);
    }
    L.push("", `HARVEST: day ${schedule.harvestDayStart}–${schedule.harvestDayEnd} post-transfection.`);
    return L.join("\n");
  }, [result, schedule, cultureVolumeMl, protocolType]);

  async function startRun() {
    if (result.errors.length > 0 || saving) return;
    setSaving(true);
    setStartError("");
    const activeRows = rows.filter((r) => (Number(r.ratio) || 0) > 0);
    const payload = {
      name: runName.trim() || suggestedName,
      protocolType: PROTOCOL_KEY[protocolType],
      cultureVolumeMl,
      volumeMode,
      measuredDensityE6: volumeMode === "DILUTE" ? Number(measuredDensity) || null : null,
      startingVolumeMl: volumeMode === "DILUTE" ? Number(startingVolume) || null : null,
      finalDnaConcUgMl: Number(finalConc) || 0.8,
      totalDnaUg: result.totalDnaUg,
      totalDnaVolumeUl: result.totalDnaVolumeUl,
      tubeVolumeUl: result.tubeVolumeUl,
      optiproForDnaUl: result.optiproForDnaUl,
      expifectamineUl: result.expifectamineUl,
      optiproForExpifectUl: result.optiproForExpifectamineUl,
      plasmids: activeRows.map((r, i) => ({
        plasmidId: r.plasmidId || null,
        name: r.name || result.plasmids[i]?.name || `Plasmid ${i + 1}`,
        stockConcNgUl: Number(r.stockConc) || 0,
        ratio: Number(r.ratio) || 0,
        amountUg: result.plasmids[i]?.amountUg ?? 0,
        volumeUl: result.plasmids[i]?.volumeUl ?? 0,
      })),
    };
    try {
      const res = await fetch("/api/expression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `HTTP ${res.status}`);
      const run = await res.json();
      router.push(`/protocols/transfection/${run.id}`);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Failed to start run");
      setSaving(false);
    }
  }

  const inp = "rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />
      <div className="mx-auto max-w-5xl">
        <a href="/protocols" className="text-sm text-zinc-400 transition hover:text-white">← Protocols</a>
        <h1 className="mt-1 text-2xl font-bold text-white">New Transfection <span className="ml-2 rounded bg-rose-600/20 px-2 py-0.5 align-middle text-xs font-medium text-rose-300">TRANSFECTION</span></h1>
        <p className="mb-6 text-sm text-zinc-400">ExpiCHO transfection / antibody co-transfection — DNA, OptiPRO and ExpiFectamine volumes.</p>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Inputs ─────────────────────────────── */}
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
                  <label className="mb-1 block text-xs text-zinc-400">Final DNA conc. (µg/mL)</label>
                  <input type="number" step="0.1" value={finalConc} onChange={(e) => setFinalConc(e.target.value)} className={`${inp} w-28`} />
                  <p className="mt-1 text-[11px] text-zinc-600">range 0.5–1.0 · default 0.8</p>
                </div>
              </div>
            </div>

            {/* Volume */}
            <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">2 · Culture volume</h2>
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {([["FIXED", "Fixed flask"], ["DILUTE", "Dilute to 6×10⁶"], ["EXACT", "Exact volume"]] as [VolumeMode, string][]).map(([m, label]) => (
                  <button key={m} onClick={() => setVolumeMode(m)} className={`rounded-full border px-3 py-1 ${volumeMode === m ? "border-indigo-500 bg-indigo-600/25 text-indigo-200" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>{label}</button>
                ))}
              </div>

              {volumeMode === "FIXED" && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Flask size</label>
                  <select value={flaskPreset} onChange={(e) => { setFlaskPreset(e.target.value); setFinalVolume(e.target.value); }} className={inp}>
                    {FLASK_PRESETS.map((v) => <option key={v} value={String(v)}>{v} mL</option>)}
                  </select>
                </div>
              )}

              {volumeMode === "DILUTE" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">Measured density (×10⁶/mL)</label>
                      <input type="number" step="0.1" value={measuredDensity} onChange={(e) => setMeasuredDensity(e.target.value)} className={`${inp} w-36`} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">Starting volume (mL)</label>
                      <input type="number" value={startingVolume} onChange={(e) => setStartingVolume(e.target.value)} className={`${inp} w-32`} />
                    </div>
                  </div>
                  {dilution.finalVolumeMl > 0 && (
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-200">
                      Dilute with <b>{fmt(dilution.mediaToAddMl)} mL</b> media → <b>{fmt(dilution.finalVolumeMl)} mL</b> at 6×10⁶/mL.
                      {dilution.note && <span className="block text-amber-300">{dilution.note}</span>}
                      <button onClick={() => setFinalVolume(String(dilution.finalVolumeMl))} className="mt-1 block text-cyan-300 underline hover:text-cyan-100">Use {fmt(dilution.finalVolumeMl)} mL as transfected volume</button>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 border-t border-white/5 pt-3">
                <label className="mb-1 block text-xs font-medium text-zinc-300">Volume transfected (mL) — drives all calculations</label>
                <input type="number" value={finalVolume} onChange={(e) => setFinalVolume(e.target.value)} className={`${inp} w-40`} />
                <p className="mt-1 text-[11px] text-zinc-600">Enter the actual volume you transfected (recommended 50/100/250… or a scaled value).</p>
              </div>
            </div>

            {/* Plasmids */}
            <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">3 · DNA (plasmids)</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                    <th className="pb-1 pr-2">Plasmid</th><th className="pb-1 pr-2">Stock (ng/µL)</th>{showRatio && <th className="pb-1 pr-2">Ratio</th>}<th className="pb-1" />
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
                      <td className="py-1 pr-2"><input type="number" value={r.stockConc} onChange={(e) => updateRow(r.key, { stockConc: e.target.value })} placeholder="NanoDrop" className={`${inp} w-28`} /></td>
                      {showRatio && <td className="py-1 pr-2"><input type="number" step="0.1" value={r.ratio} onChange={(e) => updateRow(r.key, { ratio: e.target.value })} className={`${inp} w-16`} /></td>}
                      <td className="py-1 text-right">{rows.length > 1 && <button onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} className="text-xs text-red-400/70 hover:text-red-300">Remove</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setRows((prev) => [...prev, newRow()])} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300">+ Add plasmid</button>
              {rows.length > 1 && <p className="mt-1 text-[11px] text-zinc-600">Ratios are relative (1:1, 2:1…) — normalized automatically. Ratio 0 removes a plasmid.</p>}
            </div>
          </div>

          {/* ── Output ─────────────────────────────── */}
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">DNA preparation</h2>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-zinc-500"><th className="px-2 py-1">Plasmid</th><th className="px-2 py-1 text-right">Amount (µg)</th><th className="px-2 py-1 text-right">Volume (µL)</th></tr></thead>
                <tbody>
                  {result.plasmids.map((p, i) => (
                    <tr key={i} className="border-b border-white/5"><td className="px-2 py-1 text-white">{p.name}</td><td className="px-2 py-1 text-right text-zinc-300">{fmt(p.amountUg)}</td><td className="px-2 py-1 text-right text-zinc-300">{fmt(p.volumeUl)}</td></tr>
                  ))}
                  <tr className="font-medium"><td className="px-2 py-1 text-zinc-400">Total</td><td className="px-2 py-1 text-right text-white">{fmt(result.totalDnaUg)} µg</td><td className="px-2 py-1 text-right text-white">{fmt(result.totalDnaVolumeUl)} µL</td></tr>
                </tbody>
              </table>
            </div>

            {result.errors.map((e, i) => <div key={i} className="rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-300">⚠ {e}</div>)}
            {result.warnings.map((w, i) => <div key={i} className="rounded-lg border border-amber-600/50 bg-amber-900/25 px-3 py-2 text-sm text-amber-300">⚠ {w}</div>)}

            {result.errors.length === 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-emerald-200">Transfection checklist (Day 0 → harvest)</h2>
                  <button onClick={() => navigator.clipboard?.writeText(checklist).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})} className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10">{copied ? "Copied ✓" : "Copy"}</button>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-200">{checklist}</pre>
              </div>
            )}

            {result.errors.length === 0 && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
                <button
                  onClick={startRun}
                  disabled={saving}
                  className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
                >
                  {saving ? "Starting…" : "Start Transfection →"}
                </button>
                {startError && <p className="mt-2 text-center text-xs text-red-300">⚠ {startError}</p>}
                <p className="mt-2 text-center text-[11px] text-zinc-500">Saves a tracked run with scheduled Day-1 enhancer/feed, Day-5 feed and a harvest window.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
