"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Pages without a Return-to-Top button. /knowledge-hub is matched exactly so its
// sub-pages (e.g. /knowledge-hub/papers-grants) still get the button.
const HIDDEN_PATHS = new Set(["/", "/equipment", "/knowledge-hub", "/login"]);

const SHOW_AFTER = 300; // px scrolled before the button appears

export default function ReturnToTop() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  // Tracks the element actually scrolling (window for most pages; an internal
  // overflow container on the runs pages).
  const scrollerRef = useRef<Element | null>(null);

  useEffect(() => {
    setVisible(false);
    scrollerRef.current = null;

    function onScroll(e: Event) {
      const target = e.target;
      let scrolled = window.scrollY || document.documentElement.scrollTop || 0;
      if (target instanceof Element) {
        if (target.scrollTop > 0) scrollerRef.current = target;
        scrolled = Math.max(scrolled, target.scrollTop);
      }
      setVisible(scrolled > SHOW_AFTER);
    }

    // Capture phase catches scroll events from any nested scroll container too.
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, [pathname]);

  if (HIDDEN_PATHS.has(pathname) || !visible) return null;

  function toTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      onClick={toTop}
      aria-label="Return to top"
      className="fixed bottom-3 right-3 z-50 flex items-center gap-1 rounded-full border border-white/10 bg-zinc-800/90 px-3 py-1.5 text-xs font-medium text-zinc-200 shadow-lg backdrop-blur transition hover:bg-zinc-700"
    >
      <span aria-hidden="true">↑</span> Top
    </button>
  );
}
