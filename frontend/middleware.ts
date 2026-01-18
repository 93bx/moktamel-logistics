import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales } from "./src/i18n/routing";
import { isTokenOlderThanHours } from "./src/lib/jwt";

const intlMiddleware = createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
});

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Early return for API routes - don't apply locale logic
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Early return for Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)
  ) {
    return intlMiddleware(request);
  }

  const response = intlMiddleware(request);
  const first = pathname.split("/")[1] || "";
  const locale = (locales as readonly string[]).includes(first) ? first : defaultLocale;

  // Public routes that don't require authentication
  const isPublic =
    pathname === `/${locale}/login` ||
    pathname === `/${locale}/signup` ||
    pathname === "/" ||
    pathname === `/${locale}`;

  if (isPublic) {
    // If user is already authenticated and tries to access login/signup, redirect to dashboard
    const access = request.cookies.get("moktamel_access")?.value;
    if (access && (pathname === `/${locale}/login` || pathname === `/${locale}/signup`)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/dashboard`;
      return NextResponse.redirect(url);
    }
    return response;
  }

  // All other routes require authentication
  const access = request.cookies.get("moktamel_access")?.value;
  if (!access) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Check 8-hour rule: if token is >8 hours old, clear cookies and redirect to login
  if (isTokenOlderThanHours(access, 8)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(url);
    // Clear all auth cookies
    redirectResponse.cookies.set("moktamel_access", "", { httpOnly: true, path: "/", maxAge: 0 });
    redirectResponse.cookies.set("moktamel_refresh", "", { httpOnly: true, path: "/", maxAge: 0 });
    redirectResponse.cookies.set("moktamel_company", "", { httpOnly: true, path: "/", maxAge: 0 });
    redirectResponse.cookies.set("moktamel_refreshed_once", "", { httpOnly: true, path: "/", maxAge: 0 });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};


