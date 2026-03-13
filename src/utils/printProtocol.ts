/**
 * printProtocol
 *
 * Imperatively renders PrintProtocolDocument into a hidden #print-root div,
 * injects minimal print styles into <head>, calls window.print(), then cleans
 * up both the container and the style tag on afterprint.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import PrintProtocolDocument, { type PrintProtocolProps } from "@/components/protocols/PrintProtocolDocument";

const PRINT_STYLE_ID = "labrador-print-styles";

const HEAD_CSS = `
  @page {
    size: letter;
    margin: 1.5cm 2cm;
    @bottom-left  { content: "Page " counter(page) " of " counter(pages); font-family: Georgia, serif; font-size: 8pt; color: #888; }
    @bottom-right { content: "Labrador ELN 🎾"; font-family: Georgia, serif; font-size: 8pt; color: #888; }
  }
  #print-root { font-family: Georgia, "Times New Roman", serif !important; }
`;

export function printProtocol(protocolData: PrintProtocolProps): void {
  // ── Teardown any previous incomplete print ──────────────────────────────
  document.getElementById("print-root")?.remove();
  document.getElementById(PRINT_STYLE_ID)?.remove();

  // ── Inject print styles into <head> (NOT into the component tree) ───────
  const styleTag = document.createElement("style");
  styleTag.id = PRINT_STYLE_ID;
  styleTag.textContent = HEAD_CSS;
  document.head.appendChild(styleTag);

  // ── Create the print container ──────────────────────────────────────────
  const container = document.createElement("div");
  container.id = "print-root";
  container.style.display = "none";
  document.body.appendChild(container);

  // ── Render document into container ──────────────────────────────────────
  const root = ReactDOM.createRoot(container);
  root.render(React.createElement(PrintProtocolDocument, protocolData));

  // ── Double-rAF: wait for React to paint, then print ─────────────────────
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.style.display = "block";
      window.print();

      // ── Cleanup on dialog close ─────────────────────────────────────────
      window.addEventListener(
        "afterprint",
        () => {
          root.unmount();
          container.remove();
          document.getElementById(PRINT_STYLE_ID)?.remove();
        },
        { once: true },
      );
    });
  });
}
