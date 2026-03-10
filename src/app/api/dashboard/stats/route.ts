import { NextResponse } from "next/server";
// import { auth } from "@/lib/auth";
// import { getPrisma } from "@/lib/db";

// TODO: Re-enable auth + DB queries after testing
export async function GET() {
  // const session = await auth();
  // if (!session?.user?.id) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }
  //
  // const prisma = await getPrisma();
  // const userId = session.user.id;
  //
  // const user = await prisma.user.findUnique({
  //   where: { id: userId },
  //   select: { region: true },
  // });
  //
  // const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  //
  // const [fileStats, folderCount, activeRestores, monthlyRestores, recentRestores] = await Promise.all([
  //   prisma.file.aggregate({
  //     where: { userId },
  //     _count: true,
  //     _sum: { size: true },
  //   }),
  //   prisma.folder.count({ where: { userId } }),
  //   prisma.restoreJob.count({
  //     where: { userId, status: "RESTORING" },
  //   }),
  //   // Restores completed OR initiated this month — sum their tracked sizes
  //   prisma.restoreJob.aggregate({
  //     where: {
  //       userId,
  //       requestedAt: { gte: startOfMonth },
  //     },
  //     _count: true,
  //     _sum: { totalSize: true },
  //   }),
  //   prisma.restoreJob.findMany({
  //     where: { userId },
  //     orderBy: { requestedAt: "desc" },
  //     take: 10,
  //     select: {
  //       id: true, folderPath: true, status: true, fileCount: true, totalSize: true,
  //       requestedAt: true, restoredAt: true, expiresAt: true,
  //     },
  //   }),
  // ]);
  //
  // return NextResponse.json({
  //   totalFiles: fileStats._count,
  //   totalFolders: folderCount,
  //   totalSize: Number(fileStats._sum.size || 0),
  //   activeRestores,
  //   restoresThisMonth: monthlyRestores._count,
  //   dataRestoredThisMonth: Number(monthlyRestores._sum.totalSize || 0),
  //   region: user?.region || "ap-south-1",
  //   recentRestores,
  // });

  // Mock data for testing
  return NextResponse.json({
    totalFiles: 0,
    totalFolders: 0,
    totalSize: 0,
    activeRestores: 0,
    restoresThisMonth: 0,
    dataRestoredThisMonth: 0,
    region: "ap-south-1",
    recentRestores: [],
  });
}
