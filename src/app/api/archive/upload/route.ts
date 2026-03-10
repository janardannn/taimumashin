import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserS3Config } from "@/lib/user-config";
import { generatePresignedPutUrl, generatePresignedPutUrlStandard } from "@/lib/s3-operations";
import { getFileType } from "@/lib/file-utils";

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
  const { fileName, contentType, folderPath, lastModified } = body;

  if (!fileName || !contentType) {
    return NextResponse.json({ error: "Missing fileName or contentType" }, { status: 400 });
  }

  // Decode to ensure literal characters in S3 keys, not URL-encoded
  const decodedFolder = folderPath ? decodeURIComponent(folderPath) : "";
  const key = `originals/${decodedFolder ? decodedFolder + "/" : ""}${fileName}`;

  // Preserve original file metadata
  const metadata: Record<string, string> = {};
  if (lastModified) {
    metadata["original-last-modified"] = new Date(lastModified).toISOString();
  }

  try {
    const url = await generatePresignedPutUrl(config, key, contentType, Object.keys(metadata).length > 0 ? metadata : undefined);

    let previewUrl: string | null = null;
    if (getFileType(fileName) === "image") {
      const previewKey = key.replace(/^originals\//, "previews/");
      previewUrl = await generatePresignedPutUrlStandard(config, previewKey, "image/webp");
    }

    // Return metadata as headers the client must send with the PUT
    const metaHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata)) {
      metaHeaders[`x-amz-meta-${k}`] = v;
    }

    return NextResponse.json({ url, key, previewUrl, metaHeaders });
  } catch (err) {
    console.error("Upload presign error:", err);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
