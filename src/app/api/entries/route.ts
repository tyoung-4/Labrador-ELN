import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TECHNIQUE_OPTIONS, PROTOCOL_TECHNIQUES } from "@/models/entry";
import { Q5_TEMPLATE_ENTRY, Q5_TEMPLATE_ENTRY_ID } from "@/lib/defaultTemplates";
import { ENTRY_TYPE_CONFIGS } from "@/lib/entryTypes";
import type { EntryType } from "@prisma/client";

type Actor = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
};

function normalizeDescription(value: unknown): string {
  return String(value ?? "").trim().slice(0, 100);
}

function normalizeTechnique(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "General";
  // Accept both the legacy TECHNIQUE_OPTIONS (7 values) and the full
  // PROTOCOL_TECHNIQUES catalogue (21 values) so protocols created via
  // the creation modal keep their technique through subsequent saves.
  if (TECHNIQUE_OPTIONS.includes(raw as (typeof TECHNIQUE_OPTIONS)[number])) return raw;
  if (PROTOCOL_TECHNIQUES.includes(raw as (typeof PROTOCOL_TECHNIQUES)[number])) return raw;
  return "Other";
}

function normalizeEntryType(value: unknown): EntryType {
  const raw = String(value ?? "").trim().toUpperCase();
  return (raw in ENTRY_TYPE_CONFIGS ? raw : "GENERAL") as EntryType;
}

function normalizeTypedData(value: unknown): object {
  if (value && typeof value === "object") return value;
  return {};
}

function getActorFromRequest(request?: Request): Actor {
  const headerId = request?.headers.get("x-user-id")?.trim();
  const headerName = request?.headers.get("x-user-name")?.trim();
  const headerRole = request?.headers.get("x-user-role")?.trim().toUpperCase();

  const name = headerName || "Finn";
  const safeId = headerId || `user-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "member"}`;
  const role: "ADMIN" | "MEMBER" = headerRole === "ADMIN" ? "ADMIN" : "MEMBER";

  return {
    id: safeId,
    name,
    email: `${safeId}@local.eln`,
    role,
  };
}

async function ensureActor(actor: Actor) {
  return prisma.user.upsert({
    where: { id: actor.id },
    create: {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
    },
    update: {
      name: actor.name,
      role: actor.role,
    },
  });
}

async function ensureTemplateEntry() {
  await prisma.user.upsert({
    where: { id: "admin-user" },
    create: {
      id: "admin-user",
      name: "Admin",
      email: "admin-user@local.eln",
      role: "ADMIN",
    },
    update: {
      name: "Admin",
      role: "ADMIN",
    },
  });

  await prisma.entry.upsert({
    where: { id: Q5_TEMPLATE_ENTRY_ID },
    create: {
      id: Q5_TEMPLATE_ENTRY.id,
      title: Q5_TEMPLATE_ENTRY.title,
      description: Q5_TEMPLATE_ENTRY.description,
      technique: Q5_TEMPLATE_ENTRY.technique,
      body: Q5_TEMPLATE_ENTRY.body,
      authorId: "admin-user",
      version: 1,
    },
    update: {
      title: Q5_TEMPLATE_ENTRY.title,
      description: Q5_TEMPLATE_ENTRY.description,
      technique: Q5_TEMPLATE_ENTRY.technique,
      body: Q5_TEMPLATE_ENTRY.body,
      authorId: "admin-user",
    },
  });
}

export async function GET(request: Request) {
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);
    await ensureTemplateEntry();

    const entries = await prisma.entry.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, name: true, role: true },
        },
        linkedRun: {
          select: { id: true, title: true, status: true, createdAt: true },
        },
      },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("GET /api/entries failed:", error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to load entries", detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    const payload = await request.json().catch(() => ({}));
    const linkedRunId = payload.linkedRunId ? String(payload.linkedRunId).trim() : undefined;

    const created = await prisma.entry.create({
      data: {
        title: payload.title ?? "Untitled",
        description: normalizeDescription(payload.description),
        technique: normalizeTechnique(payload.technique),
        entryType: normalizeEntryType(payload.entryType),
        typedData: normalizeTypedData(payload.typedData),
        body: payload.body ?? "",
        authorId: actor.id,
        ...(linkedRunId ? { linkedRunId } : {}),
      },
      include: {
        author: {
          select: { id: true, name: true, role: true },
        },
        attachments: true,
        linkedRun: {
          select: { id: true, title: true, status: true, createdAt: true },
        },
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/entries failed:", error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to create entry", detail }, { status: 500 });
  }
}
