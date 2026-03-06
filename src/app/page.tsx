import Link from "next/link";
import AppTopNav from "@/components/AppTopNav";
import EquipmentCalendar from "@/components/EquipmentCalendar";
import DashboardPanel from "@/components/DashboardPanel";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col gap-4 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
        JCW Lab ELN &mdash; in development
      </p>

      {/* Dashboard — full width, above module grid */}
      <DashboardPanel equipmentCalendar={<EquipmentCalendar />} />

      {/* Module bar — three equal boxes */}
      <div className="grid grid-cols-3 gap-3">

        {/* ── Protocols ── */}
        <section className="rounded-lg border border-emerald-500/30 bg-zinc-900 p-3">
          <p className="mb-2 text-xs font-semibold text-emerald-300">Protocols</p>
          <div className="flex flex-col gap-1">
            <Link
              href="/protocols"
              className="rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-400/20"
            >
              List
            </Link>
            <Link
              href="/runs"
              className="rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-1.5 text-xs text-emerald-100 transition hover:bg-emerald-400/20"
            >
              Run History
            </Link>
            <Link
              href="/runs"
              className="rounded border border-emerald-500/50 bg-emerald-500/15 px-2 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
            >
              ▶ Active Runs
            </Link>
          </div>
        </section>

        {/* ── Inventory (1fr) ── */}
        <section className="rounded-lg border border-blue-500/30 bg-zinc-900 p-3">
          <p className="mb-2 text-xs font-semibold text-blue-300">Inventory</p>
          <div className="grid grid-cols-1 gap-1">
            <Link
              href="/inventory/stocks"
              className="rounded border border-blue-400/40 bg-blue-400/10 px-2 py-1.5 text-xs text-blue-100 transition hover:bg-blue-400/20"
            >
              Stocks
            </Link>
            <Link
              href="/inventory/reagents"
              className="rounded border border-blue-400/40 bg-blue-400/10 px-2 py-1.5 text-xs text-blue-100 transition hover:bg-blue-400/20"
            >
              Reagents
            </Link>
            <Link
              href="/inventory/plasmids"
              className="rounded border border-blue-400/40 bg-blue-400/10 px-2 py-1.5 text-xs text-blue-100 transition hover:bg-blue-400/20"
            >
              Plasmids
            </Link>
            <Link
              href="/inventory/cell-lines"
              className="rounded border border-blue-400/40 bg-blue-400/10 px-2 py-1.5 text-xs text-blue-100 transition hover:bg-blue-400/20"
            >
              Cell Lines
            </Link>
          </div>
        </section>

        {/* ── Knowledge Hub (1fr) ── */}
        <section className="rounded-lg border border-rose-800/40 bg-zinc-900 p-3">
          <p className="mb-2 text-xs font-semibold text-rose-300">Knowledge Hub</p>
          <div className="flex flex-col gap-1">
            <Link
              href="/knowledge-hub/papers-grants"
              className="rounded border border-rose-700/40 bg-rose-900/15 px-2 py-1.5 text-xs text-rose-200 transition hover:bg-rose-900/30"
            >
              Papers &amp; Grants
            </Link>
            <Link
              href="/knowledge-hub/codes-scripts"
              className="rounded border border-rose-700/40 bg-rose-900/15 px-2 py-1.5 text-xs text-rose-200 transition hover:bg-rose-900/30"
            >
              Codes &amp; Scripts
            </Link>
            <Link
              href="/knowledge-hub/admin"
              className="rounded border border-rose-700/40 bg-rose-900/15 px-2 py-1.5 text-xs text-rose-200 transition hover:bg-rose-900/30"
            >
              Admin
            </Link>
            <Link
              href="/knowledge-hub/safety-sds"
              className="rounded border border-rose-700/40 bg-rose-900/15 px-2 py-1.5 text-xs text-rose-200 transition hover:bg-rose-900/30"
            >
              Safety &amp; SDS
            </Link>
            <Link
              href="/knowledge-hub/lab-resources"
              className="rounded border border-rose-700/40 bg-rose-900/15 px-2 py-1.5 text-xs text-rose-200 transition hover:bg-rose-900/30"
            >
              Lab Resources
            </Link>
            <Link
              href="/knowledge-hub/meeting-notes"
              className="rounded border border-rose-700/40 bg-rose-900/15 px-2 py-1.5 text-xs text-rose-200 transition hover:bg-rose-900/30"
            >
              Meeting Notes
            </Link>
            <Link
              href="/ingestion"
              className="rounded border border-amber-600/40 bg-amber-600/10 px-2 py-1.5 text-xs text-amber-200 transition hover:bg-amber-600/20"
            >
              👾 Data Ingestion
            </Link>
          </div>
        </section>

      </div>

      {/* Attribution */}
      <p className="mt-auto text-right text-[10px] leading-relaxed text-zinc-700">
        Developed by Tynan Young &mdash; John C. Williams Lab,{" "}
        Beckman Research Institute at City of Hope
      </p>
    </div>
  );
}
