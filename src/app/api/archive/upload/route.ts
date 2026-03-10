import { NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import { getPrisma } from "@/lib/db";
// import { generatePresignedPutUrl, generatePresignedPutUrlStandard } from "@/lib/s3-operations";
// import { getFileType } from "@/lib/file-utils";

// TODO: Re-enable auth + S3 after testing
export async function POST(req: Request) {
  const body = await req.json();
  const { fileName, contentType } = body;

  if (!fileName || !contentType) {
    return NextResponse.json({ error: "Missing fileName or contentType" }, { status: 400 });
  }

  // Mock — return error until S3 is wired up
  return NextResponse.json({ error: "S3 not configured yet. Bucket setup required." }, { status: 503 });
}
