import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawPath = req.nextUrl.searchParams.get("path") || "";
  const decodedPath = decodeURIComponent(rawPath);
  const isInstant = decodedPath === "instant" || decodedPath.startsWith("instant/");

  // Normalize to DB folder path
  // originals root: "" or "/" -> folderPath = "/"
  // originals subfolder: "photos" -> folderPath = "photos"
  // instant root: "instant" -> folderPath = "instant"
  // instant subfolder: "instant/docs" -> folderPath = "instant/docs"
  const folderPath = decodedPath || "/";

  const prisma = await getPrisma();
  const userId = session.user.id;

  // 1. Direct child folders
  // parentId is never populated, so we use string matching on path
  const allFolders = await prisma.folder.findMany({
    where: {
      userId,
      ...(folderPath === "/"
        ? { NOT: { path: { contains: "/" } } }
        : { path: { startsWith: `${folderPath}/` } }),
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter to direct children only (no deeper nesting)
  const folders = allFolders.filter((f) => {
    if (folderPath === "/") {
      // Top-level: exclude instant folders when browsing originals
      return !f.path.includes("/") && !f.path.startsWith("instant");
    }
    const remainder = f.path.slice(folderPath.length + 1);
    return remainder.length > 0 && !remainder.includes("/");
  });

  // 2. Files at this exact folder path
  const files = await prisma.file.findMany({
    where: { userId, folderPath },
    orderBy: { originalDate: "desc" },
  });

  // 3. Recursive stats
  const statsResult = await prisma.file.aggregate({
    where: {
      userId,
      OR: [
        { folderPath },
        { folderPath: { startsWith: folderPath === "/" ? "" : `${folderPath}/` } },
      ],
    },
    _count: true,
    _sum: { size: true },
  });

  const totalFiles = statsResult._count;
  const totalSize = Number(statsResult._sum.size || 0);

  // 4. Restore status (reuse logic from /api/archive/status)
  let restoreStatus = null;
  if (!isInstant) {
    const statusPath = folderPath === "/" ? "/" : folderPath;
    const pathsToCheck = [statusPath];
    const parts = statusPath.split("/").filter(Boolean);
    for (let i = parts.length - 1; i > 0; i--) {
      pathsToCheck.push(parts.slice(0, i).join("/"));
    }
    if (statusPath !== "/") pathsToCheck.push("/");

    const activeRestore = await prisma.restoreJob.findFirst({
      where: {
        userId,
        folderPath: { in: pathsToCheck },
        status: { in: ["PENDING", "RESTORING"] },
      },
      orderBy: { requestedAt: "desc" },
      select: { status: true, requestedAt: true, fileCount: true },
    });

    if (activeRestore) {
      restoreStatus = {
        status: activeRestore.status,
        requestedAt: activeRestore.requestedAt.toISOString(),
        fileCount: activeRestore.fileCount,
      };
    }
  }

  return NextResponse.json({
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      path: f.path,
      createdAt: f.createdAt.toISOString(),
    })),
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      s3Key: f.s3Key,
      previewKey: f.previewKey,
      size: Number(f.size),
      type: f.type,
      originalDate: f.originalDate?.toISOString() || null,
      createdAt: f.createdAt.toISOString(),
    })),
    stats: {
      totalFiles,
      totalSize,
      archivedCount: isInstant ? 0 : totalFiles,
      availableCount: isInstant ? totalFiles : 0,
    },
    restoreStatus,
  });
}
