import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export type ImportCategory = "reagent" | "antibody" | "cellLine" | "plasmid" | "proteinStock";

export interface MappedRow {
  name: string;
  [key: string]: unknown;
}

const NULL_NAME_VALUES = new Set(["taken", "empty", "n/a", "na", "-", "--", ""]);

function isNullName(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  return NULL_NAME_VALUES.has(String(v).trim().toLowerCase());
}

function buildNotes(base: string | undefined, extras: Record<string, unknown>): string {
  const parts: string[] = [];
  if (base) parts.push(base);
  for (const [k, v] of Object.entries(extras)) {
    if (v !== null && v !== undefined && String(v).trim() !== "") {
      parts.push(`${k}: ${v}`);
    }
  }
  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { category, rows }: { category: ImportCategory; rows: MappedRow[] } = body;

  if (!category || !Array.isArray(rows)) {
    return NextResponse.json({ error: "category and rows required" }, { status: 400 });
  }

  const validRows = rows.filter((r) => !isNullName(r.name));
  let created = 0;
  let skipped = rows.length - validRows.length;
  const errors: string[] = [];

  try {
    if (category === "reagent" || category === "antibody") {
      const records = validRows.map((r) => {
        const { name, category: cat, quantity, unit, concentration, concUnit, location, lotNumber, catalogNumber, vendor, expiryDate, owner, notes, tags, lowStockThreshold, initialQuantity, ...rest } = r as Record<string, unknown>;
        return {
          name: String(name),
          category: String(cat ?? (category === "antibody" ? "antibody" : "general")),
          quantity: quantity !== undefined && quantity !== null ? Number(quantity) : null,
          initialQuantity: initialQuantity !== undefined && initialQuantity !== null ? Number(initialQuantity) : (quantity !== undefined && quantity !== null ? Number(quantity) : null),
          unit: unit ? String(unit) : null,
          concentration: concentration !== undefined && concentration !== null ? Number(concentration) : null,
          concUnit: concUnit ? String(concUnit) : null,
          location: location ? String(location) : null,
          lotNumber: lotNumber ? String(lotNumber) : null,
          catalogNumber: catalogNumber ? String(catalogNumber) : null,
          vendor: vendor ? String(vendor) : null,
          expiryDate: expiryDate ? new Date(String(expiryDate)) : null,
          owner: owner ? String(owner) : null,
          notes: buildNotes(notes ? String(notes) : undefined, rest as Record<string, unknown>),
          tags: Array.isArray(tags) ? tags : [],
          lowStockThreshold: lowStockThreshold !== undefined && lowStockThreshold !== null ? Number(lowStockThreshold) : null,
        };
      });
      await prisma.$transaction(records.map((d) => prisma.inventoryReagent.create({ data: d })));
      created = records.length;
    } else if (category === "cellLine") {
      const records = validRows.map((r) => {
        const { name, species, tissue, morphology, passage, location, owner, notes, tags, ...rest } = r as Record<string, unknown>;
        return {
          name: String(name),
          species: species ? String(species) : null,
          tissue: tissue ? String(tissue) : null,
          morphology: morphology ? String(morphology) : null,
          passage: passage !== undefined && passage !== null ? Number(passage) : null,
          location: location ? String(location) : null,
          owner: owner ? String(owner) : null,
          notes: buildNotes(notes ? String(notes) : undefined, rest as Record<string, unknown>),
          tags: Array.isArray(tags) ? tags : [],
        };
      });
      await prisma.$transaction(records.map((d) => prisma.cellLine.create({ data: d })));
      created = records.length;
    } else if (category === "plasmid") {
      const records = validRows.map((r) => {
        const { name, backbone, insert, resistance, promoter, location, owner, notes, tags, ...rest } = r as Record<string, unknown>;
        return {
          name: String(name),
          backbone: backbone ? String(backbone) : null,
          insert: insert ? String(insert) : null,
          resistance: resistance ? String(resistance) : null,
          promoter: promoter ? String(promoter) : null,
          location: location ? String(location) : null,
          owner: owner ? String(owner) : null,
          notes: buildNotes(notes ? String(notes) : undefined, rest as Record<string, unknown>),
          tags: Array.isArray(tags) ? tags : [],
        };
      });
      await prisma.$transaction(records.map((d) => prisma.plasmid.create({ data: d })));
      created = records.length;
    } else if (category === "proteinStock") {
      const records = validRows.map((r) => {
        const { name, concentration, concUnit, volume, volUnit, purity, location, owner, notes, tags, ...rest } = r as Record<string, unknown>;
        return {
          name: String(name),
          concentration: concentration !== undefined && concentration !== null ? Number(concentration) : null,
          concUnit: concUnit ? String(concUnit) : null,
          volume: volume !== undefined && volume !== null ? Number(volume) : null,
          volUnit: volUnit ? String(volUnit) : null,
          purity: purity ? String(purity) : null,
          location: location ? String(location) : null,
          owner: owner ? String(owner) : null,
          notes: buildNotes(notes ? String(notes) : undefined, rest as Record<string, unknown>),
          tags: Array.isArray(tags) ? tags : [],
        };
      });
      await prisma.$transaction(records.map((d) => prisma.proteinStock.create({ data: d })));
      created = records.length;
    }
  } catch (e) {
    errors.push(String(e));
  }

  return NextResponse.json({ created, skipped, errors });
}
