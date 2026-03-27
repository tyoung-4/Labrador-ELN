/**
 * assembleRunExport — converts raw run data into the structured RunExportProps
 * shape consumed by the PDF export document (built in Prompt B).
 *
 * NOTE: parseStepsFromBody and stripHtml are copied from
 * src/app/runs/[runId]/page.tsx — do NOT modify the originals.
 */

import type { RunExportField, RunExportProps, RunExportSection, RunExportStep } from "@/types/runExport";

// ─── Internal parsed-step type (mirrors the one in the run detail page) ────────

type ParsedStep = {
  id: string;           // "step-0", "step-1", …
  label: string;        // plain-text title
  html: string;         // raw HTML content
  sectionTitle?: string;
  isSubstep: boolean;
  requiredFields: { key: string; label: string }[];
};

// ─── Helpers (copied from run detail page — do not modify originals) ───────────

function stripHtml(html: string): string {
  if (typeof window !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }
  return html.replace(/<[^>]+>/g, "").trim();
}

function parseStepsFromBody(runBody: string): ParsedStep[] {
  const steps: ParsedStep[] = [];

  // Try JSON format (from ProtocolStepsEditor)
  // Handles two variants:
  //   A) ProtocolBodyJSON wrapper: { steps: "JSON-stringified StepsData" }
  //   B) Raw StepsData:            { version, sections: [...] }
  try {
    type RawField   = { id: string; label: string; [k: string]: unknown };
    type RawSub     = { id: string; html?: string; text?: string; requiredFields?: RawField[]; fields?: RawField[] };
    type RawStep    = { id: string; html?: string; text?: string; requiredFields?: RawField[]; fields?: RawField[]; substeps?: RawSub[]; subSteps?: RawSub[] };
    type RawSection = { id: string; title: string; steps?: RawStep[] };
    type RawData    = { version?: number; sections?: RawSection[]; steps?: unknown };

    let parsed = JSON.parse(runBody) as RawData;

    // Unwrap ProtocolBodyJSON: { steps: "JSON string" }
    if (typeof parsed.steps === "string" && !Array.isArray((parsed as RawData).sections)) {
      parsed = JSON.parse(parsed.steps) as RawData;
    }

    if (parsed.sections && Array.isArray(parsed.sections)) {
      let globalIdx = 0;
      for (const section of parsed.sections) {
        for (const step of section.steps ?? []) {
          const stepId    = `step-${globalIdx++}`;
          const content   = step.html ?? step.text ?? "";
          const label     = step.html ? stripHtml(content) : content;
          const rawFields = step.requiredFields ?? step.fields ?? [];
          steps.push({
            id: stepId,
            label: label || `Step ${steps.length + 1}`,
            html: content,
            sectionTitle: section.title,
            isSubstep: false,
            requiredFields: rawFields.map((f, fi) => ({
              key: `field-${globalIdx - 1}-${fi}`,
              label: f.label,
            })),
          });
          for (const sub of step.substeps ?? step.subSteps ?? []) {
            const subId      = `step-${globalIdx++}`;
            const subContent = sub.html ?? sub.text ?? "";
            const subLabel   = sub.html ? stripHtml(subContent) : subContent;
            const subFields  = sub.requiredFields ?? sub.fields ?? [];
            steps.push({
              id: subId,
              label: subLabel || `Sub-step ${steps.length + 1}`,
              html: subContent,
              sectionTitle: section.title,
              isSubstep: true,
              requiredFields: subFields.map((f, fi) => ({
                key: `field-${globalIdx - 1}-${fi}`,
                label: f.label,
              })),
            });
          }
        }
      }
      return steps;
    }
  } catch {
    // fall through to HTML parsing
  }

  // Legacy HTML format — extract task list items
  if (typeof window !== "undefined") {
    const doc = new DOMParser().parseFromString(runBody || "", "text/html");
    const stepNodes = Array.from(doc.querySelectorAll("li[data-type='taskItem']"));
    stepNodes.forEach((node, idx) => {
      const contentDiv = node.querySelector("div") ?? node;
      const html = contentDiv.innerHTML || "";
      const label = (contentDiv.textContent || "").replace(/\s+/g, " ").trim();
      const fieldNodes = Array.from(node.querySelectorAll("span[data-entry-node='measurement']"));
      steps.push({
        id: `step-${idx}`,
        label: label || `Step ${idx + 1}`,
        html,
        isSubstep: false,
        requiredFields: fieldNodes.map((f, fi) => ({
          key: `field-${idx}-${fi}`,
          label: f.getAttribute("label") || `Field ${fi + 1}`,
        })),
      });
    });
  }

  return steps;
}

// ─── Public function ────────────────────────────────────────────────────────────

export function assembleRunExport(
  run: {
    id: string;
    title: string;
    runId?: string | null;
    status: string;
    runBody: string;
    notes: string;
    interactionState: string;
    createdAt: string | Date;
    completedAt: string | Date | null;
    runner?: { name: string | null } | null;
    tagAssignments?: Array<{ tag: { name: string } }>;
    stepResults?: Array<{
      stepId: string;       // "step-0", "step-1", …
      result: string;       // "PASSED" | "FAILED" | "SKIPPED"
      notes: string;
      fieldValues?: string; // JSON: Record<string, string>
    }>;
  },
  protocolVersion: string
): RunExportProps {
  // ── 1. Parse interactionState ──────────────────────────────────────────────
  let interaction: Record<string, unknown> = {};
  try {
    interaction = JSON.parse(run.interactionState || "{}") as Record<string, unknown>;
  } catch {
    // use empty object
  }

  const stepFailures:   Record<string, boolean> = (interaction.stepFailures   as Record<string, boolean>) ?? {};
  const stepSkips:      Record<string, boolean> = (interaction.stepSkips      as Record<string, boolean>) ?? {};
  const stepCompletion: Record<string, boolean> = (interaction.stepCompletion as Record<string, boolean>) ?? {};

  // ── 2. Parse runBody into flat step array ──────────────────────────────────
  const parsedSteps = parseStepsFromBody(run.runBody);

  // ── 3. Build StepResult lookup keyed by stepId ────────────────────────────
  type SREntry = { result: string; notes: string; fieldValues: Record<string, string> };
  const resultByStepId: Record<string, SREntry> = {};
  for (const sr of run.stepResults ?? []) {
    let fv: Record<string, string> = {};
    try { fv = JSON.parse(sr.fieldValues ?? "{}") as Record<string, string>; } catch { /* empty */ }
    resultByStepId[sr.stepId] = { result: sr.result, notes: sr.notes, fieldValues: fv };
  }

  // ── 4. Status resolver ─────────────────────────────────────────────────────
  function getStepStatus(key: string): "PASS" | "FAIL" | "SKIP" | "PENDING" {
    // StepResult rows are the source of truth for completed actions
    const sr = resultByStepId[key];
    if (sr) {
      if (sr.result === "PASSED") return "PASS";
      if (sr.result === "FAILED") return "FAIL";
      if (sr.result === "SKIPPED") return "SKIP";
    }
    // Fall back to interactionState blob
    if (stepCompletion[key]) {
      if (stepFailures[key]) return "FAIL";
      if (stepSkips[key]) return "SKIP";
      return "PASS";
    }
    return "PENDING";
  }

  // ── 5–6. Build sections + step labels ─────────────────────────────────────
  // Maintain a Map to preserve section insertion order
  const sectionMap = new Map<string, RunExportStep[]>();
  let globalIndex    = 0;  // 1-based continuous counter (all steps + substeps)
  let mainStepNumber = 0;  // 1-based counter for non-substep steps only
  let substepLetterIdx = 0; // resets for each new parent step

  for (const step of parsedSteps) {
    globalIndex++;
    const stepKey = step.id; // "step-N"
    const status  = getStepStatus(stepKey);
    const sr      = resultByStepId[stepKey];

    // Build step label
    let label: string;
    let parentIndex: number | null;

    if (!step.isSubstep) {
      mainStepNumber++;
      substepLetterIdx = 0;
      label       = String(mainStepNumber);
      parentIndex = null;
    } else {
      const letter = String.fromCharCode(97 + substepLetterIdx); // 'a', 'b', …
      substepLetterIdx++;
      label       = `${mainStepNumber}${letter}`;
      parentIndex = mainStepNumber;
    }

    // ── 5. Resolve field values from StepResult.fieldValues ─────────────────
    const fields: RunExportField[] = step.requiredFields.map((f) => ({
      label: f.label,
      value: sr?.fieldValues?.[f.key] ?? "",
    }));

    const exportStep: RunExportStep = {
      index: globalIndex,
      label,
      text: step.label,
      isSubStep: step.isSubstep,
      parentIndex,
      sectionName: step.sectionTitle ?? "",
      status,
      note: sr?.notes ? sr.notes : null,
      fields,
    };

    const sectionKey = step.sectionTitle ?? "";
    const existing   = sectionMap.get(sectionKey) ?? [];
    existing.push(exportStep);
    sectionMap.set(sectionKey, existing);
  }

  const sections: RunExportSection[] = [];
  for (const [name, steps] of sectionMap) {
    sections.push({ name, steps });
  }

  // ── 7. Compute stats ───────────────────────────────────────────────────────
  const allSteps    = sections.flatMap((s) => s.steps);
  const passCount   = allSteps.filter((s) => s.status === "PASS").length;
  const failCount   = allSteps.filter((s) => s.status === "FAIL").length;
  const skipCount   = allSteps.filter((s) => s.status === "SKIP").length;
  const pendingCount = allSteps.filter((s) => s.status === "PENDING").length;

  // ── 8. Compute duration ────────────────────────────────────────────────────
  const startedAt   = new Date(run.createdAt);
  const completedAt = run.completedAt ? new Date(run.completedAt) : null;
  const durationSeconds = completedAt
    ? Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)
    : null;

  return {
    protocolName:    run.title,
    version:         protocolVersion,
    runId:           run.runId ?? run.id,
    operator:        run.runner?.name ?? "Unknown",
    startedAt,
    completedAt,
    exportedAt:      new Date(),
    status:          run.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
    durationSeconds,
    runNotes:        run.notes ?? "",
    tags:            (run.tagAssignments ?? []).map((a) => a.tag.name),
    passCount,
    failCount,
    skipCount,
    pendingCount,
    sections,
  };
}
