# Equipment Management Guide

## How Bookings Work

Equipment bookings are stored in the PostgreSQL database (`EquipmentBooking` table). All users share the same booking state — bookings are visible to everyone and conflict detection runs server-side.

- Bookings are created via `POST /api/equipment-bookings`
- Conflict detection checks for overlapping `(equipmentId, startTime, endTime)` tuples
- Users can only cancel their own bookings (matched by `userId`)
- The Dashboard and `/equipment` page both poll the API every 30 seconds

## How to Add a New Equipment Type

Adding new equipment requires two edits only.

### Step 1 — Add the resource to `src/components/EquipmentShared.tsx`

Find the `RESOURCE_GROUPS` constant and add your equipment to the appropriate group, or create a new group:

```typescript
// Existing group example — add to resources array:
{
  id: "fplc", label: "FPLC/HPLC",
  // ...
  resources: [
    { id: "akta1", label: "AKTA System 1" },
    { id: "new-instrument", label: "New Instrument" }, // <-- add here
  ],
},

// Or create a new group entirely:
{
  id: "microscopy", label: "Microscopy",
  textCls: "text-pink-300", borderCls: "border-pink-500/30",
  chipBg: "bg-pink-500/20", chipText: "text-pink-200",
  resources: [
    { id: "confocal", label: "Confocal Microscope" },
  ],
},
```

The `id` must be added to the `ResourceId` union type at the top of the file:

```typescript
export type ResourceId =
  | "tc147" | "tc127"
  | "akta1" | "akta2" | "ngc" | "hplc"
  | "spr-t200" | "spr-new"
  | "plasmid-pro"
  | "confocal"; // <-- add new id here
```

### Step 2 — Set the default booking duration in `src/config/equipmentDefaults.ts`

```typescript
export const EQUIPMENT_DURATIONS: Partial<Record<ResourceId, number>> = {
  // ...existing entries...
  "confocal": 120, // Confocal Microscope: 2 hours
};
```

The value is in **minutes**. If you don't add an entry, the booking modal will default to 1 hour.

That's it. No other files need to change:
- The booking API automatically accepts any `equipmentId` string
- The calendar views derive column headers and colors from `RESOURCE_GROUPS`
- The defaults config is the single source of truth for pre-filled end times

## Equipment Defaults Reference

| Equipment | ID | Default Duration |
|---|---|---|
| TC Room 147 | `tc147` | 1 hour (60 min) |
| TC Room 127 | `tc127` | 1 hour (60 min) |
| AKTA System 1 | `akta1` | 2 hours (120 min) |
| AKTA System 2 | `akta2` | 2 hours (120 min) |
| NGC | `ngc` | 2 hours (120 min) |
| HPLC | `hplc` | 2 hours (120 min) |
| SPR T200 | `spr-t200` | 4 hours (240 min) |
| SPR (new) | `spr-new` | 4 hours (240 min) |
| Plasmid Pro | `plasmid-pro` | 1.5 hours (90 min) |

## Architecture Notes

- `src/components/EquipmentShared.tsx` — single source of truth for resource list, types, and shared view components (`DailyView`, `WeeklyView`, `BookingModal`)
- `src/config/equipmentDefaults.ts` — single source of truth for default booking durations
- `src/hooks/useEquipmentBookings.ts` — shared React hook that fetches/creates/deletes bookings via the API; used by both the Dashboard widget and the full `/equipment` page
- `src/app/api/equipment-bookings/route.ts` — GET (list all) + POST (create with conflict check)
- `src/app/api/equipment-bookings/[id]/route.ts` — PUT (update with conflict check) + DELETE

## Timezone Note

Booking times are stored as local-time `DateTime` values. The server interprets times without a timezone suffix (e.g. `"2026-03-04T09:00:00"`) as the server's local timezone. For correct behavior, the application server should run in the same timezone as the lab users.
