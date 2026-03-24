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

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ message: "No file" }, { status: 400 });
  }

  const out = new FormData();
  out.append("file", file);

  const res = await fetch(`${apiBase()}/hr/recruitment/candidates/import/validate`, {
    method: "POST",
    headers: await authHeaders(),
    body: out,
  });

  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { message: "Validate failed" }, { status: res.status });
}
