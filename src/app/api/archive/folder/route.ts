import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserS3Config } from "@/lib/user-config";
import { getS3Client } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";

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
  const { name, parentPath } = body;

  if (!name) {
    return NextResponse.json({ error: "Folder name required" }, { status: 400 });
  }

  // Use literal characters in S3 keys, never URL-encoded
  const decodedParent = parentPath ? decodeURIComponent(parentPath) : "";
  const decodedName = decodeURIComponent(name);
  const path = `originals/${decodedParent ? decodedParent + "/" : ""}${decodedName}/`;

  try {
    const client = getS3Client(config.region);
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: path,
        Body: "",
      })
    );

    return NextResponse.json({ success: true, path });
  } catch (err) {
    console.error("Folder create error:", err);
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}
