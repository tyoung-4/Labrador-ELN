import Link from "next/link";
import AppTopNav from "@/components/AppTopNav";
import MiniCalendar from "@/components/MiniCalendar";
import DashboardPanel from "@/components/DashboardPanel";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col gap-4 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
        JCW Lab ELN &mdash; in development
      </p>

      {/* Dashboard — full width, above module grid */}
      <DashboardPanel />

      {/* 2 × 2 module grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Protocols */}
        <section className="rounded-xl border border-emerald-500/30 bg-zinc-900 p-5">
          <p className="mb-3 text-sm font-semibold text-emerald-300">Protocols</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/protocols"
              className="rounded-lg border border-emerald-400/50 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-400/20"
            >
              Editor
            </Link>
            <Link
              href="/runs"
              className="rounded-lg border border-emerald-400/50 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 transition hover:bg-emerald-400/20"
            >
              Runs
            </Link>
          </div>
        </section>

        {/* Inventory */}
        <section className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
          <p className="mb-3 text-sm font-semibold text-zinc-200">Inventory</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/inventory/stocks"
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
            >
              Stocks
            </Link>
            <Link
              href="/inventory/reagents"
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
            >
              Reagents
            </Link>
            <Link
              href="/inventory/plasmids"
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
            >
              Plasmids
            </Link>
            <Link
              href="/inventory/cell-lines"
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
            >
              Cell Lines
            </Link>
          </div>
        </section>

        {/* Schedule */}
        <section className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
          <p className="mb-3 text-sm font-semibold text-zinc-200">Schedule</p>
          <MiniCalendar />
        </section>

        {/* Knowledge Hub */}
        <section className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
          <p className="mb-3 text-sm font-semibold text-zinc-200">Knowledge Hub</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/knowledge-hub/papers-grants"
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
            >
              Papers &amp; Grants
            </Link>
            <Link
              href="/knowledge-hub/codes-scripts"
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
            >
              Codes &amp; Scripts
            </Link>
            <Link
              href="/knowledge-hub/admin"
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
            >
              Admin
            </Link>
            <Link
              href="/knowledge-hub/safety-sds"
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
            >
              Safety &amp; SDS
            </Link>
            <Link
              href="/knowledge-hub/lab-resources"
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
            >
              Lab Resources
            </Link>
            <Link
              href="/knowledge-hub/meeting-notes"
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700"
            >
              Meeting Notes
            </Link>
          </div>
        </section>
      </div>

    </div>
  );
}
