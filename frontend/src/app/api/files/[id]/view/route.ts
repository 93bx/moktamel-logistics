import { NextResponse } from "next/server";
import { backendApi } from "@/lib/backendApi";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return new NextResponse("File ID is required", { status: 400 });
  }

  try {
    // Call the backend to get a signed download URL
    const data = await backendApi<{ download_url: string }>({
      method: "POST",
      path: "/files/download-url",
      body: { file_id: id },
    });

    if (!data.download_url) {
      return new NextResponse("Download URL not found", { status: 404 });
    }

    // Redirect to the signed S3/MinIO URL
    return NextResponse.redirect(data.download_url, { status: 307 });
  } catch (error: any) {
    console.error(`Error viewing file ${id}:`, error);
    return new NextResponse(error.message || "Internal Server Error", {
      status: error.status || 500,
    });
  }
}

