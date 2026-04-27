import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TEMPLATE_CONFIGS, type TemplateType } from "@/lib/inventoryTemplates";

// ── Type helpers ─────────────────────────────────────────────────────────────

type Row = Record<string, string | null>;

function str(row: Row, key: string): string | undefined {
  const v = row[key];
  return v !== null && v !== undefined && v.trim() !== "" ? v.trim() : undefined;
}

function num(row: Row, key: string): number | null {
  const v = str(row, key);
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function int(row: Row, key: string): number | null {
  const v = str(row, key);
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function dateVal(row: Row, key: string): Date | null {
  const v = str(row, key);
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// ── Per-type importers ────────────────────────────────────────────────────────

async function importProteinStock(rows: Row[], owner: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = str(row, "name");
    if (!name) { skipped++; continue; }

    try {
      const conc = num(row, "concentration_mg_ml");
      const vol = num(row, "total_volume_ml");

      // Build notes from optional extended fields
      const noteParts: string[] = [];
      const addNote = (label: string, key: string) => {
        const v = str(row, key);
        if (v) noteParts.push(`${label}: ${v}`);
      };
      addNote("Expression System", "expression_system");
      addNote("IPTG (mM)", "iptg_mM");
      addNote("Induction Temp", "induction_temp_C");
      addNote("Induction Duration", "induction_duration");
      addNote("Purification Method", "purification_method");
      addNote("Storage Buffer", "storage_buffer");
      addNote("Linked Run", "linked_run_id");
      const userNotes = str(row, "notes");
      if (userNotes) noteParts.push(userNotes);

      const purity = str(row, "purity_percent");

      await prisma.proteinStock.create({
        data: {
          name,
          concentration: conc,
          concUnit: conc !== null ? "mg/mL" : undefined,
          volume: vol,
          volUnit: vol !== null ? "mL" : undefined,
          purity: purity ? `${purity}%` : undefined,
          location: str(row, "location") ?? null,
          owner: str(row, "owner") ?? owner,
          notes: noteParts.length > 0 ? noteParts.join("\n") : undefined,
          tags: [],
        },
      });
      imported++;
    } catch (e) {
      errors.push(`Row "${name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { imported, skipped, errors };
}

async function importAntibody(rows: Row[], owner: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = str(row, "name");
    if (!name) { skipped++; continue; }

    try {
      const noteParts: string[] = [];
      const addNote = (label: string, key: string) => {
        const v = str(row, key);
        if (v) noteParts.push(`${label}: ${v}`);
      };
      const subtype = str(row, "subtype") ?? "Other";
      addNote("Subtype", "subtype");
      addNote("Target", "target");
      addNote("Host", "host");
      addNote("Clone", "clone");
      addNote("Lot Number", "lot_number");
      addNote("Volume/Aliquot (µL)", "vol_per_aliquot_ul");
      addNote("# Aliquots", "num_aliquots");
      addNote("Fluorophore", "fluorophore");
      addNote("Application", "application");
      addNote("Dilution Factor", "dilution_factor");
      addNote("Conjugate Type", "conjugate_type");
      const userNotes = str(row, "notes");
      if (userNotes) noteParts.push(userNotes);

      await prisma.inventoryReagent.create({
        data: {
          name,
          category: `antibody-${subtype.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          quantity: num(row, "num_aliquots"),
          unit: "aliquot",
          concentration: num(row, "concentration_mg_ml"),
          concUnit: "mg/mL",
          location: str(row, "location") ?? null,
          catalogNumber: str(row, "catalog_number") ?? null,
          vendor: str(row, "vendor") ?? null,
          lotNumber: str(row, "lot_number") ?? null,
          expiryDate: dateVal(row, "expiration_date"),
          owner: str(row, "owner") ?? owner,
          notes: noteParts.length > 0 ? noteParts.join("\n") : undefined,
          tags: [],
        },
      });
      imported++;
    } catch (e) {
      errors.push(`Row "${name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { imported, skipped, errors };
}

async function importClinicalAntibody(rows: Row[], owner: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = str(row, "name");
    if (!name) { skipped++; continue; }

    try {
      const noteParts: string[] = [];
      const addNote = (label: string, key: string) => {
        const v = str(row, key);
        if (v) noteParts.push(`${label}: ${v}`);
      };
      addNote("Target", "target");
      addNote("Clinical Lot Number", "clinical_lot_number");
      addNote("Storage Condition", "storage_condition");
      addNote("Originating Institution", "originating_institution");
      const userNotes = str(row, "notes");
      if (userNotes) noteParts.push(userNotes);

      await prisma.inventoryReagent.create({
        data: {
          name,
          category: "clinical-antibody",
          concentration: num(row, "concentration_mg_ml"),
          concUnit: "mg/mL",
          quantity: num(row, "total_volume_ml"),
          unit: "mL",
          location: str(row, "location") ?? null,
          owner: str(row, "owner") ?? owner,
          notes: noteParts.length > 0 ? noteParts.join("\n") : undefined,
          tags: [],
        },
      });
      imported++;
    } catch (e) {
      errors.push(`Row "${name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { imported, skipped, errors };
}

async function importGeneralReagent(rows: Row[], owner: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = str(row, "name");
    if (!name) { skipped++; continue; }

    try {
      await prisma.inventoryReagent.create({
        data: {
          name,
          category: "general",
          quantity: num(row, "quantity"),
          unit: str(row, "unit") ?? null,
          location: str(row, "location") ?? null,
          catalogNumber: str(row, "catalog_number") ?? null,
          vendor: str(row, "vendor") ?? null,
          expiryDate: dateVal(row, "expiration_date"),
          owner: str(row, "owner") ?? owner,
          notes: str(row, "notes") ?? null,
          tags: [],
        },
      });
      imported++;
    } catch (e) {
      errors.push(`Row "${name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { imported, skipped, errors };
}

async function importCellLine(rows: Row[], owner: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = str(row, "name");
    if (!name) { skipped++; continue; }

    try {
      const noteParts: string[] = [];
      const addNote = (label: string, key: string) => {
        const v = str(row, key);
        if (v) noteParts.push(`${label}: ${v}`);
      };
      addNote("Cells/Vial (×10⁶)", "cells_per_vial");
      addNote("# Vials", "vial_count");
      addNote("Tube Code", "tube_code");
      addNote("Source", "source");
      addNote("Medium", "medium");
      addNote("Mycoplasma Test Date", "mycoplasma_test_date");
      addNote("Authentication Date", "authentication_date");
      const userNotes = str(row, "notes");
      if (userNotes) noteParts.push(userNotes);

      await prisma.cellLine.create({
        data: {
          name,
          passage: int(row, "passage_at_freeze"),
          location: str(row, "location") ?? null,
          owner: str(row, "owner") ?? owner,
          notes: noteParts.length > 0 ? noteParts.join("\n") : undefined,
          tags: [],
        },
      });
      imported++;
    } catch (e) {
      errors.push(`Row "${name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { imported, skipped, errors };
}

async function importPlasmid(rows: Row[], owner: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = str(row, "name");
    if (!name) { skipped++; continue; }

    try {
      const noteParts: string[] = [];
      const addNote = (label: string, key: string) => {
        const v = str(row, key);
        if (v) noteParts.push(`${label}: ${v}`);
      };
      addNote("Bacterial Strain", "bacterial_strain");
      addNote("Concentration (ng/µL)", "concentration_ng_ul");
      addNote("Volume (µL)", "volume_ul");
      addNote("Sequence File", "sequence_file_name");
      const userNotes = str(row, "notes");
      if (userNotes) noteParts.push(userNotes);

      await prisma.plasmid.create({
        data: {
          name,
          backbone: str(row, "backbone") ?? null,
          resistance: str(row, "resistance_marker") ?? null,
          insert: str(row, "insert_gene") ?? null,
          location: str(row, "location") ?? null,
          owner: str(row, "owner") ?? owner,
          notes: noteParts.length > 0 ? noteParts.join("\n") : undefined,
          tags: [],
        },
      });
      imported++;
    } catch (e) {
      errors.push(`Row "${name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { imported, skipped, errors };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, rows } = body as { type: TemplateType; rows: Row[] };
    const owner = req.headers.get("x-user-name") ?? "Unknown";

    // Validate type
    if (!type || !(type in TEMPLATE_CONFIGS)) {
      return NextResponse.json({ error: "Invalid template type" }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    // Server-side: filter rows missing name
    const namedRows = rows.filter((r) => {
      const n = r["name"];
      return n !== null && n !== undefined && String(n).trim().length > 0;
    });
    const skippedNoName = rows.length - namedRows.length;

    let result: { imported: number; skipped: number; errors: string[] };

    switch (type) {
      case "protein_stock":
        result = await importProteinStock(namedRows, owner);
        break;
      case "antibody":
        result = await importAntibody(namedRows, owner);
        break;
      case "clinical_antibody":
        result = await importClinicalAntibody(namedRows, owner);
        break;
      case "general_reagent":
        result = await importGeneralReagent(namedRows, owner);
        break;
      case "cell_line":
        result = await importCellLine(namedRows, owner);
        break;
      case "plasmid":
        result = await importPlasmid(namedRows, owner);
        break;
      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }

    return NextResponse.json({
      imported: result.imported,
      skipped: result.skipped + skippedNoName,
      errors: result.errors,
    });
  } catch (error) {
    console.error("POST /api/inventory/import-template failed:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
