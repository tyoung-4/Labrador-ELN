import { NextResponse } from "next/server";
import { getServerActor, verifyUserPassword, setUserPassword } from "@/lib/auth";

// POST /api/auth/change-password  Body: { currentPassword, newPassword }
// Any logged-in user can change their own password.
export async function POST(request: Request) {
  const actor = await getServerActor();
  if (!actor) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const { currentPassword, newPassword } = (await request.json().catch(() => ({}))) as {
      currentPassword?: string; newPassword?: string;
    };
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }
    const ok = await verifyUserPassword(actor.id, currentPassword ?? "");
    if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });

    await setUserPassword(actor.id, newPassword);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/change-password failed:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
