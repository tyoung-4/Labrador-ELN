"use client";

import { useState } from "react";
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

const ACKNOWLEDGEMENTS = [
  { name: "Matt Craft",          role: "ELN breaker and advisor" },
  { name: "Becca Laplante",       role: "ELN guinea pig and advisor" },
  { name: "Hyeran Choi",          role: "Feature development" },
  { name: "John C. Williams lab at City of Hope, Beckman Research Institute", role: null },
];

export default function KnowledgeHubPage() {
  const [showAcknowledgements, setShowAcknowledgements] = useState(false);

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

        {/* Acknowledgements — full-width at the bottom */}
        <button
          onClick={() => setShowAcknowledgements(true)}
          className="col-span-2 rounded-xl border border-white/10 bg-white/5 p-5 text-left transition-colors hover:bg-white/10 sm:col-span-3"
        >
          <p className="mb-2 text-2xl">🙏</p>
          <p className="text-sm font-semibold text-white">Acknowledgements</p>
          <p className="mt-1 text-xs text-gray-500">The people behind Labrador ELN</p>
        </button>
      </div>

      {/* Acknowledgements modal */}
      {showAcknowledgements && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="mx-4 w-full max-w-md rounded-xl border border-white/10 bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-bold text-white">Acknowledgements</h2>
              <button
                onClick={() => setShowAcknowledgements(false)}
                className="text-xl leading-none text-gray-400 hover:text-white"
              >✕</button>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              <ul className="space-y-3">
                {ACKNOWLEDGEMENTS.map((person, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-gray-500">—</span>
                    <span>
                      <span className="font-medium text-white">{person.name}</span>
                      {person.role && (
                        <span className="text-gray-400"> · {person.role}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 px-6 py-4">
              <p className="text-center text-xs text-gray-600">
                Labrador ELN 🎾 — Built for the JCW Lab
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
