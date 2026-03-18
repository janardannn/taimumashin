import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ files: [], folders: [] });
  }

  const prisma = await getPrisma();
  const userId = session.user.id;

  const [files, folders] = await Promise.all([
    prisma.file.findMany({
      where: {
        userId,
        name: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        s3Key: true,
        folderPath: true,
        size: true,
        type: true,
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.folder.findMany({
      where: {
        userId,
        name: { contains: q, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        path: true,
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    files: files.map((f) => ({
      ...f,
      size: Number(f.size),
    })),
    folders,
  });
}
