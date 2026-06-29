"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { USER_STORAGE_KEY } from "@/components/AppTopNav";
import { DEMO_MODE } from "@/lib/demo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Demo one-click entry — enters as a seeded persona without a password.
  async function enterDemo(userId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json()) as { success?: boolean; user?: { id: string }; error?: string };
      if (res.ok && data.user) {
        try { localStorage.setItem(USER_STORAGE_KEY, data.user.id); } catch {}
        window.location.href = from;
      } else {
        setError(data.error ?? "Could not start the demo");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!identifier.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = (await res.json()) as { success?: boolean; user?: { id: string }; error?: string };
      if (res.ok && data.user) {
        // Keep the existing client identity helper in sync with the session.
        try { localStorage.setItem(USER_STORAGE_KEY, data.user.id); } catch {}
        window.location.href = from;
      } else {
        setError(data.error ?? "Login failed");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        {/* Logo — white line-art on a transparent background (sits cleanly on
            the dark card). */}
        <div className="mb-3 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/labrador-logo.png"
            alt="Labrador ELN"
            width={112}
            height={112}
            className="h-28 w-28"
          />
        </div>
        <h1 className="mb-0.5 text-center text-xl font-semibold text-white">Labrador ELN</h1>
        <p className="mb-1 text-center text-xs uppercase tracking-wide text-zinc-500">JCW Lab · City of Hope</p>
        <p className="mb-5 text-center text-sm text-zinc-400">Sign in to continue</p>

        {/* Demo / sandbox: one-click entry, no credentials needed */}
        {DEMO_MODE && (
          <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="mb-2 text-center text-xs text-amber-300/90">
              Sandbox demo — explore freely. Data is shared and reset periodically.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => enterDemo("finn-user")}
                disabled={busy}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
              >
                ▶ Enter as Lab Member
              </button>
              <button
                onClick={() => enterDemo("admin-user")}
                disabled={busy}
                className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-40"
              >
                Enter as Admin
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-zinc-500">or sign in with an account below</p>
          </div>
        )}

        <label className="mb-1 block text-sm font-medium text-zinc-300">Username or email</label>
        <input
          type="text"
          value={identifier}
          autoFocus
          onChange={(e) => setIdentifier(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          placeholder="e.g. Admin"
        />

        <label className="mb-1 block text-sm font-medium text-zinc-300">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          placeholder="••••••••"
        />

        {error && (
          <div className="mb-4 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={busy || !identifier.trim() || !password}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
