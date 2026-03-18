import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

// DB-only: S3 restore requests are handled client-side via useS3 hook
// This route accepts the result (fileCount, totalSize) and creates a DB record
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = await getPrisma();
  const body = await req.json();
  const { folderPath, fileCount, totalSize, tier, estimatedCost } = body;

  if (folderPath === undefined) {
    return NextResponse.json({ error: "Provide folderPath" }, { status: 400 });
  }

  try {
    await prisma.restoreJob.create({
      data: {
        userId: session.user.id,
        folderPath: folderPath || "/",
        tier: tier || null,
        estimatedCost: estimatedCost != null ? estimatedCost : null,
        status: "RESTORING",
        fileCount: fileCount || 0,
        totalSize: BigInt(totalSize || 0),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Restore tracking error:", err);
    const message = err instanceof Error ? err.message : "Restore tracking failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
