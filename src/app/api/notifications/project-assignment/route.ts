import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { PROJECT_ASSIGNMENT_NOTIFICATION_TYPE, normalizeEntityType } from "@/lib/projectAccess";

// Project-assignment notifications are reconciled onto DashboardNotification
// rows (type = PROJECT_ASSIGNMENT). "operator" maps to userId, "isDismissed"
// maps to isRead.

// GET /api/notifications/project-assignment?operator=
// Returns all undismissed project-assignment notifications for the operator.
export async function GET(request: NextRequest) {
  const operator = new URL(request.url).searchParams.get("operator") ?? "";
  try {
    if (!operator.trim()) return NextResponse.json({ notifications: [], count: 0 });
    const rows = await prisma.dashboardNotification.findMany({
      where: {
        type: PROJECT_ASSIGNMENT_NOTIFICATION_TYPE,
        userId: operator.trim(),
        isRead: false,
      },
      orderBy: { createdAt: "desc" },
    });
    const notifications = rows.map((n) => ({
      id: n.id,
      entityType: n.entityType,
      entityId: n.entityId,
      entityName: n.entityName,
      operator: n.userId,
      createdAt: n.createdAt.toISOString(),
      isDismissed: n.isRead,
    }));
    return NextResponse.json({ notifications, count: notifications.length });
  } catch (error) {
    console.error("GET /api/notifications/project-assignment failed:", error);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

// POST /api/notifications/project-assignment
// Body: { entityType, entityId, entityName, operator }
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      entityType?: string; entityId?: string; entityName?: string; operator?: string;
    };
    const entityType = normalizeEntityType(body.entityType ?? "");
    const entityId = (body.entityId ?? "").trim();
    const entityName = (body.entityName ?? "").trim() || entityId;
    const operator = (body.operator ?? "").trim();
    if (!entityType || !entityId || !operator) {
      return NextResponse.json({ error: "entityType, entityId and operator are required" }, { status: 400 });
    }

    // De-dupe undismissed notifications for the same entity+operator.
    const existing = await prisma.dashboardNotification.findFirst({
      where: { type: PROJECT_ASSIGNMENT_NOTIFICATION_TYPE, entityType, entityId, userId: operator, isRead: false },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ success: true, id: existing.id, deduped: true });

    const created = await prisma.dashboardNotification.create({
      data: {
        userId: operator,
        type: PROJECT_ASSIGNMENT_NOTIFICATION_TYPE,
        entityType, entityId, entityName,
        message: `${entityName} is missing a project assignment`,
        fromUser: "system",
      },
    });
    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/notifications/project-assignment failed:", error);
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
  }
}
