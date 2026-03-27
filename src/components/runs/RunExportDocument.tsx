/**
 * RunExportDocument
 *
 * Print-ready run export document rendered into #print-root by exportRun().
 * Never visible in the live app UI.
 *
 * Rules:
 *  - Inline styles ONLY — no Tailwind, no CSS classes
 *  - @page / font rules live in document.head (injected by exportRun.ts)
 *  - This component is purely presentational — no hooks, no effects
 */

import React from "react";
import type { RunExportProps, RunExportStep } from "@/types/runExport";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── StepRow sub-component ─────────────────────────────────────────────────────

function StepRow({ step }: { step: RunExportStep }) {
  const statusSymbol = {
    PASS: "✓",
    FAIL: "✗",
    SKIP: "→",
    PENDING: "○",
  }[step.status];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        marginBottom: "6pt",
        paddingLeft: step.isSubStep ? "24pt" : "0",
        pageBreakInside: "avoid",
      }}
    >
      {/* Status box */}
      <div
        style={{
          width: "16pt",
          height: "16pt",
          border: "1.5px solid black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "10pt",
          flexShrink: 0,
          marginRight: "8pt",
          marginTop: "1pt",
          fontFamily: "Georgia, serif",
        }}
      >
        {statusSymbol}
      </div>

      {/* Step content */}
      <div style={{ flex: 1 }}>
        {/* Step label + text */}
        <div style={{ fontSize: "11pt" }}>
          <span style={{ fontWeight: "bold", marginRight: "4pt" }}>
            {step.label}.
          </span>
          {step.text}
        </div>

        {/* Required fields */}
        {step.fields.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16pt",
              marginTop: "4pt",
              marginLeft: "8pt",
            }}
          >
            {step.fields.map((field, fi) => (
              <span key={fi} style={{ fontSize: "10pt" }}>
                <span style={{ fontWeight: "bold" }}>{field.label}</span>
                {field.unit ? ` (${field.unit})` : ""}:{" "}
                {field.value !== "" ? (
                  field.value
                ) : (
                  <span
                    style={{
                      borderBottom: "1px solid black",
                      display: "inline-block",
                      minWidth: "48pt",
                    }}
                  >
                    &nbsp;
                  </span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Step note */}
        {step.note && step.note.trim() !== "" && (
          <div
            style={{
              fontSize: "10pt",
              fontStyle: "italic",
              marginTop: "3pt",
              marginLeft: "8pt",
              color: "#444",
            }}
          >
            Note: {step.note}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RunExportDocument({
  protocolName,
  version,
  runId,
  operator,
  startedAt,
  completedAt,
  exportedAt,
  status,
  durationSeconds,
  runNotes,
  tags,
  passCount,
  failCount,
  skipCount,
  pendingCount,
  sections,
}: RunExportProps) {
  return (
    <div
      style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "11pt",
        color: "#000",
        background: "#fff",
        lineHeight: "1.5",
      }}
    >
      {/* ══════════════════════════════════════════════════════════
          PAGE HEADER
          ══════════════════════════════════════════════════════════ */}

      {/* Line 1: protocol name + version + Run ID  |  branding */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span style={{ fontWeight: "bold", fontSize: "13pt" }}>
          {protocolName} {version} — Run ID: {runId}
        </span>
        <span style={{ fontSize: "8pt", color: "#888" }}>Labrador ELN 🎾</span>
      </div>

      {/* Line 2: operator + started + completed or exported */}
      <div style={{ fontSize: "10pt", marginTop: "4pt" }}>
        <span>Operator: {operator}</span>
        <span style={{ marginLeft: "24pt" }}>
          Started: {formatDate(startedAt)}
        </span>
        {status === "COMPLETED" && completedAt && (
          <span style={{ marginLeft: "24pt" }}>
            Completed: {formatDate(completedAt)}
          </span>
        )}
        {status === "IN_PROGRESS" && (
          <span style={{ marginLeft: "24pt" }}>
            Exported: {formatDate(exportedAt)}
          </span>
        )}
      </div>

      {/* Line 3: duration (only if completed) */}
      {status === "COMPLETED" && durationSeconds !== null && (
        <div style={{ fontSize: "10pt", marginTop: "2pt" }}>
          Duration: {formatDuration(durationSeconds)}
        </div>
      )}

      {/* Line 4: tags (only if any) */}
      {tags.length > 0 && (
        <div style={{ fontSize: "10pt", marginTop: "2pt" }}>
          Tags: {tags.join(", ")}
        </div>
      )}

      {/* Thin rule */}
      <hr
        style={{
          border: "none",
          borderTop: "1px solid black",
          margin: "8pt 0",
        }}
      />

      {/* ══════════════════════════════════════════════════════════
          IN PROGRESS BANNER
          ══════════════════════════════════════════════════════════ */}

      {status === "IN_PROGRESS" && (
        <div
          style={{
            border: "2px solid black",
            padding: "8pt 12pt",
            marginBottom: "12pt",
            fontWeight: "bold",
            fontSize: "11pt",
            textAlign: "center",
          }}
        >
          ⚠ INCOMPLETE RUN — Exported on {formatDate(exportedAt)}.
          This run was not finished at time of export.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          PROTOCOL BODY
          ══════════════════════════════════════════════════════════ */}

      {sections.map((section, si) => (
        <div key={si} style={{ marginBottom: "16pt" }}>
          {/* Section header */}
          <div
            style={{
              fontWeight: "bold",
              fontSize: "12pt",
              marginBottom: "6pt",
              paddingBottom: "2pt",
              borderBottom: "1px solid #ccc",
            }}
          >
            {section.name}
          </div>

          {/* Steps */}
          {section.steps.map((step, idx) => (
            <StepRow key={idx} step={step} />
          ))}
        </div>
      ))}

      {/* ══════════════════════════════════════════════════════════
          RUN NOTES
          ══════════════════════════════════════════════════════════ */}

      {runNotes && runNotes.trim() !== "" && (
        <div style={{ marginTop: "20pt" }}>
          <hr
            style={{
              border: "none",
              borderTop: "1px solid black",
              marginBottom: "8pt",
            }}
          />
          <div
            style={{
              fontWeight: "bold",
              fontSize: "11pt",
              marginBottom: "4pt",
            }}
          >
            Run Notes
          </div>
          <div style={{ fontSize: "11pt", whiteSpace: "pre-wrap" }}>
            {runNotes}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SUMMARY STATS
          ══════════════════════════════════════════════════════════ */}

      <div style={{ marginTop: "20pt" }}>
        <hr
          style={{
            border: "none",
            borderTop: "1px solid black",
            marginBottom: "8pt",
          }}
        />
        <div
          style={{
            fontWeight: "bold",
            fontSize: "11pt",
            marginBottom: "6pt",
          }}
        >
          Run Summary
        </div>
        <div style={{ display: "flex", gap: "24pt", fontSize: "11pt" }}>
          <span>✓ {passCount} Passed</span>
          <span>✗ {failCount} Failed</span>
          <span>→ {skipCount} Skipped</span>
          {status === "IN_PROGRESS" && (
            <span>○ {pendingCount} Pending</span>
          )}
        </div>
        {status === "IN_PROGRESS" && (
          <div style={{ fontSize: "9pt", color: "#666", marginTop: "4pt" }}>
            * Pending steps not yet actioned at time of export
          </div>
        )}
      </div>
    </div>
  );
}
