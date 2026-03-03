"use client";

import Link from "next/link";
import { useState } from "react";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function MiniCalendar() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthLabel = viewDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const isToday = (d: number) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === d;

  const fmt = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  // Build cell array: leading nulls + day numbers
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      {/* Month header */}
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded px-1.5 py-0.5 text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
        >
          ‹
        </button>
        <span className="text-xs font-medium text-zinc-300">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="rounded px-1.5 py-0.5 text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-0.5 grid grid-cols-7 text-center">
        {DOW.map((d) => (
          <div key={d} className="py-0.5 text-[10px] text-zinc-600">
            {d}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {cells.map((day, i) =>
          day === null ? (
            <div key={`e-${i}`} />
          ) : (
            <Link
              key={day}
              href={`/equipment?date=${fmt(day)}`}
              className={`rounded py-1 text-xs transition ${
                isToday(day)
                  ? "bg-emerald-600 font-semibold text-white"
                  : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
            >
              {day}
            </Link>
          )
        )}
      </div>

      {/* Footer link */}
      <div className="mt-3 text-right">
        <Link
          href="/equipment"
          className="text-xs text-zinc-600 underline underline-offset-2 transition hover:text-zinc-400"
        >
          View equipment →
        </Link>
      </div>
    </div>
  );
}
