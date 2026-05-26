"use client";

import { useState } from "react";

export type RecipeSummary = {
  id: string;
  name: string;
  description?: string;
  notes?: string;
  components: {
    id: string;
    reagentName: string;
    concentration: number | null;
    unit: string;
    notes: string;
    order: number;
    inventoryId?: string;
    inventoryName?: string;
  }[];
};

// ── Popover preview ────────────────────────────────────────────────────────────

function RecipePreview({ recipe }: { recipe: RecipeSummary }) {
  return (
    <div className="absolute bottom-full left-0 z-50 mb-1.5 w-72 rounded border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-zinc-100">{recipe.name}</p>
      {recipe.description && (
        <p className="mb-2 text-xs text-zinc-400">{recipe.description}</p>
      )}
      {recipe.components.length > 0 && (
        <table className="w-full text-xs">
          <tbody>
            {recipe.components.map((c) => (
              <tr key={c.id} className="border-b border-zinc-800 last:border-0">
                <td className="py-0.5 pr-2 text-zinc-300">
                  {c.inventoryId ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {c.reagentName}
                    </span>
                  ) : c.reagentName}
                </td>
                <td className="py-0.5 text-right text-zinc-400 tabular-nums">
                  {c.concentration != null ? `${c.concentration} ${c.unit}`.trim() : c.unit || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {recipe.notes && (
        <>
          <div className="my-2 border-t border-zinc-700" />
          <p className="text-xs text-zinc-400 italic">{recipe.notes}</p>
        </>
      )}
    </div>
  );
}

// ── RecipeChip ─────────────────────────────────────────────────────────────────

type RecipeChipProps = {
  recipe: RecipeSummary;
  /** If provided, renders an × button to remove the recipe ref */
  onRemove?: () => void;
};

export default function RecipeChip({ recipe, onRemove }: RecipeChipProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <span
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="inline-flex items-center gap-1 rounded-full border border-indigo-700/60 bg-indigo-900/40 px-2 py-0.5 text-xs text-indigo-300"
      >
        <span className="opacity-60">⚗</span>
        <span>{recipe.name}</span>
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="ml-0.5 rounded-full text-indigo-400 hover:text-indigo-100 transition"
            title="Remove recipe"
          >
            ×
          </button>
        )}
      </span>
      {hovered && <RecipePreview recipe={recipe} />}
    </span>
  );
}
