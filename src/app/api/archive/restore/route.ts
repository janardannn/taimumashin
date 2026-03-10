import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserS3Config } from "@/lib/user-config";
import { getPrisma } from "@/lib/db";
import { restoreObject, headObject } from "@/lib/s3-operations";
import { getS3Client } from "@/lib/s3";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getUserS3Config();
  if (!result) {
    return NextResponse.json({ error: "AWS not configured. Set your bucket in Settings." }, { status: 400 });
  }

  const { config } = result;
  const prisma = await getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { restoreDays: true },
  });

  const days = user?.restoreDays || 7;
  const body = await req.json();
  const { folderPath, key } = body;

  try {
    if (key) {
      let fileSize = BigInt(0);
      try {
        const head = await headObject(config, key);
        fileSize = BigInt(head.ContentLength || 0);
      } catch {
        // proceed without size
      }

      await restoreObject(config, key, days);

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

      return NextResponse.json({ success: true, restored: 1 });
    }

    if (folderPath !== undefined) {
      const prefix = folderPath
        ? (folderPath.startsWith("originals/") ? folderPath : `originals/${folderPath}/`)
        : "originals/";

      // Recursive listing (no delimiter) to find ALL files under this prefix
      const client = getS3Client(config.region);
      let token: string | undefined;
      let restored = 0;
      let skipped = 0;
      let totalSize = BigInt(0);

      do {
        const listing = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucketName,
            Prefix: prefix,
            ContinuationToken: token,
          })
        );

        for (const obj of listing.Contents || []) {
          if (obj.Key!.endsWith("/")) continue;

          // Try restore on any non-STANDARD file
          // StorageClass may report differently depending on lifecycle timing
          try {
            await restoreObject(config, obj.Key!, days);
            restored++;
            totalSize += BigInt(obj.Size || 0);
          } catch {
            // Already restoring, not in Glacier, or standard — skip
            skipped++;
          }
        }

        token = listing.NextContinuationToken;
      } while (token);

      await prisma.restoreJob.create({
        data: {
          userId: session.user.id,
          folderPath: folderPath || "/",
          status: "RESTORING",
          fileCount: restored,
          totalSize,
        },
      });

      return NextResponse.json({ success: true, restored, skipped });
    }

    return NextResponse.json({ error: "Provide key or folderPath" }, { status: 400 });
  } catch (err) {
    console.error("Restore error:", err);
    const message = err instanceof Error ? err.message : "Restore failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
