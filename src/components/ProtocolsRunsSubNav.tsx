"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getCurrentUser } from "@/components/AppTopNav";

export default function ProtocolsRunsSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeRunCount, setActiveRunCount] = useState(0);

  const isProtocols   = pathname.startsWith("/protocols");
  const isActiveRuns  = pathname.startsWith("/runs") && !pathname.includes("/summary") && searchParams.get("view") !== "history";
  const isRunHistory  = pathname.startsWith("/runs") && (searchParams.get("view") === "history");
  const isRecipes     = pathname.startsWith("/recipes");

  // Track how many of the current user's runs are in progress, so the
  // "Active Runs" tab can surface a quick at-a-glance count/badge.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const user = getCurrentUser();
        const res = await fetch("/api/protocol-runs?status=active", {
          headers: { "x-user-id": user.id, "x-user-name": user.name, "x-user-role": user.role },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Array<{ status: string }>;
        setActiveRunCount(data.filter((r) => r.status === "IN_PROGRESS").length);
      } catch {
        // ignore — badge simply won't update this cycle
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    function onStorage() { load(); }
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);

  const base     = "rounded px-3 py-1.5 text-sm font-medium transition";
  const active   = "bg-zinc-100 text-zinc-900";
  const inactive = "bg-zinc-800 text-zinc-300 hover:bg-zinc-700";

  return (
    <div className="bg-zinc-950 px-6 py-3">
      <div className="flex gap-2">
        <Link href="/protocols" className={`${base} ${isProtocols ? active : inactive}`}>
          Protocols
        </Link>
        <Link href="/runs" className={`${base} ${isActiveRuns ? active : inactive} flex items-center gap-1.5`}>
          Active Runs
          {activeRunCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold leading-none text-white">
              {activeRunCount}
            </span>
          )}
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
