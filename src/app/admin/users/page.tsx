"use client";

import React, { useEffect, useState, useCallback } from "react";
import AppTopNav from "@/components/AppTopNav";

type User = {
  id: string; name: string | null; email: string; role: string; isActive: boolean; lastLoginAt: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New-user form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.status === 403) { setForbidden(true); return; }
    if (res.ok) setUsers(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createUser() {
    setError(null);
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError("Name, email and a password (≥6 chars) are required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role, password }),
      });
      const d = (await res.json()) as { success?: boolean; error?: string };
      if (res.ok && d.success) {
        setName(""); setEmail(""); setRole("MEMBER"); setPassword("");
        await load();
      } else setError(d.error ?? "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); window.alert(d.error ?? "Update failed"); }
    await load();
  }

  async function resetPassword(u: User) {
    const pw = window.prompt(`New password for ${u.name} (≥6 chars):`);
    if (!pw) return;
    if (pw.length < 6) return window.alert("Password must be at least 6 characters.");
    await patchUser(u.id, { password: pw });
    window.alert("Password reset.");
  }

  const field = "rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none";

  if (forbidden) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
        <AppTopNav />
        <p className="mt-12 text-center text-sm text-zinc-400">Admins only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-bold text-white">Users</h1>
        <p className="mb-6 text-sm text-zinc-400">Add lab members, set roles, reset passwords, and deactivate accounts.</p>

        {/* Add user */}
        <div className="mb-6 rounded-xl border border-white/10 bg-zinc-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Add a user</h2>
          <div className="flex flex-wrap gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={`${field} flex-1`} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@lab" className={`${field} flex-1`} />
            <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Initial password" className={`${field} flex-1`} />
            <button onClick={createUser} disabled={creating} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-40">
              {creating ? "Adding…" : "Add"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>

        {/* User table */}
        <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users === null ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-500">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-500">No users.</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="border-b border-white/5">
                  <td className="px-3 py-2 text-white">{u.name ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-400">{u.email}</td>
                  <td className="px-3 py-2">
                    <select value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200">
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span className={u.isActive ? "text-emerald-400" : "text-zinc-500"}>{u.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => resetPassword(u)} className="mr-3 text-xs text-indigo-400 hover:text-indigo-300">Reset password</button>
                    <button onClick={() => patchUser(u.id, { isActive: !u.isActive })} className="text-xs text-zinc-400 hover:text-white">
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
