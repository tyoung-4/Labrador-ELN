"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import AppTopNav from "@/components/AppTopNav";
import Link from "next/link";
import { USER_STORAGE_KEY, ELN_USERS } from "@/components/AppTopNav";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "weekly" | "monthly" | "daily";

type ResourceId =
  | "tc147" | "tc127"
  | "akta1" | "akta2" | "ngc" | "hplc"
  | "spr-t200" | "spr-new"
  | "plasmid-pro";

type ResourceMeta = { id: ResourceId; label: string };

type ResourceGroup = {
  id: string;
  label: string;
  textCls: string;
  borderCls: string;
  chipBg: string;
  chipText: string;
  resources: ResourceMeta[];
};

type ScheduleEvent = {
  id: string;
  resourceId: ResourceId;
  date: string;       // YYYY-MM-DD
  startTime?: string; // HH:MM (24h)
  endTime?: string;   // HH:MM (24h)
  title: string;
  userId: string;
  userName: string;
};

type BookingDraft = {
  resourceId: ResourceId | "";
  date: string;
  startTime: string;
  endTime: string;
  title: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

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

const ALL_RESOURCES: (ResourceMeta & { group: ResourceGroup })[] =
  RESOURCE_GROUPS.flatMap(g => g.resources.map(r => ({ ...r, group: g })));

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 a.m.–8 p.m.

export const EVENTS_KEY   = "eln-schedule-events";
export const ENABLED_KEY  = "eln-schedule-enabled";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Date helpers ─────────────────────────────────────────────────────────────

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

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first    = new Date(year, month, 1);
  const last     = new Date(year, month + 1, 0);
  const startDow = first.getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function fmt12h(t: string): string {
  const [h24s, minS] = t.split(":");
  const h24 = parseInt(h24s, 10);
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${minS}${h24 < 12 ? "a" : "p"}`;
}

function groupFor(id: ResourceId): ResourceGroup {
  return ALL_RESOURCES.find(r => r.id === id)!.group;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  // User
  const [userId,   setUserId]   = useState(ELN_USERS[0].id);
  const [userName, setUserName] = useState(ELN_USERS[0].name);

  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      const u = ELN_USERS.find(u => u.id === stored);
      if (u) { setUserId(u.id); setUserName(u.name); }
    }
    function onStorage(e: StorageEvent) {
      if (e.key === USER_STORAGE_KEY && e.newValue) {
        const u = ELN_USERS.find(u => u.id === e.newValue);
        if (u) { setUserId(u.id); setUserName(u.name); }
      }
      // Pick up equipment bookings written by the Dashboard (same-tab synthetic events)
      if (e.key === EVENTS_KEY) {
        try { setEvents(e.newValue ? JSON.parse(e.newValue) : []); } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // View — always resets to daily on mount; other nav state persists in session
  const [view,        setView]        = useState<ViewMode>("daily");
  const [weekOffset,  setWeekOffset]  = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dailyDate,   setDailyDate]   = useState(localDateStr());

  // Enabled resources — all on by default; localStorage persists across pages for shared state
  const [enabled, setEnabled] = useState<Set<ResourceId>>(
    () => new Set(ALL_RESOURCES.map(r => r.id))
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENABLED_KEY);
      if (raw) setEnabled(new Set(JSON.parse(raw) as ResourceId[]));
    } catch { /* ignore */ }
  }, []);

  function toggleResource(id: ResourceId) {
    setEnabled(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleGroup(g: ResourceGroup) {
    const ids = g.resources.map(r => r.id);
    const allOn = ids.every(id => enabled.has(id));
    setEnabled(prev => {
      const next = new Set(prev);
      ids.forEach(id => allOn ? next.delete(id) : next.add(id));
      return next;
    });
  }

  // Events
  const [events, setEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EVENTS_KEY);
      setEvents(raw ? JSON.parse(raw) : []);
    } catch { setEvents([]); }
  }, []);

  useEffect(() => {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  }, [events]);

  // Persist enabled state to localStorage so home page mirror can read it
  useEffect(() => {
    localStorage.setItem(ENABLED_KEY, JSON.stringify([...enabled]));
  }, [enabled]);

  // Booking modal
  const [showModal,  setShowModal]  = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BookingDraft>({
    resourceId: "",
    date: localDateStr(),
    startTime: "09:00",
    endTime: "10:00",
    title: "",
  });

  function openNew(params: Partial<BookingDraft> = {}) {
    setEditEventId(null);
    setDraft({
      resourceId: "",
      date: localDateStr(),
      startTime: "09:00",
      endTime: "10:00",
      title: "",
      ...params,
    });
    setShowModal(true);
  }

  function openEdit(ev: ScheduleEvent) {
    setEditEventId(ev.id);
    setDraft({
      resourceId: ev.resourceId,
      date: ev.date,
      startTime: ev.startTime ?? "09:00",
      endTime: ev.endTime ?? "10:00",
      title: ev.title,
    });
    setShowModal(true);
  }

  function saveBooking() {
    if (!draft.resourceId || !draft.date) return;
    const autoTitle = draft.title.trim() ||
      (ALL_RESOURCES.find(r => r.id === draft.resourceId)?.label ?? draft.resourceId);
    if (editEventId) {
      setEvents(prev => prev.map(e =>
        e.id === editEventId
          ? { ...e, resourceId: draft.resourceId as ResourceId, date: draft.date, startTime: draft.startTime, endTime: draft.endTime, title: autoTitle, userId, userName }
          : e
      ));
    } else {
      setEvents(prev => [...prev, {
        id: crypto.randomUUID(),
        resourceId: draft.resourceId as ResourceId,
        date: draft.date,
        startTime: draft.startTime || undefined,
        endTime: draft.endTime || undefined,
        title: autoTitle,
        userId,
        userName,
      }]);
    }
    setShowModal(false);
  }

  function deleteBooking(id: string) {
    if (!window.confirm("Delete this booking?")) return;
    setEvents(prev => prev.filter(e => e.id !== id));
    setShowModal(false);
  }

  // Month label
  const { year: monthYear, month: monthMonth } = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [monthOffset]);

  const enabledList = ALL_RESOURCES.filter(r => enabled.has(r.id));

  // Week date range label
  const weekDates = getWeekDates(weekOffset);
  const weekLabel = (() => {
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(weekDates[0])} – ${fmt(weekDates[6])}`;
  })();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <div className="p-6 pb-3">
        <AppTopNav />
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* ── Left sidebar: resource toggles ── */}
        <aside className="flex w-52 shrink-0 flex-col gap-1 border-r border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Calendars
          </p>
          {RESOURCE_GROUPS.map(group => {
            const groupIds = group.resources.map(r => r.id);
            const someOn   = groupIds.some(id => enabled.has(id));
            return (
              <div key={group.id} className="mb-2">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group)}
                  className={`mb-1 flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[10px] font-bold uppercase tracking-wider transition hover:bg-zinc-800 ${group.textCls}`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-sm border ${group.borderCls} transition ${
                      someOn ? "bg-current opacity-80" : "opacity-20"
                    }`}
                  />
                  {group.label}
                </button>
                {/* Individual resources */}
                {group.resources.map(resource => (
                  <button
                    key={resource.id}
                    onClick={() => toggleResource(resource.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition hover:bg-zinc-800"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full border transition ${group.borderCls} ${
                        enabled.has(resource.id) ? group.chipBg + " opacity-100" : "opacity-30"
                      }`}
                    />
                    <span className={enabled.has(resource.id) ? "text-zinc-200" : "text-zinc-600"}>
                      {resource.label}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}

          {/* Add booking shortcut */}
          <div className="mt-auto pt-4">
            <button
              onClick={() => openNew()}
              className="w-full rounded border border-indigo-700 bg-indigo-600/20 px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-600/40 transition"
            >
              + Add Booking
            </button>
          </div>
        </aside>

        {/* ── Main calendar area ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-5 py-3">
            {/* View switcher */}
            <div className="flex overflow-hidden rounded border border-zinc-700 bg-zinc-800">
              {(["daily", "weekly", "monthly"] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-semibold capitalize transition ${
                    view === v
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (view === "weekly")  setWeekOffset(o => o - 1);
                  if (view === "monthly") setMonthOffset(o => o - 1);
                  if (view === "daily") {
                    const d = new Date(dailyDate);
                    d.setDate(d.getDate() - 1);
                    setDailyDate(localDateStr(d));
                  }
                }}
                className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                ‹
              </button>

              <button
                onClick={() => {
                  setWeekOffset(0);
                  setMonthOffset(0);
                  setDailyDate(localDateStr());
                }}
                className="rounded px-2 py-1 text-xs text-zinc-600 hover:text-zinc-400"
              >
                Today
              </button>

              <button
                onClick={() => {
                  if (view === "weekly")  setWeekOffset(o => o + 1);
                  if (view === "monthly") setMonthOffset(o => o + 1);
                  if (view === "daily") {
                    const d = new Date(dailyDate);
                    d.setDate(d.getDate() + 1);
                    setDailyDate(localDateStr(d));
                  }
                }}
                className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                ›
              </button>
            </div>

            {/* Date label */}
            <p className="text-sm font-semibold text-zinc-300">
              {view === "weekly"  && weekLabel}
              {view === "monthly" && new Date(monthYear, monthMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              {view === "daily"   && new Date(dailyDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>

            <button
              onClick={() => openNew({ date: view === "daily" ? dailyDate : localDateStr() })}
              className="ml-auto rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500"
            >
              + Book
            </button>
          </div>

          {/* Calendar body */}
          <div className="flex-1 overflow-auto">
            {view === "weekly" && (
              <WeeklyView
                weekDates={weekDates}
                enabledResources={enabledList}
                events={events}
                onCellClick={(resourceId, date) => openNew({ resourceId, date })}
                onEventClick={openEdit}
              />
            )}
            {view === "monthly" && (
              <MonthlyView
                year={monthYear}
                month={monthMonth}
                enabledResources={enabledList}
                events={events}
                onDayClick={(date) => openNew({ date })}
                onEventClick={openEdit}
              />
            )}
            {view === "daily" && (
              <DailyView
                date={dailyDate}
                enabledResources={enabledList}
                events={events}
                onCellClick={(resourceId, startTime) => openNew({ resourceId, date: dailyDate, startTime })}
                onEventClick={openEdit}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Booking modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onMouseDown={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="mx-4 w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-base font-semibold text-zinc-100">
              {editEventId ? "Edit Booking" : "New Booking"}
            </h3>
            <div className="space-y-3">
              {/* Title (optional) */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Title <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  autoFocus
                  value={draft.title}
                  onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                  placeholder="Auto-filled from resource name if blank"
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              {/* Resource */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Resource</label>
                <select
                  value={draft.resourceId}
                  onChange={e => setDraft(d => ({ ...d, resourceId: e.target.value as ResourceId | "" }))}
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

              {/* Date */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Date</label>
                <input
                  type="date"
                  value={draft.date}
                  onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
                />
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Start time</label>
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={e => setDraft(d => ({ ...d, startTime: e.target.value }))}
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">End time</label>
                  <input
                    type="time"
                    value={draft.endTime}
                    onChange={e => setDraft(d => ({ ...d, endTime: e.target.value }))}
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              {editEventId && (
                <button
                  onClick={() => deleteBooking(editEventId)}
                  className="rounded border border-red-700/50 bg-red-900/20 px-3 py-2 text-xs text-red-400 hover:bg-red-900/40"
                >
                  Delete
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded border border-zinc-700 px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={saveBooking}
                  disabled={!draft.resourceId || !draft.date}
                  className="rounded bg-indigo-600 px-4 py-2 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {editEventId ? "Update" : "Book"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Weekly View ──────────────────────────────────────────────────────────────

function WeeklyView({
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
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-zinc-700">Enable at least one calendar from the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="min-w-[640px]">
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
              className={`border-r border-zinc-800 px-2 py-2 text-center ${
                isToday ? "bg-indigo-950/30" : ""
              }`}
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
            {/* Group label row */}
            <div
              className="grid border-b border-zinc-800/60 bg-zinc-900/60"
              style={{ gridTemplateColumns: `11rem repeat(7, minmax(0, 1fr))` }}
            >
              <div className={`col-span-8 px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${group.textCls}`}>
                {group.label}
              </div>
            </div>

            {/* Resource rows */}
            {groupResources.map(resource => (
              <div
                key={resource.id}
                className="grid border-b border-zinc-800/40"
                style={{ gridTemplateColumns: `11rem repeat(7, minmax(0, 1fr))` }}
              >
                {/* Resource label */}
                <div className={`border-r border-zinc-800 px-3 py-2 text-xs font-medium ${group.textCls} opacity-80`}>
                  {resource.label}
                </div>

                {/* Day cells */}
                {weekDates.map(d => {
                  const ds       = localDateStr(d);
                  const isToday  = ds === today;
                  const dayEvts  = events.filter(e => e.resourceId === resource.id && e.date === ds);

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

// ─── Monthly View ─────────────────────────────────────────────────────────────

function MonthlyView({
  year,
  month,
  enabledResources,
  events,
  onDayClick,
  onEventClick,
}: {
  year: number;
  month: number;
  enabledResources: (ResourceMeta & { group: ResourceGroup })[];
  events: ScheduleEvent[];
  onDayClick: (date: string) => void;
  onEventClick: (ev: ScheduleEvent) => void;
}) {
  const cells    = getMonthGrid(year, month);
  const today    = localDateStr();
  const enabledIds = new Set(enabledResources.map(r => r.id));

  return (
    <div className="p-4">
      {/* Day header */}
      <div className="mb-1 grid grid-cols-7 gap-1 text-center">
        {DAY_LABELS.map(d => (
          <div key={d} className="py-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const ds       = localDateStr(d);
          const isToday  = ds === today;
          const dayEvts  = events.filter(e => enabledIds.has(e.resourceId) && e.date === ds);
          const isOtherMonth = d.getMonth() !== month;

          return (
            <div
              key={ds}
              onClick={() => onDayClick(ds)}
              className={`min-h-[5rem] cursor-pointer rounded border p-1.5 transition hover:bg-zinc-800/60 ${
                isToday
                  ? "border-indigo-500/50 bg-indigo-950/30"
                  : isOtherMonth
                  ? "border-zinc-800/40 bg-zinc-900/20"
                  : "border-zinc-800 bg-zinc-900/40"
              }`}
            >
              <p className={`mb-1 text-xs font-bold ${
                isToday ? "text-indigo-300" : isOtherMonth ? "text-zinc-700" : "text-zinc-400"
              }`}>
                {d.getDate()}
              </p>
              <div className="space-y-0.5">
                {dayEvts.slice(0, 4).map(ev => {
                  const g = groupFor(ev.resourceId);
                  return (
                    <div
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                      className={`truncate rounded px-1 py-px text-[8px] leading-tight ${g.chipBg} ${g.chipText} hover:opacity-80`}
                    >
                      {ev.title}
                    </div>
                  );
                })}
                {dayEvts.length > 4 && (
                  <p className="text-[8px] text-zinc-600">+{dayEvts.length - 4}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Daily View ───────────────────────────────────────────────────────────────

function DailyView({
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
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-zinc-700">Enable at least one calendar from the sidebar.</p>
      </div>
    );
  }

  const colCount = enabledResources.length;

  return (
    <div className="min-w-[480px]">
      {/* Resource header */}
      <div
        className="sticky top-0 z-10 grid border-b border-zinc-800 bg-zinc-950"
        style={{ gridTemplateColumns: `3.5rem repeat(${colCount}, minmax(0, 1fr))` }}
      >
        <div className="border-r border-zinc-800" />
        {enabledResources.map(r => (
          <div key={r.id} className={`border-r border-zinc-800 px-2 py-2 text-center text-[10px] font-semibold ${r.group.textCls}`}>
            {r.label}
          </div>
        ))}
      </div>

      {/* Hour rows */}
      {HOURS.map(h => {
        const hh      = String(h).padStart(2, "0");
        const nowHour = new Date().getHours();
        const isCurrent = h === nowHour && date === localDateStr();

        return (
          <div
            key={h}
            className={`grid border-b border-zinc-800/40 ${isCurrent ? "bg-indigo-950/20" : ""}`}
            style={{ gridTemplateColumns: `3.5rem repeat(${colCount}, minmax(0, 1fr))` }}
          >
            {/* Hour label */}
            <div className={`border-r border-zinc-800 px-1.5 py-2 text-right text-[9px] ${
              isCurrent ? "font-bold text-indigo-400" : "text-zinc-700"
            }`}>
              {h % 12 === 0 ? 12 : h % 12}{h < 12 ? "a" : "p"}
            </div>

            {/* Resource cells */}
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
                      className={`truncate rounded px-1.5 py-1 text-[9px] leading-tight ${r.group.chipBg} ${r.group.chipText} hover:opacity-80`}
                    >
                      {ev.title}
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
