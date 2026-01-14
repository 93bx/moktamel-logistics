import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("moktamel_access", "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set("moktamel_refresh", "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set("moktamel_company", "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set("moktamel_refreshed_once", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}


