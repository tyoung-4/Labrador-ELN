import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerActor, isAdmin, setUserPassword } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

// PATCH /api/users/[id] — admin: change role, reset password, or (de)activate.
// Body: { role?, password?, isActive? }
export async function PATCH(request: Request, ctx: Ctx) {
  const actor = await getServerActor();
  if (!isAdmin(actor)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await ctx.params;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      role?: string; password?: string; isActive?: boolean;
    };
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) return new NextResponse(null, { status: 404 });

    const data: Record<string, unknown> = {};
    if (typeof body.role === "string") data.role = body.role.toUpperCase() === "ADMIN" ? "ADMIN" : "MEMBER";
    if (typeof body.isActive === "boolean") {
      // Don't let an admin lock themselves out.
      if (!body.isActive && id === actor!.id) {
        return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
      }
      data.isActive = body.isActive;
    }
    if (Object.keys(data).length > 0) await prisma.user.update({ where: { id }, data });

    if (typeof body.password === "string") {
      if (body.password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      await setUserPassword(id, body.password);
    }

    const user = await prisma.user.findUnique({
      where: { id }, select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error(`PATCH /api/users/${id} failed:`, error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
