import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserS3Config } from "@/lib/user-config";
import { headObject, generatePresignedGetUrl } from "@/lib/s3-operations";

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
  const key = decodeURIComponent(req.nextUrl.searchParams.get("key") || "");

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  try {
    // Check if the object is accessible (not in Glacier or has been restored)
    const head = await headObject(config, key);

    // If in Glacier and not restored, return no URL
    const storageClass = head.StorageClass;
    const restore = head.Restore;

    if (
      (storageClass === "DEEP_ARCHIVE" || storageClass === "GLACIER") &&
      (!restore || !restore.includes('ongoing-request="false"'))
    ) {
      // Not available — try preview instead
      const previewKey = key.replace(/^originals\//, "previews/");
      try {
        const previewUrl = await generatePresignedGetUrl(config, previewKey);
        return NextResponse.json({ url: previewUrl, source: "preview" });
      } catch {
        return NextResponse.json({ url: null, source: null });
      }
    }

    // Object is available (restored or standard storage)
    const url = await generatePresignedGetUrl(config, key);
    return NextResponse.json({ url, source: "original" });
  } catch (err) {
    // Object doesn't exist — try preview
    const previewKey = key.replace(/^originals\//, "previews/");
    try {
      const previewUrl = await generatePresignedGetUrl(config, previewKey);
      return NextResponse.json({ url: previewUrl, source: "preview" });
    } catch {
      console.error("View error:", err);
      return NextResponse.json({ url: null, source: null });
    }
  }
}
