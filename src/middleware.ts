import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth-edge";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/.well-known") ||
    pathname === "/api/webhooks/restore-complete" ||
    pathname === "/about" ||
    pathname === "/pricing" ||
    pathname === "/privacy" ||
    pathname === "/setup" ||
    pathname === "/changelog";
  if (isPublic) return NextResponse.next();

  // Read session cookie (Secure prefix used in production)
  const token =
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("authjs.session-token")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  let payload;
  try {
    payload = await verifySessionToken(token);
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Onboarding enforcement
  const onboarded = payload.onboarded as boolean;
  const isOnboardingRoute =
    pathname === "/onboarding" ||
    pathname.startsWith("/api/onboarding") ||
    pathname.startsWith("/api/settings");

  if (!onboarded && !isOnboardingRoute) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Onboarding not complete" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  if (onboarded && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
