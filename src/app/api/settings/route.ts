import { NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import { getPrisma } from "@/lib/db";
// import { settingsSchema } from "@/lib/validations/settings";

// TODO: Re-enable auth + DB queries after testing
export async function GET() {
  // Return mock data for testing
  return NextResponse.json({
    roleArn: null,
    bucketName: null,
    region: "ap-south-1",
    notificationEmail: null,
    restoreDays: 7,
    previewQuality: "720p",
    previewDurationCap: 60,
    lifecycleDays: 7,
  });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  // For testing, just echo back
  return NextResponse.json(body);
}
