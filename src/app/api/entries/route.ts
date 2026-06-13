import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { TECHNIQUE_OPTIONS, PROTOCOL_TECHNIQUES } from "@/models/entry";
import { ENTRY_TYPE_CONFIGS } from "@/lib/entryTypes";
import { maybeNotifyMissingProject } from "@/lib/projectAccess";
import { getActorFromRequest, ensureActor } from "@/lib/auth";
import type { EntryType } from "@prisma/client";

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

export async function GET(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
    await ensureActor(actor);

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

    // TagAssignment is polymorphic — fetch separately and merge
    const entryIds = entries.map((e) => e.id);
    const tagAssignments = await prisma.tagAssignment.findMany({
      where: { entityType: "ENTRY", entityId: { in: entryIds } },
      include: { tag: { select: { id: true, name: true, type: true, color: true } } },
    });
    const tagMap = new Map<string, typeof tagAssignments>();
    for (const a of tagAssignments) {
      const list = tagMap.get(a.entityId) ?? [];
      list.push(a);
      tagMap.set(a.entityId, list);
    }

    const enriched = entries.map((e) => ({
      ...e,
      tagAssignments: tagMap.get(e.id) ?? [],
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/entries failed:", error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to load entries", detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
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
    // Nudge if a protocol was created without a project assignment (non-blocking).
    if (created.entryType === "PROTOCOL") {
      await maybeNotifyMissingProject({
        entityType: "ENTRY",
        entityId: created.id,
        entityName: created.title,
        operator: actor.name,
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/entries failed:", error);
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? error.message : undefined;
    return NextResponse.json({ error: "Failed to create entry", detail }, { status: 500 });
  }
}
