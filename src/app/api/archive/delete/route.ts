import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserS3Config } from "@/lib/user-config";
import { deleteObject } from "@/lib/s3-operations";
import { getS3Client } from "@/lib/s3";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getUserS3Config();
  if (!result) {
    return NextResponse.json({ error: "AWS not configured" }, { status: 400 });
  }

  const { config } = result;
  const body = await req.json();
  const { key, prefix } = body;

  try {
    // Delete a single file
    if (key) {
      await deleteObject(config, key);

      // Delete preview too
      const previewKey = key.replace(/^originals\//, "previews/");
      try {
        await deleteObject(config, previewKey);
      } catch {
        // Preview might not exist
      }

      return NextResponse.json({ success: true, deleted: 1 });
    }

    // Delete a folder (all objects under prefix)
    if (prefix) {
      const client = await getS3Client(config.roleArn, config.userId, config.region);
      let token: string | undefined;
      let deleted = 0;

      do {
        const listing = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucketName,
            Prefix: prefix,
            ContinuationToken: token,
          })
        );

        for (const obj of listing.Contents || []) {
          await deleteObject(config, obj.Key!);

          // Delete corresponding preview
          const previewKey = obj.Key!.replace(/^originals\//, "previews/");
          try {
            await deleteObject(config, previewKey);
          } catch {
            // Preview might not exist
          }

          deleted++;
        }

        token = listing.NextContinuationToken;
      } while (token);

      return NextResponse.json({ success: true, deleted });
    }

    return NextResponse.json({ error: "Provide key or prefix" }, { status: 400 });
  } catch (err) {
    console.error("Delete error:", err);
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
