import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Generate a unique batch ID: <PREFIX>-<YYYYMMDD>-<A/B/C/...>
async function generateBatchId(stockId: string, proteinName: string, purificationDate: Date): Promise<string> {
  const prefix = proteinName
    .replace(/[^A-Za-z0-9]/g, "")
    .substring(0, 6)
    .toUpperCase();
  const dateStr = purificationDate.toISOString().slice(0, 10).replace(/-/g, "");
  const base = `${prefix}-${dateStr}`;

  // Find existing batches with same base to determine suffix letter
  const existing = await prisma.proteinBatch.findMany({
    where: { batchId: { startsWith: base } },
    select: { batchId: true },
    orderBy: { batchId: "asc" },
  });

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const usedSuffixes = new Set(existing.map((b) => b.batchId.split("-")[2]));
  const suffix = letters.split("").find((l) => !usedSuffixes.has(l)) ?? "Z";

  return `${base}-${suffix}`;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const batches = await prisma.proteinBatch.findMany({
      where: { stockId: params.id },
      orderBy: { purificationDate: "desc" },
    });
    return NextResponse.json(batches);
  } catch (error) {
    console.error("GET batches failed:", error);
    return NextResponse.json({ error: "Failed to load batches" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const createdBy = req.headers.get("x-user-name") ?? "Unknown";

    // Verify the stock exists and get name for batch ID generation
    const stock = await prisma.proteinStock.findUnique({
      where: { id: params.id },
      select: { name: true },
    });
    if (!stock) return NextResponse.json({ error: "Protein stock not found" }, { status: 404 });

    const purificationDate = new Date(body.purificationDate);
    if (isNaN(purificationDate.getTime())) {
      return NextResponse.json({ error: "Invalid purification date" }, { status: 400 });
    }
    if (!body.initialVolume || Number(body.initialVolume) <= 0) {
      return NextResponse.json({ error: "Initial volume is required and must be > 0" }, { status: 400 });
    }

    const batchId = await generateBatchId(params.id, stock.name, purificationDate);
    const initialVolume = Number(body.initialVolume);

    const batch = await prisma.proteinBatch.create({
      data: {
        batchId,
        stockId: params.id,
        purificationDate,
        initialVolume,
        currentVolume: initialVolume, // starts at full volume
        concentration: body.concentration != null ? Number(body.concentration) : null,
        mw: body.mw != null ? Number(body.mw) : null,
        extinctionCoeff: body.extinctionCoeff != null ? Number(body.extinctionCoeff) : null,
        a280: body.a280 != null ? Number(body.a280) : null,
        storageBuffer: body.storageBuffer?.trim() || null,
        storageLocationText: body.storageLocationText?.trim() || null,
        lowThresholdType: body.lowThresholdType || null,
        lowThresholdAmber: body.lowThresholdAmber != null ? Number(body.lowThresholdAmber) : null,
        lowThresholdRed: body.lowThresholdRed != null ? Number(body.lowThresholdRed) : null,
        notes: body.notes?.trim() || null,
        createdBy,
      },
    });

    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    console.error("POST batch failed:", error);
    return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
  }
}
