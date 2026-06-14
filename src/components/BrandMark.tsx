"use client";

import { usePathname } from "next/navigation";

// Small fixed brand mark in the bottom-right of every page — a subtle "end of
// page" / branding cue. Mirrors the bottom-left DEV badge. Non-interactive so it
// never blocks UI, and sits below modals (z-40).
export default function BrandMark() {
  const pathname = usePathname();
  // The login screen already shows the full logo prominently.
  if (pathname === "/login") return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-3 right-3 z-40 flex select-none items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/70 px-2.5 py-1 opacity-70 backdrop-blur-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/labrador-logo.png" alt="" className="h-4 w-4" />
      <span className="text-[10px] font-medium tracking-wide text-zinc-400">Labrador ELN</span>
    </div>
  );
}
