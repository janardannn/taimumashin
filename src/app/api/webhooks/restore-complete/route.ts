import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { sendRestoreEmail } from "@/lib/email";

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
  const result = await prisma.restoreJob.updateMany({
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

  // Send email notification from our side (bypasses SES sandbox)
  if (result.count > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationEmail: true, email: true },
    });
    const to = user?.notificationEmail || user?.email;
    if (to) {
      const jobs = await prisma.restoreJob.findMany({
        where: { userId, folderPath, status: "READY", restoredAt: { not: null } },
        orderBy: { restoredAt: "desc" },
        take: 1,
        select: { fileCount: true },
      });
      const fileCount = jobs[0]?.fileCount || 1;
      try {
        await sendRestoreEmail(to, folderPath, fileCount, expiresAt);
      } catch (err) {
        console.error("Failed to send restore email:", err);
      }
    }
  }

  return NextResponse.json({ success: true });
}
