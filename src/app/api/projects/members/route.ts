import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/projects/members
// Returns distinct users (by name) available to add as project members.
// Deduplicates the DB which contains both @local.eln and @labrador.eln rows
// for the same people — keeps one row per unique name, ordered name ascending.
export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Deduplicate by name — keep first occurrence per unique name
  const seen = new Set<string>();
  const unique = users.filter((u) => {
    const key = (u.name ?? "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json(unique);
}
