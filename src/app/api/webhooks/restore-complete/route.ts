import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

// Called by Lambda in user's AWS account when S3 fires ObjectRestore:Completed
export async function POST(req: Request) {
  const body = await req.json();
  const { userId, folderPath, expiresAt } = body;

  // Basic validation — in production, verify a shared secret/signature
  if (!userId || !folderPath) {
    return NextResponse.json({ error: "Missing userId or folderPath" }, { status: 400 });
  }

  const prisma = await getPrisma();

  // Update the restore job
  await prisma.restoreJob.updateMany({
    where: {
      userId,
      folderPath,
      status: "RESTORING",
    },
    data: {
      status: "READY",
      restoredAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json({ success: true });
}
