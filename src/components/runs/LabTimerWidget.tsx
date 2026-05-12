"use client";

import { useState, useEffect, useRef } from "react";

type TimerMode = "countdown" | "countup" | "lap";

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const btnBase = "rounded px-2.5 py-1 text-xs font-medium transition";
const tabBase = "rounded px-2.5 py-1 text-xs font-medium transition";
const tabOn   = "bg-zinc-700 text-zinc-100";
const tabOff  = "text-zinc-500 hover:text-zinc-200";

export default function LabTimerWidget() {
  const [mode, setMode] = useState<TimerMode>("countdown");

  // Countdown
  const [cdInput,     setCdInput]     = useState("05:00");
  const [cdRemaining, setCdRemaining] = useState<number | null>(null);
  const [cdRunning,   setCdRunning]   = useState(false);
  const [cdDone,      setCdDone]      = useState(false);

  // Countup
  const [cuElapsed, setCuElapsed] = useState(0);
  const [cuRunning, setCuRunning] = useState(false);

  // Lap
  const [lapElapsed, setLapElapsed] = useState(0);
  const [lapRunning, setLapRunning] = useState(false);
  const [laps,       setLaps]       = useState<number[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  function stopInterval() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  function startTick(cb: () => void) {
    stopInterval();
    intervalRef.current = setInterval(cb, 100);
  }

  // ── Countdown ───────────────────────────────────────────────────────────────
  function cdStart() {
    const [rawM = "0", rawS = "0"] = cdInput.split(":");
    const total = (parseInt(rawM, 10) * 60 + parseInt(rawS, 10)) * 1000;
    if (total <= 0) return;
    setCdDone(false);
    setCdRunning(true);
    let rem = total;
    let last = Date.now();
    setCdRemaining(rem);
    startTick(() => {
      const now = Date.now();
      rem = Math.max(0, rem - (now - last));
      last = now;
      setCdRemaining(rem);
      if (rem === 0) { stopInterval(); setCdRunning(false); setCdDone(true); }
    });
  }
  function cdStop()  { stopInterval(); setCdRunning(false); }
  function cdReset() { stopInterval(); setCdRunning(false); setCdRemaining(null); setCdDone(false); }

  // ── Countup ─────────────────────────────────────────────────────────────────
  function cuStart() {
    setCuRunning(true);
    let el = cuElapsed;
    let last = Date.now();
    startTick(() => {
      const now = Date.now();
      el += now - last;
      last = now;
      setCuElapsed(el);
    });
  }
  function cuStop()  { stopInterval(); setCuRunning(false); }
  function cuReset() { stopInterval(); setCuRunning(false); setCuElapsed(0); }

  // ── Lap ─────────────────────────────────────────────────────────────────────
  function lapStart() {
    setLapRunning(true);
    let el = lapElapsed;
    let last = Date.now();
    startTick(() => {
      const now = Date.now();
      el += now - last;
      last = now;
      setLapElapsed(el);
    });
  }
  function lapStop()   { stopInterval(); setLapRunning(false); }
  function lapReset()  { stopInterval(); setLapRunning(false); setLapElapsed(0); setLaps([]); }
  function lapRecord() { setLaps((prev) => [...prev, lapElapsed]); }

  function switchMode(m: TimerMode) { stopInterval(); setMode(m); }

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded bg-zinc-900 p-0.5">
        {(["countdown", "countup", "lap"] as TimerMode[]).map((m) => (
          <button key={m} onClick={() => switchMode(m)}
            className={`${tabBase} flex-1 ${mode === m ? tabOn : tabOff}`}>
            {m === "countdown" ? "Down" : m === "countup" ? "Up" : "Lap"}
          </button>
        ))}
      </div>

      {/* ── Countdown ── */}
      {mode === "countdown" && (
        <div className="space-y-2">
          {cdDone ? (
            <p className="text-center font-mono text-2xl font-bold text-amber-400 animate-pulse">
              Time&rsquo;s up!
            </p>
          ) : (
            <p className="text-center font-mono text-3xl font-bold tabular-nums text-zinc-100">
              {cdRemaining !== null ? fmt(cdRemaining) : "——:——"}
            </p>
          )}
          {cdRemaining === null && !cdDone && (
            <input
              type="text"
              value={cdInput}
              onChange={(e) => setCdInput(e.target.value)}
              placeholder="MM:SS"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-center font-mono text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
            />
          )}
          <div className="flex gap-1.5">
            {!cdRunning
              ? <button onClick={cdStart} disabled={cdDone}
                  className={`${btnBase} flex-1 bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-40`}>Start</button>
              : <button onClick={cdStop}
                  className={`${btnBase} flex-1 bg-amber-700 text-white hover:bg-amber-600`}>Stop</button>
            }
            <button onClick={cdReset}
              className={`${btnBase} bg-zinc-700 text-zinc-300 hover:bg-zinc-600`}>Reset</button>
          </div>
        </div>
      )}

      {/* ── Countup ── */}
      {mode === "countup" && (
        <div className="space-y-2">
          <p className="text-center font-mono text-3xl font-bold tabular-nums text-zinc-100">
            {fmt(cuElapsed)}
          </p>
          <div className="flex gap-1.5">
            {!cuRunning
              ? <button onClick={cuStart}
                  className={`${btnBase} flex-1 bg-emerald-700 text-white hover:bg-emerald-600`}>Start</button>
              : <button onClick={cuStop}
                  className={`${btnBase} flex-1 bg-amber-700 text-white hover:bg-amber-600`}>Stop</button>
            }
            <button onClick={cuReset}
              className={`${btnBase} bg-zinc-700 text-zinc-300 hover:bg-zinc-600`}>Reset</button>
          </div>
        </div>
      )}

      {/* ── Lap ── */}
      {mode === "lap" && (
        <div className="space-y-2">
          <p className="text-center font-mono text-3xl font-bold tabular-nums text-zinc-100">
            {fmt(lapElapsed)}
          </p>
          <div className="flex gap-1.5">
            {!lapRunning ? (
              <button onClick={lapStart}
                className={`${btnBase} flex-1 bg-emerald-700 text-white hover:bg-emerald-600`}>Start</button>
            ) : (
              <>
                <button onClick={lapStop}
                  className={`${btnBase} flex-1 bg-amber-700 text-white hover:bg-amber-600`}>Stop</button>
                <button onClick={lapRecord}
                  className={`${btnBase} bg-indigo-700 text-white hover:bg-indigo-600`}>Lap</button>
              </>
            )}
            <button onClick={lapReset}
              className={`${btnBase} bg-zinc-700 text-zinc-300 hover:bg-zinc-600`}>Reset</button>
          </div>
          {laps.length > 0 && (
            <div className="max-h-24 overflow-y-auto rounded border border-zinc-800 bg-zinc-900/60">
              {laps.map((t, i) => (
                <div key={i} className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 text-xs last:border-0">
                  <span className="text-zinc-500">Lap {i + 1}</span>
                  <span className="font-mono text-zinc-200">{fmt(t)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
