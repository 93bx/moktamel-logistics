import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";
}

async function authHeaders() {
  const access = (await cookies()).get("moktamel_access")?.value;
  return {
    "content-type": "application/json",
    ...(access ? { authorization: `Bearer ${access}` } : {}),
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const res = await fetch(`${apiBase()}/hr/recruitment/candidates`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { message: "Failed" }, { status: res.status });
}

