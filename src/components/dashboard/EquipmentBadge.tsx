"use client";

import { ALL_RESOURCES } from "@/components/EquipmentShared";
import type { ScheduleEvent } from "@/components/EquipmentShared";

// Color per equipment group — matches the RESOURCE_GROUPS chip colors in EquipmentShared
const GROUP_COLORS: Record<string, string> = {
  tc:    "#10b981", // emerald — TC Rooms
  fplc:  "#38bdf8", // sky     — FPLC / HPLC
  spr:   "#a78bfa", // violet  — SPR
  other: "#f59e0b", // amber   — Plasmid Pro / Other
};

function getGroupColor(groupId: string): string {
  return GROUP_COLORS[groupId] ?? "#6366f1"; // indigo fallback
}

function fmt12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const period = h < 12 ? "am" : "pm";
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

export default function EquipmentBadge({ booking }: { booking: ScheduleEvent }) {
  const resource = ALL_RESOURCES.find(r => r.id === booking.resourceId);
  const label    = resource?.label ?? String(booking.resourceId);
  const color    = getGroupColor(resource?.group.id ?? "");

  const startLabel = booking.startTime ? fmt12h(booking.startTime) : "";

  return (
    <div
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap select-none"
      style={{
        backgroundColor: color + "22",
        border: `1px solid ${color}55`,
        color,
      }}
      title={`${label}${startLabel ? ` · ${startLabel}` : ""}`}
    >
      {/* Colored dot */}
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {/* Equipment name — truncated */}
      <span className="max-w-[4.5rem] truncate">{label}</span>
      {/* Start time */}
      {startLabel && (
        <span style={{ opacity: 0.65 }}>{startLabel}</span>
      )}
    </div>
  );
}
