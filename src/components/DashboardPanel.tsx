"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
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
import { defaultEndTime } from "@/config/equipmentDefaults";
import type { ResourceId } from "@/components/EquipmentShared";

// ─── Types ────────────────────────────────────────────────────────────────────

type LinkCategory = "protocol" | "stock" | "reagent" | "knowledge" | "run" | "equipment";

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
  date?: string;      // "YYYY-MM-DD"
  time?: string;      // "HH:MM"
  endTime?: string;   // "HH:MM"
  notes?: string;     // free-form notes, shown on hover/click
  links: LinkRef[];
  carryover?: boolean; // true if carried over from a previous day
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
  equipment: "border-purple-500/30 bg-purple-500/10 text-purple-300",
};

// ─── Equipment scheduling data (mirrors schedule/page.tsx) ────────────────────

type EquipResourceId =
  | "tc147" | "tc127"
  | "akta1" | "akta2" | "ngc" | "hplc"
  | "spr-t200" | "spr-new"
  | "plasmid-pro";

const EQUIP_RESOURCE_GROUPS: {
  id: string; label: string;
  borderCls: string; chipBg: string; chipText: string;
  resources: { id: EquipResourceId; label: string }[];
}[] = [
  {
    id: "tc", label: "TC Rooms",
    borderCls: "border-emerald-500/30", chipBg: "bg-emerald-500/20", chipText: "text-emerald-200",
    resources: [
      { id: "tc147", label: "TC Room 147" },
      { id: "tc127", label: "TC Room 127" },
    ],
  },
  {
    id: "fplc", label: "FPLC / HPLC",
    borderCls: "border-sky-500/30", chipBg: "bg-sky-500/20", chipText: "text-sky-200",
    resources: [
      { id: "akta1", label: "AKTA 1" },
      { id: "akta2", label: "AKTA 2" },
      { id: "ngc",   label: "NGC" },
      { id: "hplc",  label: "HPLC" },
    ],
  },
  {
    id: "spr", label: "SPR",
    borderCls: "border-violet-500/30", chipBg: "bg-violet-500/20", chipText: "text-violet-200",
    resources: [
      { id: "spr-t200", label: "SPR T200" },
      { id: "spr-new",  label: "SPR (new)" },
    ],
  },
  {
    id: "other", label: "Other",
    borderCls: "border-amber-500/30", chipBg: "bg-amber-500/20", chipText: "text-amber-200",
    resources: [
      { id: "plasmid-pro", label: "Plasmid Pro" },
    ],
  },
];

type EquipEvent = {
  id: string;
  resourceId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  title: string;
  userId: string;
  userName: string;
};

const EQUIP_EVENTS_KEY = "eln-schedule-events";

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 12:00 am–11:00 pm (full day)

// ─── Schedule grid constants ──────────────────────────────────────────────────

const PX_PER_HOUR = 48;   // pixels per hour in the daily time grid
const GRID_START  = 0;    // first hour shown (12 AM)
const GRID_HOURS  = 24;   // number of hours shown (full day)
const GRID_END    = 24;   // last hour (exclusive)

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

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

/** "07:30" → "7:30 am",  "13:00" → "1:00 pm" */
function formatTime12h(t: string): string {
  const [h24s, min] = t.split(":");
  const h24  = parseInt(h24s);
  const h12  = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const ampm = h24 < 12 ? "am" : "pm";
  return `${h12}:${min} ${ampm}`;
}

/** First N words of a string (for auto-titling from protocol names) */
function firstFourWords(s: string): string {
  return s.split(/\s+/).slice(0, 4).join(" ");
}

/** Short form for schedule display: "7:00 am", "1:30 pm" */
function formatTimeShort(t: string): string {
  const [h24s, min] = t.split(":");
  const h24 = parseInt(h24s);
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${min ?? "00"} ${h24 < 12 ? "am" : "pm"}`;
}

function getWeekDates(weekOffset: number = 0): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0 = Sun
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dow + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
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

// ─── Concurrent item layout ────────────────────────────────────────────────────
/**
 * Greedy interval-coloring: assigns each timed item a `col` (0-based) and
 * `totalCols` so that overlapping items render side-by-side.
 */
function layoutTimedItems(
  items: TodoItem[]
): { item: TodoItem; col: number; totalCols: number }[] {
  const sorted = [...items].sort(
    (a, b) => timeToMinutes(a.time!) - timeToMinutes(b.time!)
  );

  const colEnds: number[] = []; // end-time of the last item in each column
  const assigned = sorted.map(item => {
    const start = timeToMinutes(item.time!);
    const end   = item.endTime ? timeToMinutes(item.endTime) : start + 60;
    let col     = colEnds.findIndex(e => e <= start);
    if (col === -1) { col = colEnds.length; colEnds.push(end); }
    else            { colEnds[col] = end; }
    return { item, col, totalCols: 0 };
  });

  // totalCols = max(col+1) among all items that overlap this one
  for (let i = 0; i < assigned.length; i++) {
    const si    = timeToMinutes(assigned[i].item.time!);
    const eiRaw = assigned[i].item.endTime;
    const ei    = eiRaw ? timeToMinutes(eiRaw) : si + 60;
    let max     = assigned[i].col + 1;
    for (let j = 0; j < assigned.length; j++) {
      if (i === j) continue;
      const sj    = timeToMinutes(assigned[j].item.time!);
      const ejRaw = assigned[j].item.endTime;
      const ej    = ejRaw ? timeToMinutes(ejRaw) : sj + 60;
      if (si < ej && ei > sj) max = Math.max(max, assigned[j].col + 1);
    }
    assigned[i].totalCols = max;
  }

  return assigned;
}

// ─── Daily schedule — pixel-grid with drag-drop & resize ─────────────────────

/** One droppable zone per hour — accepts todo items dragged from the list */
function DroppableHour({ h }: { h: number }) {
  const { isOver, setNodeRef } = useDroppable({ id: `hour-${h}` });
  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        top: (h - GRID_START) * PX_PER_HOUR,
        height: PX_PER_HOUR,
        left: 0,
        right: 0,
        zIndex: 1,
      }}
      className={`transition-colors ${isOver ? "bg-indigo-500/20 rounded" : ""}`}
    />
  );
}

/** Absolutely-positioned block representing a timed todo item in the grid */
function ScheduleBlock({
  item,
  onUpdateItem,
  col = 0,
  totalCols = 1,
}: {
  item: TodoItem;
  onUpdateItem: (id: string, updates: Partial<TodoItem>) => void;
  col?: number;
  totalCols?: number;
}) {
  const startMins = timeToMinutes(item.time!);
  const endMins   = item.endTime ? timeToMinutes(item.endTime) : startMins + 60;
  const top       = ((startMins - GRID_START * 60) / 60) * PX_PER_HOUR;
  const height    = Math.max(((endMins - startMins) / 60) * PX_PER_HOUR, 20);

  // Concurrent column layout: split the usable width (left:64 to right:4) into totalCols lanes
  const LABEL_W  = 64;  // px — time label column (wider for "12:00 am" format)
  const PAD_R    = 4;   // px — right padding
  const colStyle = totalCols > 1
    ? {
        left:  `calc(${LABEL_W}px + ${col} * (100% - ${LABEL_W}px - ${PAD_R}px) / ${totalCols})`,
        width: `calc((100% - ${LABEL_W}px - ${PAD_R}px) / ${totalCols})`,
        right: "auto" as const,
      }
    : { left: LABEL_W, right: PAD_R };

  // Ref-based drag state for resize handles (native mousemove, not dnd-kit)
  const dragRef = useRef<{
    edge: "top" | "bottom";
    startY: number;
    startMins: number;
    otherMins: number;
  } | null>(null);

  function startResize(edge: "top" | "bottom", e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      edge,
      startY: e.clientY,
      startMins: edge === "top" ? startMins : endMins,
      otherMins: edge === "top" ? endMins : startMins,
    };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const deltaY = ev.clientY - dragRef.current.startY;
      // Snap to 30-min increments
      const deltaMins = Math.round((deltaY / PX_PER_HOUR) * 60 / 30) * 30;
      const newMins   = dragRef.current.startMins + deltaMins;

      if (dragRef.current.edge === "top") {
        const clamped = Math.max(
          GRID_START * 60,
          Math.min(dragRef.current.otherMins - 30, newMins)
        );
        onUpdateItem(item.id, { time: minutesToTime(clamped) });
      } else {
        const clamped = Math.max(
          dragRef.current.otherMins + 30,
          Math.min(GRID_END * 60, newMins)
        );
        onUpdateItem(item.id, { endTime: minutesToTime(clamped) });
      }
    }

    function onUp() {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div
      style={{ position: "absolute", top, height, zIndex: 3, ...colStyle }}
      className="group/block rounded border border-indigo-500/50 bg-indigo-500/25 overflow-hidden select-none"
    >
      {/* Top resize handle */}
      <div
        onMouseDown={e => startResize("top", e)}
        className="absolute top-0 left-0 right-0 h-2 cursor-n-resize flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition"
      >
        <div className="w-5 h-0.5 rounded bg-indigo-300/70" />
      </div>

      {/* Content */}
      <div className="px-1.5 pt-2.5 pb-1">
        <p className="text-[9px] text-indigo-300/70 leading-none">
          {formatTimeShort(item.time!)}
          {item.endTime ? `–${formatTimeShort(item.endTime)}` : ""}
        </p>
        <p className="text-[10px] text-indigo-100 leading-tight truncate">{item.text}</p>
      </div>

      {/* Bottom resize handle */}
      <div
        onMouseDown={e => startResize("bottom", e)}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize flex items-center justify-center opacity-0 group-hover/block:opacity-100 transition"
      >
        <div className="w-5 h-0.5 rounded bg-indigo-300/70" />
      </div>
    </div>
  );
}

function DailySchedulePanel({
  items,
  onUpdateItem,
  date,
}: {
  items: TodoItem[];
  onUpdateItem: (id: string, updates: Partial<TodoItem>) => void;
  date: string;
}) {
  const today       = localDateStr();
  const isToday     = date === today;
  const dayItems    = items.filter(i => i.date === date && !i.done);
  const timedItems  = dayItems
    .filter(i => i.time)
    .sort((a, b) => (a.time! > b.time! ? 1 : -1));
  const allDayItems = dayItems.filter(i => !i.time);
  const now         = new Date();
  const nowH        = now.getHours();
  const nowMin      = now.getMinutes();
  const scrollRef   = useRef<HTMLDivElement>(null);

  // Auto-scroll to current time only when viewing today
  useEffect(() => {
    if (!isToday) return;
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const visiblePx   = scrollRef.current.clientHeight || 224;
      const nowOffsetPx = (nowH + nowMin / 60) * PX_PER_HOUR;
      const target      = nowOffsetPx - visiblePx / 2 + PX_PER_HOUR / 2;
      scrollRef.current.scrollTop = Math.max(0, target);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday]);

  const totalHeight = GRID_HOURS * PX_PER_HOUR;

  return (
    <div className="space-y-1">
      {/* All-day row */}
      {allDayItems.length > 0 && (
        <div className="mb-1.5 rounded border border-zinc-700/40 bg-zinc-800/30 p-1.5">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
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

      {/* Pixel-grid time column */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "14rem" }}>
        <div className="relative" style={{ height: totalHeight }}>

          {/* Hour drop zones (behind everything) */}
          {HOURS.map(h => <DroppableHour key={h} h={h} />)}

          {/* Hour rules + labels */}
          {HOURS.map(h => {
            const isPast     = isToday && h < nowH;
            const isCurrent  = isToday && h === nowH;
            const isWorkHour = h >= 8 && h <= 17;
            const h12        = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const label      = `${h12}:00 ${h < 12 ? "am" : "pm"}`;
            const top        = h * PX_PER_HOUR;
            return (
              <div
                key={h}
                style={{ position: "absolute", top, left: 0, right: 0, height: PX_PER_HOUR }}
                className={`flex items-start pointer-events-none ${isPast ? "opacity-30" : ""} ${isWorkHour ? "bg-zinc-800/10" : ""}`}
              >
                <span
                  className={`w-16 shrink-0 pt-0.5 text-right text-[9px] leading-none pr-1.5 ${
                    isCurrent ? "font-semibold text-indigo-400" : "text-zinc-500"
                  }`}
                >
                  {label}
                </span>
                <div
                  className={`flex-1 border-t ${
                    isCurrent
                      ? "border-indigo-400/60"
                      : isWorkHour
                      ? "border-zinc-700/30"
                      : "border-zinc-800/50"
                  }`}
                />
              </div>
            );
          })}

          {/* Current-time indicator — only shown when viewing today */}
          {isToday && nowH >= GRID_START && nowH < GRID_END && (
            <div
              style={{
                position: "absolute",
                top: (nowH + nowMin / 60) * PX_PER_HOUR,
                left: 64,
                right: 0,
                zIndex: 4,
              }}
              className="flex items-center pointer-events-none"
            >
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
              <div className="flex-1 h-px bg-red-400/60" />
            </div>
          )}

          {/* Scheduled item blocks — concurrent items rendered side-by-side */}
          {layoutTimedItems(timedItems).map(({ item, col, totalCols }) => (
            <ScheduleBlock
              key={item.id}
              item={item}
              onUpdateItem={onUpdateItem}
              col={col}
              totalCols={totalCols}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Weekly schedule ──────────────────────────────────────────────────────────

function WeeklySchedulePanel({
  items,
  weekOffset,
  showWeekends,
}: {
  items: TodoItem[];
  weekOffset: number;
  showWeekends: boolean;
}) {
  const allDates  = getWeekDates(weekOffset);
  const weekDates = showWeekends ? allDates : allDates.filter(d => d.getDay() !== 0 && d.getDay() !== 6);
  const today     = localDateStr();
  const cols      = weekDates.length;

  return (
    <div
      className="grid h-full gap-0.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {weekDates.map(date => {
        const ds       = localDateStr(date);
        const dayItems = items.filter(i => i.date === ds && !i.done);
        const isToday  = ds === today;

        return (
          <div
            key={ds}
            className={`h-full min-h-[6rem] rounded border p-1 ${
              isToday
                ? "border-indigo-500/40 bg-indigo-500/10"
                : "border-zinc-700/40 bg-zinc-800/20"
            }`}
          >
            <p
              className={`text-[9px] font-semibold uppercase tracking-wide ${
                isToday ? "text-indigo-400" : "text-zinc-500"
              }`}
            >
              {date.toLocaleDateString("en-US", { weekday: "short" })}
            </p>
            <p
              className={`mb-1 text-xs font-bold ${
                isToday ? "text-indigo-200" : "text-zinc-400"
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
  onClose,
}: {
  protocols: ProtocolEntry[];
  selectedLinks: LinkRef[];
  onAdd: (link: LinkRef) => void;
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
            <p className="text-[10px] text-zinc-500">Click a protocol to link it.</p>
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

// ─── Equipment booking modal ──────────────────────────────────────────────────

function EquipmentPicker({
  todoTitle = "",
  userId,
  userName,
  onAdd,
  onCreateItem,
  onClose,
}: {
  todoTitle?: string;
  userId: string;
  userName: string;
  /** Link-mode (from Edit modal): adds a link chip to an existing item */
  onAdd?: (link: LinkRef) => void;
  /** Standalone mode (from Feature column): creates a brand-new todo item */
  onCreateItem?: (item: Omit<TodoItem, "id" | "done">) => void;
  onClose: () => void;
}) {
  const [resourceId,  setResourceId]  = useState<EquipResourceId | "">("");
  const [date,        setDate]        = useState(localDateStr());
  const [startTime,   setStartTime]   = useState("09:00");
  const [endTime,     setEndTime]     = useState("10:00");
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  const allEquipResources = EQUIP_RESOURCE_GROUPS.flatMap(g => g.resources);
  const selectedLabel = allEquipResources.find(r => r.id === resourceId)?.label ?? "";

  function handleResourceChange(id: EquipResourceId | "") {
    setResourceId(id);
    setConflictMsg(null);
    if (id) {
      // Auto-fill end time from defaults
      setEndTime(defaultEndTime(id as ResourceId, startTime));
    }
  }

  async function handleConfirm() {
    if (!resourceId || !date || !startTime || !endTime || submitting) return;

    const bookingTitle = todoTitle.trim() || `${selectedLabel} — ${formatTime12h(startTime)}`;
    const autoTitle    = todoTitle.trim() || selectedLabel;

    setSubmitting(true);
    setConflictMsg(null);

    try {
      const res = await fetch("/api/equipment-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentId:  resourceId,
          operatorName: userName,
          userId,
          startTime:    `${date}T${startTime}:00`,
          endTime:      `${date}T${endTime}:00`,
          title:        bookingTitle,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setConflictMsg(body.error ?? "Failed to save booking. Please try again.");
        setSubmitting(false);
        return;
      }
    } catch {
      setConflictMsg("Network error — please try again.");
      setSubmitting(false);
      return;
    }

    const link: LinkRef = {
      type: "equipment",
      label: `${selectedLabel} ${formatTime12h(startTime)}`,
      href: "/equipment",
    };

    if (onCreateItem) {
      onCreateItem({
        text: autoTitle,
        timeSensitive: true,
        date,
        time: startTime,
        endTime,
        links: [link],
        carryover: false,
      });
    } else if (onAdd) {
      onAdd(link);
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-purple-700/40 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-purple-300">Book Equipment</p>
            <p className="text-[10px] text-zinc-500">
              Select equipment, date &amp; time. Booking is saved to the equipment calendar.
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-300">✕</button>
        </div>

        <div className="space-y-4 p-4">
          {/* Resource selection */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Select Equipment
            </p>
            {EQUIP_RESOURCE_GROUPS.map(group => (
              <div key={group.id} className="mb-2">
                <p className={`mb-1 text-[9px] font-bold uppercase tracking-wider ${group.chipText}`}>
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1">
                  {group.resources.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleResourceChange(r.id)}
                      className={`rounded border px-2 py-1 text-[10px] font-semibold transition ${
                        resourceId === r.id
                          ? `${group.chipBg} ${group.chipText} ${group.borderCls}`
                          : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Date</label>
            <CalendarPicker value={date} onChange={v => { setDate(v); setConflictMsg(null); }} />
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">Start</label>
              <CustomTimePicker value={startTime} onChange={v => { setStartTime(v); setConflictMsg(null); }} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">End</label>
              <CustomTimePicker value={endTime} onChange={v => { setEndTime(v); setConflictMsg(null); }} />
            </div>
          </div>

          {/* Conflict error */}
          {conflictMsg && (
            <div className="rounded border border-red-500/40 bg-red-900/20 px-3 py-2 text-[11px] text-red-300">
              ⚠ {conflictMsg}
            </div>
          )}

          {/* Confirm button — appears only once a resource is selected */}
          {resourceId && (
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full rounded bg-purple-700 py-2 text-xs font-semibold text-white transition hover:bg-purple-600 disabled:opacity-50"
            >
              {submitting ? "Booking…" : "Confirm Booking"}
              {!submitting && <span className="ml-1.5 opacity-70 text-[10px]">({selectedLabel})</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit item modal ──────────────────────────────────────────────────────────

function EditItemModal({
  item,
  protocolEntries,
  userId,
  userName,
  onSave,
  onClose,
}: {
  item: TodoItem;
  protocolEntries: ProtocolEntry[];
  userId: string;
  userName: string;
  onSave: (id: string, updates: Partial<TodoItem>) => void;
  onClose: () => void;
}) {
  const [text,          setText]          = useState(item.text);
  const [notes,         setNotes]         = useState(item.notes ?? "");
  const [timeSensitive, setTimeSensitive] = useState(item.timeSensitive);
  const [date,          setDate]          = useState(item.date ?? "");
  const [time,          setTime]          = useState(item.time ?? "");
  const [endTime,       setEndTime]       = useState(item.endTime ?? "");
  const [showEndTime,   setShowEndTime]   = useState(!!item.endTime);
  const [links,         setLinks]         = useState<LinkRef[]>(item.links);
  const [showProtoPicker, setShowProtoPicker] = useState(false);
  const [showInvPicker,   setShowInvPicker]   = useState(false);
  const [showEquipPicker, setShowEquipPicker] = useState(false);

  function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSave(item.id, {
      text: trimmed,
      notes: notes.trim() || undefined,
      timeSensitive,
      date:    timeSensitive ? (date || localDateStr()) : undefined,
      time:    timeSensitive && time ? time : undefined,
      endTime: timeSensitive && time && showEndTime && endTime ? endTime : undefined,
      links,
    });
    onClose();
  }

  return (
    <>
      {showProtoPicker && (
        <ProtocolPicker
          protocols={protocolEntries}
          selectedLinks={links}
          onAdd={link => {
            setLinks(s => [...s, link]);
            if (!text.trim() && link.type === "protocol") setText(firstFourWords(link.label));
          }}
          onClose={() => setShowProtoPicker(false)}
        />
      )}
      {showInvPicker && <InventoryPicker onClose={() => setShowInvPicker(false)} />}
      {showEquipPicker && (
        <EquipmentPicker
          todoTitle={text.trim()}
          userId={userId}
          userName={userName}
          onAdd={link => setLinks(s => [...s, link])}
          onClose={() => setShowEquipPicker(false)}
        />
      )}

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full max-w-sm rounded-xl border border-indigo-700/40 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <p className="text-sm font-semibold text-indigo-300">Edit Task</p>
            <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-300">✕</button>
          </div>

          <div className="flex flex-col gap-3 p-4">
            {/* Title */}
            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Task title"
              rows={2}
              className="w-full resize-none rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />

            {/* Notes */}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)…"
              rows={2}
              className="w-full resize-none rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />

            {/* Time sensitive */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={timeSensitive}
                onChange={e => {
                  setTimeSensitive(e.target.checked);
                  if (e.target.checked) {
                    if (!date) setDate(localDateStr());
                    if (!time) setTime("12:00");
                  } else {
                    setDate(""); setTime(""); setEndTime(""); setShowEndTime(false);
                  }
                }}
                className="h-3.5 w-3.5 accent-indigo-500"
              />
              <span className="text-[10px] text-zinc-400">Time sensitive?</span>
            </label>

            {timeSensitive && (
              <div className="space-y-2 rounded border border-zinc-700/50 bg-zinc-800/40 p-2">
                <div>
                  <label className="mb-1 block text-[10px] text-zinc-500">Date</label>
                  <CalendarPicker value={date} onChange={setDate} />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[10px] text-zinc-500">
                      Time <span className="text-zinc-600">(optional)</span>
                    </label>
                    {time && (
                      <button
                        type="button"
                        onClick={() => { setShowEndTime(s => { if (s) setEndTime(""); return !s; }); }}
                        className={`text-[9px] font-semibold transition ${showEndTime ? "text-indigo-400 hover:text-zinc-400" : "text-zinc-600 hover:text-indigo-400"}`}
                      >
                        {showEndTime ? "− end" : "+ end"}
                      </button>
                    )}
                  </div>
                  <CustomTimePicker value={time} onChange={setTime} />
                </div>
                {showEndTime && (
                  <div>
                    <label className="mb-1 block text-[10px] text-zinc-500">End time</label>
                    <CustomTimePicker value={endTime} onChange={setEndTime} />
                  </div>
                )}
              </div>
            )}

            {/* Link to */}
            <div>
              <p className="mb-1.5 text-[10px] text-zinc-500">Link to…</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1.5">
                  <button onClick={() => setShowProtoPicker(true)} className="flex-1 rounded border border-emerald-500/40 bg-emerald-500/10 py-1.5 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20">
                    Protocols
                  </button>
                  <button onClick={() => setShowInvPicker(true)} className="flex-1 rounded border border-blue-500/40 bg-blue-500/10 py-1.5 text-[10px] font-semibold text-blue-300 transition hover:bg-blue-500/20">
                    Inventory
                  </button>
                </div>
                <button onClick={() => setShowEquipPicker(true)} className="w-full rounded border border-purple-500/40 bg-purple-500/10 py-1.5 text-[10px] font-semibold text-purple-300 transition hover:bg-purple-500/20">
                  Equipment
                </button>
              </div>
            </div>

            {/* Link chips */}
            {links.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {links.map((l, i) => (
                  <span key={i} className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${LINK_STYLE[l.type]}`}>
                    {l.label}
                    <button onClick={() => setLinks(s => s.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100">✕</button>
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 rounded border border-zinc-700 py-2 text-xs text-zinc-400 transition hover:text-zinc-200">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!text.trim()}
                className="flex-1 rounded bg-indigo-600 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-30"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sortable todo card ───────────────────────────────────────────────────────

function SortableItem({
  item,
  onToggle,
  onRemove,
  onEdit,
}: {
  item: TodoItem;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const today      = localDateStr();
  const hasDetails = !!(item.date || item.links.length > 0 || item.notes);
  const isCarryover = !item.done && !!item.carryover;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : "auto",
      }}
      className={`group flex items-start gap-2 rounded-lg border p-3 shadow-sm transition-colors ${
        isCarryover
          ? "border-red-500/30 bg-red-500/5 hover:border-red-500/40"
          : "border-zinc-700/70 bg-zinc-800/50 hover:border-zinc-600"
      }`}
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

      {/* Title + expandable details (hover or click to reveal) */}
      <div
        className="min-w-0 flex-1"
        onClick={() => hasDetails && setExpanded(s => !s)}
        style={{ cursor: hasDetails ? "pointer" : "default" }}
      >
        {/* Title row — always visible */}
        <div className="flex items-baseline gap-1.5">
          <p className={`text-sm leading-snug ${item.done ? "text-zinc-600 line-through" : "text-zinc-100"}`}>
            {item.text}
          </p>
          {isCarryover && (
            <span className="shrink-0 text-[9px] text-red-400/70 font-medium">carried over</span>
          )}
          {/* Subtle hint dot when details exist but panel is collapsed */}
          {hasDetails && (
            <span className={`shrink-0 text-[10px] text-zinc-700 transition-opacity ${
              expanded ? "opacity-0" : "opacity-100 group-hover:opacity-0"
            }`}>
              ···
            </span>
          )}
        </div>

        {/* Details panel — hidden until hover or clicked open */}
        {hasDetails && (
          <div
            className={`overflow-hidden transition-all duration-200 ease-in-out ${
              expanded
                ? "max-h-48"
                : "max-h-0 group-hover:max-h-48"
            }`}
          >
            <div className="pt-1.5 flex flex-wrap items-center gap-1">
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
                    onClick={e => e.stopPropagation()}
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
            {item.notes && (
              <p className="pt-1 text-[10px] leading-relaxed text-zinc-500 italic">
                {item.notes}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Edit + Remove — two-step confirmation for remove */}
      {pendingRemove ? (
        <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
          <span className="text-[10px] text-zinc-400">Remove?</span>
          <button
            onClick={() => onRemove(item.id)}
            aria-label="Confirm remove"
            className="text-[10px] font-semibold text-red-400 transition hover:text-red-300"
          >
            Yes
          </button>
          <button
            onClick={() => setPendingRemove(false)}
            aria-label="Cancel remove"
            className="text-[10px] text-zinc-500 transition hover:text-zinc-300"
          >
            No
          </button>
        </div>
      ) : (
        <div className="mt-0.5 flex shrink-0 items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={e => { e.stopPropagation(); onEdit(item.id); }}
            aria-label="Edit item"
            className="text-xs text-zinc-600 transition hover:text-zinc-200"
          >
            ✏
          </button>
          <button
            onClick={() => setPendingRemove(true)}
            aria-label="Remove item"
            className="text-xs text-zinc-700 transition hover:text-red-400"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const PANEL_OPEN_KEY = "eln-todo-panel-open";

export default function DashboardPanel({ equipmentCalendar }: { equipmentCalendar?: ReactNode } = {}) {
  const [userId, setUserId]             = useState(ELN_USERS[0].id);
  const [items,  setItems]              = useState<TodoItem[]>([]);
  // Prevents the save effect from wiping localStorage on the render immediately
  // after a load (before setItems has flushed the loaded data into state).
  const isLoadingRef = useRef(true);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("daily");
  const [scheduleDate, setScheduleDate] = useState(localDateStr());          // daily nav date
  const [weekOffset,   setWeekOffset]   = useState(0);
  const [showWeekends, setShowWeekends] = useState(() => {
    try { return localStorage.getItem("eln-showWeekends") === "true"; } catch { return false; }
  });

  // Form state
  const [newText,         setNewText]         = useState("");
  const [newNotes,        setNewNotes]        = useState("");
  const [timeSensitive,   setTimeSensitive]   = useState(false);
  const [newDate,         setNewDate]         = useState("");
  const [newTime,         setNewTime]         = useState("");
  const [newEndTime,      setNewEndTime]      = useState("");
  const [showEndTime,     setShowEndTime]     = useState(false);
  const [newLinks,        setNewLinks]        = useState<LinkRef[]>([]);
  const [showProtoPicker, setShowProtoPicker] = useState(false);
  const [showInvPicker,   setShowInvPicker]   = useState(false);
  const [showEquipPicker, setShowEquipPicker] = useState(false);
  const [showFeatureEquipPicker, setShowFeatureEquipPicker] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [protocolEntries, setProtocolEntries] = useState<ProtocolEntry[]>([]);
  const [editingItemId,   setEditingItemId]   = useState<string | null>(null);

  // Stay in sync with AppTopNav user selection
  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored && ELN_USERS.find(u => u.id === stored)) setUserId(stored);
    const storedPanel = localStorage.getItem(PANEL_OPEN_KEY);
    if (storedPanel !== null) setPanelOpen(storedPanel === "true");

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
  // Also runs nightly cleanup: removes done items and flags remaining as carryover
  // if the stored last-cleared date is before today.
  useEffect(() => {
    isLoadingRef.current = true;
    const CLEARED_KEY = `eln-todo-lastCleared-${userId}`;
    const today = localDateStr();
    try {
      const raw = localStorage.getItem(`eln-todo-${userId}`);
      let parsed: TodoItem[] = raw ? JSON.parse(raw) : [];
      // Migrate legacy items
      parsed = parsed.map(item => ({ ...item, timeSensitive: item.timeSensitive ?? false }));
      // Nightly cleanup: if last-cleared date is before today, remove done + flag remaining
      const lastCleared = localStorage.getItem(CLEARED_KEY);
      if (lastCleared && lastCleared < today) {
        // Save history snapshot before discarding done items
        if (parsed.length > 0) {
          const user = ELN_USERS.find(u => u.id === userId);
          fetch("/api/todo-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              userName: user?.name ?? userId,
              date: lastCleared,
              items: parsed,
            }),
          }).catch(() => {});
        }
        parsed = parsed.filter(x => !x.done).map(x => ({ ...x, carryover: true }));
        localStorage.setItem(CLEARED_KEY, today);
      } else if (!lastCleared) {
        localStorage.setItem(CLEARED_KEY, today);
      }
      setItems(parsed);
    } catch {
      setItems([]);
    }
  }, [userId]);

  // Schedule midnight cleanup to fire while the page is open
  useEffect(() => {
    const CLEARED_KEY = `eln-todo-lastCleared-${userId}`;
    const now    = new Date();
    const target = new Date();
    target.setHours(23, 59, 0, 0);
    const msUntil = target.getTime() - now.getTime();
    if (msUntil <= 0) return;
    const tid = setTimeout(() => {
      const today = localDateStr();
      // Read latest items directly from localStorage for the history snapshot
      try {
        const raw = localStorage.getItem(`eln-todo-${userId}`);
        const currentItems: TodoItem[] = raw ? JSON.parse(raw) : [];
        if (currentItems.length > 0) {
          const user = ELN_USERS.find(u => u.id === userId);
          fetch("/api/todo-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              userName: user?.name ?? userId,
              date: today,
              items: currentItems,
            }),
          }).catch(() => {});
        }
      } catch { /* ignore */ }
      setItems(prev => prev.filter(x => !x.done).map(x => ({ ...x, carryover: true })));
      localStorage.setItem(CLEARED_KEY, today);
    }, msUntil);
    return () => clearTimeout(tid);
  }, [userId]);

  useEffect(() => {
    if (isLoadingRef.current) {
      isLoadingRef.current = false; // consumed — allow all future saves
      return;
    }
    localStorage.setItem(`eln-todo-${userId}`, JSON.stringify(items));
  }, [items, userId]);

  // Persist showWeekends toggle
  useEffect(() => {
    try { localStorage.setItem("eln-showWeekends", String(showWeekends)); } catch {}
  }, [showWeekends]);

  function togglePanel() {
    setPanelOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(PANEL_OPEN_KEY, String(next)); } catch {}
      return next;
    });
  }

  // Fetch protocols for picker
  useEffect(() => {
    fetch("/api/entries")
      .then(r => r.json())
      .then((data: { id: string; title: string }[]) => setProtocolEntries(data))
      .catch(() => {});
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;

    // Drop onto a schedule hour slot → schedule the item
    if (String(over.id).startsWith("hour-")) {
      const h = parseInt(String(over.id).split("-")[1]);
      const today       = localDateStr();
      const slotStart   = `${String(h).padStart(2, "0")}:00`;
      const slotEnd     = `${String(Math.min(h + 1, GRID_END)).padStart(2, "0")}:00`;
      const slotStartM  = timeToMinutes(slotStart);
      const slotEndM    = timeToMinutes(slotEnd);

      // Check for existing items already in this hour
      const occupied = items.filter(item => {
        if (String(item.id) === String(active.id)) return false;
        if (!item.timeSensitive || item.date !== today || !item.time) return false;
        const iStart = timeToMinutes(item.time);
        const iEnd   = item.endTime ? timeToMinutes(item.endTime) : iStart + 60;
        return iStart < slotEndM && iEnd > slotStartM;
      });

      if (occupied.length > 0) {
        const names = occupied.map(i => `"${i.text}"`).join(", ");
        const ok = window.confirm(
          `You already have ${names} at this time. Schedule concurrently?`
        );
        if (!ok) return;
      }

      setItems(prev => prev.map(item =>
        String(item.id) === String(active.id)
          ? {
              ...item,
              timeSensitive: true,
              date: today,
              time: slotStart,
              endTime: slotEnd,
              carryover: false,
            }
          : item
      ));
      return;
    }

    // Reorder within todo list
    if (active.id !== over.id) {
      setItems(prev => {
        const oi = prev.findIndex(x => x.id === active.id);
        const ni = prev.findIndex(x => x.id === over.id);
        if (oi === -1 || ni === -1) return prev;
        return arrayMove(prev, oi, ni);
      });
    }
  }

  function updateItem(id: string, updates: Partial<TodoItem>) {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }

  function addItem() {
    const text = newText.trim();
    if (!text) return;

    let finalDate: string | undefined;
    let finalTime: string | undefined;
    let finalEndTime: string | undefined;

    if (timeSensitive) {
      const today = localDateStr();
      if (!newDate && !newTime) {
        // Neither given → auto today, no time
        finalDate = today;
      } else if (newTime && !newDate) {
        // Time only → auto today + time
        finalDate = today;
        finalTime = newTime;
        if (showEndTime && newEndTime) finalEndTime = newEndTime;
      } else if (newDate && !newTime) {
        // Date only → date, no time
        finalDate = newDate;
      } else {
        // Both given
        finalDate = newDate;
        finalTime = newTime;
        if (showEndTime && newEndTime) finalEndTime = newEndTime;
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
        endTime: finalEndTime,
        notes: newNotes.trim() || undefined,
        links: newLinks,
      },
      ...prev,
    ]);
    setNewText("");
    setNewNotes("");
    setTimeSensitive(false);
    setNewDate("");
    setNewTime("");
    setNewEndTime("");
    setShowEndTime(false);
    setNewLinks([]);
  }

  const toggle = (id: string) =>
    setItems(s => s.map(x => (x.id === id ? { ...x, done: !x.done } : x)));
  const remove = (id: string) => setItems(s => s.filter(x => x.id !== id));

  const incomplete    = items.filter(x => !x.done);
  const done          = items.filter(x =>  x.done);
  const currentUser   = ELN_USERS.find(u => u.id === userId) ?? ELN_USERS[0];

  const editingItem = editingItemId ? items.find(i => i.id === editingItemId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {showProtoPicker && (
        <ProtocolPicker
          protocols={protocolEntries}
          selectedLinks={newLinks}
          onAdd={link => {
            setNewLinks(s => [...s, link]);
            // Auto-fill title with first 4 words of the protocol name if text is blank
            if (!newText.trim() && link.type === "protocol") {
              setNewText(firstFourWords(link.label));
            }
          }}
          onClose={() => setShowProtoPicker(false)}
        />
      )}
      {showInvPicker && <InventoryPicker onClose={() => setShowInvPicker(false)} />}
      {showEquipPicker && (
        <EquipmentPicker
          todoTitle={newText.trim()}
          userId={userId}
          userName={currentUser.name}
          onAdd={link => setNewLinks(s => [...s, link])}
          onClose={() => setShowEquipPicker(false)}
        />
      )}
      {showFeatureEquipPicker && (
        <EquipmentPicker
          userId={userId}
          userName={currentUser.name}
          onCreateItem={newItem =>
            setItems(prev => [{
              id: crypto.randomUUID(),
              done: false,
              ...newItem,
            }, ...prev])
          }
          onClose={() => setShowFeatureEquipPicker(false)}
        />
      )}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          protocolEntries={protocolEntries}
          userId={userId}
          userName={currentUser.name}
          onSave={updateItem}
          onClose={() => setEditingItemId(null)}
        />
      )}

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

          {/* Day navigation (daily mode only) */}
          {scheduleView === "daily" && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => {
                  const d = new Date(scheduleDate + "T00:00:00");
                  d.setDate(d.getDate() - 1);
                  setScheduleDate(localDateStr(d));
                }}
                className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                aria-label="Previous day"
              >‹</button>
              {scheduleDate !== localDateStr() && (
                <button
                  onClick={() => setScheduleDate(localDateStr())}
                  className="rounded px-1 py-0.5 text-[9px] text-zinc-600 hover:text-zinc-400"
                >Today</button>
              )}
              <button
                onClick={() => {
                  const d = new Date(scheduleDate + "T00:00:00");
                  d.setDate(d.getDate() + 1);
                  setScheduleDate(localDateStr(d));
                }}
                className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                aria-label="Next day"
              >›</button>
            </div>
          )}

          {/* Week navigation + weekends toggle (weekly mode only) */}
          {scheduleView === "weekly" && (
            <>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setWeekOffset(o => o - 1)}
                  className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Previous week"
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
                  className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  aria-label="Next week"
                >
                  ›
                </button>
              </div>
              <button
                onClick={() => setShowWeekends(v => !v)}
                className={`rounded border px-2 py-0.5 text-[9px] font-semibold transition ${
                  showWeekends
                    ? "border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                    : "border-zinc-700 bg-zinc-800 text-zinc-600 hover:text-zinc-400"
                }`}
              >
                {showWeekends ? "Hide weekends" : "Show weekends"}
              </button>
            </>
          )}

          <p className="ml-auto text-xs text-zinc-500">
            Tasks for{" "}
            <span className="font-semibold text-zinc-300">{currentUser.name}</span>
          </p>
        </div>

        {/* Body: [Schedule LEFT] | [▶ Tasks collapsible] | [Equipment RIGHT] */}
        <div className="flex h-[420px] overflow-hidden">

          {/* ── Schedule panel ── */}
          <div className="w-2/5 shrink-0 overflow-y-auto border-r border-zinc-800 p-3">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">
              {scheduleView === "daily"
                ? (() => {
                    const d = new Date(scheduleDate + "T00:00:00");
                    const isToday = scheduleDate === localDateStr();
                    const label   = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                    return isToday ? `Today · ${label}` : label;
                  })()
                : (() => {
                    const dates = getWeekDates(weekOffset);
                    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    return `${fmt(dates[0])} – ${fmt(dates[6])}`;
                  })()}
            </p>
            {scheduleView === "daily" ? (
              <DailySchedulePanel items={items} onUpdateItem={updateItem} date={scheduleDate} />
            ) : (
              <WeeklySchedulePanel items={items} weekOffset={weekOffset} showWeekends={showWeekends} />
            )}
          </div>

          {/* ── Tasks column: always visible ── */}
          <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-zinc-800">

            {/* Add to List toggle — chevron header, always visible */}
            <button
              onClick={togglePanel}
              className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 transition hover:bg-zinc-800/40 hover:text-zinc-400"
              title={panelOpen ? "Collapse add-to-list form" : "Expand add-to-list form"}
            >
              <span>{panelOpen ? "▲" : "▼"}</span>
              <span>Add to list</span>
            </button>

            {/* Add to List form — collapsible */}
            {panelOpen && (
              <div className="flex shrink-0 flex-col gap-3 overflow-y-auto border-b border-zinc-800 p-4">
                {/* Task title */}
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

                {/* Notes (optional — shown on hover/click in the list) */}
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Notes (optional)…"
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
                      if (!e.target.checked) { setNewDate(""); setNewTime(""); setNewEndTime(""); setShowEndTime(false); }
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
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-[10px] text-zinc-500">
                          Time{" "}
                          <span className="text-zinc-600">(optional)</span>
                        </label>
                        {newTime && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowEndTime(s => {
                                if (s) setNewEndTime("");
                                return !s;
                              });
                            }}
                            className={`text-[9px] font-semibold transition ${
                              showEndTime
                                ? "text-indigo-400 hover:text-zinc-400"
                                : "text-zinc-600 hover:text-indigo-400"
                            }`}
                          >
                            {showEndTime ? "− end" : "+ end"}
                          </button>
                        )}
                      </div>
                      <CustomTimePicker value={newTime} onChange={setNewTime} />
                    </div>
                    {showEndTime && (
                      <div>
                        <label className="mb-1 block text-[10px] text-zinc-500">End time</label>
                        <CustomTimePicker value={newEndTime} onChange={setNewEndTime} />
                      </div>
                    )}
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
                  className="w-full rounded bg-indigo-600 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-30"
                >
                  + Add
                </button>
              </div>
            )}

            {/* Todo list — ALWAYS VISIBLE */}
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="flex min-h-[6rem] items-center justify-center">
                  <p className="text-sm text-zinc-700">No items — add one above.</p>
                </div>
              ) : (
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
                        onEdit={setEditingItemId}
                      />
                    ))}
                  </div>
                  {done.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700">
                          Completed ({done.length})
                        </p>
                        <button
                          onClick={() => setItems(prev => prev.filter(i => !i.done))}
                          className="text-[10px] text-zinc-600 underline underline-offset-2 hover:text-red-400 transition"
                        >
                          Clear completed
                        </button>
                      </div>
                      {done.map(item => (
                        <SortableItem
                          key={item.id}
                          item={item}
                          onToggle={toggle}
                          onRemove={remove}
                          onEdit={setEditingItemId}
                        />
                      ))}
                    </div>
                  )}
                </SortableContext>
              )}
            </div>
          </div>

          {/* ── Equipment section (far right) ── */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* +Book above the calendar */}
            <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 p-2">
              <button
                onClick={() => setShowFeatureEquipPicker(true)}
                className="flex items-center gap-1.5 rounded border border-purple-500/40 bg-purple-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-purple-300 transition hover:bg-purple-500/20"
              >
                <span>+</span>
                <span>Book</span>
              </button>
              <Link
                href="/equipment"
                className="text-[10px] text-zinc-500 transition hover:text-zinc-300"
              >
                Equipment ↗
              </Link>
            </div>
            {/* Equipment calendar */}
            <div className="min-h-0 flex-1">
              {equipmentCalendar}
            </div>
          </div>
        </div>
      </section>
    </DndContext>
  );
}
