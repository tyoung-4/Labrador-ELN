import { NextResponse } from "next/server";
import { resetDemoData } from "@/lib/demoReset";

// POST /api/demo/reset   Header: x-demo-reset-token: <DEMO_RESET_TOKEN>
// Wipes + reseeds the demo database. Guarded twice: demo environment only, and a
// secret token (so a scheduled job can call it but the public cannot).
export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_ENV_LABEL !== "staging") {
    return NextResponse.json(
      { error: "Reset is only available in the demo environment" },
      { status: 403 }
    );
  }
  const expected = process.env.DEMO_RESET_TOKEN;
  const provided = request.headers.get("x-demo-reset-token");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await resetDemoData();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("POST /api/demo/reset failed:", error);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
