"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import ReagentsList from "@/components/inventory/ReagentsList";
import CellLinesList from "@/components/inventory/CellLinesList";
import PlasmidsList from "@/components/inventory/PlasmidsList";
import ProteinStocksList from "@/components/inventory/ProteinStocksList";
import AppTopNav, { ELN_USERS } from "@/components/AppTopNav";
import type { TemplateType } from "@/lib/inventoryTemplates";

const TemplateImportModal = dynamic(
  () => import("@/components/inventory/TemplateImportModal"),
  { ssr: false }
);

type Tab = "reagents" | "cellLines" | "plasmids" | "proteins";

const TABS: { id: Tab; label: string }[] = [
  { id: "reagents", label: "Reagents" },
  { id: "cellLines", label: "Cell Lines" },
  { id: "plasmids", label: "Plasmids" },
  { id: "proteins", label: "Protein Stocks" },
];

const USER_STORAGE_KEY = "eln-current-user-id";

const TYPE_TO_TAB: Partial<Record<TemplateType, Tab>> = {
  protein_stock: "proteins",
  antibody: "reagents",
  clinical_antibody: "reagents",
  general_reagent: "reagents",
  cell_line: "cellLines",
  plasmid: "plasmids",
};

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("reagents");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [currentUser, setCurrentUser] = useState("Unknown");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resolve = (id: string | null) => {
      const user = ELN_USERS.find((u) => u.id === id);
      if (user) setCurrentUser(user.name);
    };
    resolve(localStorage.getItem(USER_STORAGE_KEY));
    const onStorage = () => resolve(localStorage.getItem(USER_STORAGE_KEY));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const goToTab = useCallback((t: Tab) => {
    setTab(t);
    window.history.pushState({}, "", `/inventory?tab=${t}`);
  }, []);

  const onImportComplete = useCallback(
    (type: TemplateType) => {
      const dest = TYPE_TO_TAB[type] ?? "reagents";
      goToTab(dest);
    },
    [goToTab]
  );

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-zinc-950 p-6 text-zinc-100">
      <AppTopNav />
      <div className="mx-auto w-full max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Inventory</h1>
            <p className="text-white/40 text-sm mt-0.5">
              Reagents, cell lines, plasmids, and protein stocks
            </p>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow-lg shadow-teal-500/20"
          >
            <span>📊</span>
            <span>Import Stocks</span>
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 outline-none focus:border-teal-400/50 transition-colors text-sm"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-xl">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => goToTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {tab === "reagents" && (
            <ReagentsList search={debouncedSearch} currentUser={currentUser} />
          )}
          {tab === "cellLines" && (
            <CellLinesList search={debouncedSearch} currentUser={currentUser} />
          )}
          {tab === "plasmids" && (
            <PlasmidsList search={debouncedSearch} currentUser={currentUser} />
          )}
          {tab === "proteins" && (
            <ProteinStocksList search={debouncedSearch} currentUser={currentUser} />
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <TemplateImportModal
          currentUser={currentUser}
          onClose={() => setShowImport(false)}
          onImportComplete={(type) => {
            onImportComplete(type);
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}
