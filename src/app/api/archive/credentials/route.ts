import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { cookies } from "next/headers";

// Returns the user's AWS config + raw JWT for client-side AssumeRoleWithWebIdentity
export async function GET() {
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

  // Read the raw JWT from the session cookie
  const cookieStore = await cookies();
  const jwt =
    cookieStore.get("__Secure-authjs.session-token")?.value ||
    cookieStore.get("authjs.session-token")?.value ||
    "";

  return NextResponse.json({
    roleArn: user.roleArn,
    bucketName: user.bucketName,
    region: user.region || "ap-south-1",
    jwt,
  });
}
