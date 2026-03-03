import AppTopNav from "@/components/AppTopNav";
import Link from "next/link";
import prisma from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

type TodoItemSnapshot = {
  id: string;
  text: string;
  done: boolean;
  timeSensitive?: boolean;
  date?: string;
  time?: string;
  endTime?: string;
  notes?: string;
  carryover?: boolean;
};

type HistoryEntry = {
  id: string;
  userId: string;
  userName: string;
  date: string;
  items: TodoItemSnapshot[];
  createdAt: Date;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LabResourcesPage() {
  let history: HistoryEntry[] = [];

  try {
    const raw = await prisma.todoHistory.findMany({
      orderBy: { createdAt: "desc" },
    });
    history = raw.map(r => ({
      id:        r.id,
      userId:    r.userId,
      userName:  r.userName,
      date:      r.date,
      items:     (r.items as TodoItemSnapshot[]) ?? [],
      createdAt: r.createdAt,
    }));
  } catch {
    // DB unavailable — show empty state
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />

      <div className="flex items-center gap-3">
        <Link href="/knowledge-hub" className="text-xs text-zinc-500 hover:text-zinc-300">
          ← Knowledge Hub
        </Link>
        <h1 className="text-lg font-semibold text-zinc-100">Lab Resources</h1>
        <span className="rounded border border-rose-700/40 bg-rose-900/20 px-2 py-0.5 text-xs text-rose-300">
          ToDo History
        </span>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-12">
          <div className="text-center">
            <p className="text-sm text-zinc-500">No todo history yet.</p>
            <p className="mt-1 text-xs text-zinc-700">
              Lists are saved automatically at the end of each day.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {history.map(entry => (
            <HistoryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── History card ─────────────────────────────────────────────────────────────

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const doneItems   = entry.items.filter(i => i.done);
  const activeItems = entry.items.filter(i => !i.done);

  const dateLabel = (() => {
    try {
      const d = new Date(entry.date + "T00:00:00");
      return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    } catch {
      return entry.date;
    }
  })();

  const savedAt = entry.createdAt.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      {/* Header */}
      <div className="mb-3 flex items-baseline gap-3">
        <p className="text-sm font-semibold text-zinc-100">{dateLabel}</p>
        <span className="text-xs text-zinc-500">
          {entry.userName}
        </span>
        <span className="ml-auto text-[10px] text-zinc-700">saved {savedAt}</span>
      </div>

      {/* Stats row */}
      <div className="mb-3 flex gap-3 text-xs">
        <span className="text-zinc-400">
          <span className="font-semibold text-zinc-200">{entry.items.length}</span> items total
        </span>
        <span className="text-emerald-400">
          <span className="font-semibold">{doneItems.length}</span> completed
        </span>
        {activeItems.length > 0 && (
          <span className="text-amber-400">
            <span className="font-semibold">{activeItems.length}</span> carried over
          </span>
        )}
      </div>

      {/* Item list */}
      {entry.items.length === 0 ? (
        <p className="text-xs text-zinc-700 italic">Empty list</p>
      ) : (
        <ul className="space-y-1">
          {/* Completed items first */}
          {doneItems.map(item => (
            <li key={item.id} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
              <span className="text-xs text-zinc-600 line-through">{item.text}</span>
              {item.notes && (
                <span className="ml-1 text-[10px] text-zinc-700 italic">— {item.notes}</span>
              )}
            </li>
          ))}
          {/* Incomplete items */}
          {activeItems.map(item => (
            <li key={item.id} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-zinc-700">○</span>
              <span className={`text-xs ${item.carryover ? "text-amber-300/70" : "text-zinc-400"}`}>
                {item.text}
                {item.carryover && (
                  <span className="ml-1.5 text-[9px] text-amber-600/70 uppercase tracking-wide">carryover</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
