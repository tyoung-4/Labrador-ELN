import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSession, destroyCurrentSession } from "@/lib/auth";

// POST /api/auth/dev-login  Body: { userId }
// Dev/sandbox convenience: the "Login as …" switcher creates a real session for
// the chosen user (no password), so the UI identity and the server-trusted
// session always agree. DISABLED in production — there it would be a passwordless
// auth bypass; real login goes through /api/auth/login.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  try {
    const { userId } = (await request.json().catch(() => ({}))) as { userId?: string };
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Unknown user" }, { status: 404 });

    await destroyCurrentSession();
    await createSession(user.id);
    return NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    console.error("POST /api/auth/dev-login failed:", error);
    return NextResponse.json({ error: "Dev login failed" }, { status: 500 });
  }
}
