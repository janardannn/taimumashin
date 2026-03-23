import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

// DB-only: S3 deletions are handled client-side via useS3 hook
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
  const { key, prefix } = body;

  try {
    if (key) {
      await prisma.file.deleteMany({
        where: { userId: session.user.id, s3Key: key },
      });

      return NextResponse.json({ success: true });
    }

    if (prefix) {
      const folderPath = prefix.replace(/^(originals|instant)\//, "").replace(/\/$/, "");

      await prisma.file.deleteMany({
        where: { userId: session.user.id, s3Key: { startsWith: prefix } },
      });
      await prisma.folder.deleteMany({
        where: {
          userId: session.user.id,
          OR: [
            { path: folderPath },
            { path: { startsWith: `${folderPath}/` } },
          ],
        },
      });
      await prisma.restoreJob.deleteMany({
        where: {
          userId: session.user.id,
          OR: [
            { folderPath },
            { folderPath: { startsWith: `${folderPath}/` } },
          ],
        },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Provide key or prefix" }, { status: 400 });
  } catch (err) {
    console.error("Delete error:", err);
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
