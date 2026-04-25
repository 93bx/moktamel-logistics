import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";
}

async function authHeaders() {
  const access = (await cookies()).get("moktamel_access")?.value;
  return {
    ...(access ? { authorization: `Bearer ${access}` } : {}),
  };
}

async function forward(req: Request, slug: string[]) {
  const url = new URL(req.url);
  const path = slug.length > 0 ? `/${slug.join("/")}` : "";
  const target = `${apiBase()}/reports${path}${url.search}`;
  const res = await fetch(target, {
    method: req.method,
    headers: await authHeaders(),
    cache: "no-store",
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? { message: "Failed" }, { status: res.status });
  }
  const buf = await res.arrayBuffer();
  const headers = new Headers();
  headers.set("Content-Type", contentType || "application/octet-stream");
  const disposition = res.headers.get("content-disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  return new NextResponse(buf, { status: res.status, headers });
}

export async function GET(req: Request, ctx: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await ctx.params;
  return forward(req, slug);
}
