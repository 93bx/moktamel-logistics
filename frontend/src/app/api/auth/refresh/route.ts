import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Get refresh token and company ID from request body (not cookies, since server-side fetch doesn't forward cookies)
  const body = await request.json().catch(() => null);
  const refreshToken = body?.refresh_token;
  const companyId = body?.company_id;

  if (!refreshToken || !companyId) {
    return NextResponse.json(
      { message: "Missing refresh token or company ID" },
      { status: 401 }
    );
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";
  
  try {
    const res = await fetch(`${apiBase}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        refresh_token: refreshToken,
        company_id: companyId,
      }),
    });

    const data = await res.json().catch(() => null);
    
    if (!res.ok) {
      return NextResponse.json(
        data ?? { message: "Token refresh failed" },
        { status: res.status }
      );
    }

    // Update cookies with new tokens AND return them in the body
    // (server-side requests can't read Set-Cookie headers, so we return tokens in body too)
    const response = NextResponse.json({ 
      ok: true,
      access_token: data.access_token,  // Return in body for server-side use
      refresh_token: data.refresh_token,
      company_id: data.company_id
    });
    response.cookies.set("moktamel_access", data.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    response.cookies.set("moktamel_refresh", data.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    response.cookies.set("moktamel_company", data.company_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    
    // Set refresh flag cookie to indicate we've refreshed once in this 8-hour window
    // Cookie expires in 8 hours (28800 seconds) or when access token expires, whichever is shorter
    // Access token typically expires in 15 minutes (900 seconds), so we'll use 8 hours as max
    const eightHoursInSeconds = 8 * 60 * 60;
    response.cookies.set("moktamel_refreshed_once", Date.now().toString(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: eightHoursInSeconds,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message ?? "Token refresh failed" },
      { status: 500 }
    );
  }
}

