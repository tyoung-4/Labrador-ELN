"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import GlobalClock from "./GlobalClock";

const NAV_ITEMS = [
  { href: "/",              label: "Home",           exact: true,  activeClass: "bg-sky-500 text-white",     hard: false, alsoActive: [] as string[] },
  { href: "/projects",      label: "Projects",       exact: false, activeClass: "bg-emerald-600 text-white", hard: true,  alsoActive: [] as string[] },
  { href: "/protocols",     label: "Protocols/Runs", exact: false, activeClass: "bg-indigo-600 text-white",  hard: false, alsoActive: ["/runs", "/recipes"] },
  { href: "/inventory",     label: "Inventory",      exact: false, activeClass: "bg-teal-600 text-white",    hard: false, alsoActive: [] as string[] },
  { href: "/equipment",     label: "Equipment",      exact: false, activeClass: "bg-purple-600 text-white",  hard: false, alsoActive: [] as string[] },
  { href: "/knowledge-hub", label: "Knowledge Hub",  exact: false, activeClass: "bg-amber-600 text-white",   hard: false, alsoActive: [] as string[] },
];

export const ELN_USERS = [
  { id: "finn-user",  name: "Finn",              role: "MEMBER" as const },
  { id: "jake-user",  name: "Jake",              role: "MEMBER" as const },
  { id: "admin-user", name: "Admin",             role: "ADMIN"  as const },
  { id: "pb-user",    name: "Princess Bubblegum", role: "MEMBER" as const },
  { id: "marceline-user", name: "Marceline",     role: "MEMBER" as const },
];

export const USER_STORAGE_KEY = "eln-current-user-id";

// Module-level cache — survives component remounts during soft navigation,
// so the correct user is available synchronously on re-mount with no flash.
let _cachedUserId: string | null = null;

/** Read current user from localStorage (safe to call client-side only). */
export function getCurrentUser() {
  if (typeof window === "undefined") return ELN_USERS[0];
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  return ELN_USERS.find((u) => u.id === stored) ?? ELN_USERS[0];
}

export default function AppTopNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const [userId, setUserId] = useState(ELN_USERS[0].id);

  // useLayoutEffect fires before the browser paints. On a soft-nav remount
  // the module cache is already populated, so the correction is instantaneous.
  useLayoutEffect(() => {
    if (_cachedUserId) {
      setUserId(_cachedUserId);
      return;
    }
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    const resolved = (stored && ELN_USERS.find((u) => u.id === stored)) ? stored : ELN_USERS[0].id;
    _cachedUserId = resolved;
    setUserId(resolved);
  }, []);

  function handleUserChange(id: string) {
    _cachedUserId = id;
    setUserId(id);
    localStorage.setItem(USER_STORAGE_KEY, id);
    // Broadcast so other components on the page can react
    window.dispatchEvent(new StorageEvent("storage", { key: USER_STORAGE_KEY, newValue: id }));
    // Sandbox-only: navigate to Home on profile switch so per-user state is fresh
    router.push("/");
  }

  const currentUser = ELN_USERS.find((u) => u.id === userId) ?? ELN_USERS[0];

  return (
    <nav className="mb-5 flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 p-2">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/") ||
            item.alsoActive.some(p => pathname === p || pathname.startsWith(p + "/"));
        const cls = `rounded px-3 py-1.5 text-sm transition ${
          active ? item.activeClass : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
        }`;
        // Projects uses a hard <a> so detail-view state is cleared on click
        return item.hard ? (
          <a key={item.href} href={item.href} className={cls}>
            {item.label}
          </a>
        ) : (
          <Link key={item.href} href={item.href} className={cls}>
            {item.label}
          </Link>
        );
      })}

      {/* Clock + user selector — pushed to far right */}
      <div className="ml-auto flex items-center gap-2">
        <GlobalClock />
        <span className="text-xs text-zinc-400">
          <span className="font-semibold text-zinc-100">{currentUser.name}</span>
        </span>
        <select
          value={userId}
          onChange={(e) => handleUserChange(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:outline-none"
        >
          {ELN_USERS.map((u) => (
            <option key={u.id} value={u.id}>
              Login as {u.name}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}
