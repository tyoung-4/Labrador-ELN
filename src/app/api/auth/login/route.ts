import { NextResponse } from "next/server";
import { verifyCredentials, createSession } from "@/lib/auth";

// POST /api/auth/login  Body: { identifier, password }
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { identifier?: string; password?: string };
    const user = await verifyCredentials(body.identifier ?? "", body.password ?? "");
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
