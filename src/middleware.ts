import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const role = token?.role as string | undefined;

    // Admin/Owner only routes
    const adminRoutes = ["/expenses", "/refunds", "/reports", "/audit"];
    const isAdminRoute = adminRoutes.some((route) => path.startsWith(route));

    if (isAdminRoute && role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/pos", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    cookies: {
      sessionToken: {
        name: "next-auth.session-token",
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/pos/:path*",
    "/products/:path*",
    "/inventory/:path*",
    "/cash/:path*",
    "/expenses/:path*",
    "/refunds/:path*",
    "/reports/:path*",
    "/audit/:path*",
    "/dashboard/:path*",
  ],
};
