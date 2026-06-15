"use client";

import { usePathname } from "next/navigation";

// End-of-content brand mark. Rendered in normal flow at the end of the root
// layout (after the page content), so scrolling to it signals "end of page".
// Right-aligned, full-width dark strip so it blends with the dark pages.
export default function BrandMark() {
  const pathname = usePathname();
  // The login screen already shows the full logo prominently.
  if (pathname === "/login") return null;

  return (
    <div
      aria-hidden="true"
      className="flex w-full select-none justify-end border-t border-white/5 bg-zinc-950 px-8 pt-8 pb-2"
    >
      <div className="flex flex-col items-center opacity-60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/labrador-logo.png" alt="" className="h-12 w-12" />
        <span className="-mt-2 text-[5px] font-medium tracking-wide text-zinc-400">Labrador ELN</span>
      </div>
    </div>
  );
}
