"use client";

// TEMPORARY — delete in Prompt 3 after TagInput is wired to live pages

import React from "react";
import TagInput from "@/components/tags/TagInput";
import TagDisplay from "@/components/tags/TagDisplay";

const MOCK_TAGS = [
  { id: "mock-1", name: "AKTA", type: "GENERAL" as const, color: "#6366f1" },
  { id: "mock-2", name: "CD38", type: "PROJECT" as const, color: "#22c55e" },
];

export default function TestTagsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <h1 className="text-2xl font-bold text-white mb-2">TagInput — Test Page</h1>
      <p className="text-zinc-400 mb-8 text-sm">
        Temporary page for Prompt 2 verification. Delete in Prompt 3.
      </p>

      {/* ── Owner view ──────────────────────────────────────────────────── */}
      <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Owner view — <code className="text-indigo-400">currentUser: &quot;Admin&quot;</code>
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Full interactive: input field, create dialog, remove popover.
        </p>
        <TagInput
          entityType="ENTRY"
          entityId="test-123"
          currentUser="Admin"
          entityOwner="Admin"
          existingAssignments={[]}
        />
      </section>

      {/* ── Non-owner view ───────────────────────────────────────────────── */}
      <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white mb-1">
          Non-owner view — <code className="text-amber-400">currentUser: &quot;Finn&quot;</code>, owner: &quot;Admin&quot;
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Read-only: lock icon, no input, no remove buttons.
        </p>
        <TagInput
          entityType="ENTRY"
          entityId="test-456"
          currentUser="Finn"
          entityOwner="Admin"
          existingAssignments={[
            {
              tagId: "mock-1",
              tag: { id: "mock-1", name: "AKTA", type: "GENERAL", color: "#6366f1" },
            },
            {
              tagId: "mock-2",
              tag: { id: "mock-2", name: "CD38", type: "PROJECT", color: "#22c55e" },
            },
          ]}
        />
      </section>

      {/* ── TagDisplay ───────────────────────────────────────────────────── */}
      <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white mb-1">TagDisplay — read-only list view</h2>
        <p className="text-sm text-zinc-500 mb-4">
          maxVisible=3 with +N overflow pill.
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs text-zinc-500 mb-1">2 tags (within maxVisible):</p>
            <TagDisplay tags={MOCK_TAGS} maxVisible={3} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">5 tags (overflow, maxVisible=3):</p>
            <TagDisplay
              tags={[
                ...MOCK_TAGS,
                { id: "mock-3", name: "Protein", type: "GENERAL" as const, color: "#ef4444" },
                { id: "mock-4", name: "V2", type: "GENERAL" as const, color: "#f97316" },
                { id: "mock-5", name: "ELISA", type: "PROJECT" as const, color: "#14b8a6" },
              ]}
              maxVisible={3}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
