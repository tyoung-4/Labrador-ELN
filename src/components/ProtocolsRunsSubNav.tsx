"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function ProtocolsRunsSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isProtocols   = pathname.startsWith("/protocols");
  const isActiveRuns  = pathname.startsWith("/runs") && !pathname.includes("/summary") && searchParams.get("view") !== "history";
  const isRunHistory  = pathname.startsWith("/runs") && (searchParams.get("view") === "history");
  const isRecipes     = pathname.startsWith("/recipes");

  const base     = "rounded px-3 py-1.5 text-sm font-medium transition";
  const active   = "bg-zinc-100 text-zinc-900";
  const inactive = "bg-zinc-800 text-zinc-300 hover:bg-zinc-700";

  return (
    <div className="bg-zinc-950 px-6 py-3">
      <div className="flex gap-2">
        <Link href="/protocols" className={`${base} ${isProtocols ? active : inactive}`}>
          Protocols
        </Link>
        <Link href="/runs" className={`${base} ${isActiveRuns ? active : inactive}`}>
          Active Runs
        </Link>
        <Link href="/runs?view=history" className={`${base} ${isRunHistory ? active : inactive}`}>
          Run History
        </Link>
        <Link href="/recipes" className={`${base} ${isRecipes ? active : inactive}`}>
          Recipes
        </Link>
      </div>
    </div>
  );
}
