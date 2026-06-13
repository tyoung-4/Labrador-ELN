import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// ─── Server-trusted identity ─────────────────────────────────────────────────
//
// Identity must come from a signed, httpOnly session cookie — never from a
// client-supplied header. During the migration (and in local dev) we still
// honour the legacy x-user-* headers as a fallback so existing client code and
// `pnpm dev` keep working; that fallback is disabled in production once login
// is in place (see ALLOW_HEADER_FALLBACK).

export type Role = "ADMIN" | "MEMBER";

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export const SESSION_COOKIE = "eln-session";

// Header fallback is allowed outside production. Flip to always-false once
// every client path authenticates through /login.
const ALLOW_HEADER_FALLBACK = process.env.NODE_ENV !== "production";

function normalizeRole(role: string | null | undefined): Role {
  return (role ?? "").toUpperCase() === "ADMIN" ? "ADMIN" : "MEMBER";
}

/**
 * Resolve the current actor from the session cookie. Returns null when there is
 * no valid, unexpired session for an active user. This is the only trusted
 * source of identity.
 */
export async function getServerActor(): Promise<Actor | null> {
  let sessionId: string | undefined;
  try {
    const store = await cookies();
    sessionId = store.get(SESSION_COOKIE)?.value;
  } catch {
    return null; // cookies() unavailable (e.g. called outside a request)
  }
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }
  const u = session.user;
  return {
    id: u.id,
    name: u.name ?? "Unknown",
    email: u.email,
    role: normalizeRole(u.role),
  };
}

/** Legacy header-derived actor (dev/migration fallback only). */
function actorFromHeaders(request?: Request): Actor {
  const headerId = request?.headers.get("x-user-id")?.trim();
  const headerName = request?.headers.get("x-user-name")?.trim();
  const headerRole = request?.headers.get("x-user-role")?.trim();

  const name = headerName || "Finn";
  const safeId = headerId || `user-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "member"}`;
  return {
    id: safeId,
    name,
    email: `${safeId}@local.eln`,
    role: normalizeRole(headerRole),
  };
}

/**
 * Drop-in replacement for the per-route getActorFromRequest helpers. Prefers
 * the trusted session; falls back to headers only where allowed. Always returns
 * an Actor so existing call sites keep their non-null contract; use
 * requireActor() in routes that must hard-fail when unauthenticated.
 */
export async function getActorFromRequest(request?: Request): Promise<Actor> {
  const session = await getServerActor();
  if (session) return session;
  if (ALLOW_HEADER_FALLBACK) return actorFromHeaders(request);
  // Production with no session: return an explicit anonymous actor. Routes that
  // matter should call requireActor() to convert this into a 401.
  return { id: "__anonymous__", name: "Anonymous", email: "", role: "MEMBER" };
}

/** Returns the actor or null without any header fallback — for hard gating. */
export async function requireActor(): Promise<Actor | null> {
  return getServerActor();
}

/** Ensures a User row exists for the actor (no-op for real logged-in users). */
export async function ensureActor(actor: Actor) {
  return prisma.user.upsert({
    where: { id: actor.id },
    create: { id: actor.id, name: actor.name, email: actor.email || `${actor.id}@local.eln`, role: actor.role },
    update: { name: actor.name, role: actor.role },
  });
}

// ─── Permission helpers ───────────────────────────────────────────────────────

export function isAdmin(actor: Actor | null | undefined): boolean {
  return actor?.role === "ADMIN";
}

/** Owner (by display name, case-insensitive) or Admin may edit. */
export function canEditEntity(actor: Actor | null | undefined, ownerName: string | null | undefined): boolean {
  if (!actor) return false;
  if (isAdmin(actor)) return true;
  return (actor.name ?? "").trim().toLowerCase() === (ownerName ?? "").trim().toLowerCase();
}
