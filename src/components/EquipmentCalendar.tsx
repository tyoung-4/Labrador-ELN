"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { USER_STORAGE_KEY, ELN_USERS } from "@/components/AppTopNav";
import {
  RESOURCE_GROUPS,
  ALL_RESOURCES,
  ENABLED_KEY,
  localDateStr,
  DailyView,
  BookingModal,
  type ResourceId,
  type ResourceGroup,
  type ScheduleEvent,
  type BookingDraft,
} from "@/components/EquipmentShared";
import { useEquipmentBookings, canUserDelete } from "@/hooks/useEquipmentBookings";
import { defaultEndTime } from "@/config/equipmentDefaults";
import { useToast } from "@/components/ToastProvider";

const DASHBOARD_GROUP_KEY = "eln-dashboard-equipment-group";

// ─── Time window ──────────────────────────────────────────────────────────────

function getEquipmentTimeWindow(viewingDate: Date): { start: Date; end: Date } {
  const today = new Date();
  const isToday =
    viewingDate.getFullYear() === today.getFullYear() &&
    viewingDate.getMonth()    === today.getMonth()    &&
    viewingDate.getDate()     === today.getDate();

  if (isToday) {
    const start = new Date();
    const end   = new Date(start.getTime() + 6 * 60 * 60 * 1000);
    return { start, end };
  }

  const start = new Date(viewingDate);
  start.setHours(8, 0, 0, 0);
  const end = new Date(viewingDate);
  end.setHours(14, 0, 0, 0);
  return { start, end };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EquipmentCalendar({ singleGroup = false }: { singleGroup?: boolean }) {
  // ── User ──────────────────────────────────────────────────────────────────
  const [userId,   setUserId]   = useState(ELN_USERS[0].id);
  const [userName, setUserName] = useState(ELN_USERS[0].name);

  // ── Navigation (daily only) ────────────────────────────────────────────────
  const [dailyDate, setDailyDate] = useState(localDateStr());

  // ── API-backed events ─────────────────────────────────────────────────────
  const { events, refresh, saveBooking: saveBookingFn, deleteBooking: deleteBookingFn, endEarlyBooking } = useEquipmentBookings();

  // ── Toast + Early Release ─────────────────────────────────────────────────
  const { addToast }   = useToast();
  const earlySeenRef   = useRef<Set<string>>(new Set());

  const stableAddToast = useCallback(addToast, [addToast]);
  useEffect(() => {
    let cancelled = false;
    async function checkReleases() {
      try {
        const res = await fetch("/api/equipment/recent-releases");
        if (!res.ok || cancelled) return;
        const releases: Array<{ id: string; equipmentName: string; operatorName: string }> = await res.json();
        for (const r of releases) {
          if (!earlySeenRef.current.has(r.id)) {
            earlySeenRef.current.add(r.id);
            stableAddToast(`${r.equipmentName} is now available — session ended early by ${r.operatorName}`);
          }
        }
      } catch { /* network — ignore */ }
    }
    checkReleases();
    const interval = setInterval(checkReleases, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [stableAddToast]);

  // ── Enabled resources (localStorage preference) ────────────────────────────
  const enabledLoadingRef  = useRef(false);
  const dispatchEnabledRef = useRef(false);

  const [enabled, setEnabled] = useState<Set<ResourceId>>(
    () => new Set(ALL_RESOURCES.map(r => r.id))
  );

  // ── Active group (singleGroup mode only) ──────────────────────────────────
  const [activeGroupId, setActiveGroupId] = useState<string>(RESOURCE_GROUPS[0].id);

  // ── Booking modal state ───────────────────────────────────────────────────
  const [showModal,    setShowModal]    = useState(false);
  const [editEventId,  setEditEventId]  = useState<string | null>(null);
  const [draft,        setDraft]        = useState<BookingDraft>({
    resourceId: "", date: localDateStr(), startTime: "09:00", endTime: "10:00", title: "",
  });
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);

  // ── Calendar popup state ──────────────────────────────────────────────────
  const [calendarOpen,  setCalendarOpen]  = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);

  // Close calendar on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    }
    if (calendarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [calendarOpen]);

  // ── Load user + enabled pref from localStorage ────────────────────────────
  useEffect(() => {
    enabledLoadingRef.current = true;

    try {
      const raw = localStorage.getItem(ENABLED_KEY);
      if (raw) setEnabled(new Set(JSON.parse(raw) as ResourceId[]));
    } catch { /* ignore */ }

    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      const u = ELN_USERS.find(u => u.id === stored);
      if (u) { setUserId(u.id); setUserName(u.name); }
    }

    if (singleGroup) {
      const gStored = localStorage.getItem(DASHBOARD_GROUP_KEY);
      if (gStored && RESOURCE_GROUPS.some(g => g.id === gStored)) setActiveGroupId(gStored);
    }

    function onStorage(e: StorageEvent) {
      if (e.key === ENABLED_KEY && e.newValue !== null) {
        if (dispatchEnabledRef.current) { dispatchEnabledRef.current = false; return; }
        try { setEnabled(new Set(JSON.parse(e.newValue) as ResourceId[])); } catch { /* ignore */ }
      }
      if (e.key === USER_STORAGE_KEY && e.newValue) {
        const u = ELN_USERS.find(u => u.id === e.newValue);
        if (u) { setUserId(u.id); setUserName(u.name); }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [singleGroup]);

  // ── Persist enabled preference ────────────────────────────────────────────
  useEffect(() => {
    if (enabledLoadingRef.current) { enabledLoadingRef.current = false; return; }
    const json = JSON.stringify([...enabled]);
    localStorage.setItem(ENABLED_KEY, json);
    dispatchEnabledRef.current = true;
    window.dispatchEvent(new StorageEvent("storage", { key: ENABLED_KEY, newValue: json }));
  }, [enabled]);

  // ── Toggle helpers ────────────────────────────────────────────────────────
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

  // ── Draft change — auto-fill endTime when resource changes ────────────────
  function handleDraftChange(next: BookingDraft) {
    setBookingError(null);
    if (next.resourceId && next.resourceId !== draft.resourceId) {
      const end = defaultEndTime(next.resourceId as ResourceId, next.startTime || "09:00");
      setDraft({ ...next, endTime: end });
    } else {
      setDraft(next);
    }
  }

  // ── Booking helpers ───────────────────────────────────────────────────────
  function openNew(params: Partial<BookingDraft> = {}) {
    const resourceId  = (params.resourceId ?? "") as ResourceId | "";
    const startTime   = params.startTime ?? "09:00";
    const computedEnd = resourceId ? defaultEndTime(resourceId as ResourceId, startTime) : "10:00";

    setEditEventId(null);
    setBookingError(null);
    setDraft({
      resourceId,
      date: dailyDate,
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

  async function handleSave() {
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

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this booking?")) return;
    setSaving(true);
    await deleteBookingFn(id);
    setSaving(false);
    setShowModal(false);
  }

  async function handleEndEarly(ev: ScheduleEvent) {
    const name = ALL_RESOURCES.find(r => r.id === ev.resourceId)?.label ?? ev.resourceId;
    const ok   = window.confirm(
      `End ${name} session early? This will notify other users that the equipment is now available.`
    );
    if (!ok) return;

    earlySeenRef.current.add(ev.id);
    const success = await endEarlyBooking(ev.id);
    if (success) {
      addToast(`${name} is now available — session ended early by ${ev.userName}`);
      await refresh();
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function navPrev() {
    const d = new Date(dailyDate + "T00:00:00");
    d.setDate(d.getDate() - 1);
    setDailyDate(localDateStr(d));
  }

  function navNext() {
    const d = new Date(dailyDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    setDailyDate(localDateStr(d));
  }

  function navToday() {
    setDailyDate(localDateStr());
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const activeGroup = singleGroup
    ? RESOURCE_GROUPS.find(g => g.id === activeGroupId) ?? RESOURCE_GROUPS[0]
    : null;

  const enabledList = singleGroup
    ? ALL_RESOURCES.filter(r => r.group.id === activeGroupId && enabled.has(r.id))
    : ALL_RESOURCES.filter(r => enabled.has(r.id));

  const dailyDateObj = new Date(dailyDate + "T00:00:00");
  const timeWindow   = getEquipmentTimeWindow(dailyDateObj);

  const dateLabel = (() => {
    const isToday = dailyDate === localDateStr();
    const label   = dailyDateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    return isToday ? `Today · ${label}` : label;
  })();

  const editingEvent  = editEventId ? events.find(e => e.id === editEventId) : null;
  const canDeleteEdit = editingEvent ? canUserDelete(editingEvent, userId) : false;

  // ── Calendar popup days ────────────────────────────────────────────────────
  const calendarDays = useMemo<(Date | null)[]>(() => {
    const year  = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const startPad   = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calendarMonth]);

  const todayStr = localDateStr();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-2">

        {/* Left: nav + clickable date label */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={navPrev}
            className="rounded px-1.5 py-1 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            title="Previous"
          >‹</button>
          <button
            onClick={navToday}
            className="rounded px-2 py-1 text-[10px] text-zinc-600 hover:text-zinc-400"
          >Today</button>
          <button
            onClick={navNext}
            className="rounded px-1.5 py-1 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            title="Next"
          >›</button>

          {/* Clickable date label + calendar popup */}
          <div ref={calendarRef} className="relative ml-1.5">
            <button
              onClick={() => {
                setCalendarOpen(o => {
                  if (!o) setCalendarMonth(new Date(dailyDate + "T00:00:00"));
                  return !o;
                });
              }}
              className="rounded px-1.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              {dateLabel}
            </button>

            {/* Calendar popup */}
            {calendarOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-lg border border-white/10 bg-gray-900 p-3 shadow-xl">
                {/* Month header */}
                <div className="mb-2 flex items-center justify-between">
                  <button
                    onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
                    className="rounded p-1 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                  >‹</button>
                  <span className="text-[11px] font-semibold text-zinc-200">
                    {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                    className="rounded p-1 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                  >›</button>
                </div>

                {/* Day-of-week headers */}
                <div className="mb-1 grid grid-cols-7">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                    <div key={d} className="py-0.5 text-center text-[9px] font-semibold text-zinc-600">{d}</div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-y-0.5">
                  {calendarDays.map((day, i) => {
                    if (!day) return <div key={i} />;
                    const ds         = localDateStr(day);
                    const isToday    = ds === todayStr;
                    const isSelected = ds === dailyDate;
                    const inMonth    = day.getMonth() === calendarMonth.getMonth();

                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setDailyDate(ds);
                          setCalendarOpen(false);
                        }}
                        className={`rounded py-1 text-center text-[10px] transition ${
                          isSelected
                            ? "bg-white/20 font-bold text-white"
                            : isToday
                              ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                              : inMonth
                                ? "text-zinc-300 hover:bg-zinc-700"
                                : "text-zinc-700 hover:bg-zinc-800"
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: +Book + See full schedule */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => openNew()}
            className="rounded border border-zinc-700 px-2.5 py-1 text-[10px] text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            + Book
          </button>
          <Link
            href="/equipment"
            className="text-[10px] text-zinc-500 transition hover:text-zinc-300"
          >
            See full schedule →
          </Link>
        </div>
      </div>

      {/* ── Resource toggle chips (full page) / Group tabs (dashboard) ── */}
      {singleGroup && activeGroup ? (
        <div className="mb-2 border-b border-zinc-800 pb-2">
          <div className="mb-1.5 flex gap-1">
            {RESOURCE_GROUPS.map(g => (
              <button
                key={g.id}
                onClick={() => {
                  setActiveGroupId(g.id);
                  localStorage.setItem(DASHBOARD_GROUP_KEY, g.id);
                }}
                className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition ${
                  g.id === activeGroupId
                    ? `${g.chipBg} ${g.chipText} ${g.borderCls} border`
                    : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {activeGroup.resources.map(r => (
              <button
                key={r.id}
                onClick={() => toggleResource(r.id)}
                className={`rounded border px-1.5 py-0.5 text-[9px] transition ${
                  enabled.has(r.id)
                    ? `${activeGroup.chipBg} ${activeGroup.chipText} ${activeGroup.borderCls}`
                    : "border-zinc-800 bg-transparent text-zinc-700 hover:text-zinc-500"
                }`}
                title={r.label}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 border-b border-zinc-800 pb-2">
          {RESOURCE_GROUPS.map(group => (
            <div key={group.id} className="flex items-center gap-1">
              <button
                onClick={() => toggleGroup(group)}
                className={`text-[9px] font-bold uppercase tracking-wider transition ${group.textCls} ${
                  group.resources.some(r => enabled.has(r.id)) ? "opacity-80 hover:opacity-100" : "opacity-25 hover:opacity-50"
                }`}
                title={`Toggle all ${group.label}`}
              >
                {group.label}
              </button>
              {group.resources.map(r => (
                <button
                  key={r.id}
                  onClick={() => toggleResource(r.id)}
                  className={`rounded border px-1.5 py-0.5 text-[9px] transition ${
                    enabled.has(r.id)
                      ? `${group.chipBg} ${group.chipText} ${group.borderCls}`
                      : "border-zinc-800 bg-transparent text-zinc-700 hover:text-zinc-500"
                  }`}
                  title={r.label}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Calendar body ── */}
      <div className="flex-1 overflow-auto">
        <DailyView
          date={dailyDate}
          enabledResources={enabledList}
          events={events}
          onCellClick={(resourceId, startTime) =>
            openNew({ resourceId, date: dailyDate, startTime })
          }
          onEventClick={openEdit}
          onEndEarly={handleEndEarly}
          timeWindow={timeWindow}
          currentUserId={userId}
        />
      </div>

      {/* ── Booking modal ── */}
      {showModal && (
        <BookingModal
          draft={draft}
          editEventId={editEventId}
          onDraftChange={handleDraftChange}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setShowModal(false); setBookingError(null); }}
          errorMessage={bookingError}
          saving={saving}
          canDelete={canDeleteEdit}
        />
      )}
    </div>
  );
}
