/**
 * PrintProtocolDocument
 *
 * Print-ready protocol document rendered into #print-root by printProtocol().
 * Never visible in the live app UI.
 *
 * Rules:
 *  - Inline styles ONLY — no Tailwind, no CSS classes
 *  - @page / body rules live in document.head (injected by printProtocol.ts)
 *  - This component is purely presentational — no hooks, no effects
 */

import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrintRequiredField = {
  label: string;
  unit?: string;
};

export type PrintStep = {
  /** Sequential step number for STEP type (1, 2, 3…); unique key for SUBSTEP */
  index: number;
  text: string;
  stepType: "STEP" | "SUBSTEP";
  /** For SUBSTEP: the sequential step number of the parent STEP */
  parentIndex: number | null;
  requiredFields: PrintRequiredField[];
};

export type PrintSection = {
  name: string;
  steps: PrintStep[];
};

export type PrintProtocolProps = {
  protocolName: string;
  version: string;
  author: string;
  operator: string;
  sections: PrintSection[];
};

// ── Shared style constants ────────────────────────────────────────────────────

const S = {
  page: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "11pt",
    color: "#000",
    background: "#fff",
    lineHeight: "1.5",
  } as React.CSSProperties,

  /** Large square checkbox */
  checkbox: {
    flexShrink: 0,
    width: "18pt",
    height: "18pt",
    border: "1.5px solid #000",
    display: "inline-block",
    marginRight: "8pt",
    marginTop: "2pt",
    verticalAlign: "top",
  } as React.CSSProperties,

  /** Step / substep row */
  stepRow: (indented: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "flex-start",
    marginLeft: indented ? "24pt" : "0",
    marginBottom: "2pt",
    pageBreakInside: "avoid" as const,
  }),

  /** Required-field inline row (indented past checkbox) */
  fieldRow: (indented: boolean): React.CSSProperties => ({
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "16pt",
    marginLeft: indented ? `${24 + 26}pt` : "26pt",
    marginBottom: "6pt",
    fontSize: "10pt",
  }),
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayFormatted(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrintProtocolDocument({
  protocolName,
  version,
  author,
  operator,
  sections,
}: PrintProtocolProps) {
  const today = todayFormatted();

  return (
    <div style={S.page}>

      {/* ══════════════════════════════════════════════════════════
          PAGE HEADER
          ══════════════════════════════════════════════════════════ */}

      {/* Line 1: protocol name / version / author  |  branding */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3pt" }}>
        <span style={{ fontSize: "13pt", fontWeight: "bold" }}>
          {protocolName}&nbsp;&nbsp;v{version}&nbsp;&nbsp;Author: {author}
        </span>
        <span style={{ fontSize: "9pt", color: "#888" }}>Labrador ELN 🎾</span>
      </div>

      {/* Line 2: operator / date retrieved / experiment date */}
      <div style={{ fontSize: "10pt", color: "#333", marginBottom: "3pt" }}>
        {operator || "Unknown Operator"}
        &nbsp;&nbsp;&nbsp;
        Date Retrieved: {today}
        &nbsp;&nbsp;&nbsp;
        Experiment Date: __________
      </div>

      {/* Line 3: start / end times */}
      <div style={{ fontSize: "10pt", color: "#333" }}>
        Start time: __________&nbsp;&nbsp;&nbsp;&nbsp;End time: __________
      </div>

      {/* Thin rule */}
      <hr style={{ border: "none", borderTop: "1px solid #000", margin: "8pt 0" }} />

      {/* ══════════════════════════════════════════════════════════
          PROTOCOL BODY
          ══════════════════════════════════════════════════════════ */}

      {sections.map((section, sIdx) => {
        // Track a./b./c. position per parent step index
        const substepCounters: Record<number, number> = {};

        return (
          <div key={sIdx}>

            {/* Section name — bold, no checkbox */}
            <div style={{
              fontWeight: "bold",
              fontSize: "12pt",
              marginTop: sIdx === 0 ? "8pt" : "16pt",
              marginBottom: "6pt",
            }}>
              {section.name}
            </div>

            {section.steps.map((step) => {
              const isSubstep = step.stepType === "SUBSTEP";

              // Compute display label
              let label: string;
              if (isSubstep && step.parentIndex !== null) {
                substepCounters[step.parentIndex] = (substepCounters[step.parentIndex] ?? 0) + 1;
                // a., b., c. — not 1a, 1b
                label = String.fromCharCode(96 + substepCounters[step.parentIndex]) + ".";
              } else {
                label = `${step.index}.`;
              }

              const hasFields = step.requiredFields.length > 0;

              return (
                <div key={step.index} style={{ pageBreakInside: "avoid" }}>

                  {/* Step row: checkbox + number + text */}
                  <div style={S.stepRow(isSubstep)}>
                    <span style={S.checkbox} />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontWeight: "bold", marginRight: "4pt" }}>{label}</span>
                      {step.text || <em style={{ color: "#999" }}>(no text)</em>}
                    </span>
                  </div>

                  {/* Required fields — all on one row, inline, indented past checkbox */}
                  {hasFields && (
                    <div style={S.fieldRow(isSubstep)}>
                      {step.requiredFields.map((field, fIdx) => (
                        <span
                          key={fIdx}
                          style={{ display: "inline-flex", alignItems: "baseline", gap: "4pt", whiteSpace: "nowrap" }}
                        >
                          <span>{field.label}:</span>
                          <span style={{
                            borderBottom: "1px solid #000",
                            minWidth: "60pt",
                            display: "inline-block",
                          }}>
                            &nbsp;
                          </span>
                          {field.unit && (
                            <span style={{ color: "#555", fontSize: "9pt" }}>{field.unit}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bottom margin when no fields */}
                  {!hasFields && <div style={{ marginBottom: "4pt" }} />}

                </div>
              );
            })}
          </div>
        );
      })}

      {/* ══════════════════════════════════════════════════════════
          NOTES SECTION
          ══════════════════════════════════════════════════════════ */}

      <div style={{ marginTop: "24pt" }}>
        <div style={{ fontWeight: "bold", fontSize: "11pt", marginBottom: "8pt" }}>
          Notes:
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              borderBottom: "1px solid #000",
              width: "100%",
              height: "20pt",
              marginBottom: "8pt",
            }}
          />
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          FOOTER — fallback div (CSS @page margin boxes in head style
          handle multi-page; this div covers single-page output)
          ══════════════════════════════════════════════════════════ */}

      <div style={{
        marginTop: "24pt",
        paddingTop: "6pt",
        borderTop: "1px solid #ccc",
        display: "flex",
        justifyContent: "space-between",
        fontSize: "8pt",
        color: "#888",
      }}>
        <span>Page 1</span>
        <span>Labrador ELN 🎾</span>
      </div>

    </div>
  );
}
