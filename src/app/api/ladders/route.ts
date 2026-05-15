import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const ladders = await prisma.ladderDefinition.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(ladders);
}
