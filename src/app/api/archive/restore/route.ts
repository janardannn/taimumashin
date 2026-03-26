import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

function safeBigInt(val: unknown): bigint {
  try {
    return BigInt(val as string | number | bigint | boolean || 0);
  } catch {
    return BigInt(0);
  }
}

// Mark an individual restore job as READY by jobId.
// Called by the client-side probe when it detects a job's files are accessible.
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await req.json();
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const prisma = await getPrisma();
  const result = await prisma.restoreJob.updateMany({
    where: {
      id: jobId,
      userId: session.user.id,
      status: "RESTORING",
    },
    data: {
      status: "READY",
      restoredAt: new Date(),
    },
  });

  return NextResponse.json({ updated: result.count });
}

// DB-only: S3 restore requests are handled client-side via useS3 hook
// This route accepts the result (fileCount, totalSize, keys) and creates a DB record
export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Invalid Content-Type" }, { status: 415 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = await getPrisma();
  const body = await req.json();
  const { folderPath, fileCount, totalSize, tier, estimatedCost, keys } = body;

  if (folderPath === undefined) {
    return NextResponse.json({ error: "Provide folderPath" }, { status: 400 });
  }

  try {
    const job = await prisma.restoreJob.create({
      data: {
        userId: session.user.id,
        folderPath: folderPath || "/",
        keys: Array.isArray(keys) ? keys : [],
        tier: tier || null,
        estimatedCost: estimatedCost != null ? estimatedCost : null,
        status: "RESTORING",
        fileCount: fileCount || 0,
        totalSize: safeBigInt(totalSize),
      },
    });

    return NextResponse.json({ success: true, jobId: job.id });
  } catch (err) {
    console.error("Restore tracking error:", err);
    const message = err instanceof Error ? err.message : "Restore tracking failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
