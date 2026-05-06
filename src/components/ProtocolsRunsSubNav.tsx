"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function ProtocolsRunsSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isProtocols = pathname === "/protocols";
  const isRunsRoot = pathname === "/runs";
  const viewParam = searchParams.get("view");
  const isActiveRuns = isRunsRoot && (viewParam === "active" || viewParam === null);
  const isHistory = isRunsRoot && viewParam === "history";

  const base = "rounded px-3 py-1.5 text-sm font-medium transition";
  const active = "bg-zinc-100 text-zinc-900";
  const inactive = "bg-zinc-800 text-zinc-300 hover:bg-zinc-700";

  return (
    <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-3">
      <div className="flex gap-2">
        <Link href="/protocols" className={`${base} ${isProtocols ? active : inactive}`}>
          Protocols
        </Link>
        <Link href="/runs" className={`${base} ${isActiveRuns ? active : inactive}`}>
          Active Runs
        </Link>
        <Link href="/runs?view=history" className={`${base} ${isHistory ? active : inactive}`}>
          Run History
        </Link>
      </div>
    </div>
  );
}
