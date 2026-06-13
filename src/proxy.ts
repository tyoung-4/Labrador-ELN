import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "eln-session";

// Edge middleware can't hit the DB, so it only checks cookie *presence* — full
// session validation happens server-side in getServerActor(). In development we
// let everything through so the legacy header-fallback sandbox keeps working;
// production redirects unauthenticated requests to /login.
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/_next", "/favicon", "/assets"];

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  // Unauthenticated: APIs get 401 JSON; page navigations redirect to /login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and obvious static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
};
