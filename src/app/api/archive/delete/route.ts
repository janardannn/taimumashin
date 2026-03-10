import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { deleteObject } from "@/lib/s3-operations";

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
  const { key } = body;

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const config = {
    roleArn: user.roleArn,
    userId: session.user.id,
    bucketName: user.bucketName,
    region: user.region,
  };

  // Delete original
  await deleteObject(config, key);

  // Delete preview (originals/ -> previews/)
  const previewKey = key.replace(/^originals\//, "previews/");
  try {
    await deleteObject(config, previewKey);
  } catch {
    // Preview might not exist
  }

  // Delete from Neon
  await prisma.file.deleteMany({
    where: { userId: session.user.id, s3Key: key },
  });

  return NextResponse.json({ success: true });
}
