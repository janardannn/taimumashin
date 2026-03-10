import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { getS3Client } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";

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
  const { name, parentPath } = body;

  if (!name) {
    return NextResponse.json({ error: "Folder name required" }, { status: 400 });
  }

  const path = `originals/${parentPath ? parentPath + "/" : ""}${name}/`;

  const client = await getS3Client(user.roleArn, session.user.id, user.region);
  await client.send(
    new PutObjectCommand({
      Bucket: user.bucketName,
      Key: path,
      Body: "",
    })
  );

  // Save to Neon
  const folderPath = `${parentPath ? parentPath + "/" : ""}${name}`;
  await prisma.folder.upsert({
    where: {
      userId_path: { userId: session.user.id, path: folderPath },
    },
    update: {},
    create: {
      userId: session.user.id,
      name,
      path: folderPath,
    },
  });

  return NextResponse.json({ success: true, path });
}
