import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest } from "@/lib/auth";

// GET /api/antibodies?owner=&search=&archived=false
// Lists antibodies (default: active only) with annotation + binder counts.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner")?.trim();
  const search = searchParams.get("search")?.trim();
  const archived = searchParams.get("archived") === "true";

  const antibodies = await prisma.antibody.findMany({
    where: {
      isArchived: archived,
      ...(owner ? { owner: { equals: owner, mode: "insensitive" } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { parentName: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { annotations: true, binders: true } } },
  });

  return NextResponse.json(antibodies);
}

// POST /api/antibodies — create an antibody. Identity comes from the session
// actor (owner = createdBy = actor). Body only supplies design metadata.
export async function POST(req: NextRequest) {
  const actor = await getActorFromRequest(req);
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const antibody = await prisma.antibody.create({
    data: {
      name,
      parentName: typeof body.parentName === "string" && body.parentName.trim() ? body.parentName.trim() : null,
      format: typeof body.format === "string" && body.format.trim() ? body.format.trim() : "IgG1",
      isSymmetric: typeof body.isSymmetric === "boolean" ? body.isSymmetric : true,
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      proteinStockId: typeof body.proteinStockId === "string" && body.proteinStockId ? body.proteinStockId : null,
      owner: actor.name,
      createdBy: actor.name,
    },
  });

  return NextResponse.json({ success: true, antibody }, { status: 201 });
}
