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
  time?: string; // "HH:MM"
  links: LinkRef[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LINK_STYLE: Record<LinkCategory, string> = {
  protocol: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  stock:    "border-sky-500/30    bg-sky-500/10    text-sky-300",
  reagent:  "border-amber-500/30  bg-amber-500/10  text-amber-300",
  knowledge:"border-violet-500/30 bg-violet-500/10 text-violet-300",
  run:      "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
};

const STATIC_LINKS: LinkRef[] = [
  { type: "knowledge", label: "Papers & Grants", href: "/knowledge-hub/papers-grants" },
  { type: "knowledge", label: "Codes & Scripts",  href: "/knowledge-hub/codes-scripts" },
  { type: "knowledge", label: "Admin",             href: "/knowledge-hub/admin" },
  { type: "knowledge", label: "Safety & SDS",      href: "/knowledge-hub/safety-sds" },
  { type: "knowledge", label: "Lab Resources",     href: "/knowledge-hub/lab-resources" },
  { type: "knowledge", label: "Meeting Notes",     href: "/knowledge-hub/meeting-notes" },
  { type: "stock",     label: "Stocks",            href: "/inventory/stocks" },
  { type: "reagent",   label: "Reagents",          href: "/inventory/reagents" },
  { type: "reagent",   label: "Plasmids",          href: "/inventory/plasmids" },
  { type: "stock",     label: "Cell Lines",        href: "/inventory/cell-lines" },
];

// ─── Sortable card ────────────────────────────────────────────────────────────

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
        <p className={`text-sm leading-snug ${item.done ? "text-zinc-600 line-through" : "text-zinc-100"}`}>
          {item.text}
        </p>

        {(item.time || item.links.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {item.time && (
              <span className="rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400">
                ⏱ {item.time}
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
                <span key={i} className={`rounded border px-1.5 py-0.5 text-[10px] ${LINK_STYLE[link.type]}`}>
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
  // Sync with global user from AppTopNav (localStorage)
  const [userId, setUserId] = useState(ELN_USERS[0].id);
  const [items, setItems]   = useState<TodoItem[]>([]);

  // Form state
  const [newText,     setNewText]     = useState("");
  const [newTime,     setNewTime]     = useState("");
  const [newLinks,    setNewLinks]    = useState<LinkRef[]>([]);
  const [linkSearch,  setLinkSearch]  = useState("");
  const [linkResults, setLinkResults] = useState<LinkRef[]>([]);
  const [showDrop,    setShowDrop]    = useState(false);
  const [protocols,   setProtocols]   = useState<LinkRef[]>([]);
  const linkRef = useRef<HTMLInputElement>(null);

  // Stay in sync with AppTopNav user selection
  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored && ELN_USERS.find((u) => u.id === stored)) setUserId(stored);

    function handleStorage(e: StorageEvent) {
      if (e.key === USER_STORAGE_KEY && e.newValue && ELN_USERS.find((u) => u.id === e.newValue)) {
        setUserId(e.newValue!);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Persist todo list per user
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`eln-todo-${userId}`);
      setItems(raw ? (JSON.parse(raw) as TodoItem[]) : []);
    } catch { setItems([]); }
  }, [userId]);

  useEffect(() => {
    localStorage.setItem(`eln-todo-${userId}`, JSON.stringify(items));
  }, [items, userId]);

  // Fetch protocols for link suggestions
  useEffect(() => {
    fetch("/api/entries")
      .then((r) => r.json())
      .then((data: { id: string; title: string }[]) =>
        setProtocols(data.map((e) => ({ type: "protocol" as LinkCategory, label: e.title, href: "/protocols" })))
      )
      .catch(() => {});
  }, []);

  // Filter link suggestions
  useEffect(() => {
    const q = linkSearch.toLowerCase().trim();
    if (!q) { setLinkResults([]); return; }
    const pool = [...protocols, ...STATIC_LINKS];
    setLinkResults(pool.filter((r) => r.label.toLowerCase().includes(q)).slice(0, 8));
  }, [linkSearch, protocols]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oi = prev.findIndex((x) => x.id === active.id);
        const ni = prev.findIndex((x) => x.id === over.id);
        return arrayMove(prev, oi, ni);
      });
    }
  }

  function addItem() {
    const text = newText.trim();
    if (!text) return;
    setItems((prev) => [
      { id: crypto.randomUUID(), text, done: false, time: newTime || undefined, links: newLinks },
      ...prev,
    ]);
    setNewText(""); setNewTime(""); setNewLinks([]); setLinkSearch("");
  }

  function addLink(link: LinkRef) {
    if (!newLinks.find((l) => l.label === link.label)) setNewLinks((s) => [...s, link]);
    setLinkSearch(""); setShowDrop(false);
  }

  const toggle = (id: string) => setItems((s) => s.map((x) => x.id === id ? { ...x, done: !x.done } : x));
  const remove = (id: string) => setItems((s) => s.filter((x) => x.id !== id));

  const incomplete = items.filter((x) => !x.done);
  const done       = items.filter((x) =>  x.done);

  const currentUser = ELN_USERS.find((u) => u.id === userId) ?? ELN_USERS[0];

  return (
    <section className="overflow-hidden rounded-xl border border-indigo-500/30 bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <p className="text-sm font-semibold text-indigo-300">Dashboard</p>
        <p className="text-xs text-zinc-500">
          Tasks for <span className="font-semibold text-zinc-300">{currentUser.name}</span>
        </p>
      </div>

      {/* Body: [todo list LEFT] | [Add to List form RIGHT] */}
      <div className="flex min-h-[14rem]">

        {/* ── Todo list — LEFT ── */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center">
              <p className="text-sm text-zinc-700">No items — add one on the right.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {incomplete.map((item) => (
                    <SortableItem key={item.id} item={item} onToggle={toggle} onRemove={remove} />
                  ))}
                </div>
                {done.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700">
                      Completed ({done.length})
                    </p>
                    {done.map((item) => (
                      <SortableItem key={item.id} item={item} onToggle={toggle} onRemove={remove} />
                    ))}
                  </div>
                )}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* ── Add to List form — RIGHT ── */}
        <aside className="flex w-56 shrink-0 flex-col gap-3 border-l border-zinc-800 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Add to list</p>

          {/* Task text */}
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addItem(); } }}
            placeholder="What needs to be done?"
            rows={2}
            className="w-full resize-none rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />

          {/* Time picker */}
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Time (optional)</label>
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          {/* Link search */}
          <div className="relative">
            <label className="mb-1 block text-[10px] text-zinc-500">Link to…</label>
            <input
              ref={linkRef}
              value={linkSearch}
              onChange={(e) => { setLinkSearch(e.target.value); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 150)}
              placeholder="protocols, stocks, hub…"
              className="w-full rounded border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
            {showDrop && linkResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-0.5 overflow-hidden rounded border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/60">
                {linkResults.map((r, i) => (
                  <button
                    key={i}
                    onMouseDown={() => addLink(r)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-zinc-800"
                  >
                    <span className={`shrink-0 rounded border px-1 py-0.5 text-[9px] font-medium ${LINK_STYLE[r.type]}`}>
                      {r.type}
                    </span>
                    <span className="truncate text-zinc-300">{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chosen link chips */}
          {newLinks.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {newLinks.map((l, i) => (
                <span key={i} className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${LINK_STYLE[l.type]}`}>
                  {l.label}
                  <button onClick={() => setNewLinks((s) => s.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100">✕</button>
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
  );
}
