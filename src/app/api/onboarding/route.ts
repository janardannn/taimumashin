import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { onboardingSchema } from "@/lib/validations/onboarding";
import { assumeRole } from "@/lib/aws";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";

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

  // Validate: can we assume the role?
  let creds;
  try {
    creds = await assumeRole(roleArn, session.user.id);
  } catch {
    return NextResponse.json(
      { error: "Failed to assume IAM role. Check the Role ARN and trust policy." },
      { status: 400 }
    );
  }

  // Validate: can we access the bucket?
  try {
    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      },
    });

    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch {
    return NextResponse.json(
      { error: "Cannot access the S3 bucket. Check the bucket name, region, and IAM permissions." },
      { status: 400 }
    );
  }

  // Save to user record
  const prisma = await getPrisma();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { roleArn, bucketName, region },
  });

  return NextResponse.json({ success: true });
}
