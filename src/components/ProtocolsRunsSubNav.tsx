"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function ProtocolsRunsSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isProtocols = pathname.startsWith("/protocols");
  const isRuns = pathname.startsWith("/runs");

  const base = "rounded px-3 py-1.5 text-sm font-medium transition";
  const active = "bg-zinc-100 text-zinc-900";
  const inactive = "bg-zinc-800 text-zinc-300 hover:bg-zinc-700";

  return (
    <div className="bg-zinc-950 px-6 py-3">
      <div className="flex gap-2">
        <Link href="/protocols" className={`${base} ${isProtocols ? active : inactive}`}>
          Protocols
        </Link>
        <Link href="/runs" className={`${base} ${isRuns ? active : inactive}`}>
          Runs
        </Link>
      </div>
    </div>
  );
}
