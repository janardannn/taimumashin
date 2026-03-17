import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { getFileType } from "@/lib/file-utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { key, size, contentType, originalDate } = body;

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const prisma = await getPrisma();

  // Extract file name and folder path from S3 key
  // key format: originals/some/path/file.jpg
  const withoutPrefix = key.replace(/^originals\//, "");
  const parts = withoutPrefix.split("/");
  const name = parts.pop()!;
  const folderPath = parts.join("/") || "/";

  const previewKey = key.replace(/^originals\//, "previews/");
  const fileType = getFileType(name);

  await prisma.file.create({
    data: {
      userId: session.user.id,
      name,
      s3Key: key,
      previewKey: fileType === "image" ? previewKey : null,
      size: BigInt(size || 0),
      type: contentType || "application/octet-stream",
      folderPath,
      originalDate: originalDate ? new Date(originalDate) : null,
    },
  });

  return NextResponse.json({ success: true });
}
