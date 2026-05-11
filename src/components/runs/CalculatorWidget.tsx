"use client";

import { useState } from "react";

type Op = "+" | "-" | "×" | "÷" | null;

function formatResult(n: number): string {
  if (!isFinite(n)) return "Error";
  // Cap display to 10 significant digits
  const s = parseFloat(n.toPrecision(10)).toString();
  return s;
}

export default function CalculatorWidget() {
  const [display,           setDisplay]           = useState("0");
  const [prevValue,         setPrevValue]         = useState<number | null>(null);
  const [operator,          setOperator]          = useState<Op>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  function inputDigit(d: string) {
    if (waitingForOperand) {
      setDisplay(d === "0" ? "0" : d);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? d : display + d);
    }
  }

  function inputDot() {
    if (waitingForOperand) { setDisplay("0."); setWaitingForOperand(false); return; }
    if (!display.includes(".")) setDisplay(display + ".");
  }

  function clear() {
    setDisplay("0");
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  }

  function toggleSign() {
    setDisplay(formatResult(parseFloat(display) * -1));
  }

  function percent() {
    setDisplay(formatResult(parseFloat(display) / 100));
  }

  function compute(a: number, b: number, op: Op): number {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "×") return a * b;
    if (op === "÷") return b !== 0 ? a / b : NaN;
    return b;
  }

  function handleOp(op: Op) {
    const cur = parseFloat(display);
    if (prevValue !== null && operator && !waitingForOperand) {
      const result = compute(prevValue, cur, operator);
      setDisplay(formatResult(result));
      setPrevValue(result);
    } else {
      setPrevValue(cur);
    }
    setOperator(op);
    setWaitingForOperand(true);
  }

  function equals() {
    const cur = parseFloat(display);
    if (prevValue !== null && operator) {
      const result = compute(prevValue, cur, operator);
      setDisplay(formatResult(result));
      setPrevValue(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
  }

  const num  = "rounded py-2 text-sm font-medium bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition active:scale-95";
  const fn_  = "rounded py-2 text-sm font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 transition active:scale-95";
  const op_  = (o: Op) =>
    `rounded py-2 text-sm font-medium transition active:scale-95 ${
      operator === o && waitingForOperand
        ? "bg-white text-zinc-900"
        : "bg-indigo-700 text-white hover:bg-indigo-600"
    }`;
  const eq_  = "rounded py-2 text-sm font-semibold bg-emerald-700 text-white hover:bg-emerald-600 transition active:scale-95 col-span-4";

  return (
    <div className="space-y-2">
      {/* Display */}
      <div className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-right min-h-[52px] flex flex-col justify-end">
        {operator && prevValue !== null && (
          <p className="truncate text-xs text-zinc-500">{prevValue} {operator}</p>
        )}
        <p className="truncate font-mono text-xl font-semibold text-zinc-100">{display}</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-1">
        <button onClick={clear}        className={`${fn_} col-span-2`}>C</button>
        <button onClick={toggleSign}   className={fn_}>±</button>
        <button onClick={percent}      className={fn_}>%</button>

        <button onClick={() => inputDigit("7")} className={num}>7</button>
        <button onClick={() => inputDigit("8")} className={num}>8</button>
        <button onClick={() => inputDigit("9")} className={num}>9</button>
        <button onClick={() => handleOp("÷")}   className={op_("÷")}>÷</button>

        <button onClick={() => inputDigit("4")} className={num}>4</button>
        <button onClick={() => inputDigit("5")} className={num}>5</button>
        <button onClick={() => inputDigit("6")} className={num}>6</button>
        <button onClick={() => handleOp("×")}   className={op_("×")}>×</button>

        <button onClick={() => inputDigit("1")} className={num}>1</button>
        <button onClick={() => inputDigit("2")} className={num}>2</button>
        <button onClick={() => inputDigit("3")} className={num}>3</button>
        <button onClick={() => handleOp("-")}   className={op_("-")}>−</button>

        <button onClick={() => inputDigit("0")} className={`${num} col-span-2`}>0</button>
        <button onClick={inputDot}              className={num}>.</button>
        <button onClick={() => handleOp("+")}   className={op_("+")}>+</button>

        <button onClick={equals} className={eq_}>=</button>
      </div>
    </div>
  );
}
