/**
 * PrintProtocolDocument
 *
 * Renders a print-ready protocol document. Never visible in the normal app UI —
 * only rendered inside #print-root at print time. Uses inline styles exclusively;
 * no Tailwind classes (they won't apply in the print context).
 */

import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrintRequiredField = {
  label: string;
  unit?: string;
};

export type PrintStep = {
  index: number;          // 1-based flat index across all steps
  text: string;
  stepType: "STEP" | "SUBSTEP";
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
  sections: PrintSection[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayFormatted(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Render sub-step label: 1a, 1b, 1c ... given parent index and position */
function substepLabel(parentIndex: number, position: number): string {
  return `${parentIndex}${String.fromCharCode(96 + position)}`; // 96 + 1 = 'a'
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE_STYLE = `
  @page {
    size: letter;
    margin: 1.5cm 2cm;
  }
  @media print {
    body > *:not(#print-root) { display: none !important; }
    #print-root { display: block !important; }
    nav, header, button, [role="navigation"] { display: none !important; }
  }
  #print-root {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    color: #000;
    background: #fff;
    line-height: 1.5;
  }
  .print-section-header {
    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin: 20pt 0 4pt 0;
    padding-bottom: 3pt;
    border-bottom: 1px solid #000;
  }
  .print-step-row {
    display: flex;
    align-items: flex-start;
    gap: 8pt;
    margin: 6pt 0;
    page-break-inside: avoid;
  }
  .print-step-row.substep {
    margin-left: 2rem;
  }
  .print-checkbox {
    flex-shrink: 0;
    width: 12pt;
    height: 12pt;
    border: 1.5px solid #000;
    margin-top: 2pt;
    display: inline-block;
  }
  .print-step-number {
    flex-shrink: 0;
    font-weight: bold;
    min-width: 2rem;
  }
  .print-step-text {
    flex: 1;
  }
  .print-field-row {
    display: flex;
    align-items: flex-start;
    gap: 8pt;
    margin: 4pt 0 4pt 2rem;
    page-break-inside: avoid;
  }
  .print-field-label {
    flex-shrink: 0;
    min-width: 8rem;
    font-size: 10pt;
  }
  .print-field-box {
    flex: 1;
    min-height: 2.5cm;
    border: 1.5px solid #000;
    border-radius: 2pt;
  }
  .print-hr {
    border: none;
    border-top: 1px solid #000;
    margin: 6pt 0;
  }
  .print-header-block {
    margin-bottom: 8pt;
  }
  .print-header-line1 {
    font-size: 13pt;
    font-weight: bold;
    margin-bottom: 3pt;
  }
  .print-header-line2 {
    font-size: 10pt;
    color: #333;
  }
  /* Footer via CSS counters */
  @media print {
    body { counter-reset: page; }
    #print-root::after {
      content: "";
      display: table;
      clear: both;
    }
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrintProtocolDocument({
  protocolName,
  version,
  author,
  sections,
}: PrintProtocolProps) {
  const today = todayFormatted();

  return (
    <div id="print-root" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "11pt", color: "#000", background: "#fff", lineHeight: 1.5 }}>
      {/* Inject page + print CSS */}
      <style dangerouslySetInnerHTML={{ __html: PAGE_STYLE }} />

      {/* ── Page Header ── */}
      <div className="print-header-block" style={{ marginBottom: "8pt" }}>
        <div className="print-header-line1" style={{ fontSize: "13pt", fontWeight: "bold", marginBottom: "3pt" }}>
          {protocolName} — v{version} — Author: {author}
        </div>
        <div className="print-header-line2" style={{ fontSize: "10pt", color: "#333" }}>
          Date retrieved: {today}
          <span style={{ display: "inline-block", width: "5rem" }} />
          Experiment date: ___________
        </div>
        <hr className="print-hr" style={{ border: "none", borderTop: "1px solid #000", margin: "6pt 0" }} />
      </div>

      {/* ── Protocol Body ── */}
      {sections.map((section, sIdx) => {
        // Track substep position within each parent step
        const substepCounters: Record<number, number> = {};

        return (
          <div key={sIdx}>
            {/* Section header */}
            <div
              className="print-section-header"
              style={{
                fontSize: "14pt",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                margin: "20pt 0 4pt 0",
                paddingBottom: "3pt",
                borderBottom: "1px solid #000",
              }}
            >
              {section.name}
            </div>

            {/* Steps */}
            {section.steps.map((step) => {
              const isSubstep = step.stepType === "SUBSTEP";

              // Compute substep label position
              let stepLabel: string;
              if (isSubstep && step.parentIndex !== null) {
                substepCounters[step.parentIndex] = (substepCounters[step.parentIndex] ?? 0) + 1;
                stepLabel = substepLabel(step.parentIndex, substepCounters[step.parentIndex]);
              } else {
                stepLabel = String(step.index);
              }

              return (
                <div key={step.index}>
                  {/* Step row */}
                  <div
                    className={`print-step-row${isSubstep ? " substep" : ""}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8pt",
                      margin: "6pt 0",
                      marginLeft: isSubstep ? "2rem" : 0,
                      pageBreakInside: "avoid",
                    }}
                  >
                    {/* Checkbox */}
                    <span
                      className="print-checkbox"
                      style={{
                        flexShrink: 0,
                        width: "12pt",
                        height: "12pt",
                        border: "1.5px solid #000",
                        marginTop: "2pt",
                        display: "inline-block",
                      }}
                    />
                    {/* Step number */}
                    <span
                      className="print-step-number"
                      style={{ flexShrink: 0, fontWeight: "bold", minWidth: "2rem" }}
                    >
                      {stepLabel}.
                    </span>
                    {/* Step text */}
                    <span className="print-step-text" style={{ flex: 1 }}>
                      {step.text}
                    </span>
                  </div>

                  {/* Required fields */}
                  {step.requiredFields.map((field, fIdx) => (
                    <div
                      key={fIdx}
                      className="print-field-row"
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8pt",
                        margin: "4pt 0 4pt 2rem",
                        marginLeft: isSubstep ? "4rem" : "2rem",
                        pageBreakInside: "avoid",
                      }}
                    >
                      <span
                        className="print-field-label"
                        style={{ flexShrink: 0, minWidth: "8rem", fontSize: "10pt" }}
                      >
                        {field.label}{field.unit ? ` (${field.unit})` : ""}:
                      </span>
                      <span
                        className="print-field-box"
                        style={{
                          flex: 1,
                          minHeight: "2.5cm",
                          border: "1.5px solid #000",
                          borderRadius: "2pt",
                          display: "block",
                        }}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ── Page Footer (CSS-rendered on every page) ── */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page { @bottom-left { content: "Page " counter(page) " of " counter(pages); font-family: Georgia, serif; font-size: 9pt; color: #888; } }
            @page { @bottom-right { content: "Labrador ELN"; font-family: Georgia, serif; font-size: 9pt; color: #888; } }
          }
        `
      }} />
    </div>
  );
}
