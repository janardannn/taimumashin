import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

// Batch update DB records after client-side S3 copy+delete.
// Accepts an array of moves: [{ oldKey, newKey, oldPreviewKey?, newPreviewKey?, newFolderPath, newName }]
export async function POST(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Invalid Content-Type" }, { status: 415 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { moves, folderMoves } = await req.json();

  const prisma = await getPrisma();
  let updated = 0;

  // Update file records
  if (Array.isArray(moves)) {
    for (const move of moves) {
      const { oldKey, newKey, newPreviewKey, newFolderPath, newName } = move;
      if (!oldKey || !newKey) continue;

      const result = await prisma.file.updateMany({
        where: {
          userId: session.user.id,
          s3Key: oldKey,
        },
        data: {
          s3Key: newKey,
          previewKey: newPreviewKey || null,
          folderPath: newFolderPath,
          name: newName,
        },
      });
      updated += result.count;
    }
  }

  // Update folder records — repath the moved folder and all descendants
  if (Array.isArray(folderMoves)) {
    for (const fm of folderMoves) {
      const { oldPath, newPath } = fm;
      if (!oldPath || !newPath) continue;

      // Update the folder itself
      await prisma.folder.updateMany({
        where: { userId: session.user.id, path: oldPath },
        data: { path: newPath, name: newPath.split("/").pop() || newPath },
      });

      // Update all descendant folders (path starts with oldPath/)
      const descendants = await prisma.folder.findMany({
        where: { userId: session.user.id, path: { startsWith: `${oldPath}/` } },
        select: { id: true, path: true },
      });

      for (const desc of descendants) {
        const updatedPath = newPath + desc.path.slice(oldPath.length);
        await prisma.folder.update({
          where: { id: desc.id },
          data: { path: updatedPath, name: updatedPath.split("/").pop() || updatedPath },
        });
      }
    }
  }

  return NextResponse.json({ success: true, updated });
}
