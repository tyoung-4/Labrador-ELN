import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TECHNIQUE_OPTIONS } from "@/models/entry";
import { Q5_TEMPLATE_ENTRY_ID } from "@/lib/defaultTemplates";
import { ENTRY_TYPE_CONFIGS } from "@/lib/entryTypes";
import type { EntryType } from "@prisma/client";

type Actor = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
};
type RouteContext = { params: Promise<{ id: string }> | { id: string } };

function normalizeDescription(value: unknown): string {
  return String(value ?? "").trim().slice(0, 100);
}

function normalizeTechnique(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "General";
  return TECHNIQUE_OPTIONS.includes(raw as (typeof TECHNIQUE_OPTIONS)[number]) ? raw : "Other";
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

function canModifyEntry(actor: Actor, authorId: string | null): boolean {
  if (actor.role === "ADMIN") return true;
  return Boolean(authorId && actor.id === authorId);
}

function canEditEntry(actor: Actor, authorId: string | null): boolean {
  if (actor.role === "ADMIN") return true;
  return Boolean(authorId && actor.id === authorId);
}

async function getEntryId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return resolved.id;
}

// Standard include for single-entry queries (includes attachments)
const ENTRY_INCLUDE = {
  author: {
    select: { id: true, name: true, role: true },
  },
  attachments: {
    orderBy: { createdAt: "asc" as const },
  },
};

export async function GET(request: Request, context: RouteContext) {
  const id = await getEntryId(context);
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    const found = await prisma.entry.findUnique({
      where: { id },
      include: ENTRY_INCLUDE,
    });

    if (!found) return new NextResponse(null, { status: 404 });
    return NextResponse.json(found);
  } catch (error) {
    console.error(`GET /api/entries/${id} failed:`, error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to load entry", detail }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const id = await getEntryId(context);
  const payload = await request.json().catch(() => ({}));
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    if (id === Q5_TEMPLATE_ENTRY_ID) {
      return NextResponse.json({ error: "This template is permanent and cannot be edited." }, { status: 403 });
    }

    const existing = await prisma.entry.findUnique({ where: { id }, select: { authorId: true } });
    if (!existing) return new NextResponse(null, { status: 404 });
    if (!canEditEntry(actor, existing.authorId)) {
      return NextResponse.json({ error: "Not allowed to edit this entry" }, { status: 403 });
    }

    const data: Record<string, unknown> = {
      title: payload.title,
      description: normalizeDescription(payload.description),
      technique: normalizeTechnique(payload.technique),
      body: payload.body,
      version: { increment: 1 },
    };

    // Only update entryType / typedData if they were explicitly sent
    if ("entryType" in payload) data.entryType = normalizeEntryType(payload.entryType);
    if ("typedData" in payload) data.typedData = normalizeTypedData(payload.typedData);

    const updated = await prisma.entry.update({
      where: { id },
      data,
      include: ENTRY_INCLUDE,
    });
    return NextResponse.json(updated);
  } catch (error) {
    const isMissing = typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
    if (isMissing) return new NextResponse(null, { status: 404 });
    console.error(`PUT /api/entries/${id} failed:`, error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to update entry", detail }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const id = await getEntryId(context);
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    if (id === Q5_TEMPLATE_ENTRY_ID) {
      return NextResponse.json({ error: "This template is permanent and cannot be deleted." }, { status: 403 });
    }

    const existing = await prisma.entry.findUnique({ where: { id }, select: { authorId: true } });
    if (!existing) return new NextResponse(null, { status: 404 });
    if (!canModifyEntry(actor, existing.authorId)) {
      return NextResponse.json({ error: "Not allowed to delete this entry" }, { status: 403 });
    }

    const runCount = await prisma.protocolRun.count({ where: { sourceEntryId: id } });
    if (runCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete this protocol because run records exist. Delete related runs first." },
        { status: 409 }
      );
    }

    await prisma.entry.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const isMissing = typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
    if (isMissing) return new NextResponse(null, { status: 404 });
    const isForeignKey = typeof error === "object" && error !== null && "code" in error && error.code === "P2003";
    if (isForeignKey) {
      return NextResponse.json(
        { error: "Cannot delete this protocol because run records exist. Delete related runs first." },
        { status: 409 }
      );
    }
    console.error(`DELETE /api/entries/${id} failed:`, error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to delete entry", detail }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const id = await getEntryId(context);
  try {
    const actor = getActorFromRequest(request);
    await ensureActor(actor);

    const source = await prisma.entry.findUnique({ where: { id } });
    if (!source) return new NextResponse(null, { status: 404 });

    // Merge versioning metadata into cloned typedData
    const sourceTypedData =
      source.typedData && typeof source.typedData === "object"
        ? (source.typedData as { typed?: Record<string, string>; custom?: string[] })
        : { typed: {}, custom: [] as string[] };
    const cloneTypedData: Record<string, unknown> = {
      ...sourceTypedData,
      typed: {
        ...(sourceTypedData.typed ?? {}),
        _semVer: "1.0",
        _parentId: source.id,
        _parentTitle: source.title,
      },
    };

    const cloned = await prisma.entry.create({
      data: {
        title: `${source.title} (Clone)`,
        description: source.description,
        technique: source.technique,
        entryType: source.entryType,
        typedData: cloneTypedData as never,
        body: source.body,
        authorId: actor.id,
        version: 1,
      },
      include: ENTRY_INCLUDE,
    });

    return NextResponse.json(cloned, { status: 201 });
  } catch (error) {
    console.error(`POST /api/entries/${id} clone failed:`, error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to clone entry", detail }, { status: 500 });
  }
}
