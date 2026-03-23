import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { cookies } from "next/headers";
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { STSClient, AssumeRoleWithWebIdentityCommand } from "@aws-sdk/client-sts";
import { sanitizeFilename } from "@/lib/file-utils";

const NON_ASCII = /[^\x20-\x7E]/;

function sanitizeKey(key: string): string {
  // Preserve the prefix (originals/, instant/, previews/) and sanitize each path segment
  const parts = key.split("/");
  return parts.map((p, i) => (i === 0 ? p : sanitizeFilename(p))).join("/");
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { roleArn: true, bucketName: true, region: true },
  });

  if (!user?.roleArn || !user?.bucketName) {
    return NextResponse.json({ error: "AWS not configured" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const jwt =
    cookieStore.get("__Secure-authjs.session-token")?.value ||
    cookieStore.get("authjs.session-token")?.value ||
    "";

  if (!jwt) {
    return NextResponse.json({ error: "No session token" }, { status: 401 });
  }

  // STS → temporary S3 credentials
  const region = user.region || "ap-south-1";
  const sts = new STSClient({ region });
  const stsRes = await sts.send(
    new AssumeRoleWithWebIdentityCommand({
      RoleArn: user.roleArn,
      RoleSessionName: `sanitize-${Date.now()}`,
      WebIdentityToken: jwt,
      DurationSeconds: 3600,
    })
  );

  if (!stsRes.Credentials) {
    return NextResponse.json({ error: "STS returned no credentials" }, { status: 500 });
  }

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: stsRes.Credentials.AccessKeyId!,
      secretAccessKey: stsRes.Credentials.SecretAccessKey!,
      sessionToken: stsRes.Credentials.SessionToken!,
    },
  });

  const bucket = user.bucketName;

  // Find files with non-ASCII in their s3Key or name
  const allFiles = await prisma.file.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, s3Key: true, previewKey: true },
  });

  const dirty = allFiles.filter(
    (f) => NON_ASCII.test(f.s3Key) || NON_ASCII.test(f.name) || (f.previewKey && NON_ASCII.test(f.previewKey))
  );

  if (dirty.length === 0) {
    return NextResponse.json({ message: "No files need sanitization", fixed: 0 });
  }

  const results: { id: string; oldKey: string; newKey: string; status: string }[] = [];

  for (const file of dirty) {
    const newKey = sanitizeKey(file.s3Key);
    const newName = sanitizeFilename(file.name);
    const newPreviewKey = file.previewKey ? sanitizeKey(file.previewKey) : null;

    try {
      // Copy + delete original
      if (newKey !== file.s3Key) {
        await s3.send(new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${file.s3Key}`,
          Key: newKey,
        }));
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.s3Key }));
      }

      // Copy + delete preview
      if (file.previewKey && newPreviewKey && newPreviewKey !== file.previewKey) {
        try {
          await s3.send(new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${file.previewKey}`,
            Key: newPreviewKey,
          }));
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.previewKey }));
        } catch {
          // Preview may not exist — that's fine
        }
      }

      // Update DB
      await prisma.file.update({
        where: { id: file.id },
        data: {
          name: newName,
          s3Key: newKey,
          ...(newPreviewKey ? { previewKey: newPreviewKey } : {}),
        },
      });

      results.push({ id: file.id, oldKey: file.s3Key, newKey, status: "fixed" });
    } catch (err) {
      results.push({
        id: file.id,
        oldKey: file.s3Key,
        newKey,
        status: `error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  return NextResponse.json({
    message: `Processed ${dirty.length} files`,
    fixed: results.filter((r) => r.status === "fixed").length,
    errors: results.filter((r) => r.status !== "fixed").length,
    results,
  });
}
