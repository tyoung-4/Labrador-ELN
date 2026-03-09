import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/protocols/check-name?name=<protocol-name>
 * Returns { available: boolean } — true if no PROTOCOL entry already uses that
 * name (case-insensitive).  Checks Entry.title across all PROTOCOL-type entries
 * so that existing protocols without a Protocol row are also covered.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim() ?? "";

    if (!name) {
      return NextResponse.json({ available: false });
    }

    const existing = await prisma.entry.findFirst({
      where: {
        entryType: "PROTOCOL",
        title: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });

    return NextResponse.json({ available: !existing });
  } catch (error) {
    console.error("GET /api/protocols/check-name failed:", error);
    return NextResponse.json({ available: false }, { status: 500 });
  }
}
