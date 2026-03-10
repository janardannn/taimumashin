import { NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import { getPrisma } from "@/lib/db";
// import { getS3Client } from "@/lib/s3";
// import { PutObjectCommand } from "@aws-sdk/client-s3";

// TODO: Re-enable auth + S3 after testing
export async function POST(req: Request) {
  const body = await req.json();
  const { name } = body;

  if (!name) {
    return NextResponse.json({ error: "Folder name required" }, { status: 400 });
  }

  // Mock — return success without actually creating in S3
  return NextResponse.json({ error: "S3 not configured yet. Bucket setup required." }, { status: 503 });
}
