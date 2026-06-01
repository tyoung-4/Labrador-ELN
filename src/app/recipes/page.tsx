"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppTopNav from "@/components/AppTopNav";
import { getCurrentUser } from "@/components/AppTopNav";
import ProtocolsRunsSubNav from "@/components/ProtocolsRunsSubNav";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Component = {
  id?: string;      // undefined for new (unsaved) components
  reagentName: string;
  concentration: number | null;
  unit: string;
  notes: string;
  order: number;
  inventoryId: string;
  inventoryName: string;
};

type Recipe = {
  id: string;
  name: string;
  description: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  components: Component[];
};


// ─────────────────────────────────────────────────────────────────────────────
// Permission helper
// ─────────────────────────────────────────────────────────────────────────────

function canEditRecipe(recipe: Recipe, userId: string, userRole: string): boolean {
  return userRole === "ADMIN" || recipe.createdById === userId;
}

// ─────────────────────────────────────────────────────────────────────────────
// DeleteConfirmModal
// ─────────────────────────────────────────────────────────────────────────────

function DeleteConfirmModal({
  recipeName,
  onConfirm,
  onCancel,
}: {
  recipeName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl">
        <h3 className="mb-2 text-base font-semibold text-gray-900">Delete Recipe?</h3>
        <p className="mb-1 text-sm text-gray-700">
          Delete <span className="font-semibold">{recipeName}</span>? This cannot be undone.
        </p>
        <p className="mb-5 text-xs text-gray-500">
          Any protocols referencing this recipe will retain the recipe name as text only.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ComponentRow — a single editable component row with drag handle
// ─────────────────────────────────────────────────────────────────────────────

function ComponentRow({
  comp,
  index,
  onChange,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  comp: Component;
  index: number;
  onChange: (index: number, field: keyof Component, value: string | number | null) => void;
  onRemove: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, index); }}
      onDrop={() => onDrop(index)}
      className="group flex items-start gap-2 rounded border border-gray-200 bg-white p-2"
    >
      {/* Drag handle */}
      <div className="mt-2 cursor-grab text-gray-300 group-hover:text-gray-400 select-none" title="Drag to reorder">
        ⠿
      </div>

      <div className="flex flex-1 flex-wrap gap-2">
        {/* Reagent name */}
        <div className="flex min-w-[160px] flex-1">
          <input
            value={comp.reagentName}
            onChange={(e) => onChange(index, "reagentName", e.target.value)}
            placeholder="Reagent name"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400"
          />
        </div>

        {/* Concentration */}
        <input
          type="number"
          value={comp.concentration ?? ""}
          onChange={(e) => onChange(index, "concentration", e.target.value === "" ? null : parseFloat(e.target.value))}
          placeholder="Conc."
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400"
        />

        {/* Unit */}
        <input
          value={comp.unit}
          onChange={(e) => onChange(index, "unit", e.target.value)}
          placeholder="Unit"
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400"
        />

        {/* Notes */}
        <input
          value={comp.notes}
          onChange={(e) => onChange(index, "notes", e.target.value)}
          placeholder="Notes (e.g. pH 8.0)"
          className="min-w-[100px] flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400"
        />
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="mt-1.5 shrink-0 text-gray-400 hover:text-red-500 transition"
        title="Remove component"
      >
        ×
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RecipeEditorPanel — slide-in right panel
// ─────────────────────────────────────────────────────────────────────────────

function RecipeEditorPanel({
  recipe,
  currentUser,
  authHeaders,
  onSave,
  onClose,
}: {
  recipe: Recipe | null; // null = new recipe
  currentUser: { id: string; name: string; role: string };
  authHeaders: Record<string, string>;
  onSave: (saved: Recipe) => void;
  onClose: () => void;
}) {
  const isNew      = recipe === null;
  const canEdit    = isNew || canEditRecipe(recipe!, currentUser.id, currentUser.role);

  const [name,        setName]        = useState(recipe?.name        ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [notes,       setNotes]       = useState(recipe?.notes       ?? "");
  const [components,  setComponents]  = useState<Component[]>(
    recipe?.components.map((c) => ({ ...c })) ?? []
  );
  const [nameError,  setNameError]  = useState("");
  const [saving,     setSaving]     = useState(false);
  const dragIndexRef = useRef<number | null>(null);

  // ── Component helpers ──────────────────────────────────────────────────────

  function handleComponentChange(index: number, field: keyof Component, value: string | number | null) {
    setComponents((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }

  function addComponent() {
    setComponents((prev) => [
      ...prev,
      { reagentName: "", concentration: null, unit: "", notes: "", order: prev.length, inventoryId: "", inventoryName: "" },
    ]);
  }

  function removeComponent(index: number) {
    setComponents((prev) => prev.filter((_, i) => i !== index).map((c, i) => ({ ...c, order: i })));
  }

  function handleDragStart(index: number) { dragIndexRef.current = index; }
  function handleDragOver(e: React.DragEvent, _index: number) { e.preventDefault(); }
  function handleDrop(targetIndex: number) {
    const from = dragIndexRef.current;
    if (from === null || from === targetIndex) return;
    setComponents((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIndex, 0, moved);
      return next.map((c, i) => ({ ...c, order: i }));
    });
    dragIndexRef.current = null;
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!name.trim()) { setNameError("Recipe name is required."); return; }
    setNameError("");
    setSaving(true);
    try {
      const payload = {
        name:          name.trim(),
        description:   description.trim(),
        notes:         notes.trim(),
        components:    components.map((c, i) => ({ ...c, order: i })),
        requesterId:   currentUser.id,
        requesterRole: currentUser.role,
        createdById:   currentUser.id,
      };

      const url    = isNew ? "/api/recipes" : `/api/recipes/${recipe!.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        alert(err.error ?? "Failed to save recipe.");
        return;
      }

      const saved = (await res.json()) as Recipe;
      onSave(saved);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">
              {isNew ? "New Recipe" : (canEdit ? recipe!.name : recipe!.name)}
            </h2>
            {!canEdit && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">🔒 Read-only</span>
            )}
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            {canEdit ? (
              <>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(""); }}
                  placeholder="e.g. Lysis Buffer"
                  className={`w-full rounded border px-3 py-2 text-gray-900 ${
                    nameError ? "border-red-400 bg-red-50" : "border-gray-300"
                  }`}
                />
                {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
              </>
            ) : (
              <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{name || "—"}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            {canEdit ? (
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
                className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
              />
            ) : (
              <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{description || "—"}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            {canEdit ? (
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Storage conditions, preparation notes, hazards…"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
              />
            ) : (
              <p className="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {notes || "—"}
              </p>
            )}
          </div>

          {/* Components */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Components</label>
              {canEdit && (
                <span className="text-xs text-gray-400">Drag rows to reorder</span>
              )}
            </div>

            {components.length === 0 && (
              <p className="text-sm text-gray-400 italic">No components yet.</p>
            )}

            {canEdit ? (
              <div className="space-y-2">
                {components.map((comp, i) => (
                  <ComponentRow
                    key={i}
                    comp={comp}
                    index={i}
                    onChange={handleComponentChange}
                    onRemove={removeComponent}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                ))}
                <button
                  type="button"
                  onClick={addComponent}
                  className="mt-1 flex items-center gap-1 rounded border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition"
                >
                  + Add Component
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {components.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No components.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs text-gray-500">
                        <th className="pb-1 pr-3 text-left font-medium">Reagent</th>
                        <th className="pb-1 pr-3 text-right font-medium">Conc.</th>
                        <th className="pb-1 pr-3 text-left font-medium">Unit</th>
                        <th className="pb-1 text-left font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((c, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0">
                          <td className="py-1 pr-3 text-gray-800">
                            <span className="inline-flex items-center gap-1">
                              {c.inventoryId && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                              {c.reagentName || "—"}
                            </span>
                          </td>
                          <td className="py-1 pr-3 text-right text-gray-600 tabular-nums">
                            {c.concentration ?? "—"}
                          </td>
                          <td className="py-1 pr-3 text-gray-600">{c.unit || "—"}</td>
                          <td className="py-1 text-gray-500 italic">{c.notes || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Metadata */}
          {!isNew && (
            <div className="border-t border-gray-100 pt-4 text-xs text-gray-400 space-y-0.5">
              <p>Created by <span className="text-gray-600">{recipe!.createdBy.name}</span></p>
              <p>Created {new Date(recipe!.createdAt).toLocaleDateString()}</p>
              <p>Last updated {new Date(recipe!.updatedAt).toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-200 px-5 py-3">
          {canEdit ? (
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : (isNew ? "Create Recipe" : "Save Changes")}
              </button>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RecipeCard
// ─────────────────────────────────────────────────────────────────────────────

function RecipeCard({
  recipe,
  canEdit,
  onClick,
  onDelete,
}: {
  recipe: Recipe;
  canEdit: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const n = recipe.notes ?? "";
  const notesPreview = n.length > 80 ? n.slice(0, 80) + "…" : n;

  return (
    <div
      onClick={onClick}
      className="block cursor-pointer rounded border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-600 hover:bg-zinc-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">{recipe.name}</h3>
            <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {recipe.components.length} component{recipe.components.length !== 1 ? "s" : ""}
            </span>
          </div>
          {recipe.description && (
            <p className="mt-0.5 text-xs text-zinc-400">{recipe.description}</p>
          )}
          {recipe.notes && (
            <p className="mt-1 text-xs text-zinc-500 italic">{notesPreview}</p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            By {recipe.createdBy.name} · Updated {new Date(recipe.updatedAt).toLocaleDateString()}
          </p>
        </div>

        {canEdit && (
          <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onClick}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-red-700 hover:text-red-400 transition"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

import { Suspense } from "react";
export default function RecipesPage() {
  return (
    <Suspense>
      <RecipesPageContent />
    </Suspense>
  );
}

function RecipesPageContent() {
  const currentUser = useMemo(() => {
    if (typeof window === "undefined") return { id: "finn-user", name: "Finn", role: "MEMBER" as const };
    return getCurrentUser();
  }, []);

  const authHeaders = useMemo(
    () => ({
      "x-user-id":   currentUser.id,
      "x-user-name": currentUser.name,
      "x-user-role": currentUser.role,
    }),
    [currentUser]
  );

  const [recipes,     setRecipes]     = useState<Recipe[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [editorOpen,  setEditorOpen]  = useState(false);
  const [editTarget,  setEditTarget]  = useState<Recipe | null>(null); // null = new
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);

  // Load recipes
  const loadRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recipes", { headers: authHeaders });
      if (res.ok) setRecipes((await res.json()) as Recipe[]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { void loadRecipes(); }, [loadRecipes]);

  // Client-side filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [recipes, search]);

  // Editor open/close
  function openNew() {
    setEditTarget(null);
    setEditorOpen(true);
  }

  function openEdit(recipe: Recipe) {
    setEditTarget(recipe);
    setEditorOpen(true);
  }

  function handleSaved(saved: Recipe) {
    setRecipes((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    setEditorOpen(false);
  }

  // Delete
  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await fetch(
      `/api/recipes/${deleteTarget.id}?requesterId=${currentUser.id}&requesterRole=${currentUser.role}`,
      { method: "DELETE", headers: authHeaders }
    );
    if (res.ok || res.status === 204) {
      setRecipes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppTopNav />
      <ProtocolsRunsSubNav />

      {/* Page content */}
      <div className="flex flex-col gap-3 p-6">
        {/* Header row — sits on a border like the protocol tab bar */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <h1 className="text-xl font-bold text-zinc-100">Recipes</h1>
          <button
            onClick={openNew}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
          >
            + New Recipe
          </button>
        </div>

        {/* Search */}
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes…"
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        {/* List */}
        {loading ? (
          <p className="text-center text-sm text-zinc-500">Loading recipes…</p>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">
              {search ? `No recipes matching "${search}".` : "No recipes yet. Create your first recipe with + New Recipe."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                canEdit={canEditRecipe(recipe, currentUser.id, currentUser.role)}
                onClick={() => openEdit(recipe)}
                onDelete={() => setDeleteTarget(recipe)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Editor panel */}
      {editorOpen && (
        <RecipeEditorPanel
          recipe={editTarget}
          currentUser={currentUser}
          authHeaders={authHeaders}
          onSave={handleSaved}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          recipeName={deleteTarget.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
