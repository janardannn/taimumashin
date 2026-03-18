import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { onboardingSchema } from "@/lib/validations/onboarding";

// Returns OIDC issuer URL and webhook URL for CloudFormation parameters
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3333");

  return NextResponse.json({
    issuerUrl: appUrl,
    webhookUrl: `${appUrl}/api/webhooks/restore-complete`,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = onboardingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { roleArn, bucketName, region } = parsed.data;

  const prisma = await getPrisma();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { roleArn, bucketName, region },
  });

  return NextResponse.json({ success: true });
}
