import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/auth";

// POST /api/auth/logout — clears the session row + cookie.
export async function POST() {
  try {
    await destroyCurrentSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/logout failed:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
