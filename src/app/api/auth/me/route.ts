import { NextResponse } from "next/server";
import { getServerActor } from "@/lib/auth";

// GET /api/auth/me — the current session's actor, or null when unauthenticated.
export async function GET() {
  const actor = await getServerActor();
  return NextResponse.json({ actor });
}
