import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/recipes — list all recipes with components
export async function GET() {
  const recipes = await prisma.recipe.findMany({
    include: {
      components: { orderBy: { order: "asc" } },
      createdBy:  { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(recipes);
}

// POST /api/recipes — create a new recipe
export async function POST(req: Request) {
  const body = await req.json();
  const { name, description = "", components = [], createdById } = body;

  if (!name || !createdById) {
    return NextResponse.json({ error: "name and createdById are required" }, { status: 400 });
  }

  const recipe = await prisma.recipe.create({
    data: {
      name,
      description,
      createdById,
      components: {
        create: (components as {
          reagentName: string;
          concentration?: number;
          unit?: string;
          notes?: string;
          order?: number;
        }[]).map((c, i) => ({
          reagentName:   c.reagentName,
          concentration: c.concentration ?? null,
          unit:          c.unit  ?? "",
          notes:         c.notes ?? "",
          order:         c.order ?? i,
        })),
      },
    },
    include: {
      components: { orderBy: { order: "asc" } },
      createdBy:  { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(recipe, { status: 201 });
}
