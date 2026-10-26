import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Fast first check: no session cookie -> sign-in. The real check (valid session, workspace)
// happens on the server in app/(app)/layout.tsx via requireUser().
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/create/:path*", "/videos/:path*", "/settings/:path*", "/admin/:path*"],
};
