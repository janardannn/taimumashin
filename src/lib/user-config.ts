import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import type { S3Config } from "@/lib/s3-operations";

/**
 * Get S3 config for the current user.
 * Reads roleArn/bucketName/region from user's DB record.
 */
export async function getUserS3Config(): Promise<{
  config: S3Config;
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      roleArn: true,
      bucketName: true,
      region: true,
    },
  });

  if (!user) return null;

  const roleArn = user.roleArn;
  const bucketName = user.bucketName;
  const region = user.region || "ap-south-1";

  if (!roleArn || !bucketName) return null;

  return {
    config: { roleArn, userId: user.id, bucketName, region },
    user,
  };
}
