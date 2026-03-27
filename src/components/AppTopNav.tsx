"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home" },
  { href: "/entries", label: "Protocols" },
  { href: "/runs", label: "Runs" },
  { href: "/inventory", label: "Inventory" },
];

export default function AppTopNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-5 flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 p-2">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded px-3 py-1.5 text-sm transition ${active ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"}`}
          >
            {item.label}
          </Link>
        );
      })}
      <span className="ml-auto text-xs text-zinc-500">Schedule, Knowledge Hub: planned</span>
    </nav>
  );
}
