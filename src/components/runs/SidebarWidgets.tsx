"use client";

import { useState } from "react";
import LabTimerWidget from "./LabTimerWidget";
import CalculatorWidget from "./CalculatorWidget";

function Widget({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border border-zinc-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 transition"
      >
        <span>{label}</span>
        <span className="text-zinc-600">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-800 px-3 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

export default function SidebarWidgets() {
  return (
    <div className="space-y-1.5">
      <Widget label="⏱ Timer">
        <LabTimerWidget />
      </Widget>
      <Widget label="🧮 Calculator">
        <CalculatorWidget />
      </Widget>
    </div>
  );
}
