"use client";
import React, { useEffect, useRef, useState } from "react";

// ─── Types & constants ────────────────────────────────────────────────────────

type Tz     = "PST" | "EST" | "CST" | "MST" | "UTC";
type Fmt    = "12h" | "24h";
type Style  = "digital" | "analog";

type ClockPrefs = { tz: Tz; format: Fmt; style: Style };

const CLOCK_PREFS_KEY = "eln-clock-prefs";

const TZ_IANA: Record<Tz, string> = {
  PST: "America/Los_Angeles",
  MST: "America/Denver",
  CST: "America/Chicago",
  EST: "America/New_York",
  UTC: "UTC",
};

const DEFAULT_PREFS: ClockPrefs = { tz: "PST", format: "12h", style: "digital" };

// ─── Analog SVG clock face ────────────────────────────────────────────────────

function AnalogClock({ h, m, s }: { h: number; m: number; s: number }) {
  const hourAngle = (h % 12) * 30 + m * 0.5;
  const minAngle  = m * 6 + s * 0.1;
  const secAngle  = s * 6;

  function hand(deg: number, len: number, w: number, color: string) {
    const rad = (deg - 90) * (Math.PI / 180);
    return (
      <line
        x1="50" y1="50"
        x2={50 + Math.cos(rad) * len}
        y2={50 + Math.sin(rad) * len}
        stroke={color} strokeWidth={w} strokeLinecap="round"
      />
    );
  }

  return (
    <svg width="34" height="34" viewBox="0 0 100 100" className="shrink-0">
      {/* Face + rim */}
      <circle cx="50" cy="50" r="47" fill="#18181b" stroke="#3f3f46" strokeWidth="3" />
      {/* Hour tick marks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        return (
          <line
            key={i}
            x1={50 + Math.cos(angle) * 38} y1={50 + Math.sin(angle) * 38}
            x2={50 + Math.cos(angle) * 44} y2={50 + Math.sin(angle) * 44}
            stroke="#52525b" strokeWidth="2.5"
          />
        );
      })}
      {/* Hands */}
      {hand(hourAngle, 26, 4, "#e4e4e7")}
      {hand(minAngle,  36, 2.5, "#a1a1aa")}
      {hand(secAngle,  40, 1.5, "#f87171")}
      {/* Centre */}
      <circle cx="50" cy="50" r="4" fill="#e4e4e7" />
    </svg>
  );
}

// ─── Main clock component ─────────────────────────────────────────────────────

export default function GlobalClock() {
  const [prefs, setPrefs]       = useState<ClockPrefs>(DEFAULT_PREFS);
  const [now,   setNow]         = useState<Date | null>(null);
  const [open,  setOpen]        = useState(false);
  const popoverRef              = useRef<HTMLDivElement>(null);

  // Hydrate prefs from localStorage after mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLOCK_PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<ClockPrefs>) });
    } catch {}
    setNow(new Date());
  }, []);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function savePrefs(next: ClockPrefs) {
    setPrefs(next);
    try { localStorage.setItem(CLOCK_PREFS_KEY, JSON.stringify(next)); } catch {}
  }

  // Convert current UTC Date → components in the chosen timezone
  function getComponents(date: Date) {
    const locale  = "en-US";
    const iana    = TZ_IANA[prefs.tz];
    const parts   = new Intl.DateTimeFormat(locale, {
      timeZone: iana,
      hour: "numeric", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(date);
    const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? "0");
    return { h: get("hour") % 24, m: get("minute"), s: get("second") };
  }

  function formatDigital(date: Date): string {
    const iana    = TZ_IANA[prefs.tz];
    const hour12  = prefs.format === "12h";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: iana,
      hour: "numeric", minute: "2-digit", second: "2-digit",
      hour12,
    }).format(date);
  }

  if (!now) return null; // SSR guard

  const { h, m, s } = getComponents(now);

  return (
    <div className="relative flex items-center" ref={popoverRef}>
      {/* Clock display — click to open settings */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/70 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 transition"
        aria-label="Clock settings"
      >
        {prefs.style === "analog" ? (
          <AnalogClock h={h} m={m} s={s} />
        ) : (
          <span className="font-mono tabular-nums tracking-tight">{formatDigital(now)}</span>
        )}
        <span className="text-[9px] font-semibold uppercase text-zinc-500">{prefs.tz}</span>
      </button>

      {/* Settings popover */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-2xl shadow-black/60">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Clock Settings</p>

          {/* Timezone */}
          <label className="mb-1 block text-[11px] text-zinc-400">Time Zone</label>
          <div className="mb-3 grid grid-cols-5 gap-0.5">
            {(["PST", "MST", "CST", "EST", "UTC"] as Tz[]).map(tz => (
              <button
                key={tz}
                onClick={() => savePrefs({ ...prefs, tz })}
                className={`rounded px-1 py-1 text-[10px] font-medium transition ${
                  prefs.tz === tz
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {tz}
              </button>
            ))}
          </div>

          {/* Format */}
          <label className="mb-1 block text-[11px] text-zinc-400">Format</label>
          <div className="mb-3 grid grid-cols-2 gap-1">
            {(["12h", "24h"] as Fmt[]).map(fmt => (
              <button
                key={fmt}
                onClick={() => savePrefs({ ...prefs, format: fmt })}
                className={`rounded px-2 py-1 text-[10px] font-medium transition ${
                  prefs.format === fmt
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {fmt === "12h" ? "12-hour" : "24-hour"}
              </button>
            ))}
          </div>

          {/* Style */}
          <label className="mb-1 block text-[11px] text-zinc-400">Style</label>
          <div className="grid grid-cols-2 gap-1">
            {(["digital", "analog"] as Style[]).map(st => (
              <button
                key={st}
                onClick={() => savePrefs({ ...prefs, style: st })}
                className={`rounded px-2 py-1 text-[10px] font-medium capitalize transition ${
                  prefs.style === st
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
