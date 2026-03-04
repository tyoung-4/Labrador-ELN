/**
 * Server-safe equipment ID → label lookup.
 * Used by API routes where "use client" modules cannot be imported.
 * Keep in sync with RESOURCE_GROUPS in src/components/EquipmentShared.tsx.
 */
export const EQUIPMENT_LABELS: Record<string, string> = {
  "tc147":       "TC Room 147",
  "tc127":       "TC Room 127",
  "akta1":       "AKTA System 1",
  "akta2":       "AKTA System 2",
  "ngc":         "NGC",
  "hplc":        "HPLC",
  "spr-t200":    "SPR T200",
  "spr-new":     "SPR (new)",
  "plasmid-pro": "Plasmid Pro",
};

export function equipmentLabel(id: string): string {
  return EQUIPMENT_LABELS[id] ?? id;
}
