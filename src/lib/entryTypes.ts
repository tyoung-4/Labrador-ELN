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

export type FieldType = "text" | "textarea" | "select";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  /** Only used when type === "select" */
  options?: readonly string[];
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
