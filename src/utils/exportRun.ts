/**
 * exportRun
 *
 * Imperatively renders RunExportDocument into a hidden #print-root div,
 * injects minimal print styles into <head>, calls window.print(), then cleans
 * up both the container and the style tag on afterprint.
 *
 * Mirrors printProtocol.ts exactly — same container injection, same
 * double-rAF flush, same dual cleanup pattern.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import RunExportDocument from "@/components/runs/RunExportDocument";
import type { RunExportProps } from "@/types/runExport";

const EXPORT_STYLE_ID = "labrador-export-styles";

const HEAD_CSS = `
  @page {
    size: letter;
    margin: 1.5cm 2cm;
    @bottom-left  { content: "Page " counter(page) " of " counter(pages); font-family: Georgia, serif; font-size: 8pt; color: #888; }
    @bottom-right { content: "Labrador ELN 🎾"; font-family: Georgia, serif; font-size: 8pt; color: #888; }
  }
  #print-root { font-family: Georgia, "Times New Roman", serif !important; }
`;

export function exportRun(exportData: RunExportProps): void {
  // ── Teardown any previous incomplete export ──────────────────────────────
  document.getElementById("print-root")?.remove();
  document.getElementById(EXPORT_STYLE_ID)?.remove();

  // ── Inject print styles into <head> (NOT into the component tree) ────────
  const styleTag = document.createElement("style");
  styleTag.id = EXPORT_STYLE_ID;
  styleTag.textContent = HEAD_CSS;
  document.head.appendChild(styleTag);

  // ── Create the print container ───────────────────────────────────────────
  const container = document.createElement("div");
  container.id = "print-root";
  container.style.display = "none";
  document.body.appendChild(container);

  // ── Render document into container ───────────────────────────────────────
  const root = ReactDOM.createRoot(container);
  root.render(React.createElement(RunExportDocument, exportData));

  // ── Double-rAF: wait for React to paint, then print ──────────────────────
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.style.display = "block";
      window.print();

      // ── Cleanup on dialog close ──────────────────────────────────────────
      // Use both afterprint AND a short timeout as dual guarantee
      const cleanup = () => {
        root.unmount();
        container.remove();
        document.getElementById(EXPORT_STYLE_ID)?.remove();
      };

      window.addEventListener("afterprint", cleanup, { once: true });

      // Fallback: if afterprint already fired or never fires, clean up after 1s
      setTimeout(() => {
        if (document.getElementById("print-root")) {
          cleanup();
        }
      }, 1000);
    });
  });
}
