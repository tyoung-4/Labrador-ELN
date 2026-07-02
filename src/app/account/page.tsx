"use client";

import React, { useEffect, useState } from "react";
import AppTopNav, { getCurrentUser } from "@/components/AppTopNav";

export default function AccountPage() {
  const [me, setMe] = useState<{ name: string; role: string } | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.actor ? { name: d.actor.name, role: d.actor.role } : { name: getCurrentUser().name, role: getCurrentUser().role }))
      .catch(() => setMe({ name: getCurrentUser().name, role: getCurrentUser().role }));
  }, []);

  async function submit() {
    setMsg(null);
    if (next.length < 6) return setMsg({ ok: false, text: "New password must be at least 6 characters." });
    if (next !== confirm) return setMsg({ ok: false, text: "New passwords do not match." });
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const d = (await res.json()) as { success?: boolean; error?: string };
      if (res.ok && d.success) {
        setMsg({ ok: true, text: "Password changed." });
        setCurrent(""); setNext(""); setConfirm("");
      } else {
        setMsg({ ok: false, text: d.error ?? "Failed to change password." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error — please try again." });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />
      <div className="mx-auto max-w-md">
        <h1 className="mb-1 text-2xl font-bold text-white">Account</h1>
        {me && <p className="mb-6 text-sm text-zinc-400">Signed in as {me.name} ({me.role})</p>}

        <div className="rounded-xl border border-white/10 bg-zinc-900 p-5">
          <h2 className="mb-4 text-base font-semibold text-white">Change password</h2>
          <label className="mb-1 block text-sm text-zinc-300">Current password</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={`${field} mb-3`} />
          <label className="mb-1 block text-sm text-zinc-300">New password</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={`${field} mb-3`} placeholder="at least 6 characters" />
          <label className="mb-1 block text-sm text-zinc-300">Confirm new password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className={`${field} mb-4`} />

          {msg && (
            <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${msg.ok ? "border-emerald-700/50 bg-emerald-900/30 text-emerald-300" : "border-red-700/50 bg-red-900/30 text-red-300"}`}>
              {msg.text}
            </div>
          )}

          <button onClick={submit} disabled={busy || !current || !next} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? "Saving…" : "Change password"}
          </button>
        </div>
      </div>
    </div>
  );
}
