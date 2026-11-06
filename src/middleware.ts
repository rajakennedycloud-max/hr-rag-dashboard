import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Protect API routes (except auth routes and health check)
    if (path.startsWith("/api/") && !path.startsWith("/api/auth/") && !path.startsWith("/api/health") && !path.startsWith("/api/rag/compute")) {
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Protect dashboard and candidate pages
    if (path.startsWith("/dashboard") || path.startsWith("/candidates")) {
      if (!token) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Allow public pages; API routes always pass through so the
        // middleware can return a JSON 401 instead of a sign-in redirect
        if (path === "/" || path.startsWith("/api/")) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/candidates/:path*", "/api/:path*"],
};
