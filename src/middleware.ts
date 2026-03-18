import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic = pathname === "/login"
    || pathname.startsWith("/api/auth")
    || pathname.startsWith("/.well-known")
    || pathname.startsWith("/api/webhooks")
    || pathname === "/about"
    || pathname === "/pricing"
    || pathname === "/privacy"
    || pathname === "/setup"
    || pathname === "/changelog";
  if (isPublic) return NextResponse.next();

  // Not logged in — redirect pages to /login, return 401 for APIs
  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Logged in but not onboarded — force to /onboarding
  const onboarded = (req.auth.user as unknown as Record<string, unknown>)?.onboarded;
  const isOnboardingRoute = pathname === "/onboarding" || pathname.startsWith("/api/onboarding") || pathname.startsWith("/api/settings");
  if (!onboarded && !isOnboardingRoute) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Onboarding not complete" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Already onboarded — don't let them go back to /onboarding
  if (onboarded && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
