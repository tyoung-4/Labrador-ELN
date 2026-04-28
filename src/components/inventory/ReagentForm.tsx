"use client";

import React, { useState } from "react";

type ReagentFormProps = {
  currentUser: string;
  existing?: any;
  onSuccess: (reagent: any) => void;
  onCancel: () => void;
};

export default function ReagentForm({
  currentUser,
  existing,
  onSuccess,
  onCancel,
}: ReagentFormProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? "general");
  const [quantity, setQuantity] = useState(existing?.quantity ?? "");
  const [unit, setUnit] = useState(existing?.unit ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [supplier, setSupplier] = useState(existing?.supplier ?? "");
  const [catalogNumber, setCatalogNumber] = useState(existing?.catalogNumber ?? "");
  const [lotNumber, setLotNumber] = useState(existing?.lotNumber ?? "");
  const [expiryDate, setExpiryDate] = useState(existing?.expiryDate ?? "");
  const [lowThresholdType, setLowThresholdType] = useState(existing?.lowThresholdType ?? "none");
  const [lowThresholdAmber, setLowThresholdAmber] = useState(existing?.lowThresholdAmber ?? "");
  const [lowThresholdRed, setLowThresholdRed] = useState(existing?.lowThresholdRed ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const thresholdError =
    lowThresholdType !== "none" &&
    lowThresholdAmber &&
    lowThresholdRed &&
    parseFloat(lowThresholdRed) >= parseFloat(lowThresholdAmber);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (thresholdError) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/inventory/reagents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": currentUser,
        },
        body: JSON.stringify({
          name: name.trim(),
          category,
          quantity: quantity ? parseFloat(quantity) : null,
          unit: unit.trim() || null,
          location: location.trim() || null,
          vendor: supplier.trim() || null,
          catalogNumber: catalogNumber.trim() || null,
          lotNumber: lotNumber.trim() || null,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          lowStockThreshold: null,
          notes: notes.trim() || null,
          owner: currentUser,
        }),
      });
      if (!res.ok) throw new Error("Failed to create reagent");
      const item = await res.json();
      onSuccess(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating reagent");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ampicillin, 1.5 mL tubes"
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Category */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Category
        </label>
        <div className="flex gap-2">
          {["general", "reagent"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-sm rounded px-4 py-1.5 border transition-colors ${
                category === cat
                  ? "bg-purple-500/20 border-purple-500 text-purple-300"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
              }`}
            >
              {cat === "general" ? "Reagent" : "Consumable"}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity & Unit */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            Quantity
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="0"
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            Unit
          </label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="mL, mg, boxes..."
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Location
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Flammables cabinet, Room temp shelf 2"
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Supplier */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Supplier
        </label>
        <input
          type="text"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Catalog & Lot */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            Catalog Number
          </label>
          <input
            type="text"
            value={catalogNumber}
            onChange={(e) => setCatalogNumber(e.target.value)}
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
            Lot Number
          </label>
          <input
            type="text"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        </div>
      </div>

      {/* Expiry Date */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Expiry Date
        </label>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Footer */}
      <div className="flex justify-end gap-3 pt-2 border-t border-white/10 mt-4">
        <button
          onClick={onCancel}
          className="text-sm text-gray-400 hover:text-white px-4 py-2 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || submitting}
          className={`text-sm rounded px-4 py-2 font-medium transition-colors ${
            !name.trim() || submitting
              ? "bg-purple-600/40 text-white/40 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700 text-white"
          }`}
        >
          {submitting ? "Adding..." : "Add Reagent"}
        </button>
      </div>
    </div>
  );
}
