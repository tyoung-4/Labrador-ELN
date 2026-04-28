"use client";

import React, { useState } from "react";
import ReagentForm from "./ReagentForm";
import CellLineForm from "./CellLineForm";
import PlasmidForm from "./PlasmidForm";
import ProteinStockForm from "./ProteinStockForm";

type ItemCategory = "proteinStock" | "reagent" | "cellLine" | "plasmid";

type CreateItemModalProps = {
  currentUser: string;
  availableRuns: Array<{ id: string; title: string; runId: string }>;
  availablePlasmids: Array<{ id: string; name: string }>;
  allCellLines: Array<{ id: string; name: string }>;
  onSuccess: (category: ItemCategory, item: any) => void;
  onCancel: () => void;
};

export default function CreateItemModal({
  currentUser,
  availableRuns,
  availablePlasmids,
  allCellLines,
  onSuccess,
  onCancel,
}: CreateItemModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);

  const categories = [
    {
      id: "proteinStock" as const,
      label: "Protein Stock",
      emoji: "🧪",
      description: "Purified proteins with batch tracking",
    },
    {
      id: "reagent" as const,
      label: "Reagent / Consumable",
      emoji: "🧴",
      description: "Chemicals, kits, lab supplies",
    },
    {
      id: "cellLine" as const,
      label: "Cell Line",
      emoji: "🔬",
      description: "Cell lines with vial tracking",
    },
    {
      id: "plasmid" as const,
      label: "Plasmid",
      emoji: "🧬",
      description: "Plasmid maps and constructs",
    },
  ];

  if (selectedCategory === null) {
    // Category selection screen
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md mx-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold text-lg">Create Inventory Item</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <p className="text-gray-400 text-sm mb-5">Choose a category:</p>

          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="flex flex-col items-start gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 p-4 text-left transition-all"
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-white text-sm font-medium">{cat.label}</span>
                <span className="text-gray-500 text-xs leading-tight">{cat.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Form screen
  const categoryLabel =
    selectedCategory === "proteinStock"
      ? "Protein Stock"
      : selectedCategory === "reagent"
      ? "Reagent / Consumable"
      : selectedCategory === "cellLine"
      ? "Cell Line"
      : "Plasmid";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Sticky header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 flex-shrink-0">
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-gray-400 hover:text-white text-sm"
          >
            ← Back
          </button>
          <h2 className="text-white font-bold">New {categoryLabel}</h2>
          <button
            onClick={onCancel}
            className="ml-auto text-gray-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {selectedCategory === "proteinStock" && (
            <ProteinStockForm
              currentUser={currentUser}
              availablePlasmids={availablePlasmids}
              onSuccess={(stock) => onSuccess("proteinStock", stock)}
              onCancel={onCancel}
            />
          )}
          {selectedCategory === "reagent" && (
            <ReagentForm
              currentUser={currentUser}
              onSuccess={(reagent) => onSuccess("reagent", reagent)}
              onCancel={onCancel}
            />
          )}
          {selectedCategory === "cellLine" && (
            <CellLineForm
              currentUser={currentUser}
              allCellLines={allCellLines}
              availableRuns={availableRuns}
              onSuccess={(cl) => onSuccess("cellLine", cl)}
              onCancel={onCancel}
            />
          )}
          {selectedCategory === "plasmid" && (
            <PlasmidForm
              currentUser={currentUser}
              availableRuns={availableRuns}
              onSuccess={(p) => onSuccess("plasmid", p)}
              onCancel={onCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
