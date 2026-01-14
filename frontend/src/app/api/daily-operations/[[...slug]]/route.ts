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

async function forward(req: Request, slug: string[]) {
  const url = new URL(req.url);
  const path = slug.length > 0 ? `/${slug.join("/")}` : "";
  const target = `${apiBase()}/operations/daily${path}${url.search}`;

  const headers = await authHeaders();
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  const res = await fetch(target, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { message: "Failed" }, { status: res.status });
}

export async function GET(req: Request, ctx: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await ctx.params;
  return forward(req, slug);
}

export async function POST(req: Request, ctx: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await ctx.params;
  return forward(req, slug);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await ctx.params;
  return forward(req, slug);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await ctx.params;
  return forward(req, slug);
}


