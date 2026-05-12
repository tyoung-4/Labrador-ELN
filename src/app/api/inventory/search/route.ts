import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export type InventorySearchResult = {
  id: string;
  type: "reagent" | "stock" | "plasmid" | "cellline";
  name: string;
  detail: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);

  const filter = { contains: q, mode: "insensitive" as const };

  const [reagents, stocks, plasmids, cellLines] = await Promise.all([
    prisma.inventoryReagent.findMany({
      where: { name: filter, isArchived: false },
      select: { id: true, name: true, category: true, unit: true, quantity: true },
      take: 10,
    }),
    prisma.proteinStock.findMany({
      where: { name: filter },
      select: { id: true, name: true, concUnit: true, concentration: true },
      take: 10,
    }),
    prisma.plasmid.findMany({
      where: { name: filter },
      select: { id: true, name: true, backbone: true, insert: true },
      take: 10,
    }),
    prisma.cellLine.findMany({
      where: { name: filter },
      select: { id: true, name: true, species: true, tissue: true },
      take: 10,
    }),
  ]);

  const results: InventorySearchResult[] = [
    ...reagents.map((r) => ({
      id: r.id, type: "reagent" as const, name: r.name,
      detail: [r.category, r.quantity != null ? `${r.quantity} ${r.unit ?? ""}`.trim() : ""].filter(Boolean).join(" · "),
    })),
    ...stocks.map((r) => ({
      id: r.id, type: "stock" as const, name: r.name,
      detail: r.concentration != null ? `${r.concentration} ${r.concUnit ?? ""}`.trim() : "",
    })),
    ...plasmids.map((r) => ({
      id: r.id, type: "plasmid" as const, name: r.name,
      detail: [r.backbone, r.insert].filter(Boolean).join(" / "),
    })),
    ...cellLines.map((r) => ({
      id: r.id, type: "cellline" as const, name: r.name,
      detail: [r.species, r.tissue].filter(Boolean).join(" · "),
    })),
  ];

  return NextResponse.json(results);
}
