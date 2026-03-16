"use client";

import { MouseEvent, useEffect, useRef, useState } from "react";

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
  date: string;        // YYYY-MM-DD  (start date)
  startTime?: string;  // HH:MM (24h)
  endTime?: string;    // HH:MM (24h) — may be on the next calendar day if overnight
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
  isOvernight?: boolean;
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

/** Full 24-hour day, 12:00 am–11:00 pm */
export const HOURS = Array.from({ length: 24 }, (_, i) => i);

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

/** "09:30" → "9:30 am",  "13:00" → "1:00 pm" */
export function fmt12h(t: string): string {
  const [h24s, minS] = t.split(":");
  const h24 = parseInt(h24s, 10);
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${minS} ${h24 < 12 ? "am" : "pm"}`;
}

export function groupFor(id: ResourceId): ResourceGroup {
  return ALL_RESOURCES.find(r => r.id === id)!.group;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Generate all 30-min time options for a day */
function gen30MinOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh  = String(h).padStart(2, "0");
      const mm  = String(m).padStart(2, "0");
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      opts.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${h < 12 ? "am" : "pm"}` });
    }
  }
  return opts;
}

const TIME_OPTIONS = gen30MinOptions();

/** Advance a YYYY-MM-DD string by one calendar day */
export function nextDayStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}

// ─── DailyView ────────────────────────────────────────────────────────────────

const TOTAL_MINUTES      = 1440;                                // 12 am – 11:59 pm
const GRID_PX_PER_MINUTE = 2;                                   // 2 px / min = 120 px / hr
const TOTAL_GRID_HEIGHT  = TOTAL_MINUTES * GRID_PX_PER_MINUTE; // 2880 px
const CONTAINER_HEIGHT   = 360  * GRID_PX_PER_MINUTE;          // 720 px  (6-hr viewport)

// 48 labels: 12:00 am, 12:30 am … 11:30 pm  (pre-computed at module load)
const TIME_LABELS: ReadonlyArray<{ label: string; topPx: number }> =
  Array.from({ length: 48 }, (_, i) => {
    const totalMins = i * 30;
    const h24       = Math.floor(totalMins / 60);
    const m         = totalMins % 60;
    const h12       = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    return {
      label: `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "am" : "pm"}`,
      topPx: totalMins * GRID_PX_PER_MINUTE,
    };
  });

export function DailyView({
  date,
  enabledResources,
  events,
  onCellClick,
  onEventClick,
  onEndEarly,
  currentUserId,
  scrollTrigger,
}: {
  date: string;
  enabledResources: (ResourceMeta & { group: ResourceGroup })[];
  events: ScheduleEvent[];
  onCellClick: (resourceId: ResourceId, startTime: string) => void;
  onEventClick: (ev: ScheduleEvent) => void;
  onEndEarly?: (ev: ScheduleEvent) => void;
  /** Current user's ID. When provided, only owners (or "Admin") can interact. */
  currentUserId?: string;
  /** Increment to force-scroll back to default position (e.g. on Today click). */
  scrollTrigger?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track current minute for the live time indicator — updates every 60 s
  const [nowMins, setNowMins] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNowMins(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to default position on mount, date change, or explicit trigger
  function defaultScrollPx(): number {
    if (date === localDateStr()) {
      const n = new Date();
      return (n.getHours() * 60 + n.getMinutes()) * GRID_PX_PER_MINUTE;
    }
    return 8 * 60 * GRID_PX_PER_MINUTE; // 8 am = 960 px
  }
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = defaultScrollPx();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, scrollTrigger]);

  if (enabledResources.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-xs text-zinc-700">Enable at least one calendar.</p>
      </div>
    );
  }

  const colCount = enabledResources.length;
  const isToday  = date === localDateStr();

  // ── Helpers ────────────────────────────────────────────────────────────────
  function tmins(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  }

  function bookingTop(startTime: string): number {
    return tmins(startTime) * GRID_PX_PER_MINUTE;
  }

  function bookingHeight(startTime: string, endTime: string): number {
    let s = tmins(startTime);
    let e = tmins(endTime);
    if (e <= s) e += 1440; // overnight
    return Math.max((e - s) * GRID_PX_PER_MINUTE, 24);
  }

  function isActive(ev: ScheduleEvent): boolean {
    if (!isToday || !ev.startTime || !ev.endTime) return false;
    const s = tmins(ev.startTime);
    const e = tmins(ev.endTime);
    return e > s ? nowMins >= s && nowMins < e : nowMins >= s;
  }

  function isOwner(ev: ScheduleEvent): boolean {
    if (!currentUserId) return true;
    return ev.userId === currentUserId || currentUserId === "Admin";
  }

  function handleColClick(e: MouseEvent<HTMLDivElement>, resourceId: ResourceId) {
    const rect        = e.currentTarget.getBoundingClientRect();
    const clickedMins = Math.floor((e.clientY - rect.top) / GRID_PX_PER_MINUTE);
    const rounded     = Math.floor(clickedMins / 30) * 30;
    const h = Math.floor(rounded / 60) % 24;
    const m = rounded % 60;
    onCellClick(resourceId, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }

  return (
    <div className="min-w-[320px]">
      {/* ── Scroll viewport (6-hr window) ── */}
      <div
        ref={scrollRef}
        className="overflow-y-scroll"
        style={{ height: `${CONTAINER_HEIGHT}px` }}
      >
        {/* Sticky resource header */}
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

        {/* ── Full-day grid (2880 px) ── */}
        <div className="relative" style={{ height: `${TOTAL_GRID_HEIGHT}px` }}>

          {/* Current-time indicator (today only) */}
          {isToday && (
            <div
              className="pointer-events-none absolute z-20 border-t-2 border-red-500"
              style={{ top: `${nowMins * GRID_PX_PER_MINUTE}px`, left: "3.5rem", right: 0 }}
            />
          )}

          {/* Time label column */}
          <div
            className="absolute left-0 top-0 bottom-0 border-r border-zinc-800"
            style={{ width: "3.5rem" }}
          >
            {TIME_LABELS.map(({ label, topPx }) => (
              <div
                key={topPx}
                className="absolute inset-x-0 px-1 text-right text-[9px] leading-none text-zinc-700"
                style={{ top: `${topPx}px` }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Resource columns */}
          <div
            className="absolute top-0 bottom-0 grid"
            style={{
              left: "3.5rem",
              right: 0,
              gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
            }}
          >
            {enabledResources.map(r => {
              const colEvts = events.filter(e => e.resourceId === r.id && e.date === date);

              return (
                <div
                  key={r.id}
                  onClick={e => handleColClick(e, r.id)}
                  className="relative h-full cursor-pointer border-r border-zinc-800 transition hover:bg-zinc-800/20"
                >
                  {/* 30-min grid lines */}
                  {TIME_LABELS.map(({ topPx }, i) => (
                    <div
                      key={topPx}
                      className={`pointer-events-none absolute inset-x-0 border-t ${
                        i % 2 === 0 ? "border-zinc-800/40" : "border-zinc-800/20"
                      }`}
                      style={{ top: `${topPx}px` }}
                    />
                  ))}

                  {/* Booking boxes */}
                  {colEvts.map(ev => {
                    if (!ev.startTime || !ev.endTime) return null;
                    const top    = bookingTop(ev.startTime);
                    const height = bookingHeight(ev.startTime, ev.endTime);
                    const active = isActive(ev);
                    const owner  = isOwner(ev);

                    return (
                      <div
                        key={ev.id}
                        onClick={owner ? e => { e.stopPropagation(); onEventClick(ev); } : e => e.stopPropagation()}
                        className={`absolute inset-x-0.5 overflow-hidden rounded px-1.5 py-1 text-[9px] leading-tight ${r.group.chipBg} ${r.group.chipText} ${owner ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div className="truncate font-medium">{ev.title}</div>
                        <div className="truncate opacity-70">{ev.userName}</div>
                        {ev.startTime && ev.endTime && (
                          <div className="opacity-60">{fmt12h(ev.startTime)}–{fmt12h(ev.endTime)}</div>
                        )}
                        {active && owner && onEndEarly && (
                          <button
                            onClick={e => { e.stopPropagation(); onEndEarly(ev); }}
                            className="mt-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[8px] text-amber-300 transition hover:bg-amber-500/30"
                          >
                            End Early
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
  // ── Client-side validation ──────────────────────────────────────────────────
  const startMins    = timeToMins(draft.startTime || "00:00");
  const endMins      = timeToMins(draft.endTime   || "00:00");
  const isOvernight  = draft.isOvernight ?? false;

  // Duration: for overnight, add 24h to end so end is effectively next day
  const effectiveEndMins = isOvernight ? endMins + 1440 : endMins;
  const durationMins     = effectiveEndMins - startMins;

  let validationError: string | null = null;
  if (!isOvernight && endMins <= startMins) {
    validationError = "End time must be after start time";
  } else if (durationMins > 1440) {
    validationError = "Bookings cannot exceed 24 hours";
  } else if (isOvernight && durationMins <= 0) {
    validationError = "End time must be after start time";
  }

  const displayError = validationError ?? errorMessage ?? null;
  const canSubmit    = !saving && !!draft.resourceId && !!draft.date && !validationError;

  // Compute the displayed end date for overnight runs
  const endDateDisplay = isOvernight && draft.date
    ? new Date(draft.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : null;
  const nextDate = draft.date ? nextDayStr(draft.date) : "";
  const nextDateDisplay = nextDate
    ? new Date(nextDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "";

  void endDateDisplay; // suppress unused warning

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
          {/* Title */}
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

          {/* Resource */}
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

          {/* Date + Overnight toggle */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-400">Start date</label>
              <input
                type="date"
                value={draft.date}
                onChange={e => onDraftChange({ ...draft, date: e.target.value })}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
              />
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 pb-2.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={isOvernight}
                onChange={e => onDraftChange({ ...draft, isOvernight: e.target.checked })}
                className="rounded border-zinc-600 bg-zinc-800 accent-indigo-500"
              />
              Overnight run
            </label>
          </div>

          {/* Overnight end-date indicator */}
          {isOvernight && nextDateDisplay && (
            <p className="text-[10px] text-indigo-300">
              Ends on: <span className="font-semibold">{nextDateDisplay}</span>
            </p>
          )}

          {/* Start / End time selects */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Start time</label>
              <select
                value={draft.startTime}
                onChange={e => onDraftChange({ ...draft, startTime: e.target.value })}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
              >
                {TIME_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                End time {isOvernight && <span className="text-indigo-300">(next day)</span>}
              </label>
              <select
                value={draft.endTime}
                onChange={e => onDraftChange({ ...draft, endTime: e.target.value })}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
              >
                {TIME_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Validation / API error */}
          {displayError && (
            <div className="rounded border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
              {displayError}
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
              onClick={() => { if (canSubmit) onSave(); }}
              disabled={!canSubmit}
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
