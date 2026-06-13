import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
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

// ─── Password + session lifecycle (login/logout) ─────────────────────────────

const SESSION_TTL_DAYS = 30;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Find an active user by email or display name and verify their password. */
export async function verifyCredentials(identifier: string, password: string) {
  const id = identifier.trim();
  if (!id || !password) return null;
  // The DB has duplicate rows per person (canonical "{name}-user" + legacy
  // UUID/@labrador.eln rows). Only the canonical rows carry a passwordHash, so
  // requiring one here disambiguates to the right account.
  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      passwordHash: { not: null },
      OR: [
        { email: { equals: id, mode: "insensitive" } },
        { name: { equals: id, mode: "insensitive" } },
      ],
    },
  });
  if (!user || !user.passwordHash) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

/** Create a Session row and set the httpOnly session cookie. */
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  const session = await prisma.session.create({ data: { userId, expiresAt } });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  const store = await cookies();
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Delete the current session row (if any) and clear the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (sid) {
    await prisma.session.deleteMany({ where: { id: sid } });
    store.delete(SESSION_COOKIE);
  }
}
