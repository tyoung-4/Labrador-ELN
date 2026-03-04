"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResourceId =
  | "tc147" | "tc127"
  | "akta1" | "akta2" | "ngc" | "hplc"
  | "spr-t200" | "spr-new"
  | "plasmid-pro";

export type ResourceMeta = { id: ResourceId; label: string };

export type ResourceGroup = {
  id: string;
  label: string;
  textCls: string;
  borderCls: string;
  chipBg: string;
  chipText: string;
  resources: ResourceMeta[];
};

export type ScheduleEvent = {
  id: string;
  resourceId: ResourceId;
  date: string;        // YYYY-MM-DD
  startTime?: string;  // HH:MM (24h)
  endTime?: string;    // HH:MM (24h)
  title: string;
  userId: string;
  userName: string;
};

export type BookingDraft = {
  resourceId: ResourceId | "";
  date: string;
  startTime: string;
  endTime: string;
  title: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const EVENTS_KEY  = "eln-schedule-events";
export const ENABLED_KEY = "eln-schedule-enabled";

export const RESOURCE_GROUPS: ResourceGroup[] = [
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

export const ALL_RESOURCES: (ResourceMeta & { group: ResourceGroup })[] =
  RESOURCE_GROUPS.flatMap(g => g.resources.map(r => ({ ...r, group: g })));

export const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 a.m.–8 p.m.

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function localDateStr(d = new Date()): string {
  return (
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0")
  );
}

export function getWeekDates(weekOffset = 0): Date[] {
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

export function fmt12h(t: string): string {
  const [h24s, minS] = t.split(":");
  const h24 = parseInt(h24s, 10);
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${minS}${h24 < 12 ? "a" : "p"}`;
}

export function groupFor(id: ResourceId): ResourceGroup {
  return ALL_RESOURCES.find(r => r.id === id)!.group;
}

// ─── DailyView ────────────────────────────────────────────────────────────────

export function DailyView({
  date,
  enabledResources,
  events,
  onCellClick,
  onEventClick,
}: {
  date: string;
  enabledResources: (ResourceMeta & { group: ResourceGroup })[];
  events: ScheduleEvent[];
  onCellClick: (resourceId: ResourceId, startTime: string) => void;
  onEventClick: (ev: ScheduleEvent) => void;
}) {
  if (enabledResources.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-xs text-zinc-700">Enable at least one calendar.</p>
      </div>
    );
  }

  const colCount = enabledResources.length;
  const today    = localDateStr();
  const isToday  = date === today;

  return (
    <div className="min-w-[320px]">
      {/* Resource header */}
      <div
        className="sticky top-0 z-10 grid border-b border-zinc-800 bg-zinc-950"
        style={{ gridTemplateColumns: `3.5rem repeat(${colCount}, minmax(0, 1fr))` }}
      >
        <div className="border-r border-zinc-800" />
        {enabledResources.map(r => (
          <div
            key={r.id}
            className={`border-r border-zinc-800 px-2 py-2 text-center text-[10px] font-semibold ${r.group.textCls}`}
          >
            {r.label}
          </div>
        ))}
      </div>

      {/* Hour rows */}
      {HOURS.map(h => {
        const hh        = String(h).padStart(2, "0");
        const nowHour   = new Date().getHours();
        const isCurrent = h === nowHour && isToday;

        return (
          <div
            key={h}
            className={`grid border-b border-zinc-800/40 ${isCurrent ? "bg-indigo-950/20" : ""}`}
            style={{ gridTemplateColumns: `3.5rem repeat(${colCount}, minmax(0, 1fr))` }}
          >
            <div className={`border-r border-zinc-800 px-1.5 py-2 text-right text-[9px] ${
              isCurrent ? "font-bold text-indigo-400" : "text-zinc-700"
            }`}>
              {h % 12 === 0 ? 12 : h % 12}{h < 12 ? "a" : "p"}
            </div>

            {enabledResources.map(r => {
              const slotEvts = events.filter(e =>
                e.resourceId === r.id &&
                e.date === date &&
                e.startTime?.startsWith(hh + ":")
              );
              return (
                <div
                  key={r.id}
                  onClick={() => onCellClick(r.id, `${hh}:00`)}
                  className="group min-h-[2.5rem] cursor-pointer border-r border-zinc-800 p-0.5 transition hover:bg-zinc-800/50"
                >
                  {slotEvts.map(ev => (
                    <div
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                      className={`rounded px-1.5 py-1 text-[9px] leading-tight cursor-pointer ${r.group.chipBg} ${r.group.chipText} hover:opacity-80`}
                    >
                      <div className="truncate font-medium">{ev.title}</div>
                      <div className="truncate opacity-70">{ev.userName}</div>
                      {ev.startTime && ev.endTime && (
                        <div className="opacity-60">{fmt12h(ev.startTime)}–{fmt12h(ev.endTime)}</div>
                      )}
                    </div>
                  ))}
                  {slotEvts.length === 0 && (
                    <div className="flex h-full items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="text-[9px] text-zinc-700">+</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── WeeklyView ───────────────────────────────────────────────────────────────

export function WeeklyView({
  weekDates,
  enabledResources,
  events,
  onCellClick,
  onEventClick,
}: {
  weekDates: Date[];
  enabledResources: (ResourceMeta & { group: ResourceGroup })[];
  events: ScheduleEvent[];
  onCellClick: (resourceId: ResourceId, date: string) => void;
  onEventClick: (ev: ScheduleEvent) => void;
}) {
  const today = localDateStr();

  if (enabledResources.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-xs text-zinc-700">Enable at least one calendar.</p>
      </div>
    );
  }

  return (
    <div className="min-w-[480px]">
      {/* Day header row */}
      <div
        className="sticky top-0 z-10 grid border-b border-zinc-800 bg-zinc-950"
        style={{ gridTemplateColumns: `11rem repeat(7, minmax(0, 1fr))` }}
      >
        <div className="border-r border-zinc-800 px-3 py-2" />
        {weekDates.map(d => {
          const ds      = localDateStr(d);
          const isToday = ds === today;
          return (
            <div
              key={ds}
              className={`border-r border-zinc-800 px-2 py-2 text-center ${isToday ? "bg-indigo-950/30" : ""}`}
            >
              <p className={`text-[9px] font-semibold uppercase tracking-wider ${isToday ? "text-indigo-400" : "text-zinc-600"}`}>
                {DAY_LABELS[d.getDay()]}
              </p>
              <p className={`text-sm font-bold ${isToday ? "text-indigo-300" : "text-zinc-400"}`}>
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Resource rows grouped */}
      {RESOURCE_GROUPS.map(group => {
        const groupResources = enabledResources.filter(r => r.group.id === group.id);
        if (groupResources.length === 0) return null;
        return (
          <div key={group.id}>
            <div
              className="grid border-b border-zinc-800/60 bg-zinc-900/60"
              style={{ gridTemplateColumns: `11rem repeat(7, minmax(0, 1fr))` }}
            >
              <div className={`col-span-8 px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${group.textCls}`}>
                {group.label}
              </div>
            </div>

            {groupResources.map(resource => (
              <div
                key={resource.id}
                className="grid border-b border-zinc-800/40"
                style={{ gridTemplateColumns: `11rem repeat(7, minmax(0, 1fr))` }}
              >
                <div className={`border-r border-zinc-800 px-3 py-2 text-xs font-medium ${group.textCls} opacity-80`}>
                  {resource.label}
                </div>

                {weekDates.map(d => {
                  const ds      = localDateStr(d);
                  const isToday = ds === today;
                  const dayEvts = events.filter(e => e.resourceId === resource.id && e.date === ds);

                  return (
                    <div
                      key={ds}
                      onClick={() => onCellClick(resource.id, ds)}
                      className={`group min-h-[3.5rem] cursor-pointer border-r border-zinc-800 p-1 transition hover:bg-zinc-800/50 ${
                        isToday ? "bg-indigo-950/20" : ""
                      }`}
                    >
                      <div className="space-y-0.5">
                        {dayEvts.slice(0, 3).map(ev => (
                          <div
                            key={ev.id}
                            onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                            className={`truncate rounded px-1 py-0.5 text-[9px] leading-tight cursor-pointer ${group.chipBg} ${group.chipText} hover:opacity-80`}
                          >
                            {ev.startTime && <span className="opacity-70">{fmt12h(ev.startTime)} </span>}
                            {ev.title}
                            {ev.userName && <span className="opacity-60"> — {ev.userName}</span>}
                          </div>
                        ))}
                        {dayEvts.length > 3 && (
                          <p className="text-[8px] text-zinc-600">+{dayEvts.length - 3} more</p>
                        )}
                      </div>
                      {dayEvts.length === 0 && (
                        <div className="flex h-full items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="text-[9px] text-zinc-700">+</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── BookingModal ─────────────────────────────────────────────────────────────

export function BookingModal({
  draft,
  editEventId,
  onDraftChange,
  onSave,
  onDelete,
  onClose,
  errorMessage,
  saving,
  canDelete,
}: {
  draft: BookingDraft;
  editEventId: string | null;
  onDraftChange: (d: BookingDraft) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  errorMessage?: string | null;
  saving?: boolean;
  /** Show the Delete button — only true when the current user owns the booking */
  canDelete?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <h3 className="mb-4 text-base font-semibold text-zinc-100">
          {editEventId ? "Edit Booking" : "New Booking"}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Title <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              autoFocus
              value={draft.title}
              onChange={e => onDraftChange({ ...draft, title: e.target.value })}
              placeholder="Auto-filled from resource name if blank"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Resource</label>
            <select
              value={draft.resourceId}
              onChange={e => onDraftChange({ ...draft, resourceId: e.target.value as ResourceId | "" })}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
            >
              <option value="">— Select resource —</option>
              {RESOURCE_GROUPS.map(g => (
                <optgroup key={g.id} label={g.label}>
                  {g.resources.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Date</label>
            <input
              type="date"
              value={draft.date}
              onChange={e => onDraftChange({ ...draft, date: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Start time</label>
              <input
                type="time"
                value={draft.startTime}
                onChange={e => onDraftChange({ ...draft, startTime: e.target.value })}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">End time</label>
              <input
                type="time"
                value={draft.endTime}
                onChange={e => onDraftChange({ ...draft, endTime: e.target.value })}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="rounded border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2">
          {editEventId && canDelete && (
            <button
              onClick={() => onDelete(editEventId)}
              disabled={saving}
              className="rounded border border-red-700/50 bg-red-900/20 px-3 py-2 text-xs text-red-400 hover:bg-red-900/40 disabled:opacity-50"
            >
              Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded border border-zinc-700 px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!draft.resourceId || !draft.date || saving}
              className="rounded bg-indigo-600 px-4 py-2 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : editEventId ? "Update" : "Book"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
