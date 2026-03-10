import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { listObjects, generatePresignedGetUrl } from "@/lib/s3-operations";

// Returns presigned GET URLs for all files in a folder (for client-side zip)
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
  const { folderPath, key } = body;

  const config = {
    roleArn: user.roleArn,
    userId: session.user.id,
    bucketName: user.bucketName,
    region: user.region,
  };

  // Single file download
  if (key) {
    const url = await generatePresignedGetUrl(config, key);
    return NextResponse.json({ files: [{ key, url }] });
  }

  // Folder download — return presigned URLs for all files
  if (folderPath) {
    const prefix = folderPath.startsWith("originals/") ? folderPath : `originals/${folderPath}`;
    const result = await listObjects(config, prefix);
    const contents = (result.Contents || []).filter((obj) => obj.Key !== prefix);

    const files = await Promise.all(
      contents.map(async (obj) => ({
        key: obj.Key!,
        name: obj.Key!.split("/").pop()!,
        url: await generatePresignedGetUrl(config, obj.Key!),
      }))
    );

    return NextResponse.json({ files });
  }

  return NextResponse.json({ error: "Provide key or folderPath" }, { status: 400 });
}
