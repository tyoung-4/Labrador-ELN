"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EVENTS_KEY, ENABLED_KEY } from "@/app/equipment/page";

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceId =
  | "tc147" | "tc127"
  | "akta1" | "akta2" | "ngc" | "hplc"
  | "spr-t200" | "spr-new"
  | "plasmid-pro";

type ResourceGroup = {
  id: string;
  label: string;
  textCls: string;
  chipBg: string;
  chipText: string;
  borderCls: string;
  resources: { id: ResourceId; label: string }[];
};

type ScheduleEvent = {
  id: string;
  resourceId: ResourceId;
  date: string;
  startTime?: string;
  endTime?: string;
  title: string;
  userId: string;
  userName: string;
};

// ─── Constants (mirrors equipment page) ───────────────────────────────────────

const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    id: "tc", label: "TC Rooms",
    textCls: "text-emerald-300", borderCls: "border-emerald-500/30",
    chipBg: "bg-emerald-500/20", chipText: "text-emerald-200",
    resources: [
      { id: "tc147", label: "TC Room 147" },
      { id: "tc127", label: "TC Room 127" },
    ],
  },
  {
    id: "fplc", label: "FPLC/HPLC",
    textCls: "text-sky-300", borderCls: "border-sky-500/30",
    chipBg: "bg-sky-500/20", chipText: "text-sky-200",
    resources: [
      { id: "akta1", label: "AKTA System 1" },
      { id: "akta2", label: "AKTA System 2" },
      { id: "ngc",   label: "NGC" },
      { id: "hplc",  label: "HPLC" },
    ],
  },
  {
    id: "spr", label: "SPR",
    textCls: "text-violet-300", borderCls: "border-violet-500/30",
    chipBg: "bg-violet-500/20", chipText: "text-violet-200",
    resources: [
      { id: "spr-t200", label: "SPR T200" },
      { id: "spr-new",  label: "SPR (new)" },
    ],
  },
  {
    id: "other", label: "Other",
    textCls: "text-amber-300", borderCls: "border-amber-500/30",
    chipBg: "bg-amber-500/20", chipText: "text-amber-200",
    resources: [
      { id: "plasmid-pro", label: "Plasmid Pro" },
    ],
  },
];

const ALL_RESOURCES = RESOURCE_GROUPS.flatMap(g =>
  g.resources.map(r => ({ ...r, group: g }))
);

const DAY_LABELS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localDateStr(d = new Date()): string {
  return (
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0")
  );
}

function getWeekDates(weekOffset = 0): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dow + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function fmt12h(t: string): string {
  const [h24s, minS] = t.split(":");
  const h24 = parseInt(h24s, 10);
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${minS}${h24 < 12 ? "a" : "p"}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EquipmentMirror() {
  const [events,  setEvents]  = useState<ScheduleEvent[]>([]);
  const [enabled, setEnabled] = useState<Set<ResourceId>>(
    () => new Set(ALL_RESOURCES.map(r => r.id))
  );
  const [weekOffset, setWeekOffset] = useState(0);

  // Load events and enabled state from localStorage (shared with /equipment page)
  useEffect(() => {
    // Events
    try {
      const raw = localStorage.getItem(EVENTS_KEY);
      setEvents(raw ? JSON.parse(raw) : []);
    } catch { /* ignore */ }

    // Enabled resources — read from localStorage (shared with /equipment)
    try {
      const raw = localStorage.getItem(ENABLED_KEY);
      if (raw) setEnabled(new Set(JSON.parse(raw) as ResourceId[]));
    } catch { /* ignore */ }

    // Listen for changes to events from the same or other tabs
    function onStorage(e: StorageEvent) {
      if (e.key === EVENTS_KEY && e.newValue) {
        try { setEvents(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
      if (e.key === ENABLED_KEY && e.newValue) {
        try { setEnabled(new Set(JSON.parse(e.newValue) as ResourceId[])); } catch { /* ignore */ }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const weekDates     = getWeekDates(weekOffset);
  const today         = localDateStr();
  const enabledList   = ALL_RESOURCES.filter(r => enabled.has(r.id));

  const weekLabel = (() => {
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(weekDates[0])} – ${fmt(weekDates[6])}`;
  })();

  return (
    <div className="flex flex-col gap-2">
      {/* Week navigation header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="rounded px-1.5 py-0.5 text-zinc-500 transition hover:bg-zinc-700 hover:text-zinc-200"
          >
            ‹
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="rounded px-1 py-0.5 text-[9px] text-zinc-600 hover:text-zinc-400"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="rounded px-1.5 py-0.5 text-zinc-500 transition hover:bg-zinc-700 hover:text-zinc-200"
          >
            ›
          </button>
        </div>
        <span className="text-[10px] font-medium text-zinc-400">{weekLabel}</span>
      </div>

      {/* Compact read-only weekly grid — click anywhere to open /equipment */}
      <Link
        href="/equipment"
        className="block overflow-x-auto rounded border border-zinc-800 transition hover:border-zinc-600 hover:ring-1 hover:ring-zinc-600/50"
        title="Open Equipment Schedule"
      >
        {enabledList.length === 0 ? (
          <div className="flex h-16 items-center justify-center">
            <p className="text-[10px] text-zinc-700">All calendars hidden in /equipment</p>
          </div>
        ) : (
          <table className="w-full min-w-[400px] border-collapse text-[9px]">
            {/* Day header */}
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="w-20 border-r border-zinc-800 px-1.5 py-1 text-left font-normal text-zinc-700" />
                {weekDates.map(d => {
                  const ds = localDateStr(d);
                  const isTdy = ds === today;
                  return (
                    <th
                      key={ds}
                      className={`border-r border-zinc-800 px-1 py-1 text-center font-semibold ${
                        isTdy ? "bg-indigo-950/40 text-indigo-300" : "text-zinc-500"
                      }`}
                    >
                      <div>{DAY_LABELS_SHORT[d.getDay()]}</div>
                      <div className={`text-[10px] font-bold ${isTdy ? "text-indigo-300" : "text-zinc-400"}`}>
                        {d.getDate()}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {RESOURCE_GROUPS.map(group => {
                const groupResources = enabledList.filter(r => r.group.id === group.id);
                if (groupResources.length === 0) return null;
                return groupResources.map((resource, rIdx) => (
                  <tr key={resource.id} className="border-b border-zinc-800/40">
                    {/* Resource label */}
                    <td className={`border-r border-zinc-800 px-1.5 py-1 font-medium ${group.textCls} opacity-70`}>
                      <div className="truncate max-w-[4.5rem]">{resource.label}</div>
                    </td>

                    {/* Day cells */}
                    {weekDates.map(d => {
                      const ds      = localDateStr(d);
                      const isTdy   = ds === today;
                      const dayEvts = events.filter(
                        e => e.resourceId === resource.id && e.date === ds
                      );
                      return (
                        <td
                          key={ds}
                          className={`border-r border-zinc-800 px-0.5 py-0.5 align-top ${
                            isTdy ? "bg-indigo-950/10" : ""
                          }`}
                        >
                          <div className="space-y-px">
                            {dayEvts.slice(0, 2).map(ev => (
                              <div
                                key={ev.id}
                                className={`truncate rounded px-1 py-px leading-tight ${group.chipBg} ${group.chipText}`}
                              >
                                {ev.startTime && (
                                  <span className="opacity-60">{fmt12h(ev.startTime)} </span>
                                )}
                                {ev.title}
                              </div>
                            ))}
                            {dayEvts.length > 2 && (
                              <div className="text-zinc-600">+{dayEvts.length - 2}</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        )}
      </Link>

      {/* Footer label */}
      <div className="text-right">
        <span className="text-[10px] text-zinc-600">
          Click grid to open full schedule →
        </span>
      </div>
    </div>
  );
}
