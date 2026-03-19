import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { settingsSchema } from "@/lib/validations/settings";

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
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Invalid Content-Type" }, { status: 415 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const prisma = await getPrisma();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      roleArn: parsed.data.roleArn || null,
      bucketName: parsed.data.bucketName || null,
      region: parsed.data.region || "ap-south-1",
      notificationEmail: parsed.data.notificationEmail || null,
      restoreDays: parsed.data.restoreDays ?? 7,
      previewQuality: parsed.data.previewQuality ?? "720p",
      previewDurationCap: parsed.data.previewDurationCap ?? 60,
      lifecycleDays: parsed.data.lifecycleDays ?? 7,
    },
  });

  return NextResponse.json({ success: true });
}
