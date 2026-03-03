/**
 * entryTypes.ts
 *
 * Single source of truth for all entry type definitions.
 * To add a new entry type:
 *   1. Add the key to ENTRY_TYPE_CONFIGS below.
 *   2. Add the enum value to prisma/schema.prisma  →  EntryType enum.
 *   3. Run `prisma migrate dev` to update the database.
 *   4. That's it — the UI, API validation, and typed-fields panel
 *      all derive from this config automatically.
 *
 * See TYPES.md at the project root for full documentation.
 */

export type FieldType = "text" | "textarea" | "select" | "date" | "csv_trace";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  /** Only used when type === "select" */
  options?: readonly string[];
  /** Whether this field is required */
  required?: boolean;
  /** Visual grouping: "core" (top) or "structured" (below separator). Defaults to "core". */
  section?: "core" | "structured";
};

export type EntryTypeConfig = {
  label: string;
  icon: string;
  description: string;
  fields: FieldDef[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions
// To add a new type: insert a new key here (and add the enum to Prisma schema).
// ─────────────────────────────────────────────────────────────────────────────

export const ENTRY_TYPE_CONFIGS: Record<string, EntryTypeConfig> = {
  GENERAL: {
    label: "General",
    icon: "📄",
    description: "General-purpose entry for anything that doesn't fit other types.",
    fields: [],
  },

  EXPERIMENT: {
    label: "Experiment",
    icon: "🔬",
    description: "Experimental record with hypothesis and outcome tracking.",
    fields: [
      { key: "projectName", label: "Project Name",  type: "text",
        placeholder: "e.g. TurboID proximity labeling" },
      { key: "hypothesis",  label: "Hypothesis",    type: "text",
        placeholder: "What do you expect to observe?" },
      { key: "outcome",     label: "Outcome",       type: "text",
        placeholder: "Fill in after the experiment completes" },
      { key: "status",      label: "Status",        type: "select",
        options: ["planned", "in-progress", "complete"] },
    ],
  },

  PROTOCOL: {
    label: "Protocol",
    icon: "📋",
    description: "Standard operating procedure or reproducible method.",
    fields: [
      { key: "version",           label: "Version",            type: "text",
        placeholder: "e.g. v1.2" },
      { key: "estimatedDuration", label: "Estimated Duration", type: "text",
        placeholder: "e.g. 3 hours" },
      { key: "materialsList",     label: "Materials List",     type: "textarea",
        placeholder: "Key materials, one per line" },
    ],
  },

  NOTE: {
    label: "Note",
    icon: "📝",
    description: "Observations, ideas, meeting notes, or other records.",
    fields: [
      { key: "category", label: "Category", type: "select",
        options: ["observation", "idea", "meeting", "other"] },
    ],
  },

  CELL_LINE: {
    label: "Cell Line",
    icon: "🧫",
    description: "Cell line record with passage tracking and culture conditions.",
    fields: [
      { key: "cellLineName",      label: "Cell Line Name",  type: "text",     required: true,  placeholder: "e.g. HEK293T" },
      { key: "species",           label: "Species",         type: "text",     required: true,  placeholder: "e.g. Homo sapiens" },
      { key: "source",            label: "Source",          type: "text",     required: true,  placeholder: "e.g. ATCC CRL-3216" },
      { key: "passageNumber",     label: "Passage Number",  type: "text",     required: true,  placeholder: "e.g. P12" },
      { key: "date",              label: "Date",            type: "date",     required: true },
      { key: "cultureConditions", label: "Culture Conditions", type: "textarea", section: "structured",
        placeholder: "Media, supplements, temperature, CO₂ %" },
    ],
  },

  PROTEIN: {
    label: "Protein",
    icon: "🧬",
    description: "Protein record with expression system and yield tracking.",
    fields: [
      { key: "proteinName",      label: "Protein Name",      type: "text", required: true, placeholder: "e.g. EGFP-His6" },
      { key: "organism",         label: "Organism",           type: "text", required: true, placeholder: "e.g. E. coli BL21" },
      { key: "tag",              label: "Tag",                type: "text", required: true, placeholder: "e.g. His6, GST, MBP" },
      { key: "construct",        label: "Construct",          type: "text", required: true, placeholder: "e.g. pET28a-EGFP" },
      { key: "expressionSystem", label: "Expression System",  type: "text", section: "structured", placeholder: "e.g. IPTG-inducible, BL21 DE3" },
      { key: "yield",            label: "Yield",              type: "text", section: "structured", placeholder: "e.g. 2.4 mg/mL from 1 L culture" },
    ],
  },

  REAGENT: {
    label: "Reagent",
    icon: "🧪",
    description: "Reagent record with supplier, lot, and storage information.",
    fields: [
      { key: "reagentName",       label: "Reagent Name",       type: "text", required: true, placeholder: "e.g. IPTG" },
      { key: "supplier",          label: "Supplier",            type: "text", required: true, placeholder: "e.g. Sigma-Aldrich" },
      { key: "catalogNumber",     label: "Catalog Number",      type: "text", required: true, placeholder: "e.g. I6758" },
      { key: "concentration",     label: "Concentration",       type: "text", required: true, placeholder: "e.g. 1 M stock" },
      { key: "dateReceived",      label: "Date Received",       type: "date", required: true },
      { key: "storageConditions", label: "Storage Conditions",  type: "text", section: "structured", placeholder: "e.g. −20 °C, desiccate" },
      { key: "lotNumber",         label: "Lot Number",          type: "text", section: "structured", placeholder: "e.g. SLBJ1234V" },
    ],
  },

  CHROMATOGRAPHY_RUN: {
    label: "Chromatography Run",
    icon: "📈",
    description: "Chromatography run with A280 trace, yield, and notes.",
    fields: [
      { key: "proteinName",  label: "Protein Name",  type: "text", required: true, placeholder: "e.g. EGFP-His6" },
      { key: "columnType",   label: "Column Type",   type: "text", required: true, placeholder: "e.g. HisTrap 5 mL" },
      { key: "date",         label: "Date",          type: "date", required: true },
      { key: "operator",     label: "Operator",      type: "text", required: true, placeholder: "Name of operator" },
      { key: "yield",        label: "Yield",         type: "text", section: "structured", placeholder: "e.g. 8.2 mg total" },
      { key: "a280Trace",    label: "A280 Trace (CSV)", type: "csv_trace", section: "structured",
        placeholder: "Upload a CSV file with two columns: volume_mL, abs280" },
    ],
  },
};

// Ordered list of keys for dropdowns / display
export const ENTRY_TYPE_KEYS = Object.keys(ENTRY_TYPE_CONFIGS) as Array<
  keyof typeof ENTRY_TYPE_CONFIGS
>;

export function getEntryTypeConfig(key: string): EntryTypeConfig {
  return ENTRY_TYPE_CONFIGS[key] ?? ENTRY_TYPE_CONFIGS["GENERAL"];
}

// ─────────────────────────────────────────────────────────────────────────────
// TypedData shape — stored as JSON in the DB
// ─────────────────────────────────────────────────────────────────────────────

/** Named fields specific to an entry type (e.g. { status: "planned" }). */
export type TypedFields = Record<string, string>;

/** A single user-defined custom key-value pair. */
export type CustomField = { id: string; key: string; value: string };

/** The full JSON stored in Entry.typedData */
export type TypedData = {
  typed: TypedFields;
  custom: CustomField[];
};

export function emptyTypedData(): TypedData {
  return { typed: {}, custom: [] };
}

export function parseTypedData(raw: unknown): TypedData {
  if (!raw || typeof raw !== "object") return emptyTypedData();
  const obj = raw as Record<string, unknown>;
  return {
    typed: (typeof obj.typed === "object" && obj.typed !== null
      ? obj.typed
      : {}) as TypedFields,
    custom: Array.isArray(obj.custom) ? (obj.custom as CustomField[]) : [],
  };
}
