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

export default function EquipmentBadge({
  booking,
  badgeHeight = 20,
}: {
  booking: ScheduleEvent;
  badgeHeight?: number;
}) {
  const resource   = ALL_RESOURCES.find(r => r.id === booking.resourceId);
  const label      = resource?.label ?? String(booking.resourceId);
  const color      = getGroupColor(resource?.group.id ?? "");
  const startLabel = booking.startTime ? fmt12h(booking.startTime) : "";
  const endLabel   = booking.endTime   ? fmt12h(booking.endTime)   : "";

  return (
    <div
      className="w-full h-full rounded px-2 py-0.5 flex flex-col justify-start overflow-hidden select-none"
      style={{
        backgroundColor: color + "33",
        border: `1px solid ${color}`,
        color,
      }}
      title={`${label}${startLabel ? ` · ${startLabel}` : ""}${endLabel ? `–${endLabel}` : ""}`}
    >
      {/* Name row — always visible */}
      <div className="flex items-center gap-1 min-w-0">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] font-medium truncate" style={{ color }}>
          {label}
        </span>
        {/* Start time — only when tall enough to show it */}
        {badgeHeight >= 24 && startLabel && (
          <span className="text-[10px] shrink-0 opacity-70" style={{ color }}>
            {startLabel}
          </span>
        )}
      </div>
      {/* End time — only when badge is tall enough */}
      {badgeHeight >= 40 && endLabel && (
        <span className="text-[10px] opacity-50 ml-3 leading-tight" style={{ color }}>
          until {endLabel}
        </span>
      )}
    </div>
  );
}
