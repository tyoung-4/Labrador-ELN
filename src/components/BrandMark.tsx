"use client";

import { usePathname } from "next/navigation";

// End-of-content footer: a centered "Back to Top" button (middle of the page)
// and the right-aligned Labrador ELN logo, both in normal flow at the bottom of
// the page. Back-to-Top is shown everywhere except Home, Equipment and the main
// Knowledge Hub page (exact match, so KH sub-pages keep it). The whole footer is
// hidden on /login (which already shows the full logo).
const NO_BACK_TO_TOP = new Set(["/", "/equipment", "/knowledge-hub", "/login"]);

export default function BrandMark() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  const showBackToTop = !NO_BACK_TO_TOP.has(pathname);

  function toTop() {
    // Instant scroll (not "smooth") for reliability across browsers.
    window.scrollTo(0, 0);
    // Also reset any internal scroll container (e.g. the runs pages).
    document.querySelectorAll<HTMLElement>(".overflow-y-auto").forEach((el) => {
      if (el.scrollTop > 0) el.scrollTop = 0;
    });
  }

  return (
    <div className="grid w-full grid-cols-3 items-center border-t border-white/5 bg-zinc-950 px-8 pt-8 pb-2">
      <div />
      <div className="flex justify-center">
        {showBackToTop && (
          <button
            onClick={toTop}
            className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-800/90 px-4 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700"
          >
            <span aria-hidden="true">↑</span> Back to Top
          </button>
        )}
      </div>
      <div aria-hidden="true" className="flex select-none flex-col items-center justify-self-end opacity-60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/labrador-logo.png" alt="" className="h-12 w-12" />
        <span className="-mt-2 text-[5px] font-medium tracking-wide text-zinc-400">Labrador ELN</span>
      </div>
    </div>
  );
}
