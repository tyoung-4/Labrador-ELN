import type { ResourceId } from "@/components/EquipmentShared";

// ─── Slot-based equipment ─────────────────────────────────────────────────────

/**
 * A fixed time slot offered by slot-based equipment (e.g. Plasmid Pro).
 * Slot-based equipment shows a slot picker instead of free start/end time inputs.
 */
export type EquipmentSlot = {
  id: string;
  label: string;     // human-readable, e.g. "Slot 1 · 8:00 – 9:30 am"
  startTime: string; // HH:MM (24h)
  endTime: string;   // HH:MM (24h)
};

/**
 * Fixed time slots per equipment type. When a resource has an entry here,
 * BookingModal renders a slot picker instead of free start/end time inputs.
 */
export const EQUIPMENT_SLOTS: Partial<Record<ResourceId, EquipmentSlot[]>> = {
  "plasmid-pro": [
    { id: "slot-1", label: "Slot 1 · 8:00 – 9:30 am",   startTime: "08:00", endTime: "09:30" },
    { id: "slot-2", label: "Slot 2 · 10:00 – 11:30 am",  startTime: "10:00", endTime: "11:30" },
    { id: "slot-3", label: "Slot 3 · 1:00 – 2:30 pm",    startTime: "13:00", endTime: "14:30" },
    { id: "slot-4", label: "Slot 4 · 3:00 – 4:30 pm",    startTime: "15:00", endTime: "16:30" },
    { id: "slot-5", label: "Slot 5 · 5:00 – 6:30 pm",    startTime: "17:00", endTime: "18:30" },
  ],
};

// ─── Default durations ────────────────────────────────────────────────────────

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
