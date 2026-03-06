"use client";

import { createContext, useCallback, useContext, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Toast = { id: string; message: string };
type ToastCtx = { addToast: (msg: string) => void };

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastCtx>({ addToast: () => {} });

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 8_000);
  }, []);

  function dismiss(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Fixed toast overlay — bottom-right, stacked */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2" role="status" aria-live="polite">
          {toasts.map(t => (
            <div
              key={t.id}
              className="flex max-w-sm items-start gap-3 rounded-lg border border-emerald-500/40 bg-zinc-900 px-4 py-3 shadow-xl"
            >
              <span className="mt-0.5 text-emerald-400">✓</span>
              <p className="flex-1 text-[12px] leading-snug text-zinc-100">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 text-zinc-500 transition hover:text-zinc-200"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastCtx {
  return useContext(ToastContext);
}
