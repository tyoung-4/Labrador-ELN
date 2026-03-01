"use client";

import { useEffect, useState } from "react";
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
                  <span className="opacity-70">{item.time} · </span>
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
                  {item.time && <span className="opacity-60">{item.time} </span>}
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
          <p className="text-sm font-semibold text-emerald-300">Link to Protocol</p>
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
                const added = selectedLinks.some(l => l.label === p.title);
                return (
                  <button
                    key={p.id}
                    disabled={added}
                    onClick={() => {
                      onAdd({ type: "protocol", label: p.title, href: "/protocols" });
                      onClose();
                    }}
                    className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
                      added
                        ? "cursor-default text-zinc-600"
                        : "text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-200"
                    }`}
                  >
                    <span className="truncate">{p.title}</span>
                    {added && (
                      <span className="ml-2 shrink-0 text-[10px] text-emerald-600">✓ Added</span>
                    )}
                  </button>
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
                {item.time ? ` · ${item.time}` : ""}
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

  // Persist todo list per user (migrate old items that lack timeSensitive)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`eln-todo-${userId}`);
      const parsed: TodoItem[] = raw ? JSON.parse(raw) : [];
      setItems(parsed.map(item => ({ ...item, timeSensitive: item.timeSensitive ?? false })));
    } catch {
      setItems([]);
    }
  }, [userId]);

  useEffect(() => {
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
                  <label className="mb-1 block text-[10px] text-zinc-500">
                    Date{" "}
                    <span className="text-zinc-600">(optional — auto today)</span>
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-zinc-500">
                    Time{" "}
                    <span className="text-zinc-600">(optional)</span>
                  </label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
                  />
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
