import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const access = (await cookies()).get("moktamel_access")?.value;
  if (!access) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const uploadUrl = req.headers.get("x-upload-url");
  const contentType = req.headers.get("content-type");
  if (!uploadUrl || !contentType) {
    return NextResponse.json({ message: "Invalid upload request" }, { status: 400 });
  }

  const body = await req.arrayBuffer();
  const upstream = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!upstream.ok) {
    const payload = await upstream.text().catch(() => "");
    return NextResponse.json(
      { message: "Upload to storage failed", details: payload || undefined },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
