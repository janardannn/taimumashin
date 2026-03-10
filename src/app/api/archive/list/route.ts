import { NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import { getPrisma } from "@/lib/db";
// import { listObjects, generatePresignedGetUrl } from "@/lib/s3-operations";

// TODO: Re-enable auth + S3 after testing
export async function GET() {
  // Return empty data for testing
  return NextResponse.json({
    folders: [],
    files: [],
    isTruncated: false,
    nextToken: null,
  });
}
