import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Canonical Labrador ELN user ids always follow the "{shortname}-user" pattern
// (finn-user, jake-user, admin-user, pb-user, marceline-user). Legacy/duplicate
// rows (UUIDs, "user-finn", @labrador.eln seeds) do not match this pattern.
const CANONICAL_ID_RE = /^[a-z]+-user$/;

// GET /api/projects/members
// Returns distinct users (by name) available to add as project members.
// Deduplicates the DB which contains both @local.eln and @labrador.eln rows
// for the same people — keeps one row per unique name, ordered name ascending.
// When multiple rows share a name, prefers the canonical "{shortname}-user" id
// so downstream ProjectMember rows always reference a stable, canonical User.id.
export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Deduplicate by name — keep first occurrence, but prefer canonical ids
  const byName = new Map<string, { id: string; name: string | null }>();
  for (const u of users) {
    const key = (u.name ?? "").toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, u);
    } else if (!CANONICAL_ID_RE.test(existing.id) && CANONICAL_ID_RE.test(u.id)) {
      byName.set(key, u);
    }
  }

  return NextResponse.json(Array.from(byName.values()));
}
