"use client";
import { useState, useEffect, useMemo } from "react";
import AppTopNav from "@/components/AppTopNav";
import { USER_STORAGE_KEY, ELN_USERS } from "@/components/AppTopNav";
import {
  RESOURCE_GROUPS,
  ALL_RESOURCES,
  ENABLED_KEY,
  DAY_LABELS,
  localDateStr,
  getWeekDates,
  groupFor,
  DailyView,
  WeeklyView,
  BookingModal,
  type ResourceId,
  type ResourceGroup,
  type ScheduleEvent,
  type BookingDraft,
} from "@/components/EquipmentShared";
import { useEquipmentBookings, canUserDelete } from "@/hooks/useEquipmentBookings";
import { defaultEndTime } from "@/config/equipmentDefaults";

// Re-export key so any existing imports from this file continue to work
export { ENABLED_KEY };

type ViewMode = "weekly" | "monthly" | "daily";

// ─── Monthly grid helper (used only here) ─────────────────────────────────────

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
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // API-backed events
  const { events, saveBooking: saveBookingFn, deleteBooking: deleteBookingFn } = useEquipmentBookings();

  // View — defaults to daily
  const [view,        setView]        = useState<ViewMode>("daily");
  const [weekOffset,  setWeekOffset]  = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dailyDate,   setDailyDate]   = useState(localDateStr());

  // Enabled resources
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
    const ids   = g.resources.map(r => r.id);
    const allOn = ids.every(id => enabled.has(id));
    setEnabled(prev => {
      const next = new Set(prev);
      ids.forEach(id => allOn ? next.delete(id) : next.add(id));
      return next;
    });
  }

  useEffect(() => {
    localStorage.setItem(ENABLED_KEY, JSON.stringify([...enabled]));
  }, [enabled]);

  // Booking modal
  const [showModal,    setShowModal]    = useState(false);
  const [editEventId,  setEditEventId]  = useState<string | null>(null);
  const [draft,        setDraft]        = useState<BookingDraft>({
    resourceId: "", date: localDateStr(), startTime: "09:00", endTime: "10:00", title: "",
  });
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);

  function handleDraftChange(next: BookingDraft) {
    setBookingError(null);
    if (next.resourceId && next.resourceId !== draft.resourceId) {
      const end = defaultEndTime(next.resourceId as ResourceId, next.startTime || "09:00");
      setDraft({ ...next, endTime: end });
    } else {
      setDraft(next);
    }
  }

  function openNew(params: Partial<BookingDraft> = {}) {
    const resourceId = (params.resourceId ?? "") as ResourceId | "";
    const startTime  = params.startTime ?? "09:00";
    const computedEnd = resourceId
      ? defaultEndTime(resourceId as ResourceId, startTime)
      : "10:00";
    setEditEventId(null);
    setBookingError(null);
    setDraft({
      resourceId,
      date: localDateStr(),
      startTime,
      title: "",
      ...params,
      endTime: params.endTime ?? computedEnd,
    });
    setShowModal(true);
  }

  function openEdit(ev: ScheduleEvent) {
    setEditEventId(ev.id);
    setBookingError(null);
    setDraft({
      resourceId: ev.resourceId,
      date:       ev.date,
      startTime:  ev.startTime ?? "09:00",
      endTime:    ev.endTime   ?? "10:00",
      title:      ev.title,
    });
    setShowModal(true);
  }

  async function saveBooking() {
    setSaving(true);
    setBookingError(null);
    const err = await saveBookingFn(draft, editEventId, userId, userName);
    setSaving(false);
    if (err) {
      setBookingError(err);
    } else {
      setShowModal(false);
    }
  }

  async function deleteBooking(id: string) {
    if (!window.confirm("Delete this booking?")) return;
    setSaving(true);
    await deleteBookingFn(id);
    setSaving(false);
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
            <div className="flex overflow-hidden rounded border border-zinc-700 bg-zinc-800">
              {(["daily", "weekly", "monthly"] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-semibold capitalize transition ${
                    view === v ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (view === "weekly")  setWeekOffset(o => o - 1);
                  if (view === "monthly") setMonthOffset(o => o - 1);
                  if (view === "daily") {
                    const d = new Date(dailyDate); d.setDate(d.getDate() - 1); setDailyDate(localDateStr(d));
                  }
                }}
                className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >‹</button>

              <button
                onClick={() => { setWeekOffset(0); setMonthOffset(0); setDailyDate(localDateStr()); }}
                className="rounded px-2 py-1 text-xs text-zinc-600 hover:text-zinc-400"
              >Today</button>

              <button
                onClick={() => {
                  if (view === "weekly")  setWeekOffset(o => o + 1);
                  if (view === "monthly") setMonthOffset(o => o + 1);
                  if (view === "daily") {
                    const d = new Date(dailyDate); d.setDate(d.getDate() + 1); setDailyDate(localDateStr(d));
                  }
                }}
                className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >›</button>
            </div>

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

      {showModal && (
        <BookingModal
          draft={draft}
          editEventId={editEventId}
          onDraftChange={handleDraftChange}
          onSave={saveBooking}
          onDelete={deleteBooking}
          onClose={() => { setShowModal(false); setBookingError(null); }}
          errorMessage={bookingError}
          saving={saving}
          canDelete={editEventId
            ? canUserDelete(events.find(e => e.id === editEventId)!, userId)
            : false}
        />
      )}
    </div>
  );
}

// ─── Monthly View (equipment page only) ───────────────────────────────────────

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
  enabledResources: (import("@/components/EquipmentShared").ResourceMeta & { group: ResourceGroup })[];
  events: ScheduleEvent[];
  onDayClick: (date: string) => void;
  onEventClick: (ev: ScheduleEvent) => void;
}) {
  const cells      = getMonthGrid(year, month);
  const today      = localDateStr();
  const enabledIds = new Set(enabledResources.map(r => r.id));

  return (
    <div className="p-4">
      <div className="mb-1 grid grid-cols-7 gap-1 text-center">
        {DAY_LABELS.map(d => (
          <div key={d} className="py-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const ds           = localDateStr(d);
          const isToday      = ds === today;
          const dayEvts      = events.filter(e => enabledIds.has(e.resourceId) && e.date === ds);
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
