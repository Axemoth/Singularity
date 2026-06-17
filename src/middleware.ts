import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check for Better Auth session token cookies (both dev and production secure versions)
  const hasSessionToken =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Secure-better-auth.session_token");

  // Define route types
  const isAuthRoute = path === "/login";
  const isRootRoute = path === "/";
  const isProtectedRoute =
    path.startsWith("/inbox") ||
    path.startsWith("/calendar") ||
    path.startsWith("/settings") ||
    path.startsWith("/agent");

  // 1. If user is logged in and tries to access /login, redirect to /inbox
  if (hasSessionToken && isAuthRoute) {
    return NextResponse.redirect(new URL("/inbox", request.url));
  }

  // 2. If user is NOT logged in and tries to access a protected route, redirect to /login
  if (!hasSessionToken && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

// Config to run middleware on all paths except static assets and API routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml
     */
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
