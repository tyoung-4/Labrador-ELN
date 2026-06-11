import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { PROJECT_ASSIGNMENT_NOTIFICATION_TYPE } from "@/lib/projectAccess";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

async function getId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return resolved.id;
}

// PATCH /api/notifications/project-assignment/[id]
// Body: { isDismissed: true } — dismiss the notification (maps to isRead).
export async function PATCH(request: NextRequest, context: RouteContext) {
  const id = await getId(context);
  try {
    const body = (await request.json().catch(() => ({}))) as { isDismissed?: boolean };
    const existing = await prisma.dashboardNotification.findUnique({
      where: { id },
      select: { id: true, type: true },
    });
    if (!existing || existing.type !== PROJECT_ASSIGNMENT_NOTIFICATION_TYPE) {
      return new NextResponse(null, { status: 404 });
    }

    const dismiss = body.isDismissed !== false; // default true
    const updated = await prisma.dashboardNotification.update({
      where: { id },
      data: { isRead: dismiss, readAt: dismiss ? new Date() : null },
      select: { id: true, isRead: true },
    });
    return NextResponse.json({ success: true, id: updated.id, isDismissed: updated.isRead });
  } catch (error) {
    console.error(`PATCH /api/notifications/project-assignment/${id} failed:`, error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
