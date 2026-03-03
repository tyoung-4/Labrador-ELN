"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import GlobalClock from "./GlobalClock";

const NAV_ITEMS = [
  { href: "/",              label: "Home",          exact: true,  activeClass: "bg-sky-500 text-white"     },
  { href: "/protocols",     label: "Protocols",     exact: false, activeClass: "bg-emerald-600 text-white" },
  { href: "/inventory",     label: "Inventory",     exact: false, activeClass: "bg-blue-600 text-white"    },
  { href: "/equipment",     label: "Equipment",     exact: false, activeClass: "bg-purple-600 text-white"  },
  { href: "/knowledge-hub", label: "Knowledge Hub", exact: false, activeClass: "bg-rose-700 text-white"    },
  { href: "/ingestion",     label: "👾 Ingestion",  exact: false, activeClass: "bg-amber-600 text-white"   },
];

export const ELN_USERS = [
  { id: "finn-user",  name: "Finn",  role: "MEMBER" as const },
  { id: "jake-user",  name: "Jake",  role: "MEMBER" as const },
  { id: "admin-user", name: "Admin", role: "ADMIN"  as const },
];

export const USER_STORAGE_KEY = "eln-current-user-id";

/** Read current user from localStorage (safe to call client-side only). */
export function getCurrentUser() {
  if (typeof window === "undefined") return ELN_USERS[0];
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  return ELN_USERS.find((u) => u.id === stored) ?? ELN_USERS[0];
}

export default function AppTopNav() {
  const pathname = usePathname();
  const [userId, setUserId] = useState(ELN_USERS[0].id);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored && ELN_USERS.find((u) => u.id === stored)) {
      setUserId(stored);
    }
  }, []);

  function handleUserChange(id: string) {
    setUserId(id);
    localStorage.setItem(USER_STORAGE_KEY, id);
    // Broadcast so other components on the page can react
    window.dispatchEvent(new StorageEvent("storage", { key: USER_STORAGE_KEY, newValue: id }));
  }

  const currentUser = ELN_USERS.find((u) => u.id === userId) ?? ELN_USERS[0];

  return (
    <nav className="mb-5 flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 p-2">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded px-3 py-1.5 text-sm transition ${
              active ? item.activeClass : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            }`}
          >
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
