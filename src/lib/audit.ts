import { createHash } from "crypto";
import prisma from "@/lib/prisma";
import type { Actor } from "@/lib/auth";

// ─── Tamper-evident audit trail + electronic signatures ──────────────────────

export type AuditAction =
  | "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "SIGN" | "LOCK" | "UNLOCK";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Hash is computed over stored, reproducible fields only (no write-time clock),
// so verifyAuditChain() can recompute and detect in-place edits too.
function rowPayload(r: {
  entityType: string; entityId: string; action: string;
  actorId: string; summary: string; diff: unknown;
}): string {
  return JSON.stringify({
    entityType: r.entityType, entityId: r.entityId, action: r.action,
    actorId: r.actorId, summary: r.summary, diff: r.diff ?? null,
  });
}

/**
 * Append an audit-log row for an entity. Each row hashes the previous row's
 * hash plus this row's payload, forming a per-entity chain: tampering with or
 * deleting an earlier row breaks verification downstream. Never throws — audit
 * failures must not block the primary operation.
 */
export async function recordAudit(args: {
  entityType: string;
  entityId: string;
  action: AuditAction;
  actor: Pick<Actor, "id" | "name">;
  summary?: string;
  diff?: unknown;
}): Promise<void> {
  try {
    const prev = await prisma.auditLog.findFirst({
      where: { entityType: args.entityType, entityId: args.entityId },
      orderBy: { createdAt: "desc" },
      select: { hash: true },
    });
    const prevHash = prev?.hash ?? null;
    const payload = rowPayload({
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      actorId: args.actor.id,
      summary: args.summary ?? "",
      diff: args.diff ?? null,
    });
    const hash = sha256((prevHash ?? "") + payload);
    await prisma.auditLog.create({
      data: {
        entityType: args.entityType,
        entityId: args.entityId,
        action: args.action,
        actorId: args.actor.id,
        actorName: args.actor.name,
        summary: args.summary ?? "",
        diff: (args.diff ?? undefined) as object | undefined,
        prevHash,
        hash,
      },
    });
  } catch (err) {
    console.error("recordAudit failed (non-blocking):", err);
  }
}

/** Stable hash of an arbitrary record snapshot, stored on a Signature. */
export function snapshotHash(snapshot: unknown): string {
  return sha256(JSON.stringify(snapshot));
}

/** Verify a per-entity audit chain. Returns the first broken link, if any. */
export async function verifyAuditChain(entityType: string, entityId: string) {
  const rows = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "asc" },
  });
  let prevHash: string | null = null;
  for (const r of rows) {
    const expected = sha256((prevHash ?? "") + rowPayload(r));
    // Detects both re-ordering/insertion/deletion (linkage) and in-place edits
    // (recomputed hash mismatch).
    if (r.prevHash !== prevHash || r.hash !== expected) {
      return { valid: false, brokenAt: r.id };
    }
    prevHash = r.hash;
  }
  return { valid: true, brokenAt: null as string | null };
}
