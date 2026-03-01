"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", exact: true },
  { href: "/protocols", label: "Protocols", exact: false },
  { href: "/inventory", label: "Inventory", exact: false },
  { href: "/schedule", label: "Schedule", exact: false },
  { href: "/knowledge-hub", label: "Knowledge Hub", exact: false },
];

export default function AppTopNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-5 flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 p-2">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
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
    </nav>
  );
}
