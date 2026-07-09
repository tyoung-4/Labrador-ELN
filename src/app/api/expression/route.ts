import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActorFromRequest } from "@/lib/auth";
import {
  calculateExpressionSchedule,
  type ProtocolType,
} from "@/lib/transfection";

const PROTOCOL_TYPES: ProtocolType[] = ["STANDARD", "HIGH_TITER", "MAX_TITER"];
const DAY_MS = 86_400_000;

// GET /api/expression — list runs (newest first) with lightweight action counts.
export async function GET() {
  const runs = await prisma.expressionTimeline.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plasmids: { orderBy: { order: "asc" } },
      actions: { orderBy: [{ scheduledDate: "asc" }, { id: "asc" }] },
    },
  });
  return NextResponse.json(runs);
}

// POST /api/expression — create a transfection run from the calculator payload.
// Reagent numbers are stored as a snapshot; the Day-1/Day-5/harvest actions are
// generated server-side from the schedule so they can't drift from the source.
export async function POST(req: NextRequest) {
  const actor = await getActorFromRequest(req);
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const name = String(body.name ?? "").trim() || "Untitled transfection";
  const protocolType: ProtocolType = PROTOCOL_TYPES.includes(body.protocolType)
    ? body.protocolType
    : "STANDARD";
  const cultureVolumeMl = Number(body.cultureVolumeMl);
  if (!(cultureVolumeMl > 0)) {
    return NextResponse.json({ error: "cultureVolumeMl must be > 0" }, { status: 400 });
  }

  const plasmids = Array.isArray(body.plasmids) ? body.plasmids : [];
  if (plasmids.length === 0) {
    return NextResponse.json({ error: "At least one plasmid is required" }, { status: 400 });
  }

  const day0 = body.day0Date ? new Date(body.day0Date) : new Date();
  const addDays = (n: number) => new Date(day0.getTime() + n * DAY_MS);
  const sched = calculateExpressionSchedule(cultureVolumeMl, protocolType);

  const actions: {
    type: string;
    label: string;
    dayOffset: number;
    scheduledDate: Date;
    detail: string;
  }[] = [
    { type: "ENHANCER", label: "Add ExpiCHO Enhancer", dayOffset: 1, scheduledDate: addDays(1), detail: `${sched.enhancerUl} µL` },
    { type: "FEED", label: "Add ExpiCHO Feed", dayOffset: 1, scheduledDate: addDays(1), detail: `${sched.feedMl} mL` },
  ];
  if (sched.tempShiftC != null) {
    actions.push({ type: "TEMP_SHIFT", label: `Shift culture to ${sched.tempShiftC} °C`, dayOffset: 1, scheduledDate: addDays(1), detail: "" });
  }
  if (sched.feed2Ml != null) {
    actions.push({ type: "FEED2", label: "Add ExpiCHO Feed (2nd)", dayOffset: 5, scheduledDate: addDays(5), detail: `${sched.feed2Ml} mL` });
  }
  actions.push({
    type: "HARVEST",
    label: "Harvest window",
    dayOffset: sched.harvestDayStart,
    scheduledDate: addDays(sched.harvestDayStart),
    detail: `day ${sched.harvestDayStart}–${sched.harvestDayEnd} post-transfection`,
  });

  const run = await prisma.expressionTimeline.create({
    data: {
      name,
      protocolType,
      cultureVolumeMl,
      volumeMode: typeof body.volumeMode === "string" ? body.volumeMode : "FIXED",
      measuredDensityE6: body.measuredDensityE6 != null ? Number(body.measuredDensityE6) : null,
      startingVolumeMl: body.startingVolumeMl != null ? Number(body.startingVolumeMl) : null,
      finalDnaConcUgMl: body.finalDnaConcUgMl != null ? Number(body.finalDnaConcUgMl) : 0.8,
      totalDnaUg: body.totalDnaUg != null ? Number(body.totalDnaUg) : null,
      totalDnaVolumeUl: body.totalDnaVolumeUl != null ? Number(body.totalDnaVolumeUl) : null,
      tubeVolumeUl: body.tubeVolumeUl != null ? Number(body.tubeVolumeUl) : null,
      optiproForDnaUl: body.optiproForDnaUl != null ? Number(body.optiproForDnaUl) : null,
      expifectamineUl: body.expifectamineUl != null ? Number(body.expifectamineUl) : null,
      optiproForExpifectUl: body.optiproForExpifectUl != null ? Number(body.optiproForExpifectUl) : null,
      day0Date: day0,
      harvestWindowStart: addDays(sched.harvestDayStart),
      harvestWindowEnd: addDays(sched.harvestDayEnd),
      runnerId: actor?.id ?? null,
      createdBy: actor?.name ?? "",
      notes: typeof body.notes === "string" ? body.notes : "",
      plasmids: {
        create: plasmids.map((p: Record<string, unknown>, i: number) => ({
          plasmidId: typeof p.plasmidId === "string" && p.plasmidId ? (p.plasmidId as string) : null,
          name: String(p.name ?? "").trim() || `Plasmid ${i + 1}`,
          stockConcNgUl: Number(p.stockConcNgUl) || 0,
          ratio: Number(p.ratio) || 0,
          amountUg: Number(p.amountUg) || 0,
          volumeUl: Number(p.volumeUl) || 0,
          order: i,
        })),
      },
      actions: { create: actions },
    },
    include: {
      plasmids: { orderBy: { order: "asc" } },
      actions: { orderBy: [{ scheduledDate: "asc" }, { id: "asc" }] },
    },
  });

  return NextResponse.json(run, { status: 201 });
}
