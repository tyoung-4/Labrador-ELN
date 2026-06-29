import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSession, destroyCurrentSession } from "@/lib/auth";
import { GUEST_ENTRY_ENABLED, GUEST_USER_IDS, DEFAULT_GUEST_ID } from "@/lib/demo";

// POST /api/auth/guest-login  Body: { userId? }
// One-click entry for the public demo: creates a real session for a seeded
// persona (no password). Disabled in non-demo production.
export async function POST(request: Request) {
  if (!GUEST_ENTRY_ENABLED) {
    return NextResponse.json({ error: "Guest entry is disabled" }, { status: 403 });
  }
  try {
    const { userId } = (await request.json().catch(() => ({}))) as { userId?: string };
    const id =
      userId && (GUEST_USER_IDS as readonly string[]).includes(userId) ? userId : DEFAULT_GUEST_ID;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { error: "Demo user not found — has the database been seeded?" },
        { status: 404 }
      );
    }

    await destroyCurrentSession();
    await createSession(user.id);
    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("POST /api/auth/guest-login failed:", error);
    return NextResponse.json({ error: "Guest login failed" }, { status: 500 });
  }
}
