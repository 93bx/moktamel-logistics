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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const res = await fetch(
    `${apiBase()}/hr/recruitment/candidates/export${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: await authHeaders(),
    },
  );

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? { message: "Export failed" }, { status: res.status });
  }

  const buf = await res.arrayBuffer();
  const disposition = res.headers.get("content-disposition");
  const headers = new Headers();
  headers.set(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  if (disposition) {
    headers.set("Content-Disposition", disposition);
  }
  return new NextResponse(buf, { status: 200, headers });
}
