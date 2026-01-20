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

  // Extract locale from pathname
  const first = pathname.split("/")[1] || "";
  const locale = (locales as readonly string[]).includes(first) ? first : defaultLocale;
  
  // Normalize pathname for comparison (remove locale prefix if present)
  const pathWithoutLocale = (locales as readonly string[]).includes(first)
    ? "/" + pathname.split("/").slice(2).join("/")
    : pathname;

  // Public routes that don't require authentication
  // Check both with and without locale prefix to handle "as-needed" locale prefix
  const isPublic =
    pathWithoutLocale === "/login" ||
    pathWithoutLocale === "/signup" ||
    pathname === "/" ||
    pathname === `/${locale}` ||
    pathname === `/${locale}/login` ||
    pathname === `/${locale}/signup`;

  if (isPublic) {
    // If user is already authenticated and tries to access login/signup, redirect to dashboard
    const access = request.cookies.get("moktamel_access")?.value;
    if (access && (pathWithoutLocale === "/login" || pathWithoutLocale === "/signup")) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/dashboard`;
      // Clear any next parameter to avoid loops
      url.searchParams.delete("next");
      return NextResponse.redirect(url);
    }
    // Let intlMiddleware handle the response
    return intlMiddleware(request);
  }

  // All other routes require authentication
  const access = request.cookies.get("moktamel_access")?.value;
  if (!access) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    // Only set next if it's not already pointing to login to avoid loops
    if (pathWithoutLocale !== "/login" && pathname !== `/${locale}/login`) {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  // Check 8-hour rule: if token is >8 hours old, clear cookies and redirect to login
  if (isTokenOlderThanHours(access, 8)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    // Only set next if it's not already pointing to login to avoid loops
    if (pathWithoutLocale !== "/login" && pathname !== `/${locale}/login`) {
      url.searchParams.set("next", pathname);
    }
    const redirectResponse = NextResponse.redirect(url);
    // Clear all auth cookies
    redirectResponse.cookies.set("moktamel_access", "", { httpOnly: true, path: "/", maxAge: 0 });
    redirectResponse.cookies.set("moktamel_refresh", "", { httpOnly: true, path: "/", maxAge: 0 });
    redirectResponse.cookies.set("moktamel_company", "", { httpOnly: true, path: "/", maxAge: 0 });
    redirectResponse.cookies.set("moktamel_refreshed_once", "", { httpOnly: true, path: "/", maxAge: 0 });
    return redirectResponse;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};


