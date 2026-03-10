// TODO: Re-enable auth after testing
// import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Bypass auth for testing — let everything through
export default function middleware() {
  return NextResponse.next();
}

// export default auth((req) => {
//   const { pathname } = req.nextUrl;
//   const isApi = pathname.startsWith("/api/archive") || pathname.startsWith("/api/onboarding") || pathname.startsWith("/api/settings") || pathname.startsWith("/api/dashboard");
//
//   if (isApi && !req.auth) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }
//
//   const isProtected = pathname.startsWith("/onboarding") || pathname.startsWith("/settings") || pathname.startsWith("/dashboard");
//
//   if (isProtected && !req.auth) {
//     return NextResponse.redirect(new URL("/login", req.url));
//   }
//
//   return NextResponse.next();
// });

export const config = {
  matcher: [
    "/onboarding/:path*",
    "/settings/:path*",
    "/dashboard/:path*",
    "/api/archive/:path*",
    "/api/onboarding/:path*",
    "/api/settings/:path*",
    "/api/dashboard/:path*",
  ],
};
