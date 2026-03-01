"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { USER_STORAGE_KEY, ELN_USERS } from "@/components/AppTopNav";

// ─── Types ────────────────────────────────────────────────────────────────────

type LinkCategory = "protocol" | "stock" | "reagent" | "knowledge" | "run";

type LinkRef = {
  type: LinkCategory;
  label: string;
  href?: string;
};

type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  timeSensitive: boolean;
  date?: string;  // "YYYY-MM-DD"
  time?: string;  // "HH:MM"
  links: LinkRef[];
};

type ScheduleView = "daily" | "weekly";
type ProtocolEntry = { id: string; title: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const LINK_STYLE: Record<LinkCategory, string> = {
  protocol:  "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  stock:     "border-sky-500/30    bg-sky-500/10    text-sky-300",
  reagent:   "border-amber-500/30  bg-amber-500/10  text-amber-300",
  knowledge: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  run:       "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 a.m.–8 p.m.

// ─── Date helpers ─────────────────────────────────────────────────────────────

function localDateStr(d: Date = new Date()): string {
  return (
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0")
  );
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateBadge(dateStr: string): string {
  const today = localDateStr();
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  if (dateStr === today) return "Today";
  if (dateStr === localDateStr(tom)) return "Tomorrow";
  return parseDateStr(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "07:30" → "7:30 AM",  "13:00" → "1:00 PM" */
function formatTime12h(t: string): string {
  const [h24s, min] = t.split(":");
  const h24  = parseInt(h24s);
  const h12  = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h12}:${min} ${ampm}`;
}

/** Short form for tight spaces: "7a", "1p" */
function formatTimeShort(t: string): string {
  const h24 = parseInt(t.split(":")[0]);
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}${h24 < 12 ? "a" : "p"}`;
}

function getWeekDates(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0 = Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// ─── Custom time picker ───────────────────────────────────────────────────────
//
// Auto AM/PM rules: hours 7–11 → AM, hours 12 and 1–6 → PM

function CustomTimePicker({
  value,
  onChange,
}: {
  value: string;          // stored as "HH:MM" (24h)
  onChange: (v: string) => void;
}) {
  const [showGrid, setShowGrid] = useState(false);
  const [hourDraft, setHourDraft] = useState<string | null>(null);

  const [h24s, minS] = (value || "12:00").split(":");
  const h24  = parseInt(h24s);
  const min  = minS ?? "00";
  const ampm: "AM" | "PM" = h24 < 12 ? "AM" : "PM";
  const h12  = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;

  /** Apply auto AM/PM and notify parent */
  function selectHour(h: number) {
    const ap: "AM" | "PM" = h >= 7 && h <= 11 ? "AM" : "PM";
    const newH24 = ap === "AM" ? h : h === 12 ? 12 : h + 12;
    onChange(`${String(newH24).padStart(2, "0")}:${min}`);
    setHourDraft(null);
    setShowGrid(false);
  }

  function toggleAmPm() {
    const newH24 =
      ampm === "AM" ? (h12 === 12 ? 0 : h12 + 12) : (h12 === 12 ? 12 : h12);
    onChange(`${String(newH24).padStart(2, "0")}:${min}`);
  }

  const displayHour = hourDraft !== null ? hourDraft : String(h12);

  return (
    <div className="relative flex items-center gap-1 text-xs">
      {/* Hour: typeable + dropdown grid */}
      <div className="relative flex">
        <input
          type="text"
          inputMode="numeric"
          value={displayHour}
          maxLength={2}
          onFocus={e => { e.target.select(); setShowGrid(true); setHourDraft(""); }}
          onBlur={() => {
            const n = parseInt(hourDraft ?? "");
            if (n >= 1 && n <= 12) selectHour(n);
            else setHourDraft(null);
            setTimeout(() => setShowGrid(false), 150);
          }}
          onChange={e => {
            const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
            setHourDraft(raw);
            const n = parseInt(raw);
            if (n >= 1 && n <= 12) selectHour(n);
          }}
          className="w-7 rounded-l border border-r-0 border-zinc-700 bg-zinc-800 px-1 py-1 text-center text-zinc-200 focus:border-indigo-500/60 focus:outline-none"
        />
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => setShowGrid(s => !s)}
          className="rounded-r border border-zinc-700 bg-zinc-800 px-1 py-1 text-[9px] text-zinc-600 hover:bg-zinc-700 hover:text-zinc-400"
        >
          ▾
        </button>

        {/* 1–12 vertical scroll list */}
        {showGrid && (
          <div className="absolute left-0 top-full z-50 mt-1 flex max-h-44 w-10 flex-col overflow-y-auto rounded border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
              <button
                key={h}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => selectHour(h)}
                className={`shrink-0 py-1.5 text-center text-xs font-medium transition hover:bg-indigo-500/30 hover:text-indigo-200 ${
                  h === h12 ? "bg-indigo-600/80 text-white" : "text-zinc-300"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="font-bold text-zinc-600">:</span>

      {/* Minute */}
      <input
        type="text"
        inputMode="numeric"
        value={min}
        maxLength={2}
        onFocus={e => e.target.select()}
        onChange={e => {
          const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
          onChange(`${String(h24).padStart(2, "0")}:${raw.padStart(2, "0")}`);
        }}
        onBlur={e => {
          const n = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
          onChange(`${String(h24).padStart(2, "0")}:${String(n).padStart(2, "0")}`);
        }}
        className="w-8 rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-center text-zinc-200 focus:border-indigo-500/60 focus:outline-none"
      />

      {/* AM / PM toggle */}
      <button
        type="button"
        onClick={toggleAmPm}
        className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 text-[10px] font-bold tracking-wide text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
      >
        {ampm}
      </button>
    </div>
  );
}

// ─── Calendar date picker ─────────────────────────────────────────────────────

function CalendarPicker({
  value,
  onChange,
}: {
  value: string;          // "YYYY-MM-DD" or ""
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const today = localDateStr();

  // Which month to display
  const [view, setView] = useState(() => {
    const d = value ? parseDateStr(value) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const label =
    !value || value === today
      ? "Today"
      : parseDateStr(value).toLocaleDateString("en-US", {
          weekday: "short",
          month:   "short",
          day:     "numeric",
        });

  function openCalendar() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(s => !s);
  }

  function prevMonth() {
    setView(v => {
      const d = new Date(v.year, v.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }
  function nextMonth() {
    setView(v => {
      const d = new Date(v.year, v.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const firstDow    = new Date(view.year, view.month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const monthLabel  = new Date(view.year, view.month).toLocaleDateString("en-US", {
    month: "long",
    year:  "numeric",
  });

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={btnRef}
        type="button"
        onClick={openCalendar}
        className="flex w-full items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-left text-xs text-zinc-200 transition hover:border-zinc-600 focus:outline-none"
      >
        <span className="text-zinc-500">📅</span>
        <span>{label}</span>
      </button>

      {open && (
        <>
          {/* Backdrop — closes calendar on outside click */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          {/* Calendar panel — fixed to escape overflow:hidden on parent section */}
          <div
            className="fixed z-40 w-56 rounded border border-zinc-700 bg-zinc-900 p-3 shadow-xl"
            style={{ top: panelPos.top, left: panelPos.left }}
          >

            {/* Month navigation */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={prevMonth}
                className="rounded px-2 py-0.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              >
                ‹
              </button>
              <span className="text-[11px] font-semibold text-zinc-300">{monthLabel}</span>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={nextMonth}
                className="rounded px-2 py-0.5 text-sm text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              >
                ›
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="mb-1 grid grid-cols-7">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                <div key={d} className="text-center text-[9px] font-semibold text-zinc-600">
                  {d}
                </div>
              ))}
            </div>

            {/* Day buttons */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day     = i + 1;
                const dateStr = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday    = dateStr === today;
                const isSelected = dateStr === value;
                return (
                  <button
                    key={day}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { onChange(dateStr); setOpen(false); }}
                    className={`rounded py-1 text-center text-[11px] transition ${
                      isSelected
                        ? "bg-indigo-600 font-semibold text-white"
                        : isToday
                        ? "border border-indigo-500/40 font-semibold text-indigo-300 hover:bg-indigo-500/20"
                        : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Today shortcut */}
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onChange(today);
                setOpen(false);
                setView({ year: new Date().getFullYear(), month: new Date().getMonth() });
              }}
              className="mt-2 w-full rounded border border-zinc-700/60 py-1 text-[10px] text-zinc-500 transition hover:border-indigo-500/40 hover:text-indigo-300"
            >
              Today
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Daily schedule ───────────────────────────────────────────────────────────

function DailySchedulePanel({ items }: { items: TodoItem[] }) {
  const today       = localDateStr();
  const todayItems  = items.filter(i => i.date === today && !i.done);
  const timedItems  = todayItems
    .filter(i => i.time)
    .sort((a, b) => (a.time! > b.time! ? 1 : -1));
  const allDayItems = todayItems.filter(i => !i.time);
  const nowHour     = new Date().getHours();

  return (
    <div className="space-y-px">
      {/* All-day row */}
      {allDayItems.length > 0 && (
        <div className="mb-1.5 rounded border border-zinc-700/40 bg-zinc-800/30 p-1.5">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
            All day
          </p>
          {allDayItems.map(item => (
            <div key={item.id} className="flex items-start gap-1.5 py-0.5">
              <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
              <p className="text-[11px] leading-tight text-zinc-300">{item.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Hourly rows */}
      {HOURS.map(h => {
        const hh        = String(h).padStart(2, "0");
        const slotItems = timedItems.filter(i => i.time!.startsWith(hh + ":"));
        const isPast    = h < nowHour;
        const isCurrent = h === nowHour;
        const label     = `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;

        return (
          <div
            key={h}
            className={`flex min-h-[1.75rem] items-start gap-1.5 ${isPast ? "opacity-35" : ""}`}
          >
            <span
              className={`w-7 shrink-0 pt-0.5 text-right text-[9px] leading-none ${
                isCurrent ? "font-semibold text-indigo-400" : "text-zinc-700"
              }`}
            >
              {label}
            </span>
            <div
              className={`flex flex-1 flex-col gap-0.5 border-l py-0.5 pl-1.5 ${
                isCurrent ? "border-indigo-500" : "border-zinc-800"
              }`}
            >
              {slotItems.map(item => (
                <div
                  key={item.id}
                  className="rounded bg-indigo-500/25 px-1.5 py-px text-[10px] leading-tight text-indigo-200"
                >
                  <span className="opacity-70">{formatTime12h(item.time!)} · </span>
                  {item.text}
                </div>
              ))}
              {slotItems.length === 0 && <div className="h-3.5" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Weekly schedule ──────────────────────────────────────────────────────────

function WeeklySchedulePanel({ items }: { items: TodoItem[] }) {
  const weekDates = getWeekDates();
  const today     = localDateStr();

  return (
    <div className="grid grid-cols-7 gap-0.5">
      {weekDates.map(date => {
        const ds       = localDateStr(date);
        const dayItems = items.filter(i => i.date === ds && !i.done);
        const isToday  = ds === today;

        return (
          <div
            key={ds}
            className={`min-h-[6rem] rounded border p-1 ${
              isToday
                ? "border-indigo-500/40 bg-indigo-500/10"
                : "border-zinc-800 bg-zinc-900/40"
            }`}
          >
            <p
              className={`text-[9px] font-semibold uppercase tracking-wide ${
                isToday ? "text-indigo-400" : "text-zinc-600"
              }`}
            >
              {date.toLocaleDateString("en-US", { weekday: "short" })}
            </p>
            <p
              className={`mb-1 text-xs font-bold ${
                isToday ? "text-indigo-200" : "text-zinc-500"
              }`}
            >
              {date.getDate()}
            </p>
            <div className="space-y-0.5">
              {dayItems.slice(0, 4).map(item => (
                <div
                  key={item.id}
                  className="truncate rounded bg-indigo-500/20 px-1 py-px text-[8px] leading-tight text-indigo-200"
                >
                  {item.time && <span className="opacity-60">{formatTimeShort(item.time)} </span>}
                  {item.text}
                </div>
              ))}
              {dayItems.length > 4 && (
                <p className="text-[8px] text-zinc-600">+{dayItems.length - 4} more</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Protocol picker modal ────────────────────────────────────────────────────

function ProtocolPicker({
  protocols,
  selectedLinks,
  onAdd,
  onQuickAdd,
  onClose,
}: {
  protocols: ProtocolEntry[];
  selectedLinks: LinkRef[];
  onAdd: (link: LinkRef) => void;
  onQuickAdd: (entry: ProtocolEntry) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered  = protocols.filter(p =>
    p.title.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-emerald-300">Protocols</p>
            <p className="text-[10px] text-zinc-500">
              Click a protocol to link it, or{" "}
              <span className="text-emerald-500">＋ Add to list</span>{" "}
              to create a to-do directly.
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search protocols…"
            className="mb-3 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-600">No protocols found</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {filtered.map(p => {
                const linked = selectedLinks.some(l => l.label === p.title);
                return (
                  <div
                    key={p.id}
                    className="group flex items-center gap-2 rounded px-3 py-2 hover:bg-zinc-800/60"
                  >
                    {/* Protocol name — click to link */}
                    <button
                      disabled={linked}
                      onClick={() => {
                        onAdd({ type: "protocol", label: p.title, href: `/protocols?open=${p.id}` });
                        onClose();
                      }}
                      className={`min-w-0 flex-1 truncate text-left text-sm transition ${
                        linked
                          ? "cursor-default text-zinc-600"
                          : "text-zinc-200 hover:text-emerald-200"
                      }`}
                    >
                      {p.title}
                      {linked && (
                        <span className="ml-2 text-[10px] text-emerald-600">✓ Linked</span>
                      )}
                    </button>

                    {/* Quick-add to todo list */}
                    <button
                      onClick={() => { onQuickAdd(p); onClose(); }}
                      title="Add as new to-do item"
                      className="shrink-0 rounded border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 opacity-0 transition hover:bg-emerald-600/20 group-hover:opacity-100"
                    >
                      ＋ Add to list
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inventory placeholder modal ──────────────────────────────────────────────

function InventoryPicker({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-xl border border-blue-700/40 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <p className="text-sm font-semibold text-blue-300">Link to Inventory</p>
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="text-4xl">📦</span>
          <p className="text-sm font-semibold text-blue-300">Inventory Module</p>
          <p className="text-xs text-zinc-500">In development — coming soon</p>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable todo card ───────────────────────────────────────────────────────

function SortableItem({
  item,
  onToggle,
  onRemove,
}: {
  item: TodoItem;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const today = localDateStr();

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : "auto",
      }}
      className="group flex items-start gap-2 rounded-lg border border-zinc-700/70 bg-zinc-800/50 p-3 shadow-sm transition-colors hover:border-zinc-600"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        tabIndex={-1}
        aria-label="Drag to reorder"
        className="mt-0.5 cursor-grab select-none text-lg leading-none text-zinc-700 transition hover:text-zinc-400 active:cursor-grabbing"
      >
        ⠿
      </button>

      {/* Checkbox */}
      <button
        onClick={() => onToggle(item.id)}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold text-white transition ${
          item.done
            ? "border-emerald-500 bg-emerald-500"
            : "border-zinc-600 bg-transparent hover:border-zinc-400"
        }`}
      >
        {item.done && "✓"}
      </button>

      {/* Text + badges */}
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm leading-snug ${
            item.done ? "text-zinc-600 line-through" : "text-zinc-100"
          }`}
        >
          {item.text}
        </p>

        {(item.date || item.links.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {item.date && (
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] ${
                  item.date === today
                    ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                    : "border-zinc-600 bg-zinc-900 text-zinc-400"
                }`}
              >
                📅 {formatDateBadge(item.date)}
                {item.time ? ` · ${formatTime12h(item.time)}` : ""}
              </span>
            )}
            {item.links.map((link, i) =>
              link.href ? (
                <a
                  key={i}
                  href={link.href}
                  className={`rounded border px-1.5 py-0.5 text-[10px] transition hover:opacity-80 ${LINK_STYLE[link.type]}`}
                >
                  {link.label}
                </a>
              ) : (
                <span
                  key={i}
                  className={`rounded border px-1.5 py-0.5 text-[10px] ${LINK_STYLE[link.type]}`}
                >
                  {link.label}
                </span>
              )
            )}
          </div>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.id)}
        aria-label="Remove item"
        className="mt-0.5 text-xs text-zinc-700 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPanel() {
  const [userId, setUserId]             = useState(ELN_USERS[0].id);
  const [items,  setItems]              = useState<TodoItem[]>([]);
  // Prevents the save effect from wiping localStorage on the render immediately
  // after a load (before setItems has flushed the loaded data into state).
  const isLoadingRef = useRef(true);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("daily");

  // Form state
  const [newText,         setNewText]         = useState("");
  const [timeSensitive,   setTimeSensitive]   = useState(false);
  const [newDate,         setNewDate]         = useState("");
  const [newTime,         setNewTime]         = useState("");
  const [newLinks,        setNewLinks]        = useState<LinkRef[]>([]);
  const [showProtoPicker, setShowProtoPicker] = useState(false);
  const [showInvPicker,   setShowInvPicker]   = useState(false);
  const [protocolEntries, setProtocolEntries] = useState<ProtocolEntry[]>([]);

  // Stay in sync with AppTopNav user selection
  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored && ELN_USERS.find(u => u.id === stored)) setUserId(stored);

    function handleStorage(e: StorageEvent) {
      if (
        e.key === USER_STORAGE_KEY &&
        e.newValue &&
        ELN_USERS.find(u => u.id === e.newValue)
      ) {
        setUserId(e.newValue!);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Persist todo list per user (migrate old items that lack timeSensitive).
  // isLoadingRef is set true here so the save effect below skips its run on
  // the same render cycle — preventing items=[] from overwriting stored data
  // before the setItems call has had a chance to re-render with loaded data.
  useEffect(() => {
    isLoadingRef.current = true;
    try {
      const raw = localStorage.getItem(`eln-todo-${userId}`);
      const parsed: TodoItem[] = raw ? JSON.parse(raw) : [];
      setItems(parsed.map(item => ({ ...item, timeSensitive: item.timeSensitive ?? false })));
    } catch {
      setItems([]);
    }
  }, [userId]);

  useEffect(() => {
    if (isLoadingRef.current) {
      isLoadingRef.current = false; // consumed — allow all future saves
      return;
    }
    localStorage.setItem(`eln-todo-${userId}`, JSON.stringify(items));
  }, [items, userId]);

  // Fetch protocols for picker
  useEffect(() => {
    fetch("/api/entries")
      .then(r => r.json())
      .then((data: { id: string; title: string }[]) => setProtocolEntries(data))
      .catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setItems(prev => {
        const oi = prev.findIndex(x => x.id === active.id);
        const ni = prev.findIndex(x => x.id === over.id);
        return arrayMove(prev, oi, ni);
      });
    }
  }

  function addItem() {
    const text = newText.trim();
    if (!text) return;

    let finalDate: string | undefined;
    let finalTime: string | undefined;

    if (timeSensitive) {
      const today = localDateStr();
      if (!newDate && !newTime) {
        // Neither given → auto today, no time
        finalDate = today;
      } else if (newTime && !newDate) {
        // Time only → auto today + time
        finalDate = today;
        finalTime = newTime;
      } else if (newDate && !newTime) {
        // Date only → date, no time
        finalDate = newDate;
      } else {
        // Both given
        finalDate = newDate;
        finalTime = newTime;
      }
    }

    setItems(prev => [
      {
        id: crypto.randomUUID(),
        text,
        done: false,
        timeSensitive,
        date: finalDate,
        time: finalTime,
        links: newLinks,
      },
      ...prev,
    ]);
    setNewText("");
    setTimeSensitive(false);
    setNewDate("");
    setNewTime("");
    setNewLinks([]);
  }

  const toggle = (id: string) =>
    setItems(s => s.map(x => (x.id === id ? { ...x, done: !x.done } : x)));
  const remove = (id: string) => setItems(s => s.filter(x => x.id !== id));

  const incomplete    = items.filter(x => !x.done);
  const done          = items.filter(x =>  x.done);
  const currentUser   = ELN_USERS.find(u => u.id === userId) ?? ELN_USERS[0];

  return (
    <>
      {showProtoPicker && (
        <ProtocolPicker
          protocols={protocolEntries}
          selectedLinks={newLinks}
          onAdd={link => setNewLinks(s => [...s, link])}
          onQuickAdd={entry => {
            setItems(prev => [
              {
                id: crypto.randomUUID(),
                text: entry.title,
                done: false,
                timeSensitive: false,
                links: [{ type: "protocol", label: entry.title, href: `/protocols?open=${entry.id}` }],
              },
              ...prev,
            ]);
          }}
          onClose={() => setShowProtoPicker(false)}
        />
      )}
      {showInvPicker && <InventoryPicker onClose={() => setShowInvPicker(false)} />}

      <section className="overflow-hidden rounded-xl border border-indigo-500/30 bg-zinc-900">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-3">
          <p className="text-sm font-semibold text-indigo-300">Dashboard</p>

          {/* Daily / Weekly toggle */}
          <div className="flex overflow-hidden rounded border border-zinc-700 bg-zinc-800">
            <button
              onClick={() => setScheduleView("daily")}
              className={`px-2.5 py-1 text-[10px] font-semibold transition ${
                scheduleView === "daily"
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setScheduleView("weekly")}
              className={`px-2.5 py-1 text-[10px] font-semibold transition ${
                scheduleView === "weekly"
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Weekly
            </button>
          </div>

          <p className="ml-auto text-xs text-zinc-500">
            Tasks for{" "}
            <span className="font-semibold text-zinc-300">{currentUser.name}</span>
          </p>
        </div>

        {/* Body: [Schedule LEFT] | [Todo MIDDLE] | [Form RIGHT] */}
        <div className="flex min-h-[20rem]">

          {/* ── Schedule panel ── */}
          <div
            className={`overflow-y-auto border-r border-zinc-800 p-3 ${
              scheduleView === "weekly" ? "flex-[2]" : "w-52 shrink-0"
            }`}
          >
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
              {scheduleView === "daily"
                ? new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month:   "short",
                    day:     "numeric",
                  })
                : "This Week"}
            </p>
            {scheduleView === "daily" ? (
              <DailySchedulePanel items={items} />
            ) : (
              <WeeklySchedulePanel items={items} />
            )}
          </div>

          {/* ── Todo list ── */}
          <div className="flex-1 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="flex h-full min-h-[12rem] items-center justify-center">
                <p className="text-sm text-zinc-700">No items — add one on the right.</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={items.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {incomplete.map(item => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        onToggle={toggle}
                        onRemove={remove}
                      />
                    ))}
                  </div>
                  {done.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700">
                        Completed ({done.length})
                      </p>
                      {done.map(item => (
                        <SortableItem
                          key={item.id}
                          item={item}
                          onToggle={toggle}
                          onRemove={remove}
                        />
                      ))}
                    </div>
                  )}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* ── Add to List form ── */}
          <aside className="flex w-56 shrink-0 flex-col gap-3 border-l border-zinc-800 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Add to list
            </p>

            {/* Task text */}
            <textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addItem();
                }
              }}
              placeholder="What needs to be done?"
              rows={2}
              className="w-full resize-none rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />

            {/* Time sensitive? */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={timeSensitive}
                onChange={e => {
                  setTimeSensitive(e.target.checked);
                  if (e.target.checked) {
                    if (!newDate) setNewDate(localDateStr());
                    if (!newTime) setNewTime("12:00");
                  }
                  if (!e.target.checked) { setNewDate(""); setNewTime(""); }
                }}
                className="h-3.5 w-3.5 accent-indigo-500"
              />
              <span className="text-[10px] text-zinc-400">Time sensitive?</span>
            </label>

            {/* Date + time inputs */}
            {timeSensitive && (
              <div className="space-y-2 rounded border border-zinc-700/50 bg-zinc-800/40 p-2">
                <div>
                  <label className="mb-1 block text-[10px] text-zinc-500">Date</label>
                  <CalendarPicker value={newDate} onChange={setNewDate} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-zinc-500">
                    Time{" "}
                    <span className="text-zinc-600">(optional)</span>
                  </label>
                  <CustomTimePicker value={newTime} onChange={setNewTime} />
                </div>
              </div>
            )}

            {/* Link to — Protocols / Inventory buttons */}
            <div>
              <p className="mb-1.5 text-[10px] text-zinc-500">Link to…</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowProtoPicker(true)}
                  className="flex-1 rounded border border-emerald-500/40 bg-emerald-500/10 py-1.5 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                >
                  Protocols
                </button>
                <button
                  onClick={() => setShowInvPicker(true)}
                  className="flex-1 rounded border border-blue-500/40 bg-blue-500/10 py-1.5 text-[10px] font-semibold text-blue-300 transition hover:bg-blue-500/20"
                >
                  Inventory
                </button>
              </div>
            </div>

            {/* Chosen link chips */}
            {newLinks.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {newLinks.map((l, i) => (
                  <span
                    key={i}
                    className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${LINK_STYLE[l.type]}`}
                  >
                    {l.label}
                    <button
                      onClick={() => setNewLinks(s => s.filter((_, j) => j !== i))}
                      className="opacity-60 hover:opacity-100"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={addItem}
              disabled={!newText.trim()}
              className="mt-auto w-full rounded bg-indigo-600 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-30"
            >
              + Add
            </button>
          </aside>
        </div>
      </section>
    </>
  );
}
