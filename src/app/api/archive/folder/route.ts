import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

// DB-only: S3 marker object creation is handled client-side via useS3 hook
export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Invalid Content-Type" }, { status: 415 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, parentPath } = body;

  if (!name) {
    return NextResponse.json({ error: "Folder name required" }, { status: 400 });
  }

  let decodedParent: string;
  let decodedName: string;
  try {
    decodedParent = parentPath ? decodeURIComponent(parentPath) : "";
    decodedName = decodeURIComponent(name);
  } catch {
    return NextResponse.json({ error: "Invalid path encoding" }, { status: 400 });
  }
  const folderPath = decodedParent ? `${decodedParent}/${decodedName}` : decodedName;

  try {
    const prisma = await getPrisma();
    await prisma.folder.upsert({
      where: {
        userId_path: { userId: session.user.id, path: folderPath },
      },
      update: {},
      create: {
        userId: session.user.id,
        name: decodedName,
        path: folderPath,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Folder create error:", err);
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}
