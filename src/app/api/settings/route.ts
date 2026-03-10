import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      roleArn: true,
      bucketName: true,
      region: true,
      notificationEmail: true,
      restoreDays: true,
      previewQuality: true,
      previewDurationCap: true,
      lifecycleDays: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const prisma = await getPrisma();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      roleArn: body.roleArn || null,
      bucketName: body.bucketName || null,
      region: body.region || "ap-south-1",
      notificationEmail: body.notificationEmail || null,
      restoreDays: body.restoreDays ?? 7,
      previewQuality: body.previewQuality ?? "720p",
      previewDurationCap: body.previewDurationCap ?? 60,
      lifecycleDays: body.lifecycleDays ?? 7,
    },
  });

  return NextResponse.json({ success: true });
}
