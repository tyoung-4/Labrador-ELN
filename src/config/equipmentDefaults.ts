import type { ResourceId } from "@/components/EquipmentShared";

/**
 * Default booking duration (minutes) per equipment type.
 * This is the single source of truth — to add a new equipment type with a
 * default duration, add an entry here AND add the resource to RESOURCE_GROUPS
 * in src/components/EquipmentShared.tsx.
 * See EQUIPMENT.md for the full guide.
 */
export const EQUIPMENT_DURATIONS: Partial<Record<ResourceId, number>> = {
  // TC Rooms: 1 hour
  "tc147": 60,
  "tc127": 60,
  // FPLC: 2 hours
  "akta1": 120,
  "akta2": 120,
  "ngc":   120,
  // HPLC: 2 hours
  "hplc":  120,
  // SPR: 4 hours
  "spr-t200": 240,
  "spr-new":  240,
  // Plasmid Pro: 1.5 hours (90 min)
  "plasmid-pro": 90,
};

/**
 * Returns the default end time (HH:MM, 24-hour) given an equipment resource
 * and a start time string. Falls back to 1 hour if no default is configured.
 */
export function defaultEndTime(resourceId: ResourceId, startTime: string): string {
  const durationMins = EQUIPMENT_DURATIONS[resourceId] ?? 60;
  const [hStr = "9", mStr = "00"] = startTime.split(":");
  const totalMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + durationMins;
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
