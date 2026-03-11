/**
 * printProtocol
 *
 * Imperatively renders PrintProtocolDocument into a hidden #print-root div,
 * calls window.print(), then cleans up. Does not navigate away.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import PrintProtocolDocument, { type PrintProtocolProps } from "@/components/protocols/PrintProtocolDocument";

export function printProtocol(protocolData: PrintProtocolProps): void {
  // Remove any existing print root
  const existing = document.getElementById("print-root");
  if (existing) existing.remove();

  // Create container, append to body (hidden from normal view via @media print CSS)
  const container = document.createElement("div");
  container.style.display = "none";
  document.body.appendChild(container);

  // Render the component synchronously-enough via flushSync
  const root = ReactDOM.createRoot(container);

  // Use a Promise to wait for the next paint before printing
  root.render(React.createElement(PrintProtocolDocument, protocolData));

  // Give React one tick to flush, then print
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Make the container visible so @media print rules can see it
      container.style.display = "block";
      window.print();
      // Cleanup after print dialog closes (fires immediately on some browsers,
      // after user dismisses on others — both are fine)
      window.addEventListener(
        "afterprint",
        () => {
          root.unmount();
          container.remove();
        },
        { once: true },
      );
    });
  });
}
