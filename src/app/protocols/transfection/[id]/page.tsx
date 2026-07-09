"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppTopNav from "@/components/AppTopNav";

interface ExprPlasmid { id: string; name: string; stockConcNgUl: number; ratio: number; amountUg: number; volumeUl: number; order: number }
interface ExprAction { id: string; type: string; label: string; dayOffset: number; scheduledDate: string; detail: string; done: boolean; doneAt: string | null; doneBy: string | null }
interface ExprRun {
  id: string; name: string; protocolType: string; status: string;
  cultureVolumeMl: number; volumeMode: string; finalDnaConcUgMl: number;
  totalDnaUg: number | null; totalDnaVolumeUl: number | null; tubeVolumeUl: number | null;
  optiproForDnaUl: number | null; expifectamineUl: number | null; optiproForExpifectUl: number | null;
  day0Date: string; harvestWindowStart: string | null; harvestWindowEnd: string | null; harvestedAt: string | null;
  createdBy: string; notes: string;
  plasmids: ExprPlasmid[]; actions: ExprAction[];
}

const PROTOCOL_LABEL: Record<string, string> = { STANDARD: "Standard", HIGH_TITER: "High Titer", MAX_TITER: "Max Titer" };
const DAY_MS = 86_400_000;
const fmt = (n: number | null | undefined, dp = 1) => (n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: dp }));
const mL = (ul: number | null | undefined) => (ul == null ? "—" : (ul / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 }));
const dateStr = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "—");

export default function TransfectionTimelinePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [run, setRun] = useState<ExprRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/expression/${id}`);
    if (res.ok) setRun(await res.json());
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const currentDay = useMemo(() => {
    if (!run) return 0;
    const day0 = new Date(run.day0Date).getTime();
    return Math.floor((Date.now() - day0) / DAY_MS);
  }, [run]);

  async function toggleAction(a: ExprAction) {
    if (!run) return;
    setBusy(a.id);
    // optimistic
    setRun({ ...run, actions: run.actions.map((x) => (x.id === a.id ? { ...x, done: !a.done } : x)) });
    await fetch(`/api/expression/${id}/actions/${a.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !a.done }),
    }).catch(() => {});
    await load();
    setBusy(null);
  }

  async function setStatus(status: string) {
    if (!run) return;
    setBusy("status");
    await fetch(`/api/expression/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    }).catch(() => {});
    await load();
    setBusy(null);
  }

  async function remove() {
    if (!confirm("Delete this transfection run? This cannot be undone.")) return;
    await fetch(`/api/expression/${id}`, { method: "DELETE" }).catch(() => {});
    router.push("/protocols");
  }

  if (loading) return <div className="min-h-screen bg-zinc-950 p-6 text-zinc-400"><AppTopNav /><p className="mx-auto max-w-4xl">Loading…</p></div>;
  if (!run) return <div className="min-h-screen bg-zinc-950 p-6 text-zinc-400"><AppTopNav /><p className="mx-auto max-w-4xl">Run not found. <a href="/protocols" className="text-indigo-400 underline">Back to protocols</a></p></div>;

  const statusColor = run.status === "HARVESTED" ? "bg-emerald-600/20 text-emerald-300"
    : run.status === "CANCELLED" ? "bg-zinc-600/30 text-zinc-400" : "bg-amber-600/20 text-amber-300";
  const inHarvestWindow = run.harvestWindowStart && run.harvestWindowEnd &&
    Date.now() >= new Date(run.harvestWindowStart).getTime() && Date.now() <= new Date(run.harvestWindowEnd).getTime() + DAY_MS;

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />
      <div className="mx-auto max-w-4xl">
        <a href="/protocols" className="text-sm text-zinc-400 transition hover:text-white">← Protocols</a>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-white">{run.name}</h1>
          <span className="rounded bg-rose-600/20 px-2 py-0.5 text-xs font-medium text-rose-300">TRANSFECTION</span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}>{run.status.replace("_", " ")}</span>
        </div>
        <p className="mb-4 text-sm text-zinc-400">
          {PROTOCOL_LABEL[run.protocolType] ?? run.protocolType} · {fmt(run.cultureVolumeMl)} mL · Day 0 {dateStr(run.day0Date)}
          {run.createdBy && <> · by {run.createdBy}</>}
          {run.status === "IN_PROGRESS" && <> · <b className="text-zinc-200">today is day {currentDay}</b></>}
        </p>

        {inHarvestWindow && run.status === "IN_PROGRESS" && (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            🧫 In the harvest window ({dateStr(run.harvestWindowStart)} – {dateStr(run.harvestWindowEnd)}). Harvest when titer looks good.
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Day 0 reference */}
          <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Day 0 — DNA complexation (reference)</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-zinc-500"><th className="px-1 py-1">Plasmid</th><th className="px-1 py-1 text-right">µg</th><th className="px-1 py-1 text-right">µL</th></tr></thead>
              <tbody>
                {run.plasmids.map((p) => (
                  <tr key={p.id} className="border-b border-white/5"><td className="px-1 py-1 text-white">{p.name}{run.plasmids.length > 1 && <span className="text-zinc-500"> ({fmt(p.ratio)})</span>}</td><td className="px-1 py-1 text-right text-zinc-300">{fmt(p.amountUg)}</td><td className="px-1 py-1 text-right text-zinc-300">{fmt(p.volumeUl)}</td></tr>
                ))}
                <tr className="font-medium"><td className="px-1 py-1 text-zinc-400">Total</td><td className="px-1 py-1 text-right text-white">{fmt(run.totalDnaUg)}</td><td className="px-1 py-1 text-right text-white">{fmt(run.totalDnaVolumeUl)}</td></tr>
              </tbody>
            </table>
            <ul className="mt-3 space-y-1 text-xs text-zinc-300">
              <li>DNA tube: <b>{mL(run.optiproForDnaUl)} mL</b> cold OptiPRO SFM + {fmt(run.totalDnaVolumeUl)} µL DNA</li>
              <li>ExpiFectamine tube: <b>{mL(run.optiproForExpifectUl)} mL</b> OptiPRO + <b>{fmt(run.expifectamineUl)} µL</b> ExpiFectamine CHO</li>
              <li className="text-zinc-500">Final DNA conc. {fmt(run.finalDnaConcUgMl)} µg/mL</li>
            </ul>
          </div>

          {/* Scheduled actions */}
          <div className="rounded-xl border border-white/10 bg-zinc-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Schedule</h2>
            <ul className="space-y-2">
              {run.actions.map((a) => {
                const due = !a.done && currentDay >= a.dayOffset && run.status === "IN_PROGRESS";
                const isHarvest = a.type === "HARVEST";
                return (
                  <li key={a.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${due ? "border-amber-500/40 bg-amber-500/5" : "border-white/5"}`}>
                    {!isHarvest ? (
                      <input type="checkbox" checked={a.done} disabled={busy === a.id || run.status !== "IN_PROGRESS"} onChange={() => toggleAction(a)} className="mt-0.5 h-4 w-4 accent-rose-500" />
                    ) : <span className="mt-0.5">🧫</span>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm ${a.done ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
                          {a.label}{a.detail && <span className="text-zinc-400">: {a.detail}</span>}
                        </span>
                        <span className="shrink-0 text-[11px] text-zinc-500">Day {a.dayOffset} · {dateStr(a.scheduledDate)}</span>
                      </div>
                      {a.done && a.doneBy && <p className="text-[11px] text-emerald-400/80">✓ {a.doneBy}{a.doneAt ? ` · ${dateStr(a.doneAt)}` : ""}</p>}
                      {due && <p className="text-[11px] text-amber-400">Due now</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {run.notes && <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900 p-4 text-sm text-zinc-300"><h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Notes</h2>{run.notes}</div>}

        {/* Actions bar */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
          {run.status === "IN_PROGRESS" && (
            <>
              <button onClick={() => setStatus("HARVESTED")} disabled={busy === "status"} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">Mark harvested</button>
              <button onClick={() => setStatus("CANCELLED")} disabled={busy === "status"} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50">Cancel run</button>
            </>
          )}
          {run.status !== "IN_PROGRESS" && (
            <button onClick={() => setStatus("IN_PROGRESS")} disabled={busy === "status"} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50">Reopen</button>
          )}
          {run.harvestedAt && <span className="text-xs text-emerald-400">Harvested {dateStr(run.harvestedAt)}</span>}
          <button onClick={remove} className="ml-auto text-xs text-red-400/70 transition hover:text-red-300">Delete run</button>
        </div>
      </div>
    </div>
  );
}
