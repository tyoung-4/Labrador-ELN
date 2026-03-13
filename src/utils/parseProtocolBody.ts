/**
 * parseProtocolBody
 *
 * Converts an Entry.body string into PrintProtocolProps for the print document.
 *
 * Handles three storage formats:
 *   1. Plain TipTap HTML (legacy)
 *   2. JSON-wrapped TipTap HTML: {"steps": "<tiptap html>"}
 *   3. JSON-wrapped v2 structured JSON: {"steps": "{\"version\":2,\"sections\":[...]}"}
 *      — produced by ProtocolStepsEditor (the new protocol editor)
 *
 * Format 3 schema:
 *   sections[].title            → section name
 *   sections[].steps[].text     → step text
 *   sections[].steps[].fields[] → { id, kind, label, unit }  ← required fields
 *   sections[].steps[].subSteps[] → { id, text, fields[], subSteps[] }
 */

import {
  type PrintProtocolProps,
  type PrintSection,
  type PrintStep,
  type PrintRequiredField,
} from "@/components/protocols/PrintProtocolDocument";

// ── Format-3: v2 structured JSON ─────────────────────────────────────────────

type V2Field   = { id?: string; kind?: string; label?: string; unit?: string };
type V2SubStep = { id?: string; text?: string; fields?: V2Field[]; subSteps?: V2SubStep[] };
type V2Step    = { id?: string; text?: string; fields?: V2Field[]; subSteps?: V2SubStep[] };
type V2Section = { id?: string; title?: string; steps?: V2Step[] };
type V2Body    = { version?: number; sections?: V2Section[] };

function normaliseFields(raw: V2Field[] | undefined): PrintRequiredField[] {
  if (!raw?.length) return [];
  return raw
    .map((f) => ({ label: (f.label ?? "").trim(), unit: (f.unit ?? "").trim() || undefined }))
    .filter((f) => f.label.length > 0);
}

/**
 * Try to parse body as v2 structured JSON (ProtocolStepsEditor format).
 * Returns sections array on success, null if not this format.
 */
function tryParseV2(body: string): PrintSection[] | null {
  try {
    // Outer envelope may be {"steps": "...json string..."}
    let data: unknown = JSON.parse(body);

    if (
      data !== null &&
      typeof data === "object" &&
      "steps" in (data as object) &&
      typeof (data as Record<string, unknown>).steps === "string"
    ) {
      data = JSON.parse((data as Record<string, unknown>).steps as string);
    }

    const v2 = data as V2Body;
    if (!Array.isArray(v2.sections)) return null;

    const sections: PrintSection[] = [];
    let stepNum    = 0;
    let substepKey = 0;

    for (const sec of v2.sections) {
      const printSec: PrintSection = { name: (sec.title ?? "").trim() || "Section", steps: [] };

      for (const step of sec.steps ?? []) {
        stepNum++;
        const myIdx = stepNum;

        printSec.steps.push({
          index:          myIdx,
          text:           (step.text ?? "").trim(),
          stepType:       "STEP",
          parentIndex:    null,
          requiredFields: normaliseFields(step.fields),
        });

        for (const sub of step.subSteps ?? []) {
          substepKey++;
          printSec.steps.push({
            index:          10000 + substepKey,
            text:           (sub.text ?? "").trim(),
            stepType:       "SUBSTEP",
            parentIndex:    myIdx,
            requiredFields: normaliseFields(sub.fields),
          });
        }
      }

      if (printSec.steps.length > 0) sections.push(printSec);
    }

    return sections.length > 0 ? sections : null;
  } catch {
    return null;
  }
}

// ── Format-1 / Format-2: TipTap HTML ─────────────────────────────────────────

function extractHtml(body: string): string {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (parsed && typeof parsed.steps === "string") {
      return parsed.steps;
    }
  } catch {
    // Not JSON — use as-is
  }
  return body;
}

function getText(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function getDirectFields(item: Element): PrintRequiredField[] {
  const fields: PrintRequiredField[] = [];
  const nodes = Array.from(item.querySelectorAll("span[data-entry-node='measurement']"));
  for (const node of nodes) {
    const closestItem = node.closest("li[data-type='taskItem']");
    if (closestItem && closestItem !== item) continue;
    const label = (node.getAttribute("label") ?? "").trim();
    const unit  = (node.getAttribute("unit")  ?? "").trim();
    if (label) fields.push({ label, unit: unit || undefined });
  }
  return fields;
}

function getItemText(item: Element): string {
  const contentDiv = item.querySelector(":scope > div");
  const source     = contentDiv ?? item;
  const cloned     = source.cloneNode(true) as Element;
  cloned
    .querySelectorAll("ul[data-type='taskList'], ol[data-type='taskList']")
    .forEach((el) => el.remove());
  cloned
    .querySelectorAll(
      "span[data-entry-node='measurement'], span[data-entry-node='timer'], span[data-entry-node='component']",
    )
    .forEach((el) => el.remove());
  return getText(cloned);
}

interface Counters { stepNum: number; substepKey: number }

function collectSteps(
  listEl: Element,
  counters: Counters,
  parentStepNum: number | null,
): PrintStep[] {
  const results: PrintStep[] = [];
  const items = Array.from(listEl.children).filter(
    (el) => el.tagName === "LI" && el.getAttribute("data-type") === "taskItem",
  );

  for (const item of items) {
    let myIndex: number;
    let stepType: "STEP" | "SUBSTEP";

    if (parentStepNum === null) {
      counters.stepNum++;
      myIndex  = counters.stepNum;
      stepType = "STEP";
    } else {
      counters.substepKey++;
      myIndex  = 10000 + counters.substepKey;
      stepType = "SUBSTEP";
    }

    results.push({
      index:          myIndex,
      text:           getItemText(item),
      stepType,
      parentIndex:    parentStepNum,
      requiredFields: getDirectFields(item),
    });

    const contentDiv  = item.querySelector(":scope > div");
    const searchIn    = contentDiv ?? item;
    const nestedLists = Array.from(
      searchIn.querySelectorAll(
        ":scope > ul[data-type='taskList'], :scope > ol[data-type='taskList']",
      ),
    );
    for (const nestedList of nestedLists) {
      const parentRef = parentStepNum === null ? myIndex : parentStepNum;
      results.push(...collectSteps(nestedList, counters, parentRef));
    }
  }

  return results;
}

function parseTipTapHtml(html: string): PrintSection[] {
  const doc      = new DOMParser().parseFromString(html, "text/html");
  const counters: Counters = { stepNum: 0, substepKey: 0 };
  const sections: PrintSection[] = [];
  let current: PrintSection | null = null;

  for (const child of Array.from(doc.body.children)) {
    const tag = child.tagName.toUpperCase();

    if (["H1", "H2", "H3", "H4"].includes(tag)) {
      const name = getText(child);
      if (name) { current = { name, steps: [] }; sections.push(current); }
      continue;
    }

    if ((tag === "UL" || tag === "OL") && child.getAttribute("data-type") === "taskList") {
      if (!current) { current = { name: "Protocol Steps", steps: [] }; sections.push(current); }
      current.steps.push(...collectSteps(child, counters, null));
    }
  }

  return sections.filter((s) => s.steps.length > 0);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse an Entry.body string into the props needed by PrintProtocolDocument.
 *
 * @param body         Raw Entry.body (plain HTML, JSON-wrapped HTML, or JSON-wrapped v2)
 * @param protocolName Protocol title
 * @param version      SemVer string (e.g. "1.2")
 * @param author       Author display name
 * @param operator     Currently logged-in user's display name
 */
export function parseProtocolBody(
  body: string,
  protocolName: string,
  version: string,
  author: string,
  operator = "",
): PrintProtocolProps {
  const empty: PrintProtocolProps = { protocolName, version, author, operator, sections: [] };

  if (!body?.trim()) return empty;

  // ── Try v2 structured JSON first (ProtocolStepsEditor format) ────────────
  const v2Sections = tryParseV2(body);
  if (v2Sections) {
    return { protocolName, version, author, operator, sections: v2Sections };
  }

  // ── Fall back to TipTap HTML (server-guard) ──────────────────────────────
  if (typeof window === "undefined") return empty;

  const html = extractHtml(body);
  if (!html.trim()) return empty;

  const sections = parseTipTapHtml(html);
  return { protocolName, version, author, operator, sections };
}
