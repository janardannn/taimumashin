import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserS3Config } from "@/lib/user-config";
import { getPrisma } from "@/lib/db";
import { listObjects, generatePresignedGetUrl, headObject } from "@/lib/s3-operations";
import { getS3Client } from "@/lib/s3";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getUserS3Config();
  if (!result) {
    return NextResponse.json({ error: "AWS not configured" }, { status: 400 });
  }

  const { config } = result;
  // Decode to ensure literal characters in S3 keys
  const rawPrefix = req.nextUrl.searchParams.get("prefix") || "originals/";
  const prefix = decodeURIComponent(rawPrefix);

  try {
    const listing = await listObjects(config, prefix);

    // Get folder dates by HeadObject on marker keys
    const folders = await Promise.all(
      (listing.CommonPrefixes || []).map(async (p) => {
        let lastModified: string | null = null;
        try {
          const head = await headObject(config, p.Prefix!);
          if (head.LastModified) {
            lastModified = head.LastModified.toISOString();
          }
        } catch {
          // Marker object might not exist (implicit prefix)
        }
        return {
          prefix: p.Prefix!,
          name: p.Prefix!.replace(prefix, "").replace(/\/$/, ""),
          lastModified,
        };
      })
    );

    const files = await Promise.all(
      (listing.Contents || [])
        .filter((obj) => obj.Key !== prefix && !obj.Key!.endsWith("/"))
        .map(async (obj) => {
          const key = obj.Key!;
          const name = key.split("/").pop()!;
          const previewKey = key.replace(/^originals\//, "previews/");

          let previewUrl: string | null = null;
          try {
            previewUrl = await generatePresignedGetUrl(config, previewKey);
          } catch {
            // No preview exists
          }

          // Prefer original file date from metadata over S3 upload timestamp
          let lastModified = obj.LastModified?.toISOString() || null;
          try {
            const head = await headObject(config, key);
            const originalDate = head.Metadata?.["original-last-modified"];
            if (originalDate) {
              lastModified = originalDate;
            }
          } catch {
            // HeadObject failed — use S3 LastModified
          }

          return {
            key,
            name,
            size: obj.Size || 0,
            lastModified,
            storageClass: obj.StorageClass || "STANDARD",
            previewUrl,
          };
        })
    );

    // Recursive stats
    const client = getS3Client(config.region);
    let totalFiles = 0;
    let totalSize = 0;
    let archivedCount = 0;
    let token: string | undefined;

    do {
      const recursive = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucketName,
          Prefix: prefix,
          ContinuationToken: token,
        })
      );

      for (const obj of recursive.Contents || []) {
        if (obj.Key!.endsWith("/")) continue;
        totalFiles++;
        totalSize += obj.Size || 0;
        if (obj.StorageClass === "DEEP_ARCHIVE" || obj.StorageClass === "GLACIER") {
          archivedCount++;
        }
      }

      token = recursive.NextContinuationToken;
    } while (token);

    // Check for active restore jobs on this folder or any parent folder
    // e.g. if viewing "photos/2024", also check "photos" and "/"
    const folderPath = prefix.replace(/^originals\//, "").replace(/\/$/, "");
    const pathsToCheck = [folderPath || "/"];
    const parts = folderPath.split("/").filter(Boolean);
    for (let i = parts.length - 1; i > 0; i--) {
      pathsToCheck.push(parts.slice(0, i).join("/"));
    }
    if (folderPath) pathsToCheck.push("/");

    const prisma = await getPrisma();
    const activeRestore = await prisma.restoreJob.findFirst({
      where: {
        userId: session.user.id,
        folderPath: { in: pathsToCheck },
        status: { in: ["PENDING", "RESTORING"] },
      },
      orderBy: { requestedAt: "desc" },
      select: { status: true, requestedAt: true, fileCount: true, folderPath: true },
    });

    return NextResponse.json({
      folders,
      files,
      stats: {
        totalFiles,
        totalSize,
        archivedCount,
        availableCount: totalFiles - archivedCount,
      },
      restoreStatus: activeRestore
        ? {
            status: activeRestore.status,
            requestedAt: activeRestore.requestedAt.toISOString(),
            fileCount: activeRestore.fileCount,
          }
        : null,
      isTruncated: listing.IsTruncated || false,
      nextToken: listing.NextContinuationToken || null,
    });
  } catch (err) {
    console.error("S3 list error:", err);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}
