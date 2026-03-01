import Link from "next/link";
import AppTopNav from "@/components/AppTopNav";

const SECTIONS = [
  { href: "/knowledge-hub/papers-grants", label: "Papers & Grants" },
  { href: "/knowledge-hub/codes-scripts", label: "Codes & Scripts" },
  { href: "/knowledge-hub/admin", label: "Admin" },
  { href: "/knowledge-hub/safety-sds", label: "Safety & SDS" },
  { href: "/knowledge-hub/lab-resources", label: "Lab Resources" },
  { href: "/knowledge-hub/meeting-notes", label: "Meeting Notes" },
];

export default function KnowledgeHubPage() {
  return (
    <div className="flex min-h-screen flex-col gap-4 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Knowledge Hub</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-6 text-center text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
