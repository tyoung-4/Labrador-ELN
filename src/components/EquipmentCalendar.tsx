"use client";

import { useEffect, useRef, useState } from "react";
import { USER_STORAGE_KEY, ELN_USERS } from "@/components/AppTopNav";
import {
  RESOURCE_GROUPS,
  ALL_RESOURCES,
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
import { useEquipmentBookings, canUserDelete } from "@/hooks/useEquipmentBookings";
import { defaultEndTime } from "@/config/equipmentDefaults";

type CalView = "daily" | "weekly";

const DASHBOARD_GROUP_KEY = "eln-dashboard-equipment-group";

export default function EquipmentCalendar({ singleGroup = false }: { singleGroup?: boolean }) {
  // ── User ──────────────────────────────────────────────────────────────────
  const [userId,   setUserId]   = useState(ELN_USERS[0].id);
  const [userName, setUserName] = useState(ELN_USERS[0].name);

  // ── View + navigation ─────────────────────────────────────────────────────
  const [view,       setView]       = useState<CalView>("daily");
  const [dailyDate,  setDailyDate]  = useState(localDateStr());
  const [weekOffset, setWeekOffset] = useState(0);

  // ── API-backed events ─────────────────────────────────────────────────────
  const { events, saveBooking: saveBookingFn, deleteBooking: deleteBookingFn } = useEquipmentBookings();

  // ── Enabled resources (localStorage preference, not shared) ──────────────
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
    const resourceId = (params.resourceId ?? "") as ResourceId | "";
    const startTime  = params.startTime ?? "09:00";
    const computedEnd = resourceId
      ? defaultEndTime(resourceId as ResourceId, startTime)
      : "10:00";

    setEditEventId(null);
    setBookingError(null);
    setDraft({
      resourceId,
      date: view === "daily" ? dailyDate : localDateStr(),
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
  const activeGroup = singleGroup
    ? RESOURCE_GROUPS.find(g => g.id === activeGroupId) ?? RESOURCE_GROUPS[0]
    : null;

  // In singleGroup mode, only show enabled resources from the active group
  const enabledList = singleGroup
    ? ALL_RESOURCES.filter(r => r.group.id === activeGroupId && enabled.has(r.id))
    : ALL_RESOURCES.filter(r => enabled.has(r.id));

  const weekDates = getWeekDates(weekOffset);

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

  // Delete button only shown when viewing your own booking
  const editingEvent  = editEventId ? events.find(e => e.id === editEventId) : null;
  const canDeleteEdit = editingEvent ? canUserDelete(editingEvent, userId) : false;

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

      {/* ── Resource toggle chips (full page) / Group tabs (dashboard) ── */}
      {singleGroup && activeGroup ? (
        <div className="mb-2 border-b border-zinc-800 pb-2">
          {/* Group tab switcher */}
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
          {/* Individual resource toggles for active group */}
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
