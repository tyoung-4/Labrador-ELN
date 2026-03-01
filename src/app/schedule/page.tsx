"use client";
import AppTopNav from "@/components/AppTopNav";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function SchedulePage() {
  const params = useSearchParams();
  const date = params.get("date");

  return (
    <div className="flex min-h-screen flex-col gap-3 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />
      <div className="flex items-center gap-3">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">← Back</Link>
        <h1 className="text-lg font-semibold text-zinc-100">Schedule</h1>
        {date && (
          <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {date}
          </span>
        )}
        <span className="rounded border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
          In Development
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-12">
        <p className="text-sm text-zinc-600">Full schedule view coming soon.</p>
      </div>
    </div>
  );
}
