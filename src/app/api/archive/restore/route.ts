import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { listObjects, restoreObject, headObject } from "@/lib/s3-operations";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { roleArn: true, bucketName: true, region: true, restoreDays: true },
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

  const days = user.restoreDays || 7;

  if (key) {
    // Restore a single file — get its size first
    let fileSize = BigInt(0);
    try {
      const head = await headObject(config, key);
      fileSize = BigInt(head.ContentLength || 0);
    } catch {
      // proceed without size
    }

    await restoreObject(config, key, days);

    // Track single-file restore
    const fileFolderPath = key.replace(/^originals\//, "").replace(/\/[^/]+$/, "") || "/";
    await prisma.restoreJob.create({
      data: {
        userId: session.user.id,
        folderPath: fileFolderPath,
        status: "RESTORING",
        fileCount: 1,
        totalSize: fileSize,
      },
    });

    return NextResponse.json({ success: true, restored: 1, totalSize: fileSize.toString() });
  }

  if (folderPath) {
    // Restore all files in folder — track sizes
    const prefix = folderPath.startsWith("originals/") ? folderPath : `originals/${folderPath}`;

    // Paginate through all files in the folder
    let continuationToken: string | undefined;
    let restored = 0;
    let totalSize = BigInt(0);

    do {
      const result = await listObjects(config, prefix, continuationToken);
      const files = (result.Contents || []).filter((obj) => obj.Key !== prefix);

      for (const file of files) {
        try {
          await restoreObject(config, file.Key!, days);
          restored++;
          totalSize += BigInt(file.Size || 0);
        } catch {
          // File might already be restoring or not in Glacier
        }
      }

      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken);

    // Track restore job with actual size data
    await prisma.restoreJob.create({
      data: {
        userId: session.user.id,
        folderPath,
        status: "RESTORING",
        fileCount: restored,
        totalSize,
      },
    });

    return NextResponse.json({ success: true, restored, totalSize: totalSize.toString() });
  }

  return NextResponse.json({ error: "Provide key or folderPath" }, { status: 400 });
}
