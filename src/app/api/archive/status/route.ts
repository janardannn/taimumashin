import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

// Returns restore status for a folder path (DB-only, no S3)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folderPath = req.nextUrl.searchParams.get("path") || "/";
  const prisma = await getPrisma();

  // Check for active restore jobs at this path or parent paths
  const pathsToCheck = [folderPath];
  const parts = folderPath.split("/").filter(Boolean);
  for (let i = parts.length - 1; i > 0; i--) {
    pathsToCheck.push(parts.slice(0, i).join("/"));
  }
  if (folderPath !== "/") pathsToCheck.push("/");

  const activeRestore = await prisma.restoreJob.findFirst({
    where: {
      userId: session.user.id,
      folderPath: { in: pathsToCheck },
      status: { in: ["PENDING", "RESTORING"] },
    },
    orderBy: { requestedAt: "desc" },
    select: { status: true, requestedAt: true, fileCount: true },
  });

  return NextResponse.json({
    restoreStatus: activeRestore
      ? {
          status: activeRestore.status,
          requestedAt: activeRestore.requestedAt.toISOString(),
          fileCount: activeRestore.fileCount,
        }
      : null,
  });
}
