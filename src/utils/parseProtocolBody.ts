/**
 * parseProtocolBody
 *
 * Converts an Entry.body string into PrintProtocolProps for the print document.
 *
 * Handles two storage formats:
 *   1. Plain TipTap HTML (legacy)
 *   2. JSON-wrapped: {"steps": "<tiptap html>"} (current)
 *
 * TipTap HTML structure:
 *   <h2>/<h3>  → section headers
 *   <ul data-type="taskList">
 *     <li data-type="taskItem">  → top-level step
 *       <div><p>text</p>
 *         <span data-entry-node="measurement" label="..." unit="..."> → required field
 *         <ul data-type="taskList">
 *           <li data-type="taskItem">  → sub-step
 *         </ul>
 *       </div>
 *     </li>
 *   </ul>
 */

import {
  type PrintProtocolProps,
  type PrintSection,
  type PrintStep,
  type PrintRequiredField,
} from "@/components/protocols/PrintProtocolDocument";

// ── Internal helpers ──────────────────────────────────────────────────────────

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

/**
 * Extracts measurement fields directly owned by this task item (not in nested sub-items).
 */
function getDirectFields(item: Element): PrintRequiredField[] {
  const fields: PrintRequiredField[] = [];
  const nodes = Array.from(
    item.querySelectorAll("span[data-entry-node='measurement']"),
  );
  for (const node of nodes) {
    // Skip if this node lives inside a nested taskItem that is not `item` itself
    const closestItem = node.closest("li[data-type='taskItem']");
    if (closestItem && closestItem !== item) continue;

    const label = node.getAttribute("label") ?? "";
    const unit = node.getAttribute("unit") ?? "";
    if (label.trim()) {
      fields.push({ label: label.trim(), unit: unit.trim() || undefined });
    }
  }
  return fields;
}

/**
 * Returns direct text of a task item (strips nested task lists from the content).
 */
function getItemText(item: Element): string {
  const contentDiv = item.querySelector(":scope > div");
  const source = contentDiv ?? item;
  const cloned = source.cloneNode(true) as Element;
  // Remove nested task lists so they don't pollute the text
  cloned
    .querySelectorAll("ul[data-type='taskList'], ol[data-type='taskList']")
    .forEach((el) => el.remove());
  // Also strip measurement/timer nodes — they're not readable text
  cloned
    .querySelectorAll(
      "span[data-entry-node='measurement'], span[data-entry-node='timer'], span[data-entry-node='component']",
    )
    .forEach((el) => el.remove());
  return getText(cloned);
}

// ── Parsing ───────────────────────────────────────────────────────────────────

interface Counters {
  /** Sequential number for top-level steps (used as display label and parentIndex ref) */
  stepNum: number;
  /** Unique key for sub-steps (10000+ range to avoid collisions with stepNum) */
  substepKey: number;
}

function collectSteps(
  listEl: Element,
  counters: Counters,
  parentStepNum: number | null,
): PrintStep[] {
  const results: PrintStep[] = [];
  const items = Array.from(listEl.children).filter(
    (el) =>
      el.tagName === "LI" && el.getAttribute("data-type") === "taskItem",
  );

  for (const item of items) {
    let myIndex: number;
    let stepType: "STEP" | "SUBSTEP";

    if (parentStepNum === null) {
      // Top-level step: sequential display number
      counters.stepNum++;
      myIndex = counters.stepNum;
      stepType = "STEP";
    } else {
      // Sub-step: high-range unique key
      counters.substepKey++;
      myIndex = 10000 + counters.substepKey;
      stepType = "SUBSTEP";
    }

    const text = getItemText(item);
    const requiredFields = getDirectFields(item);

    results.push({
      index: myIndex,
      text,
      stepType,
      parentIndex: parentStepNum,
      requiredFields,
    });

    // Recurse into any nested task lists (sub-steps)
    // Use :scope selector to get only immediate children task lists inside the content div
    const contentDiv = item.querySelector(":scope > div");
    const searchIn = contentDiv ?? item;
    const nestedLists = Array.from(
      searchIn.querySelectorAll(
        ":scope > ul[data-type='taskList'], :scope > ol[data-type='taskList']",
      ),
    );
    for (const nestedList of nestedLists) {
      // Sub-steps always reference the top-level step's myIndex (for labeling 1a, 1b, 2a, 2b...)
      // If we're already at substep level, still use the original stepNum so labels are e.g. "3a", not nested further
      const parentRef = parentStepNum === null ? myIndex : parentStepNum;
      const subSteps = collectSteps(nestedList, counters, parentRef);
      results.push(...subSteps);
    }
  }

  return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse an Entry.body string into the props needed by PrintProtocolDocument.
 *
 * @param body - Raw Entry.body (plain HTML or JSON-wrapped)
 * @param protocolName - Protocol title
 * @param version - SemVer string (e.g. "1.2")
 * @param author - Author display name
 */
export function parseProtocolBody(
  body: string,
  protocolName: string,
  version: string,
  author: string,
): PrintProtocolProps {
  const html = extractHtml(body);

  // Guard: server-side or empty
  if (typeof window === "undefined" || !html.trim()) {
    return { protocolName, version, author, sections: [] };
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const counters: Counters = { stepNum: 0, substepKey: 0 };
  const sections: PrintSection[] = [];

  let current: PrintSection | null = null;

  for (const child of Array.from(doc.body.children)) {
    const tag = child.tagName.toUpperCase();

    // Headings start a new section
    if (["H1", "H2", "H3", "H4"].includes(tag)) {
      const name = getText(child);
      if (name) {
        current = { name, steps: [] };
        sections.push(current);
      }
      continue;
    }

    // Task lists contain steps
    if (
      (tag === "UL" || tag === "OL") &&
      child.getAttribute("data-type") === "taskList"
    ) {
      if (!current) {
        current = { name: "Protocol Steps", steps: [] };
        sections.push(current);
      }
      const steps = collectSteps(child, counters, null);
      current.steps.push(...steps);
      continue;
    }

    // <p> or other non-heading, non-list elements — skip for print
    // (Measurement fields at section level are not tied to a specific step)
  }

  // Drop empty sections
  const populated = sections.filter((s) => s.steps.length > 0);

  return {
    protocolName,
    version,
    author,
    sections: populated.length > 0 ? populated : sections,
  };
}
