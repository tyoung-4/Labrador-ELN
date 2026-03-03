"use client";

import { useEffect, useRef, useState } from "react";
import { USER_STORAGE_KEY, ELN_USERS } from "@/components/AppTopNav";
import {
  RESOURCE_GROUPS,
  ALL_RESOURCES,
  EVENTS_KEY,
  ENABLED_KEY,
  localDateStr,
  getWeekDates,
  DailyView,
  WeeklyView,
  BookingModal,
  type ResourceId,
  type ResourceGroup,
  type ScheduleEvent,
  type BookingDraft,
} from "@/components/EquipmentShared";

type CalView = "daily" | "weekly";

export default function EquipmentCalendar() {
  // ── User ──────────────────────────────────────────────────────────────────
  const [userId,   setUserId]   = useState(ELN_USERS[0].id);
  const [userName, setUserName] = useState(ELN_USERS[0].name);

  // ── View + navigation ─────────────────────────────────────────────────────
  const [view,       setView]       = useState<CalView>("daily");
  const [dailyDate,  setDailyDate]  = useState(localDateStr());
  const [weekOffset, setWeekOffset] = useState(0);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [events,  setEvents]  = useState<ScheduleEvent[]>([]);
  const [enabled, setEnabled] = useState<Set<ResourceId>>(
    () => new Set(ALL_RESOURCES.map(r => r.id))
  );

  // ── Booking modal ─────────────────────────────────────────────────────────
  const [showModal,   setShowModal]   = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [draft,       setDraft]       = useState<BookingDraft>({
    resourceId: "", date: localDateStr(), startTime: "09:00", endTime: "10:00", title: "",
  });

  // ── Guards: prevent persisting before initial load finishes ───────────────
  const eventsLoadingRef  = useRef(false);
  const enabledLoadingRef = useRef(false);
  // Guards: prevent re-entrancy when we dispatch synthetic storage events
  const dispatchEventsRef  = useRef(false);
  const dispatchEnabledRef = useRef(false);

  // ── Load from localStorage + subscribe to storage events ─────────────────
  useEffect(() => {
    eventsLoadingRef.current  = true;
    enabledLoadingRef.current = true;

    try {
      const raw = localStorage.getItem(EVENTS_KEY);
      if (raw) setEvents(JSON.parse(raw));
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem(ENABLED_KEY);
      if (raw) setEnabled(new Set(JSON.parse(raw) as ResourceId[]));
    } catch { /* ignore */ }

    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      const u = ELN_USERS.find(u => u.id === stored);
      if (u) { setUserId(u.id); setUserName(u.name); }
    }

    function onStorage(e: StorageEvent) {
      if (e.key === EVENTS_KEY && e.newValue !== null) {
        if (dispatchEventsRef.current) { dispatchEventsRef.current = false; return; }
        try { setEvents(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
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
  }, []);

  // ── Persist events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (eventsLoadingRef.current) { eventsLoadingRef.current = false; return; }
    const json = JSON.stringify(events);
    localStorage.setItem(EVENTS_KEY, json);
    dispatchEventsRef.current = true;
    window.dispatchEvent(new StorageEvent("storage", { key: EVENTS_KEY, newValue: json }));
  }, [events]);

  // ── Persist enabled ───────────────────────────────────────────────────────
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

  // ── Booking helpers ───────────────────────────────────────────────────────
  function openNew(params: Partial<BookingDraft> = {}) {
    setEditEventId(null);
    setDraft({
      resourceId: "",
      date: view === "daily" ? dailyDate : localDateStr(),
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
      date:       ev.date,
      startTime:  ev.startTime ?? "09:00",
      endTime:    ev.endTime   ?? "10:00",
      title:      ev.title,
    });
    setShowModal(true);
  }

  function saveBooking() {
    if (!draft.resourceId || !draft.date) return;
    const autoTitle =
      draft.title.trim() ||
      (ALL_RESOURCES.find(r => r.id === draft.resourceId)?.label ?? draft.resourceId);

    if (editEventId) {
      setEvents(prev => prev.map(e =>
        e.id === editEventId
          ? { ...e, resourceId: draft.resourceId as ResourceId, date: draft.date,
              startTime: draft.startTime, endTime: draft.endTime,
              title: autoTitle, userId, userName }
          : e
      ));
    } else {
      setEvents(prev => [...prev, {
        id:          crypto.randomUUID(),
        resourceId:  draft.resourceId as ResourceId,
        date:        draft.date,
        startTime:   draft.startTime || undefined,
        endTime:     draft.endTime   || undefined,
        title:       autoTitle,
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

  // ── Navigation ────────────────────────────────────────────────────────────
  function navPrev() {
    if (view === "daily") {
      const d = new Date(dailyDate); d.setDate(d.getDate() - 1); setDailyDate(localDateStr(d));
    } else {
      setWeekOffset(o => o - 1);
    }
  }

  function navNext() {
    if (view === "daily") {
      const d = new Date(dailyDate); d.setDate(d.getDate() + 1); setDailyDate(localDateStr(d));
    } else {
      setWeekOffset(o => o + 1);
    }
  }

  function navToday() { setDailyDate(localDateStr()); setWeekOffset(0); }

  // ── Derived display values ────────────────────────────────────────────────
  const enabledList = ALL_RESOURCES.filter(r => enabled.has(r.id));
  const weekDates   = getWeekDates(weekOffset);

  const dateLabel = (() => {
    if (view === "daily") {
      const d       = new Date(dailyDate + "T00:00:00");
      const isToday = dailyDate === localDateStr();
      const label   = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      return isToday ? `Today · ${label}` : label;
    }
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(weekDates[0])} – ${fmt(weekDates[6])}`;
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-zinc-800 pb-2">

        {/* Daily / Weekly switcher */}
        <div className="flex overflow-hidden rounded border border-zinc-700 bg-zinc-800">
          {(["daily", "weekly"] as CalView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-[10px] font-semibold capitalize transition ${
                view === v ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Prev / Today / Next */}
        <div className="flex items-center">
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
        </div>

        {/* Date label */}
        <p className="text-[11px] font-semibold text-zinc-300">{dateLabel}</p>

        {/* Book button */}
        <button
          onClick={() => openNew()}
          className="ml-auto rounded bg-indigo-600 px-2.5 py-1 text-[10px] text-white hover:bg-indigo-500"
        >
          + Book
        </button>
      </div>

      {/* ── Resource toggle chips ── */}
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 border-b border-zinc-800 pb-2">
        {RESOURCE_GROUPS.map(group => (
          <div key={group.id} className="flex items-center gap-1">
            {/* Group label — click to toggle whole group */}
            <button
              onClick={() => toggleGroup(group)}
              className={`text-[9px] font-bold uppercase tracking-wider transition ${group.textCls} ${
                group.resources.some(r => enabled.has(r.id)) ? "opacity-80 hover:opacity-100" : "opacity-25 hover:opacity-50"
              }`}
              title={`Toggle all ${group.label}`}
            >
              {group.label}
            </button>

            {/* Individual resource chips */}
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

      {/* ── Calendar body ── */}
      <div className="flex-1 overflow-auto">
        {view === "daily" && (
          <DailyView
            date={dailyDate}
            enabledResources={enabledList}
            events={events}
            onCellClick={(resourceId, startTime) =>
              openNew({ resourceId, date: dailyDate, startTime })
            }
            onEventClick={openEdit}
          />
        )}
        {view === "weekly" && (
          <WeeklyView
            weekDates={weekDates}
            enabledResources={enabledList}
            events={events}
            onCellClick={(resourceId, date) => openNew({ resourceId, date })}
            onEventClick={openEdit}
          />
        )}
      </div>

      {/* ── Booking modal ── */}
      {showModal && (
        <BookingModal
          draft={draft}
          editEventId={editEventId}
          onDraftChange={setDraft}
          onSave={saveBooking}
          onDelete={deleteBooking}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
