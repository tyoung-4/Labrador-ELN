import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerActor, isAdmin, hashPassword } from "@/lib/auth";

// GET /api/users — admin: list accounts.
export async function GET() {
  const actor = await getServerActor();
  if (!isAdmin(actor)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

// POST /api/users — admin: create an account. Body: { name, email, role, password }
export async function POST(request: Request) {
  const actor = await getServerActor();
  if (!isAdmin(actor)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string; email?: string; role?: string; password?: string;
    };
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const role = (body.role ?? "").toUpperCase() === "ADMIN" ? "ADMIN" : "MEMBER";
    const password = body.password ?? "";

    if (!name || !email || password.length < 6) {
      return NextResponse.json({ error: "Name, email and a password (≥6 chars) are required" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });

    const user = await prisma.user.create({
      data: { name, email, role, passwordHash: await hashPassword(password), isActive: true },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error) {
    console.error("POST /api/users failed:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
