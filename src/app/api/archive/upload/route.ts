import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { generatePresignedPutUrl, generatePresignedPutUrlStandard } from "@/lib/s3-operations";
import { getFileType } from "@/lib/file-utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { roleArn: true, bucketName: true, region: true },
  });

  if (!user?.roleArn || !user?.bucketName || !user?.region) {
    return NextResponse.json({ error: "AWS not configured" }, { status: 400 });
  }

  const body = await req.json();
  const { fileName, contentType, folderPath } = body;

  if (!fileName || !contentType) {
    return NextResponse.json({ error: "Missing fileName or contentType" }, { status: 400 });
  }

  const key = `originals/${folderPath ? folderPath + "/" : ""}${fileName}`;

  const config = {
    roleArn: user.roleArn,
    userId: session.user.id,
    bucketName: user.bucketName,
    region: user.region,
  };

  const url = await generatePresignedPutUrl(config, key, contentType);

  // For image files, also generate a presigned URL for the preview thumbnail
  let previewUrl: string | null = null;
  let previewKey: string | null = null;
  if (getFileType(fileName) === "image") {
    previewKey = key.replace(/^originals\//, "previews/");
    // Preview is stored in S3 Standard (not Deep Archive), content type may be webp or jpeg
    previewUrl = await generatePresignedPutUrlStandard(config, previewKey, "image/webp");
  }

  return NextResponse.json({ url, key, previewUrl, previewKey });
}
