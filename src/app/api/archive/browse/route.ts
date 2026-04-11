import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawPath = req.nextUrl.searchParams.get("path") || "";
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return NextResponse.json({ error: "Invalid path encoding" }, { status: 400 });
  }
  const isInstant = decodedPath === "instant" || decodedPath.startsWith("instant/");

  // Normalize to DB folder path
  // originals root: "" or "/" -> folderPath = "/"
  // originals subfolder: "photos" -> folderPath = "photos"
  // instant root: "instant" -> folderPath = "instant"
  // instant subfolder: "instant/docs" -> folderPath = "instant/docs"
  const folderPath = decodedPath || "/";

  const prisma = await getPrisma();
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { region: true },
  });

  try {
  // 1. Direct child folders — from Folder table
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
  const explicitFolders = allFolders.filter((f) => {
    if (folderPath === "/") {
      return !f.path.includes("/") && !f.path.startsWith("instant");
    }
    const remainder = f.path.slice(folderPath.length + 1);
    return remainder.length > 0 && !remainder.includes("/");
  });

  // 2. Derive implicit folders from File.folderPath — catches folders
  //    created before upload/confirm auto-created folder records
  const childFiles = await prisma.file.findMany({
    where: {
      userId,
      ...(folderPath === "/"
        ? {
            NOT: [
              { folderPath: "/" },
              { folderPath: { startsWith: "instant" } },
            ],
          }
        : {
            folderPath: { startsWith: `${folderPath}/` },
            NOT: { folderPath },
          }),
    },
    select: { folderPath: true, createdAt: true },
  });

  // Extract the direct child folder name from each file's folderPath
  const implicitMap = new Map<string, { name: string; path: string; createdAt: Date }>();
  for (const f of childFiles) {
    const remainder = folderPath === "/"
      ? f.folderPath
      : f.folderPath.slice(folderPath.length + 1);
    const directChild = remainder.split("/")[0];
    if (!directChild) continue;
    const childPath = folderPath === "/" ? directChild : `${folderPath}/${directChild}`;
    if (!implicitMap.has(childPath)) {
      implicitMap.set(childPath, { name: directChild, path: childPath, createdAt: f.createdAt });
    }
  }

  // Merge explicit + implicit, deduplicating by path
  const explicitPaths = new Set(explicitFolders.map((f) => f.path));
  const folders = [
    ...explicitFolders,
    ...[...implicitMap.values()]
      .filter((f) => !explicitPaths.has(f.path))
      .map((f) => ({ id: `implicit-${f.path}`, name: f.name, path: f.path, createdAt: f.createdAt })),
  ];

  // 3. Files at this exact folder path
  const files = await prisma.file.findMany({
    where: { userId, folderPath },
    orderBy: [{ originalDate: "desc" }, { createdAt: "desc" }],
  });

  // 4. Recursive stats (exclude instant files when browsing originals root)
  const statsWhere = isInstant
    ? {
        userId,
        OR: [
          { folderPath },
          { folderPath: { startsWith: `${folderPath}/` } },
        ],
      }
    : folderPath === "/"
      ? {
          userId,
          NOT: { folderPath: { startsWith: "instant" } },
        }
      : {
          userId,
          OR: [
            { folderPath },
            { folderPath: { startsWith: `${folderPath}/` } },
          ],
        };

  const statsResult = await prisma.file.aggregate({
    where: statsWhere,
    _count: true,
    _sum: { size: true },
  });

  const totalFiles = statsResult._count;
  const totalSize = Number(statsResult._sum.size || 0);

  // 5. Active restore jobs (all PENDING/RESTORING for this path and ancestors)
  let restoreJobs: { id: string; status: string; requestedAt: string; fileCount: number; tier: string | null; keys: string[] }[] = [];
  if (!isInstant) {
    const statusPath = folderPath === "/" ? "/" : folderPath;
    const pathsToCheck = [statusPath];
    const parts = statusPath.split("/").filter(Boolean);
    for (let i = parts.length - 1; i > 0; i--) {
      pathsToCheck.push(parts.slice(0, i).join("/"));
    }
    if (statusPath !== "/") pathsToCheck.push("/");

    const activeRestores = await prisma.restoreJob.findMany({
      where: {
        userId,
        folderPath: { in: pathsToCheck },
        status: { in: ["PENDING", "RESTORING"] },
      },
      orderBy: { requestedAt: "desc" },
      select: { id: true, status: true, requestedAt: true, fileCount: true, tier: true, keys: true },
    });

    restoreJobs = activeRestores.map((r) => ({
      id: r.id,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      fileCount: r.fileCount,
      tier: r.tier,
      keys: Array.isArray(r.keys) ? r.keys as string[] : [],
    }));
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
    restoreJobs,
    region: user?.region || "us-east-1",
  });

  } catch (err) {
    console.error("Browse API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
