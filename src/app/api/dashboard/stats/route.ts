import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prisma = await getPrisma();
    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { region: true },
    });

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [fileStats, folderCount, activeRestores, monthlyRestores, recentRestores] = await Promise.all([
      prisma.file.aggregate({
        where: { userId },
        _count: true,
        _sum: { size: true, previewSize: true },
      }),
      prisma.folder.count({ where: { userId } }),
      prisma.restoreJob.count({
        where: { userId, status: "RESTORING" },
      }),
      prisma.restoreJob.aggregate({
        where: {
          userId,
          requestedAt: { gte: startOfMonth },
        },
        _count: true,
        _sum: { totalSize: true, estimatedCost: true },
      }),
      prisma.restoreJob.findMany({
        where: { userId },
        orderBy: { requestedAt: "desc" },
        take: 10,
        select: {
          id: true, folderPath: true, status: true, tier: true, fileCount: true, totalSize: true,
          estimatedCost: true, requestedAt: true, restoredAt: true, expiresAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      totalFiles: fileStats._count,
      totalFolders: folderCount,
      totalSize: Number(fileStats._sum.size || 0),
      totalPreviewSize: Number(fileStats._sum.previewSize || 0),
      activeRestores,
      restoresThisMonth: monthlyRestores._count,
      dataRestoredThisMonth: Number(monthlyRestores._sum.totalSize || 0),
      retrievalCostThisMonth: monthlyRestores._sum.estimatedCost || 0,
      region: user?.region || "ap-south-1",
      recentRestores,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
