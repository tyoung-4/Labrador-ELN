import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id")?.trim() ?? "";
  const role = req.headers.get("x-user-role")?.trim().toUpperCase() ?? "MEMBER";

  const runs = await prisma.protocolRun.findMany({
    where: {
      status: "IN_PROGRESS",
      ...(role === "ADMIN" ? {} : { runnerId: userId }),
    },
    select: {
      id: true,
      runId: true,
      title: true,
      runBody: true,
      createdAt: true,
      runner: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Count steps per run by parsing runBody (lightweight: just count "step-" occurrences)
  const enriched = runs.map((run) => {
    let stepCount = 0;
    try {
      const parsed = JSON.parse(run.runBody) as { sections?: unknown[] };
      const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
      stepCount = (sections as Array<{ steps?: unknown[] }>).reduce(
        (acc, s) => acc + (Array.isArray(s.steps) ? s.steps.length : 0),
        0,
      );
    } catch {
      // non-JSON / legacy body — count not available
    }
    return { id: run.id, runId: run.runId, title: run.title, stepCount, createdAt: run.createdAt };
  });

  return NextResponse.json({ count: enriched.length, runs: enriched });
}
