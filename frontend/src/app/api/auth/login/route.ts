import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ message: "Invalid body" }, { status: 400 });

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";
  const res = await fetch(`${apiBase}/auth/break-glass/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json(data ?? { message: "Login failed" }, { status: res.status });
  }

  const response = NextResponse.json({ ok: true });
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
  // Clear refresh flag on new login to reset the refresh-once limit
  response.cookies.set("moktamel_refreshed_once", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}


