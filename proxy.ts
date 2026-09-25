// proxy.ts (project root) — runs before every request: IP allowlist, then "is there a session cookie?"
import { NextResponse, type NextRequest } from "next/server";
import ipaddr from "ipaddr.js";
import { getSessionCookie } from "better-auth/cookies";

const ALLOWED = (process.env.ALLOWED_CIDRS ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean)
  .map((cidr) => ipaddr.parseCIDR(cidr));
const HOPS = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
const SKIP_IP_CHECK =
  process.env.NODE_ENV === "development" && process.env.IP_ALLOWLIST_ENABLED === "false";

// The load balancer appends the real client IP to X-Forwarded-For; only trust the entry it added.
function clientIp(req: NextRequest): string | null {
  const parts = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - HOPS] ?? null;
}

function isAllowed(ip: string | null): boolean {
  if (!ip || !ipaddr.isValid(ip)) return false;
  const addr = ipaddr.process(ip); // turns "::ffff:10.0.0.5" into "10.0.0.5"
  return ALLOWED.some(([range, bits]) => addr.kind() === range.kind() && addr.match(range, bits));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/api/health") return NextResponse.next(); // load balancer probe

  if (!SKIP_IP_CHECK && !isAllowed(clientIp(req))) {
    return new NextResponse("Forbidden", { status: 403 }); // fail closed
  }

  // Quick check only; pages and routes still verify the session properly with getCurrentUser().
  const isPublic = pathname.startsWith("/api/auth") || pathname === "/sign-in";
  if (!isPublic && !getSessionCookie(req)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); // API callers get an error, not a page
    }
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
