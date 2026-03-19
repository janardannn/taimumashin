import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { getFileType } from "@/lib/file-utils";

function safeBigInt(val: unknown): bigint {
  try {
    return BigInt(val || 0);
  } catch {
    return BigInt(0);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { key, size, contentType, originalDate, previewSize } = body;

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const prisma = await getPrisma();

  // Extract file name and folder path from S3 key
  // key format: originals/some/path/file.jpg or instant/some/path/file.jpg
  const isInstant = key.startsWith("instant/");
  const withoutPrefix = key.replace(/^(originals|instant)\//, "");
  const parts = withoutPrefix.split("/");
  const name = parts.pop()!;
  const rawFolderPath = parts.join("/");
  // For instant files, keep "instant/..." prefix in folderPath to match browse query
  const folderPath = isInstant
    ? (rawFolderPath ? `instant/${rawFolderPath}` : "instant")
    : (rawFolderPath || "/");

  const previewKey = isInstant ? null : key.replace(/^originals\//, "previews/");
  const fileType = getFileType(name);

  // Auto-create any missing folder records in the path hierarchy
  // e.g. folderPath "photos/vacation" needs folders: "photos" and "photos/vacation"
  if (folderPath !== "/" && folderPath !== "instant") {
    const pathParts = folderPath.split("/");
    // For instant paths like "instant/photos/vacation", skip the "instant" prefix for hierarchy
    const startIdx = isInstant ? 1 : 0;
    for (let i = startIdx; i < pathParts.length; i++) {
      const ancestorPath = pathParts.slice(0, i + 1).join("/");
      const folderName = pathParts[i];
      await prisma.folder.upsert({
        where: {
          userId_path: { userId: session.user.id, path: ancestorPath },
        },
        update: {},
        create: {
          userId: session.user.id,
          name: folderName,
          path: ancestorPath,
        },
      });
    }
  }

  await prisma.file.create({
    data: {
      userId: session.user.id,
      name,
      s3Key: key,
      previewKey: fileType === "image" ? previewKey : null,
      size: safeBigInt(size),
      type: contentType || "application/octet-stream",
      folderPath,
      originalDate: originalDate ? new Date(originalDate) : null,
      previewSize: previewSize ? safeBigInt(previewSize) : null,
    },
  });

  return NextResponse.json({ success: true });
}
